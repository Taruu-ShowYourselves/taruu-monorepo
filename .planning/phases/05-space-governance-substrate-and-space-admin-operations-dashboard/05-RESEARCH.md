# Phase 5: Space governance substrate and space-admin operations dashboard - Research

**Researched:** 2026-08-02
**Domain:** Object-level authorization (BOLA prevention), Postgres governance schema (enum evolution, append-only audit, capability grants), governed notification fan-out, Next.js 15 App Router admin surface
**Confidence:** HIGH (codebase facts verified by reading; Postgres semantics verified empirically against the Supabase Postgres 17.6 image; Next.js authorization guidance verified against official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Space model — additive, wraps municipalities**

- New `spaces` table: uuid id, `type`, `slug`, geography, owner, verification state, plus a **nullable `municipality_code` FK** to `municipalities(code)`.
- Existing `municipality_id` columns on `users`, `votes`, and `treasury` stay untouched. No rewrite of three live tables, no churn in every repo that filters by municipality.
- This mirrors the strategy the municipalities migration itself used (NOT VALID foreign keys validated after a normalization pass, zero table rewrites) — see `supabase/migrations/20260728000001_municipalities.sql`.
- #74's org / urban-area / national space types become new `spaces` rows later, not a migration.

**Capabilities — per-action grants, roles as presets**

- `space_capability_grants(user_id, space_id, capability, granted_by, granted_at, suspended_at)`. **Default deny.**
- Roles are named capability bundles applied at grant time, not stored authority. There is no role column that confers power on its own, and no broad admin boolean anywhere — #75 requires explicit capabilities.
- Super-admin suspension is setting `suspended_at`, a single nullable column. Access dies; audit rows are never deleted. This is exactly the fourth acceptance criterion.
- Every capability check resolves server-side per request from the DB. The JWT stays as-is (`userId/googleId/did/email`) — no roles claim, so a stale token can never carry stale authority.

**Proposals — review states on `votes`**

- Extend `vote_status` with `draft | in_review | changes_requested | rejected` and gate publication behind approval.
- Today `initialStatus(start, now)` at `apps/web/src/server/app/votes/create-vote.ts:82` publishes with **no review gate at all**; `pending` currently means "scheduled, not started", not "awaiting approval". Planning must not conflate the two.
- One table, existing reads keep working, publication becomes the approved transition.
- **Requires a backfill** defaulting all existing rows to approved, and it touches the live create-vote path — call this out as a plan-level risk.

**Notifications — in-app + push**

- Persist an in-app notification row per recipient, then fan out to existing Expo push tokens via `activeTokensForUsers` in `apps/web/src/server/infra/supabase/push.repo.ts`.
- No email for v1. Resend is wired but email needs unsubscribe handling plus bounce/complaint tracking before an admin-authored surface can safely use it.
- Audience preview, quota, and opt-out are all enforced **server-side before any send** — the delivery log must prove that delivered recipients equal the previewed authorized audience.

### Claude's Discretion

- Capability vocabulary (the concrete list of action names) and which bundles constitute the shipped role presets.
- Audit table shape beyond the mandated columns (actor, timestamp, prior state, new state, reason, related object) and how immutability is enforced — RLS, revoke-UPDATE/DELETE grants, or trigger.
- Concurrency mechanism for deterministic conflicting decisions (conditional update on prior state vs advisory lock vs unique partial index).
- Dashboard information architecture and component composition within the press design system.

### Deferred Ideas (OUT OF SCOPE)

- Platform-wide (super-admin) moderation surface — issue #68, reuses this substrate.
- Non-municipal space types (organization, urban area, nationwide civic), discovery/join/leave flows, org profiles, space switcher — issue #74.
- Email as a notification channel — needs unsubscribe, bounce, and complaint handling first.
- Statistics dashboard in admin — issue #91.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SPACE-01 | Typed `spaces` table, nullable `municipality_code` FK, additive only | § Space Model — `municipalities.council_id`/`slug_he` already exist (mig `20260730000001`) and should seed `spaces.id`/`spaces.slug`; `20260728000001_municipalities.sql` is the NOT VALID → VALIDATE precedent; `spaces.municipality_code` needs a partial UNIQUE so one municipality maps to at most one space |
| SPACE-02 | Explicit per-action capability grants, default deny, resolved server-side every request, no roles in JWT | § Capability Vocabulary (12 capabilities, 5 presets, `granted_via_role` as provenance only); § Authorization Architecture (resolver in `server/app/space-admin/authorize.ts`, one indexed query per request) |
| SPACE-03 | Object-level authorization — swapped `spaceId` yields FORBIDDEN, no data disclosed | § Pattern 1 (branded `SpaceScope` token — repo functions structurally cannot be called with a raw id); § Pitfall 1 (service role bypasses RLS, so RLS cannot help); § Pitfall 2 (403-not-404 to avoid existence oracle); Next.js DAL guidance (layouts do not protect children) |
| SPACE-04 | Immutable audit rows: actor, timestamp, prior state, new state, reason, related object; reason required at API; never updatable/deletable | § Don't Hand-Roll + § Pattern 3 — REVOKE UPDATE/DELETE/TRUNCATE **plus** a `BEFORE UPDATE OR DELETE OR TRUNCATE` raising trigger; `ON DELETE RESTRICT` (not CASCADE) on every FK; zod `.trim().min(3)` + DB CHECK on `reason` |
| SPACE-05 | Review states on `vote_status`, publication gated, deterministic conflicting decisions, no self-review | § Pattern 2 (two-migration-file enum split — empirically proven mandatory); § Pattern 4 (conditional update on prior state, empirically proven; + partial unique index backstop); self-review guard is a pure domain function plus a `creator_id <> reviewer` predicate |
| SPACE-06 | Member/role management and content controls scoped to the administered space, each audited | § Pattern 1 (same `SpaceScope` token on every mutation repo); § Pattern 3 (audit write in the same use-case chain, before the success `map`) |
| SPACE-07 | Aggregates only for resident metrics; privacy-safe member fields; never raw identity documents | § Pattern 5 — copy `public_council_metrics()` (SECURITY DEFINER, fixed RETURNS TABLE, `search_path = ''`) and the `council.ts` contract allow-list; `identity_documents` must never be joined |
| SPACE-08 | Audience preview equals delivered set, opt-outs honored, per-space quota server-side, delivery log | § Pattern 6 (one `resolveAudience()` used by both endpoints + `audience_hash` re-verified at send); § Pitfall 5 (Upstash is unprovisioned — quota must be DB-counted, not `createRateLimiter`) |
| SPACE-09 | Super admin suspends a space admin immediately without deleting audit history | § Capability Vocabulary (`suspended_at IS NULL` predicate in the resolver query, JWT carries no authority so effect is immediate); § Pattern 3 (`ON DELETE RESTRICT` is what makes "without erasing history" structurally true) |
| SPACE-10 | Dashboard at `/he/space-admin/[spaceId]`, Hebrew/RTL, design tokens only, desktop + mobile | § Dashboard Information Architecture; press tokens are `--np-*` + `--space-*` + `--text-*`; no table primitive exists in `components/press/` — a `PressTable` is genuinely new work |
</phase_requirements>

---

## Summary

This phase is an authorization product built on a codebase whose entire server layer runs as the Supabase **service role**, which bypasses RLS by design. That single fact reorders everything: RLS cannot protect the admin surface, cannot make audit rows immutable, and cannot scope a space admin to their space. Every guarantee in SPACE-02 through SPACE-09 must be enforced in application types, in SQL predicates written by the application, and in table privileges plus triggers — never in RLS policies. RLS remains valuable only as a second wall against a leaked anon key.

The codebase already contains the four patterns this phase needs, and they should be extended rather than reinvented: the closed `AppError` union with an exhaustive `toHttp` switch (`server/http/errors.ts`) makes new failure modes a compile error rather than a silent 500; `markMerchOrderPaid`'s atomic `WHERE status='pending'` transition is the deterministic-concurrency answer; `public_council_metrics()` is the aggregate-only, SECURITY DEFINER, fixed-return-type precedent for SPACE-07; and `treasury-transaction-scoping.test.ts` is the exact test shape for proving that scoping lives in the SQL, not in a post-fetch filter. The one genuinely new type-level idea is a branded `SpaceScope` token minted only by the capability resolver and required as the first argument of every space-scoped repository function — that is what turns "someone forgot the check" from a runtime hole into a compile error, and it matches Next.js's own guidance that authorization belongs in a Data Access Layer rather than in a layout.

Two findings change the shape of the plan. First, the `vote_status` extension **cannot** be done in one migration file: verified empirically on the Supabase Postgres 17.6 image, `ALTER TYPE ... ADD VALUE` followed by any use of that value in the same transaction raises `unsafe use of new value` and rolls the whole transaction back, leaving the enum unchanged. It needs two files. Second, an adjacent role model already exists — `council_role_assignments` with `role = 'community_manager'` and `municipalities.council_id` (migration `20260730000001`, shipped four days ago). The plan must reconcile with it explicitly or the repo ends up with two contradictory notions of "who runs this place".

**Primary recommendation:** Mint a branded `SpaceScope` in one resolver, make every space-scoped repo function take it as its first parameter so a raw `spaceId` string is untypable at the data layer, extend `vote_status` across two migration files, enforce audit immutability with REVOKE + trigger (not RLS), decide proposals with a conditional `UPDATE ... WHERE status = <prior>`, and drive both the notification preview and the send from one `resolveAudience()` whose output hash is re-verified at send time.

---

## Standard Stack

No new runtime libraries. Everything below is already installed; the phase extends it.

### Core

| Library | Version (in repo) | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| `neverthrow` | `^8.2.0` (registry current: 8.2.0) | `ResultAsync<T, AppError>` for every use-case | Already the contract between `server/app/*` and `respond()`; registry-current, no upgrade needed |
| `zod` | `^3.23.0` (registry current: **4.4.3**) | Request contracts in `packages/shared/src/contracts/` | **Stay on v3.** Every existing contract and `parse()` in `respond.ts` depends on v3's `error.issues` shape. A v4 bump is a separate, breaking piece of work |
| `@supabase/supabase-js` | `^2.39.0` | PostgREST query builder via `supabaseAdmin` | Sole DB access path; service role |
| `next` | `^15.5.18` | App Router, `after()`, Server Components | Note: `CLAUDE.md` says "Next.js 17" — that is stale, the repo is on 15 |
| `vitest` | `^1.0.0` (registry current: 4.1.10) | Test runner | **Do not upgrade in this phase.** 55 existing test files depend on the v1 config surface |
| `expo-server-sdk` | `^3.9.0` | Push fan-out (`sendBatchNotifications`, chunks at 100) | Already wired in `services/notifications/expo.ts` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@upstash/ratelimit` / `@upstash/redis` | `^2.0.8` / `^1.36.1` | Burst limiting on compose/preview | Only as a cheap first gate — see Pitfall 5, Upstash is not provisioned so it must not be the quota of record |
| `jose` | `^5.2.0` | Session JWT | Unchanged — do **not** add a roles claim (SPACE-02) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Branded `SpaceScope` type | A type-aware ESLint rule ("repo call must be preceded by authorize") | `apps/web/eslint.config.mjs` has **no** `parserOptions.project`, so type-aware linting is not configured. Enabling it is a repo-wide change with its own CI cost. Types achieve the same guarantee with zero config |
| REVOKE + trigger for audit immutability | RLS policies only | **Rejected — does not work here.** `service_role` has `BYPASSRLS` and every server write uses it. RLS cannot stop the application from updating an audit row |
| Conditional `UPDATE ... WHERE status = <prior>` | `pg_advisory_xact_lock` | Rejected. Session-scoped advisory locks are unreliable through connection pooling, and the codebase already has a proven conditional-transition idiom (`markMerchOrderPaid`) |
| Separate `review_state` column | (Locked: extend `vote_status`) | Locked by CONTEXT decision 3. Noted only because migration `20250118000001` set the opposite precedent with `resolution_status TEXT` — the plan should say why it diverges |
| PostGIS for `spaces.geography` | JSONB / centroid + radius | No PostGIS extension exists (`uuid-ossp` and `pgcrypto` only). `verification_attempts.latitude DOUBLE PRECISION` is how geo is stored today. Use plain columns or JSONB; adding PostGIS is out of scope |

**Installation:** none. **But the worktree has no `node_modules`** — `/Users/saharbarak/personal/taruu-space-admin/node_modules` and `apps/web/node_modules` are both absent, so `pnpm test`/`typecheck` currently fail with `Command "vitest" not found`. Wave 0 must run:

```bash
pnpm install                              # at the worktree root
pnpm --filter @sync/web typecheck         # baseline must be green before any change
pnpm --filter @sync/web test              # baseline must be green before any change
```

---

## Architecture Patterns

### Recommended Project Structure

```
supabase/migrations/
├── 2026080200000A_spaces_and_capabilities.sql     # spaces, grants, audit log, RLS+REVOKE+trigger
├── 2026080200000B_vote_status_review_values.sql   # ALTER TYPE ADD VALUE only — NOTHING that uses them
├── 2026080200000C_vote_review_gating.sql          # indexes/CHECKs/queries that USE the new labels
└── 2026080200000D_space_notifications.sql         # campaigns, deliveries, user_notifications

packages/shared/src/contracts/
└── spaceAdmin.ts             # zod request/response shapes, re-exported from contracts/index.ts

apps/web/src/server/
├── domain/space/
│   ├── capability.ts         # PURE: capability vocabulary, role presets, expansion
│   ├── capability.test.ts
│   ├── review.ts             # PURE: legal transitions, self-review rule
│   └── review.test.ts
├── app/space-admin/
│   ├── authorize.ts          # the ONLY minter of SpaceScope
│   ├── list-proposals.ts
│   ├── decide-proposal.ts
│   ├── manage-grants.ts
│   ├── list-members.ts
│   ├── get-metrics.ts
│   ├── preview-audience.ts
│   ├── send-notification.ts
│   └── list-audit.ts
└── infra/supabase/
    ├── space.repo.ts         # every fn: (scope: SpaceScope, ...) — never a raw spaceId
    ├── space-audit.repo.ts   # insert ONLY; module exports no update/delete
    └── space-notify.repo.ts

apps/web/src/app/api/space-admin/[spaceId]/
├── proposals/route.ts
├── proposals/[voteId]/decide/route.ts
├── members/route.ts
├── grants/route.ts
├── metrics/route.ts
├── notifications/preview/route.ts
├── notifications/send/route.ts
└── audit/route.ts

apps/web/src/app/[locale]/space-admin/[spaceId]/
├── page.tsx  proposals/  members/  content/  metrics/  notifications/  audit/
```

### Pattern 1: Branded `SpaceScope` — the object-level authorization gate

**What:** A phantom-typed capability token, constructible only inside `authorize.ts`, that carries the resolved scoping keys. Every space-scoped repository function takes it as parameter one and derives the scope from it, so a URL-supplied `spaceId` string can never reach a query.

**When to use:** Every read and every mutation in `server/infra/supabase/space*.repo.ts`, and every Server Component that renders space data.

**Why this shape:** Next.js's official guidance is explicit that a layout is not a security boundary — "Avoid performing authentication checks directly in Layouts because they do not re-render on navigation… layouts do not prevent nested route segments or parallel route slots from rendering. Instead, perform authorization checks close to the data source or within a dedicated Data Access Layer." Here the DAL is `server/infra/supabase/*`, and the brand makes the DAL structurally refuse an unauthorized call.

```ts
// server/domain/space/capability.ts  (pure)
export const CAPABILITIES = [
  'space.read', 'space.update',
  'proposal.read', 'proposal.decide',
  'member.read', 'member.manage',
  'grant.manage',
  'content.moderate',
  'metrics.read',
  'notification.compose', 'notification.send',
  'audit.read',
] as const;
export type Capability = (typeof CAPABILITIES)[number];

// server/app/space-admin/authorize.ts  — the ONLY minter
declare const SpaceScopeBrand: unique symbol;

export interface SpaceScope {
  readonly [SpaceScopeBrand]: true;
  readonly spaceId: string;
  /** Join key into the untouched municipality_id columns. Null for #74 space types. */
  readonly municipalityCode: string | null;
  readonly userId: string;
  readonly capability: Capability;
}

export function authorize(
  session: Session,
  rawSpaceId: string,
  capability: Capability
): ResultAsync<SpaceScope, AppError> {
  const id = parse(z.string().uuid(), rawSpaceId);          // reject before touching the DB
  if (id.isErr()) return errAsync(forbidden());             // NOT validation — see Pitfall 2
  return findActiveGrant(session.userId, id.value, capability).andThen((row) =>
    row
      ? okAsync({
          spaceId: row.space_id,
          municipalityCode: row.municipality_code,
          userId: session.userId,
          capability,
        } as SpaceScope)                                     // module-private cast
      : errAsync<SpaceScope, AppError>(forbidden())          // no reason string → no disclosure
  );
}
```

```ts
// server/infra/supabase/space.repo.ts — scope is structural, not advisory
export function listProposals(
  scope: SpaceScope,                       // ← cannot be forged outside authorize.ts
  filter: { status?: ReviewStatus; limit?: number }   // ← deliberately has NO spaceId field
): ResultAsync<Vote[], AppError> {
  const query = supabaseAdmin
    .from('votes')
    .select('*')
    .eq('municipality_id', scope.municipalityCode!)   // scope key, never a caller string
    .in('status', filter.status ? [filter.status] : REVIEW_STATUSES)
    .order('created_at', { ascending: false })
    .limit(Math.min(filter.limit ?? 50, 200));
  return ResultAsync.fromPromise(/* … */);
}
```

The single-`.eq()` form works because `authorize()` resolves `spaces.municipality_code` once; PostgREST cannot express the subquery form. This is why the scope carries the resolved key rather than only the space id.

**Route shell** (unchanged from `apps/web/src/app/api/verification/document/route.ts`):

```ts
export async function GET(request: NextRequest, { params }: { params: Promise<{ spaceId: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));
  const { spaceId } = await params;
  return respond(
    authorize(session, spaceId, 'proposal.read').andThen((scope) => listProposals(scope, {}))
  );
}
```

### Pattern 2: Two-file `vote_status` extension (mandatory, empirically verified)

**What:** `ALTER TYPE ... ADD VALUE` in one migration file with nothing that uses the new labels; everything that uses them in the next file.

**Why:** PostgreSQL 15+ docs: *"If `ALTER TYPE ... ADD VALUE` is executed inside a transaction block, the new value cannot be used until after the transaction has been committed."* Verified on the Supabase `postgres:17.6.1.136` image — the failure is not a warning, it aborts and **rolls back the enum addition too**:

```
BEGIN
DO                                        -- ALTER TYPE inside a DO block succeeds
ERROR:  unsafe use of new value "draft" of enum type vote_status
HINT:   New enum values must be committed before they can be used.
ROLLBACK
-- afterwards:
ERROR:  invalid input value for enum vote_status: "draft"     ← the label was never added
```

Splitting across two transactions works cleanly (also verified: `ALTER TYPE` committed, then `CREATE UNIQUE INDEX … WHERE status = 'rejected'` succeeded). Statements referencing only pre-existing labels are safe in file 1.

```sql
-- FILE B — 2026080200000B_vote_status_review_values.sql — ONLY this, nothing else
ALTER TYPE vote_status ADD VALUE IF NOT EXISTS 'draft'             BEFORE 'pending';
ALTER TYPE vote_status ADD VALUE IF NOT EXISTS 'in_review'         AFTER  'draft';
ALTER TYPE vote_status ADD VALUE IF NOT EXISTS 'changes_requested' AFTER  'in_review';
ALTER TYPE vote_status ADD VALUE IF NOT EXISTS 'rejected'          AFTER  'changes_requested';
```

```sql
-- FILE C — 2026080200000C_vote_review_gating.sql — everything that USES them
CREATE INDEX idx_votes_review_queue
  ON votes (municipality_id, created_at DESC)
  WHERE status IN ('draft', 'in_review', 'changes_requested');
-- Deliberately NOT: ALTER TABLE votes ALTER COLUMN status SET DEFAULT 'draft';
```

**Backfill:** there is nothing to rewrite. Every existing row already holds `pending|active|ended|resolving|resolved|failed`, all of which mean "already past review". "Default existing rows to approved" is satisfied by adding the new labels and leaving history alone — state this explicitly in the plan so nobody writes an `UPDATE`.

**Do not change the column DEFAULT.** Both writers set `status` explicitly (`create-vote.ts` via `initialStatus`, `app/api/ingest/topics/route.ts:137` with `'pending'`). Changing the DB default silently rewires the ingest path. Change `initialStatus()` instead.

### Pattern 3: Append-only audit — REVOKE **and** trigger, never RLS

**What:** Table privileges plus a raising trigger. RLS only guards reads from a leaked anon key.

```sql
CREATE TABLE public.space_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id      UUID NOT NULL REFERENCES public.spaces(id) ON DELETE RESTRICT,
  actor_user_id UUID NOT NULL REFERENCES public.users(id)  ON DELETE RESTRICT,
  action        TEXT NOT NULL,          -- 'proposal.approved', 'grant.revoked', …
  object_type   TEXT NOT NULL CHECK (object_type IN
                  ('vote','grant','space','member','notification_campaign','content')),
  object_id     UUID,
  prior_state   JSONB,
  new_state     JSONB,
  reason        TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 2000),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_space_audit_space_time ON public.space_audit_log (space_id, created_at DESC);
CREATE INDEX idx_space_audit_object     ON public.space_audit_log (object_type, object_id);

CREATE OR REPLACE FUNCTION public.space_audit_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'space_audit_log is append-only (attempted %)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE TRIGGER space_audit_log_no_mutate
  BEFORE UPDATE OR DELETE ON public.space_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.space_audit_append_only();

CREATE TRIGGER space_audit_log_no_truncate
  BEFORE TRUNCATE ON public.space_audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.space_audit_append_only();

REVOKE UPDATE, DELETE, TRUNCATE ON public.space_audit_log FROM anon, authenticated, service_role;
ALTER TABLE public.space_audit_log ENABLE ROW LEVEL SECURITY;   -- no policies ⇒ anon/auth denied
```

Three deliberate choices:

`ON DELETE RESTRICT`, not `CASCADE`. This is what makes SPACE-09 structurally true: deleting a suspended admin's user row cannot silently erase their decisions. Note that `identity_document_events` uses `ON DELETE CASCADE` — **do not copy that table's FK style here**, only its append-only insert shape.

The trigger, not just REVOKE, because the table owner (`postgres`) retains implicit privileges and any future migration written by a hurried agent could `GRANT` them back. The trigger fires regardless of grants.

RLS is present but is not the mechanism. `service_role` has `BYPASSRLS` and is the identity of every application write in this codebase (`apps/web/src/lib/supabase/server.ts`). An RLS-only design would be security theatre here.

*Optional hardening (not required by #75):* a `prev_hash`/`row_hash` chain per space makes tampering by a DB superuser **detectable**. Nothing short of WORM storage makes it impossible. Say so in the plan rather than over-claiming immutability.

**Write it in the same Result chain as the mutation, before the success `map`:**

```ts
return decideProposalRow(scope, voteId, priorStatus, nextStatus)
  .andThen((row) =>
    insertAuditRow({
      space_id: scope.spaceId,
      actor_user_id: scope.userId,
      action: `proposal.${decision}`,
      object_type: 'vote',
      object_id: voteId,
      prior_state: { status: priorStatus },
      new_state: { status: nextStatus },
      reason: cmd.reason,
    }).map(() => row)
  );
```

### Pattern 4: Deterministic conflicting decisions

**What:** Conditional update on prior state, exactly mirroring `markMerchOrderPaid` (`apps/web/src/lib/supabase/db.ts`, documented in CONVENTIONS.md as the atomic transition pattern).

Verified empirically — the winner gets `UPDATE 1`, the loser gets `UPDATE 0` with no row:

```
UPDATE votes SET status='active'   WHERE id=3 AND status='in_review' RETURNING …  → 1 row
UPDATE votes SET status='rejected' WHERE id=3 AND status='in_review' RETURNING …  → 0 rows
```

```ts
export function decideProposalRow(
  scope: SpaceScope, voteId: string, prior: ReviewStatus, next: VoteStatus
): ResultAsync<Vote, AppError> {
  const q = supabaseAdmin
    .from('votes')
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq('id', voteId)
    .eq('municipality_id', scope.municipalityCode!)  // object-level scope, same statement
    .eq('status', prior)                             // optimistic guard, same statement
    .select()
    .maybeSingle()
    .then(({ data, error }) => { if (error) throw error; return data; });

  return ResultAsync.fromPromise(q, (c) => dbError('votes.decide', c))
    .andThen((row) =>
      row ? okAsync(row)
          : errAsync<Vote, AppError>(conflict('ההצעה כבר הוכרעה')));  // 409, never a duplicate publish
}
```

Order of guards inside `decide-proposal.ts`:
1. `authorize(session, spaceId, 'proposal.decide')` → scope.
2. Load the proposal **through the scope** — a cross-space `voteId` reads back nothing → `forbidden()`.
3. Pure domain guards, for clean errors: `isLegalTransition(prior, decision)` and `reviewerIsNotSubmitter(vote.creator_id, scope.userId)` → `forbidden('…')`.
4. Conditional `UPDATE` above → 0 rows means someone else decided first → `CONFLICT`.

**Backstop invariant** (DB-level, so no code path can violate it): one approval per proposal.

```sql
CREATE UNIQUE INDEX uq_space_proposal_single_approval
  ON public.space_audit_log (object_id)
  WHERE object_type = 'vote' AND action = 'proposal.approved';
```

Reject `pg_advisory_xact_lock`: with pooled Supabase connections from Cloudflare Workers the session semantics are not dependable, and the conditional update already gives the required determinism at zero cost.

### Pattern 5: Aggregate-only metrics (SPACE-07)

Copy `public_council_metrics()` from `supabase/migrations/20260730000001_public_council_profiles.sql` verbatim in shape: `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''`, a fixed `RETURNS TABLE (…)` of scalars only, `REVOKE ALL … FROM PUBLIC` then a narrow `GRANT EXECUTE`. A fixed return type means a future private column on `users` or `payments` cannot leak by widening a `SELECT *`.

Pair it with a contract allow-list in `packages/shared/src/contracts/spaceAdmin.ts` modelled on `contracts/council.ts` — its own header states the reason: *"Deliberately keep this allow-list separate from database row types. Adding a private database column can therefore never add it to the public response."*

Member listing (SPACE-07's second half) must be a hand-written column list, never `select('*')`. Safe: `id`, display name, `municipality_id`, `verification_status`, `identity_verified_at` (boolean-ised), `created_at`. Forbidden: anything from `identity_documents` (`id_number_hash`, `id_number_last2`, `first_name`, `last_name`, `date_of_birth`, `document_expiry`), `did_encrypted_private_key`, `phone`, `access_token_encrypted`.

### Pattern 6: Preview-equals-delivery

One resolver, used by both endpoints — and a hash so the equality is *proved*, not merely intended.

```ts
// server/app/space-admin/audience.ts — the single source of truth for BOTH endpoints
export function resolveAudience(
  scope: SpaceScope, filter: AudienceFilter
): ResultAsync<{ userIds: string[]; hash: string }, AppError> {
  return listSpaceMembersForNotification(scope, filter)   // opt-out filtering happens INSIDE
    .map((rows) => {
      const userIds = rows.map((r) => r.id).sort();       // sorted ⇒ stable hash
      return { userIds, hash: sha256Hex(userIds.join(',')) };
    });
}
```

- **Preview** persists a `space_notification_campaigns` row: `status='previewed'`, `audience_hash`, `audience_size`, `audience_filter`.
- **Send** takes the campaign id, re-runs `resolveAudience`, and compares hashes. Mismatch → `conflict('הקהל השתנה — הציגו תצוגה מקדימה מחדש')`. A membership change between preview and send becomes an explicit, testable event instead of a silent divergence.
- Deliveries are written **per recipient user**, not per push token, so the log is directly comparable to the audience: `UNIQUE (campaign_id, user_id, channel)` makes retries idempotent (same idea as `uq_treasury_tx_payment`).
- In-app rows are the source of truth and are written before fan-out; the Expo push is best-effort and runs off the request path via `after()`, the way `create-vote.ts` defers `notifyVoteCreated`.
- Opt-outs live in the existing `users.notification_settings` JSONB (`{newVotes, voteEnding, voteResults, marketing}`). Add one key — `spaceAnnouncements` — and **decide the null default explicitly** (recommend: null ⇒ opted in, matching today's behaviour) and document it, because the existing fan-out ignores the column entirely today.

### Anti-Patterns to Avoid

- **Passing `spaceId: string` into a repo function.** Defeats the whole design. Repo signatures take `SpaceScope`; the filter object must not contain a space field.
- **Filtering by space after the fetch.** CONCERNS.md and `treasury-transaction-scoping.test.ts` already record the bug this caused in the dashboard. The predicate belongs in the query.
- **Auth check only in `[spaceId]/layout.tsx`.** Next.js docs are explicit that layouts don't re-render on navigation and don't gate nested segments or parallel slots. Every page and every route handler authorizes for its own capability.
- **`select('*')` on `users` in an admin surface.** Guarantees a future PII leak.
- **`ON DELETE CASCADE` anywhere in the audit chain.** Turns user deletion into evidence destruction.
- **A `role` column consulted at authorization time.** #75 forbids it. Store `granted_via_role` only as provenance for the UI and never read it in the resolver.
- **Adding roles to the JWT.** A 7-day session token would keep conferring revoked authority; SPACE-09 requires immediate suspension.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP error taxonomy | Ad-hoc `NextResponse.json({error},{status})` | `AppError` + `respond()` (`server/http/`) | Exhaustive `toHttp` switch; a new variant without a mapping is a compile error |
| 429 from inside a use-case | A bare `Response` returned mid-chain | **Add** `{ kind: 'QUOTA_EXCEEDED'; scope: string; retryAfterSeconds?: number }` to `AppError` | The exhaustive switch forces you to write the 429 mapping. This is the one union extension the phase needs |
| Race-free state transition | Read-then-write, `SELECT … FOR UPDATE`, advisory locks | Conditional `.update().eq('status', prior).maybeSingle()` | Proven idiom in `markMerchOrderPaid`; documented in CONVENTIONS.md |
| Audit immutability | Application-level "we never call update" | REVOKE + trigger (Pattern 3) | Discipline is not an enforcement mechanism; a future agent will write the update |
| Aggregate metrics | Fetch rows and reduce in JS | A `LANGUAGE sql STABLE SECURITY DEFINER` RPC | `municipality_profile_metrics` exists precisely because the JS version pulled 10k rows |
| Push chunking / receipts | Manual batching | `sendBatchNotifications` (`services/notifications/expo.ts`) | Already chunks at Expo's 100 limit and collects tickets |
| Batched token lookup | Per-recipient query | `activeTokensForUsers` (`server/infra/supabase/push.repo.ts`) | Written specifically to kill the N+1 |
| Request validation | Hand-rolled type guards | zod v3 contracts in `packages/shared/src/contracts/` + `parse()` | Uniform `VALIDATION` errors with issue paths |
| Rollout kill-switch | A new flag system | Copy `lib/features/council-public-pages.ts` (`process.env.X !== 'false'`) | #75's rollback plan is "fall back to super-admin-only"; a one-line env gate delivers it |

**Key insight:** every hand-rolled variant of the above already exists in this repo in a *worse* form that a prior audit flagged (CONCERNS.md §3, §6). The governance surface is exactly where those mistakes become privilege escalation rather than an inconvenience.

---

## Common Pitfalls

### Pitfall 1: Assuming RLS protects the admin surface

**What goes wrong:** A migration ships careful `USING (space_id IN (SELECT … public.user_id()))` policies, everyone feels safe, and nothing is actually enforced.
**Why:** All server reads/writes use `supabaseAdmin` (service role, `SUPABASE_SERVICE_ROLE_KEY`), which bypasses RLS. ARCHITECTURE.md states this; CONCERNS.md §3 shows the treasury endpoint already leaking for exactly this reason.
**How to avoid:** Treat RLS as anon-key defence only. Every space predicate is written by application code into the query. Write the RLS policies anyway (deny-by-default, service-role-only writes) but never count them as the control.
**Warning signs:** A test that "proves" isolation by setting `app.current_user_id`. Any plan sentence of the form "RLS ensures…".

### Pitfall 2: 404 vs 403 turning into an existence oracle

**What goes wrong:** Unknown space → 404, known-but-unauthorized space → 403. An attacker enumerates every space id.
**Why:** SPACE-03 demands "no data disclosed in the error"; existence is data.
**How to avoid:** `authorize()` returns `forbidden()` for *all* of: malformed uuid, nonexistent space, no grant, suspended grant. Pass **no** reason — `toHttp` then emits the constant `{ error: 'Forbidden', code: 'FORBIDDEN' }`. Localise in the UI from the code, matching how `'Unauthorized'` is handled today.
**Warning signs:** `notFound('Space')` in any space-admin path; a `reason` string mentioning an id, a name, or "not found".

### Pitfall 3: The `vote_status` extension leaking drafts into public reads

**What goes wrong:** Draft, `in_review`, `changes_requested`, and `rejected` proposals appear on public surfaces the moment they can exist.
**Why:** Several read paths have **no** status filter and rely on "every row is public-ish", which stops being true.

Audited read paths (`apps/web/src/lib/supabase/db.ts` unless noted):

| Path | Current filter | Verdict |
|------|----------------|---------|
| `getVotesByMunicipality(m, status?)` :783 — reached by `GET /api/votes?municipality=` with no `status` | none when `status` omitted | **LEAK — must fix** |
| `getVoteWithOptions(id)` :744 — `GET /api/votes/[id]` | none | **LEAK — must fix** |
| `getVoteById(id)` :733 | none | **LEAK — audit each caller** |
| `findVoteByMunicipalityAndTitle` :857 — ingest dedup | `IN ('pending','active')` | **Bug — misses review states ⇒ duplicate proposals** |
| `countVotesCreatedByUser` :1317 / `getVotesCreatedByUser` :1333 | none, creator-scoped | OK (own drafts) but skews the "votes created" stat — decide and state |
| `getActiveVotes` :761, `getActiveVotesWithOptions` :806 | `= 'active'` | Safe |
| `getMunicipalityProfile` :~2341 | `IN ('active','ended')` | Safe |
| `getVotesNeedingResolution` :1796 | `IN ('active','ended')` | Safe |
| `participate` route :67 | `status !== 'active'` reject | Safe |
| `stats/network`, `bags/trending`, `public_council_metrics()` | explicit lists | Safe |

**How to avoid:** Introduce a domain allow-list and use it as the default, so a *future* status also cannot leak:

```ts
// server/domain/votes/vote.ts
export const PUBLIC_VOTE_STATUSES = ['active', 'ended', 'resolving', 'resolved'] as const;
export const REVIEW_VOTE_STATUSES = ['draft', 'in_review', 'changes_requested', 'rejected'] as const;
```

Allow-list, never deny-list.

**Type/contract sites that must be updated together** (a missed one is a compile error, which is the desired outcome):
`apps/web/src/lib/supabase/types.ts` — `Enums.vote_status` (:1063) and `votes` Row/Insert/Update `status` (:406, :421, :436); `packages/shared/src/types/vote.ts:10` `VoteStatus`; `packages/shared/src/contracts/vote.ts:11` `VoteStatusSchema`; `server/infra/supabase/vote.repo.ts:18` local `VoteStatus`; `server/domain/votes/vote.ts:60,65` `initialStatus` + `normalizeStatusFilter`; `server/app/votes/list-votes.ts:12`; `app/api/votes/route.ts:15` `ListQuerySchema`.

Note the shared contract and the DB enum have **already diverged**: the contract has `'cancelled'` (which the DB never had) and lacks `resolving|resolved|failed`. Reconcile deliberately rather than by accident; `normalizeStatusFilter` exists to paper over exactly this.

### Pitfall 4: Duplicating the existing council role model

**What goes wrong:** `space_capability_grants` and `council_role_assignments` both claim to answer "who runs this municipality", and they disagree.
**Why:** Migration `20260730000001_public_council_profiles.sql` (shipped 2026-07-30) already added `municipalities.council_id UUID UNIQUE NOT NULL`, `municipalities.slug_he UNIQUE NOT NULL`, and `council_role_assignments(council_id, user_id, role='community_manager', active_from, active_until, qualifying_payment_id)` with `council_role_assignments_one_active_role` — a unique partial index on `WHERE active_until IS NULL`.
**How to avoid:**
- Seed `spaces.id` **from** `municipalities.council_id` and `spaces.slug` from `slug_he`, so the public council page and the administered space are the same object and #74 does not need a third id space.
- Add `COMMENT ON TABLE council_role_assignments` stating it is public-profile metadata that confers **no** administrative capability, and never read it in `authorize()`. That keeps #75's "no role column that confers power" literally true.
- Constrain one space per municipality: `CREATE UNIQUE INDEX uq_spaces_municipality ON spaces (municipality_code) WHERE municipality_code IS NOT NULL;`. Without it, two spaces sharing a `municipality_code` would silently break `Pattern 1`'s scoping predicate.
- Reuse the `one_active_role` index shape for grants: `CREATE UNIQUE INDEX uq_active_grant ON space_capability_grants (space_id, user_id, capability) WHERE suspended_at IS NULL;`.

### Pitfall 5: Treating `createRateLimiter` as the per-space quota

**What goes wrong:** The notification quota silently does nothing in production.
**Why:** `apps/web/src/lib/rate-limit.ts` falls back to an in-process `Map` when `UPSTASH_REDIS_REST_URL`/`_TOKEN` are unset. On Cloudflare Workers that map is per-isolate and short-lived, so N isolates give N× the quota. Project notes record the Upstash secrets as still empty in production.
**How to avoid:** Count the quota in the database, inside the send use-case, before any fan-out:

```sql
SELECT count(*) FROM space_notification_campaigns
WHERE space_id = $1 AND sent_at > now() - interval '24 hours';
```

Compare against `spaces.notification_daily_quota INT NOT NULL DEFAULT 2`. Keep `createRateLimiter('space-notification-preview', …)` keyed by `spaceId` as a cheap burst gate on preview only, and say in the plan that it is not the control.
**Warning signs:** A plan task whose only quota mechanism is a named limiter.

### Pitfall 6: Server Components reaching the DB without a scope

**What goes wrong:** `app/[locale]/space-admin/[spaceId]/members/page.tsx` calls a db helper with the route param and renders another space's members. The API is watertight; the page is not.
**Why:** RSC pages are directly addressable and run with full server privileges.
**How to avoid:** Pages call the same `server/app/space-admin/*` use-cases as the routes, each authorizing for its own capability, and `redirect()`/`notFound()` on `FORBIDDEN`. `import 'server-only'` at the top of every `server/app/space-admin/*` and `server/infra/supabase/space*.repo.ts` module prevents accidental client-bundle inclusion.
**Warning signs:** Any `page.tsx` under `space-admin/` importing from `@/lib/supabase/db` or `@/server/infra/**` directly.

### Pitfall 7: Reason capture that a client can skip

**What goes wrong:** A decision lands with `reason: ''`.
**How to avoid:** Both layers. zod: `reason: z.string().trim().min(3).max(2000)`. DB: `CHECK (length(btrim(reason)) BETWEEN 3 AND 2000)`. `.trim()` runs before `.min()` in zod v3, so whitespace-only fails at the edge with a `VALIDATION` error rather than a 500 from the constraint.

---

## Code Examples

### Extending the closed `AppError` union (the only change to `server/http/errors.ts`)

```ts
// Source: apps/web/src/server/http/errors.ts (existing file, verbatim structure)
export type AppError =
  | { kind: 'UNAUTHORIZED' }
  | { kind: 'FORBIDDEN'; reason?: string }
  | { kind: 'NOT_FOUND'; entity: string }
  | { kind: 'VALIDATION'; issues: string[] }
  | { kind: 'CONFLICT'; reason: string }
  | { kind: 'QUOTA_EXCEEDED'; scope: string; retryAfterSeconds?: number }  // ← NEW
  | { kind: 'PAYMENT_INVALID'; reason: string }
  | { kind: 'DB'; op: string; cause?: string }
  | { kind: 'INTERNAL'; cause?: string };

export const quotaExceeded = (scope: string, retryAfterSeconds?: number): AppError =>
  ({ kind: 'QUOTA_EXCEEDED', scope, retryAfterSeconds });

// toHttp is an exhaustive switch — omitting this case fails `tsc --noEmit`.
    case 'QUOTA_EXCEEDED':
      return { status: 429, body: { error: 'Quota exceeded', code: 'QUOTA_EXCEEDED' } };
```

### Capability presets — expanded at grant time, never consulted at check time

```ts
// server/domain/space/capability.ts (pure, unit-testable)
export const ROLE_PRESETS = {
  space_admin:        [...CAPABILITIES],
  space_reviewer:     ['space.read','proposal.read','proposal.decide','member.read','metrics.read','audit.read'],
  space_moderator:    ['space.read','content.moderate','member.read','metrics.read','audit.read'],
  space_communicator: ['space.read','member.read','metrics.read','notification.compose','notification.send','audit.read'],
  space_observer:     ['space.read','metrics.read','audit.read'],
} as const satisfies Record<string, readonly Capability[]>;

export type RolePreset = keyof typeof ROLE_PRESETS;
export const expandPreset = (r: RolePreset): readonly Capability[] => ROLE_PRESETS[r];
```

Each expanded capability becomes its own `space_capability_grants` row carrying `granted_via_role = 'space_reviewer'` **for display only**. Splitting `notification.compose` from `notification.send` is what makes #75's "approval rules to notifications" expressible without a new mechanism.

### The resolver query (one indexed hit per request)

```ts
// server/infra/supabase/space.repo.ts
export function findActiveGrant(userId: string, spaceId: string, capability: Capability) {
  const q = supabaseAdmin
    .from('space_capability_grants')
    .select('space_id, spaces!inner(municipality_code)')
    .eq('user_id', userId)
    .eq('space_id', spaceId)
    .eq('capability', capability)
    .is('suspended_at', null)          // ← SPACE-09: suspension is immediate, no cache
    .maybeSingle()
    .then(({ data, error }) => { if (error) throw error; return data; });
  return ResultAsync.fromPromise(q, (c) => dbError('space_capability_grants.find', c));
}
```

Backed by `uq_active_grant (space_id, user_id, capability) WHERE suspended_at IS NULL`.

### Object-level authorization test (adapt `treasury-transaction-scoping.test.ts`)

```ts
// Source shape: apps/web/src/__tests__/services/treasury-transaction-scoping.test.ts
it('scopes the proposal query in SQL, never after the fetch', async () => {
  await listProposals(SCOPE_A, {});
  const columns = eq.mock.calls.map(([c]) => c);
  expect(columns).toContain('municipality_id');
  expect(eq).toHaveBeenCalledWith('municipality_id', SCOPE_A.municipalityCode);
});

it('returns FORBIDDEN with no reason for another space', async () => {
  (findActiveGrant as Mock).mockReturnValue(okAsync(null));   // no grant in space B
  const res = await GET(req('/api/space-admin/' + SPACE_B + '/proposals'), { params: p(SPACE_B) });
  expect(res.status).toBe(403);
  const body = await res.json();
  expect(body).toEqual({ error: 'Forbidden', code: 'FORBIDDEN' });   // nothing else disclosed
  expect(JSON.stringify(body)).not.toContain(SPACE_B);
});
```

### Capability-matrix test (table-driven)

```ts
const MATRIX: Array<[Capability, () => Promise<Response>, number]> = [
  ['proposal.read',   () => GET_PROPOSALS(reqA), 200],
  ['proposal.decide', () => GET_PROPOSALS(reqA), 403],   // wrong capability ⇒ denied
  ['audit.read',      () => GET_AUDIT(reqA),     200],
];
it.each(MATRIX)('capability %s ⇒ %i', async (cap, call, expected) => {
  (findActiveGrant as Mock).mockImplementation((_u, _s, want) =>
    okAsync(want === cap ? GRANT_ROW : null));
  expect((await call()).status).toBe(expected);
});
```

---

## State of the Art

| Old approach | Current approach | When changed | Impact here |
|--------------|------------------|--------------|-------------|
| `auth.uid()` in RLS policies | `public.user_id()` (custom JWT sets `app.current_user_id`) | mig `20260628000002` | Any new policy must use `public.user_id()`; `auth.uid()` silently matches nothing |
| Fat route handlers calling `db.ts` | Hexagonal `server/{http,app,domain,infra}` with `neverthrow` | ~2026-07 (post-CONVENTIONS.md) | **The `.planning/codebase/*.md` maps are dated 2026-06-28 and describe the pre-hex layout.** Follow the live code (`server/`), not those docs, for layering |
| Aggregation in JS over fetched rows | `LANGUAGE sql STABLE` RPCs | mig `20260728000002`, `20260730000001` | SPACE-07 metrics belong in SQL |
| `ALTER TYPE ADD VALUE` forbidden in a transaction (PG < 12) | Allowed in-transaction, but the value is unusable until commit (PG 12+) | PG 12 | Two migration files, not one — and the failure mode is a full rollback, not a warning |
| Auth checks in layouts | Data Access Layer / per-page checks | Next.js App Router guidance | Layouts do not re-render on navigation and do not gate nested or parallel segments |

**Deprecated / stale in this repo:**
- `CLAUDE.md` says "Next.js 17", Clerk-era assumptions, and `/api/votes/[id]/participate` at ₪1. Reality: Next 15.5.18, Auth0 OIDC + custom JWT, membership pricing. Trust the code.
- `.redesign/DESIGN_SYSTEM.md` (Luminous Civic, `--lc-*`) is explicitly deprecated by `.redesign/NEWSPRINT_TECH.md`, which is **LOCKED**. New surfaces use `--np-*`.
- `packages/shared/src/contracts/vote.ts` `VoteStatusSchema` includes `'cancelled'`, which the DB enum never had.

---

## Dashboard Information Architecture

> **The visual and interaction contract is `05-UI-SPEC.md`** (produced in parallel by `gsd-ui-researcher`). Where the two documents overlap — route names, component inventory, tokens, Hebrew strings, dialog behaviour — **`05-UI-SPEC.md` wins.** This section covers only the server-side capability binding per surface, which the UI spec does not own.

Route group `apps/web/src/app/[locale]/space-admin/[spaceId]/` — under the locale segment, because `middleware.ts` redirects every non-`/api` bare path to `/he/*`.

| Route (per `05-UI-SPEC.md`) | Capability required | Server-side note |
|---------|-----------|------------------|
| `/he/space-admin/[spaceId]` | `space.read` | Overview: review-queue depth, notification quota remaining, last audit entries. Every widget resolves through its own use-case |
| `…/proposals` | `proposal.read` | Queue filtered by `REVIEW_VOTE_STATUSES`, newest first, paginated |
| `…/proposals/[voteId]` | `proposal.read`, then `proposal.decide` for the action | Reason required before submit (zod + DB CHECK); self-submitted proposals lock the decision controls, and the server independently rejects them |
| `…/members` | `member.read` (+ `member.manage`, `grant.manage`) | Privacy-safe column allow-list only; grant/revoke via preset picker showing the expanded capability list |
| `…/stats` | `metrics.read` | Aggregate RPC only; no per-user rows reach the response |
| `…/dispatch` | `notification.compose`, then `notification.send` | Compose → preview (count + hash + quota remaining) → send; past campaigns with delivered/suppressed counts |
| `…/audit` | `audit.read` | Reverse-chronological, filterable by object type; visibly read-only |

Two reconciliation notes for the planner:

- The UI spec has **six** surfaces and no dedicated `content/` route, while SPACE-06 also requires "permitted content controls". Fold `content.moderate` into the proposals surface (moderation acts on the same objects) or add a seventh route — either way, decide explicitly and keep `content.moderate` as its own capability so the grant model does not have to change later.
- The UI spec places a shared `layout.tsx` shell. That shell may render chrome, but per Pitfall 6 it must **not** be the authorization boundary: each page still calls its own use-case and authorizes for its own capability.

The UI spec already specifies `PressTable` in `apps/web/src/components/space-admin/` — correct, because no table primitive exists in `apps/web/src/components/press/` today (current exports: `NewsButton`, `Ticker`, `Countdown`, `VoteWidget`/`TallyBar`, `Masthead`, `PressInput`, `PressSelect`, `Segmented`, `Stepper`, `Receipt`, `SealCard`). Size it as its own task.

Ship the whole surface behind `lib/features/space-admin.ts` mirroring `council-public-pages.ts`, satisfying #75's stated rollback ("fall back to super-admin-only operations").

---

## Open Questions

1. **Does `spaces.id` reuse `municipalities.council_id`?**
   - Known: `council_id` is already a `UUID UNIQUE NOT NULL` stable public identifier, commented as "never carries display meaning", and `/he/councils/[slug]` is live on it.
   - Unclear: whether the planner wants the admin space and the public council page to be literally the same identifier.
   - Recommendation: **yes** — seed `spaces.id := municipalities.council_id`. One identifier, no reconciliation table, and #74 slots in cleanly. If the planner declines, `spaces` needs its own id plus a documented mapping, and every deep link must translate.

2. **What is `spaces.geography` for municipal spaces?**
   - Known: no PostGIS; the only geo column anywhere is `verification_attempts.latitude DOUBLE PRECISION`; municipalities carry population but no shape.
   - Recommendation: a nullable `geography JSONB` holding `{ centroid: {lat, lng}, radiusMeters }` for v1. Enough for #74's "geographic relevance" without an extension, and nothing in Phase 5's acceptance criteria reads it.

3. **Who mints the first grant?**
   - Known: there is no super-admin concept in this repo (no role column on `users`; the #42/#44 admin lives in the separate `taruu-agents` repo and is explicitly not a dependency).
   - Unclear: whether Phase 5 introduces a minimal super-admin marker or bootstraps grants by migration/seed script.
   - Recommendation: a single `users.is_platform_admin BOOLEAN NOT NULL DEFAULT false` used **only** to authorize `grant.manage` and `suspended_at` writes across spaces, plus a documented SQL bootstrap. Explicitly not a general admin boolean — it grants nothing inside a space. Flag it for the planner; #68 will replace it.

4. **Does the existing `create-vote` path move behind review immediately?**
   - Known: `initialStatus()` publishes with no gate; `POST /api/votes` requires a completed ₪50 `vote_creation` payment first.
   - Unclear: charging ₪50 for something that may be rejected is a product/refund question the payments track (PAY-06, v2 BAG-04) has not answered.
   - Recommendation: gate creation behind review but surface the risk to the planner as a product decision, and note that `POST /api/ingest/topics` (agent-created votes, currently `'pending'`) is a second writer that also needs an explicit review posture.

5. **Can audit immutability be proven in CI?**
   - Known: `vitest.config.ts` is `environment: 'node'` with Supabase fully mocked. There is **no live-DB test harness** and no `supabase/tests/` directory.
   - Recommendation: the SQL-level proof is a scripted probe against a throwaway database (the technique used to verify the enum semantics for this document: `docker exec … psql -d scratch -f probe.sql`), committed as `supabase/tests/audit_append_only.sql` and run manually as verification evidence. In CI, assert the weaker but real property that `space-audit.repo.ts` exports no update/delete function. State the limitation rather than implying CI coverage.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^1.0.0` (do **not** upgrade; registry current is 4.1.10) |
| Config file | `apps/web/vitest.config.ts` — `environment: 'node'`, `globals: true`, `include: ['src/**/*.test.ts','src/**/*.spec.ts']`, alias `@ → ./src` |
| Quick run command | `pnpm --filter @sync/web exec vitest run src/__tests__/api/space-admin` |
| Full suite command | `pnpm --filter @sync/web test` (plus `pnpm --filter @sync/web typecheck`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test type | Automated command | File exists? |
|--------|----------|-----------|-------------------|--------------|
| SPACE-01 | `spaces` row resolves to `municipality_code`; existing municipality columns unchanged | unit | `pnpm --filter @sync/web exec vitest run src/__tests__/api/space-admin-authorize.test.ts` | ❌ Wave 0 |
| SPACE-02 | Default deny; capability matrix; grant with wrong capability ⇒ 403; `granted_via_role` never read | unit | `… src/__tests__/api/space-admin-capability-matrix.test.ts` | ❌ Wave 0 |
| SPACE-02 | Preset expansion is pure and total over `CAPABILITIES` | unit | `… src/server/domain/space/capability.test.ts` | ❌ Wave 0 |
| SPACE-03 | Swapped `spaceId` ⇒ 403 on read **and** mutate; body discloses nothing; scope predicate is in the SQL | unit | `… src/__tests__/api/space-admin-object-authz.test.ts` | ❌ Wave 0 |
| SPACE-04 | Missing/blank reason ⇒ 400 before any DB call; audit row carries actor/prior/new/object | unit | `… src/__tests__/api/space-admin-audit.test.ts` | ❌ Wave 0 |
| SPACE-04 | `UPDATE`/`DELETE`/`TRUNCATE` on `space_audit_log` raise | manual-only (no live-DB harness — see Open Question 5) | `psql -f supabase/tests/audit_append_only.sql` | ❌ Wave 0 |
| SPACE-05 | Legal/illegal transitions; self-review ⇒ 403 | unit | `… src/server/domain/space/review.test.ts` | ❌ Wave 0 |
| SPACE-05 | Second concurrent decision ⇒ 409, no duplicate publication | unit | `… src/__tests__/api/space-admin-concurrency.test.ts` | ❌ Wave 0 |
| SPACE-05 | Public read paths exclude review statuses (`getVotesByMunicipality`, `getVoteWithOptions`) | unit | `… src/__tests__/services/vote-status-visibility.test.ts` | ❌ Wave 0 |
| SPACE-06 | Member/grant/content mutations scoped and audited | unit | `… src/__tests__/api/space-admin-members.test.ts` | ❌ Wave 0 |
| SPACE-07 | Metrics response matches the contract allow-list; member listing contains no identity-document field | unit | `… src/__tests__/api/space-admin-metrics.test.ts` | ❌ Wave 0 |
| SPACE-08 | Delivered set === previewed set; opt-outs suppressed; audience-hash mismatch ⇒ 409 | unit | `… src/__tests__/api/space-admin-notifications.test.ts` | ❌ Wave 0 |
| SPACE-08 | DB-counted per-space quota blocks before any fan-out ⇒ 429 | unit | same file | ❌ Wave 0 |
| SPACE-09 | `suspended_at` set ⇒ next request 403; historical audit rows still readable | unit | `… src/__tests__/api/space-admin-suspension.test.ts` | ❌ Wave 0 |
| SPACE-10 | Routes compile and render at `/he/space-admin/[spaceId]`; no hardcoded colors/spacing | smoke + review | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web lint` + `grep -rnE '#[0-9a-fA-F]{6}|[0-9]+px' apps/web/src/app/\[locale\]/space-admin` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @sync/web exec vitest run src/__tests__/api/space-admin` plus `pnpm --filter @sync/web typecheck`
- **Per wave merge:** `pnpm --filter @sync/web test` (all 55+ existing files — the `vote_status` widening touches shared types, so regressions surface here)
- **Phase gate:** full suite green + `lint` clean + the manual SQL immutability probe recorded as evidence, before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `pnpm install` at the worktree root — `node_modules` is absent, so `pnpm test`/`typecheck` currently fail outright
- [ ] Capture green baselines for `test` and `typecheck` before any change
- [ ] `apps/web/src/__tests__/api/space-admin-*.test.ts` — 9 new files (list above)
- [ ] `apps/web/src/server/domain/space/{capability,review}.test.ts` — 2 pure-domain files
- [ ] `apps/web/src/__tests__/services/vote-status-visibility.test.ts` — guards Pitfall 3
- [ ] `supabase/tests/audit_append_only.sql` — no `supabase/tests/` directory exists yet
- [ ] A shared `SpaceScope` fixture factory — fixtures are inline per file today, but ~10 files need identical scope/grant fixtures; a single `__tests__/fixtures/space.ts` is justified here (a deliberate, documented departure from the inline-fixture convention)
- [ ] No framework install needed — Vitest is configured

---

## Sources

### Primary (HIGH confidence)

- Codebase, read directly at `/Users/saharbarak/personal/taruu-space-admin` on branch `feat/75-space-admin-dashboard` (HEAD `e5fce2c`): `server/http/errors.ts`, `server/http/respond.ts`, `server/app/votes/create-vote.ts`, `server/app/council/get-public-profile.ts`, `server/domain/votes/vote.ts`, `server/infra/supabase/{identity,vote,push}.repo.ts`, `server/infra/notify/vote-created.ts`, `lib/rate-limit.ts`, `lib/supabase/db.ts`, `lib/supabase/types.ts`, `lib/features/council-public-pages.ts`, `middleware.ts`, `app/api/verification/document/route.ts`, `app/api/votes/route.ts`, `app/api/votes/[id]/route.ts`, `services/auth/session.ts`, `services/notifications/expo.ts`, `eslint.config.mjs`, `vitest.config.ts`, `apps/web/package.json`
- Migrations: `20240101000000_initial_schema.sql`, `20240101000001_rls_policies.sql`, `20250118000001_vote_nfts.sql`, `20260628000002_fix_rls_user_id_helper.sql`, `20260728000001_municipalities.sql`, `20260728000002_municipality_profile_metrics.sql`, `20260728000004_identity_documents.sql`, `20260730000001_public_council_profiles.sql`
- Tests read as templates: `__tests__/api/identity-document.test.ts`, `__tests__/services/treasury-transaction-scoping.test.ts`
- **Empirical probe** (this research): PostgreSQL 17.6 in the running `public.ecr.aws/supabase/postgres:17.6.1.136` container, throwaway database created and dropped. Confirmed (a) `ALTER TYPE ADD VALUE` + use in the same transaction ⇒ `ERROR: unsafe use of new value … HINT: New enum values must be committed before they can be used`, whole transaction rolled back and the label not added; (b) the two-transaction split succeeds; (c) conditional `UPDATE … WHERE status = <prior>` yields `UPDATE 1` / `UPDATE 0`
- [PostgreSQL 15 — ALTER TYPE, Notes](https://www.postgresql.org/docs/15/sql-altertype.html) — transaction rule, `IF NOT EXISTS`, sort-position performance note
- Next.js official docs via Context7 (`/vercel/next.js`, `docs/01-app/02-guides/authentication.mdx`, `docs/01-app/02-guides/data-security.mdx`) — layouts are not an auth boundary; Data Access Layer pattern; `import 'server-only'`
- neverthrow docs via Context7 (`/supermacro/neverthrow`) — `andThen` chaining, `combineWithAllErrors`, `safeTry`
- Sibling artifact `.planning/phases/05-.../05-UI-SPEC.md` (gsd-ui-researcher, 2026-08-02) — authoritative for SPACE-10 visuals, routes, and components; this document defers to it on every overlap
- GitHub issues `#75`, `#74`, `#68` (`Taruu-ShowYourselves/taruu-monorepo`) via `gh issue view`
- npm registry versions verified 2026-08-02: `neverthrow@8.2.0`, `zod@4.4.3`, `vitest@4.1.10`, `@upstash/ratelimit@2.0.8`, `server-only@0.0.1`

### Secondary (MEDIUM confidence)

- [OWASP API1:2023 Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization.md) — object-level checks in every function that takes a client-supplied id; corroborates the DAL placement
- [Tamper-evident audit log in Postgres with a trigger](https://anishgandhi.com/audit-log-postgres-trigger-tutorial/) and [How to Build PostgreSQL Triggers for Audit](https://oneuptime.com/blog/post/2026-01-30-postgresql-triggers-audit/view) — REVOKE + trigger as layered defence; the project-specific service-role argument is mine, from reading `lib/supabase/server.ts`
- [Branded Types in TypeScript](https://tigerabrodi.blog/branded-types-in-typescript) and [Phantom Types: Compile-Time Only Types](https://krython.com/tutorial/typescript/phantom-types-compile-time-only-types/) — the `unique symbol` brand technique; zero runtime cost
- `.planning/codebase/{ARCHITECTURE,CONVENTIONS,TESTING,CONCERNS}.md` — accurate on conventions, idempotency, and security findings, but **dated 2026-06-28 and pre-date the `server/` hexagonal layer**; treated as historical

### Tertiary (LOW confidence — flagged for validation)

- Upstash secrets being unset in production comes from project session notes, not from an inspected deployment. The DB-backed quota recommendation is correct regardless, but confirm with `wrangler secret list` before writing the plan's rationale as fact.
- Whether the Supabase Management API path used for DDL in this project wraps a submitted script in one implicit transaction was not directly observed. The two-file enum split is safe under every interpretation, which is why it is the recommendation.

---

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — read from `apps/web/package.json`; registry versions verified via `npm view`
- Codebase facts, layering, read-path audit: **HIGH** — every file read directly at the stated paths and line numbers
- `vote_status` extension mechanics: **HIGH** — official PG 15 docs plus an empirical probe on the exact Supabase Postgres image
- Concurrency determinism: **HIGH** — empirically probed, and identical to the shipped `markMerchOrderPaid` idiom
- Audit immutability mechanism: **HIGH** on the reasoning (service role bypasses RLS; grants and triggers do not), **MEDIUM** on the exact grant set surviving Supabase's default-privilege automation — verify by running the probe against a scratch database
- Authorization architecture (`SpaceScope`): **HIGH** on feasibility and on the Next.js DAL guidance; **MEDIUM** on ergonomics at 10+ repo functions — validate on the first two use-cases before committing the whole surface
- Notification audience equality: **MEDIUM-HIGH** — the design is sound and testable; the `notification_settings` null default is an undecided product question
- Pitfall 4 (council model overlap): **HIGH** — migration read in full; the reconciliation choice is a recommendation, not a verified decision

**Research date:** 2026-08-02
**Valid until:** 2026-09-01 (30 days — Postgres and Next.js semantics are stable; the codebase is moving fast, so re-check `supabase/migrations/` and `server/` if planning slips past that)
