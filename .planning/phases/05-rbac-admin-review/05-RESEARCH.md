# Phase 5: RBAC + Admin Review - Research

**Researched:** 2026-08-02
**Domain:** Application-layer authorization in a Next.js/Supabase monolith with a custom (non-Supabase-Auth) JWT, deployed to Cloudflare Workers
**Confidence:** HIGH (all findings verified against this repo's actual code, not general RBAC theory)

## Summary

This phase does not need an RBAC library, a policy engine, or any third-party dependency. Taruu already has every primitive this phase needs: a custom JWT session (`getSessionFromRequest`), a service-role Supabase client that all real traffic goes through, a Result-monad HTTP layer (`neverthrow` + `AppError` + `respond()`) that already ships a `FORBIDDEN` variant, and a recent (`identity_documents`) migration that is the exact structural template for a privacy-sensitive, append-only-audited, RLS-denied table. The work is 100% about composing existing patterns correctly, not introducing new ones.

The single most important finding is a negative one: **this codebase's per-user RLS policies (`public.user_id()`) do not run for any real request today.** `public.user_id()` reads either a PostgREST JWT claim or a `SET LOCAL app.current_user_id` session variable — and nothing in the application ever sets either. `withUserContext()`, the one function that tries, sets `app.user_id` (a different key, from a naming mismatch with the `set_claim(claim, value)` RPC) and is never called from application code. Every real read and write goes through `supabaseAdmin`, the service-role client, which bypasses RLS entirely. This means RLS in this codebase is not an enforcement layer for business rules — it is a **deny-by-default backstop against the anon key**, exactly as implemented on `merch_orders` (RLS enabled, zero policies, anon key gets nothing). RBAC-04's "RLS denies anon-key reads" requirement should be read the same way: enable RLS, add no anon-reachable policies (or only `public.user_id()`-scoped ones, per the locked convention, understanding they are currently unreachable in practice). The actual authorization enforcement for RBAC-02 must happen in application code — one helper function called by every privileged route handler.

The second major finding is architectural: this repo has two coexisting patterns. The dominant legacy pattern (`payments/`, `merch/`, most of `votes/`) is flat try/catch routes calling named functions in one large `lib/supabase/db.ts`. But the most recent feature (`identity_documents`, issue #32) introduced a proper layered architecture at `apps/web/src/server/{http,app,domain,infra}/` — HTTP shell → use-case → pure domain logic → repository — built on `neverthrow` `ResultAsync` and a single exhaustive `AppError` union that already has `{ kind: 'FORBIDDEN'; reason?: string }`. This is the correct foundation for the "single server-side authorization helper" RBAC-02 requires: it composes naturally, is unit-testable without HTTP or a database, and matches CLAUDE.md's explicit demand for result monads, DDD layering, and composable functional code far better than the legacy pattern does.

**Primary recommendation:** Build the authorization helper as a `server/app/authz/require-role.ts` use-case (plus a pure `server/domain/authz/policy.ts` decision function) that composes a list of independent boolean "requirements" against already-fetched facts (active grant, and — from Phase 6 — active billing). Every privileged route calls this one function; its call sites never change between Phase 5 and Phase 6, only the requirement list passed internally for the `community_manager` role grows by one.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Role model**
- Three roles exist: `super_admin`, `space_admin`, `community_manager`.
- Role grants are **rows with an explicit lifecycle**, not a boolean column on `users`. (ROADMAP Phase 5 success criterion 1.)
- Grants are scoped per space where applicable — `super_admin` is platform-wide; `space_admin` and `community_manager` are scoped to a space.
- Issue #79 says review is performed by "platform or authorized space admins", so both `super_admin` and `space_admin` can act on applications within their scope.

**Authorization**
- A **single** server-side authorization helper is the only enforcement point. Every privileged route calls it. (ROADMAP criterion 2.)
- Authorization is never inferred client-side.
- Authorization is never derived from payment state. Payment alone must never grant a role — this is issue #79's central requirement and its first acceptance criterion.
- The helper must be shaped so Phase 6 can require approval **AND** active billing without changing its call sites.

**Application and review**
- An applicant submits a community-manager application.
- An admin sees pending applications in a review console and can approve, reject, or suspend.
- Every one of those transitions records an actor, a timestamp, and a reason. (Issue #79: "Allow super admins to suspend access independently of billing and record the reason.")
- Approval is **not** automatic. Issue #79 places automatic approval explicitly out of scope.
- Super admins can suspend access independently of any other condition.

**States**
- Issue #79 names a combined set of states across both halves: `active`, `past_due`, `grace`, `cancelled`, `rejected`, `suspended`, `expired`. `past_due`, `grace`, `cancelled`, and `expired` are billing states and belong to Phase 6.
- This phase owns the application/grant states only — at minimum: submitted/pending, `approved`, `rejected`, `suspended`, and revoked. Transitions must be explicit and recorded, not implied by field mutation.

**Audit and data protection**
- Every grant, revocation, and suspension writes an **append-only** audit row that outlives the role change itself. (ROADMAP criterion 5.)
- RLS denies anon-key reads of applications and audit rows.
- Follow the project's established RLS convention: policies use `public.user_id()`, **never** `auth.uid()` — the built-in helper returns NULL under this project's custom JWT. This was a corrective migration in Phase 1 (`20260628000002_fix_rls_user_id_helper.sql`) and repeating the mistake would silently break every per-user policy.

### Claude's Discretion

- What a "space" is concretely in this codebase — the natural candidate is a municipality (`supabase/migrations/20260728000001_municipalities.sql`), but the mapping is unstated in the issue and must be chosen and justified.
- Table and column naming, and whether applications and grants are one table or two.
- Whether roles are an enum type or a lookup table.
- How the helper reads identity — it must integrate with the existing session/JWT plumbing (`apps/web/src/app/api/auth/session/`, `apps/web/src/middleware.ts`) rather than inventing a parallel auth path.
- The admin review console's surface and its route placement. No UI-SPEC was generated for this phase; the console inherits the locked redesign system rather than introducing new visual language.
- Notification of applicants on approve/reject/suspend — issue #79 lists notifications, but its acceptance criterion ties them to the failed-payment/cancellation policy, which is Phase 6. Basic transition notification here is at the planner's discretion.

### Deferred Ideas (OUT OF SCOPE)

All deferred to **Phase 6: Manager Billing + Subscription** (requirements MGR-01..05):
- The ₪50/month subscription, checkout, and tokenization
- Invoices and receipts
- Renewal state, idempotent renewal handling, and duplicate-event protection
- Failed-payment grace policy and past-due handling
- Cancellation
- Billing-driven role activation and suspension
- Reconciliation against Green Invoice settlement records
- The billing states `past_due`, `grace`, `cancelled`, `expired`

Out of scope for issue #79 entirely (both phases): vote-submission fees, salary or payment *to* managers, and automatic approval.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| RBAC-01 | Roles/role-grants schema (`super_admin`, `space_admin`, `community_manager`), scoped per space where applicable; grants are rows with explicit lifecycle, not a boolean column | See "Table Shape" — recommended `role_grants` + `community_manager_applications` + `role_grant_events` split, `municipalities.code` as the space FK, TEXT+CHECK over native ENUM (matches the `identity_documents` convention, not the older `20240101000000` ENUM convention) |
| RBAC-02 | Single server-side authorization helper is the only enforcement point for privileged routes; never client-inferred, never derived from payment state | See "Authorization Helper Design" — `server/app/authz/require-role.ts` + pure `server/domain/authz/policy.ts`, composed-requirements shape that survives the Phase 6 billing addition without call-site changes |
| RBAC-03 | Community-manager application submit + admin review (approve/reject/suspend), each recording actor/timestamp/reason | See "Table Shape" and "Route and Layer Placement" — `community_manager_applications` for submission/decision, atomic `.eq('status', ...)` guarded transitions per `CONVENTIONS.md`, `role_grant_events` for the actor/timestamp/reason record |
| RBAC-04 | Append-only audit row for every grant/revocation/suspension; RLS denies anon-key reads of applications and audit rows | See "RLS Reality Check" and "Table Shape" — `role_grant_events` is INSERT-only (no `updated_at`, no UPDATE/DELETE policies), mirrors `identity_document_events`; RLS enabled with no anon-reachable policies on all three new tables, mirroring `merch_orders` |

## Standard Stack

No new runtime dependencies are needed. This phase is composition of already-installed libraries:

### Core (already installed, verified in `apps/web/package.json`)

| Library | Version | Purpose | Why Standard (for this repo) |
|---------|---------|---------|-------------------------------|
| `neverthrow` | ^8.2.0 | `Result`/`ResultAsync` monad for the app/domain/infra layers | Already the backbone of the `server/` layered architecture (`submit-document.ts`, `identity.repo.ts`); CLAUDE.md explicitly asks for result monads |
| `zod` | ^3.23.0 | Request/response contract validation | Already the convention for every `packages/shared/src/contracts/*.ts` file |
| `jose` | (existing, via `services/auth/session.ts`) | JWT sign/verify for the custom session | No change needed — the authorization helper reads the *existing* session, it does not touch JWT internals |
| `@supabase/supabase-js` | (existing) | DB access via `supabaseAdmin` (service role) | All new tables/queries go through `supabaseAdmin`, same as every other table in this repo |

### Explicitly do NOT add

| Considered | Why not |
|------------|---------|
| CASL / `@casl/ability`, `accesscontrol`, or any policy-engine npm package | Three roles, one scoping dimension (space), and one composed-requirement shape do not need a rules engine. A policy engine would be an unjustified dependency for a `switch`/small-`if`-chain problem, and it would not integrate with the existing `AppError`/`ResultAsync` shell without a translation layer that adds more code than it saves. |
| Supabase Auth (`auth.uid()`, RLS-driven authorization) | This project deliberately does not use Supabase Auth (`supabase/config.toml` has `[auth] enabled = false`). `auth.uid()` returns NULL. Any RLS policy assuming stock Supabase Auth is wrong here — already burned once (SEC-01, `20260628000002_fix_rls_user_id_helper.sql`). |
| A dedicated `roles` lookup table with FK from `role_grants.role` | Three fixed roles that don't need runtime CRUD by an app admin. See "Enum vs. lookup table vs. TEXT+CHECK" below — the newer convention in this codebase (`identity_documents.status`) is TEXT + CHECK, not a lookup table or a native Postgres ENUM. |

**Installation:** None required — no `pnpm add` needed for this phase.

## Architecture Patterns

### Two coexisting conventions in this codebase — use the newer one

`.planning/codebase/CONVENTIONS.md` and `.planning/codebase/ARCHITECTURE.md` (dated 2026-06-28) describe the **legacy pattern**: routes with inline try/catch, one flat `apps/web/src/lib/supabase/db.ts` (~2050 lines) of named DB functions, and hand-rolled `{ error, code }` JSON responses. This is real and still dominant by file count (`payments/`, `merch/`, `votes/`, `verification/status` etc. all use it).

But `apps/web/src/server/{http,app,domain,infra}/` is a **newer, better-fit pattern** introduced for the identity-document verification feature (issue #32, shipped 2026-07-27 — after the CONVENTIONS.md snapshot date). It is not yet documented in `.planning/codebase/`, but it is the more recent and more sophisticated code in the repo, and it is a closer match to CLAUDE.md's explicit requirements ("result monads, chainings, interfaces, modular, composable and declarative... DDD, layers of logic"). This phase should build on it, not on the legacy `db.ts` pattern.

```
apps/web/src/server/
├── http/
│   ├── errors.ts      # AppError union + toHttp() — already has FORBIDDEN
│   └── respond.ts      # parse() + respond() — route handlers stay ~15 lines
├── app/                 # use-cases: orchestrate domain + infra, return ResultAsync<T, AppError>
│   └── authz/
│       └── require-role.ts        # NEW — the single authorization helper
│       └── review-application.ts  # NEW — approve/reject/suspend use-cases
├── domain/               # pure functions, no IO, no framework — colocated *.test.ts
│   └── authz/
│       └── policy.ts               # NEW — evaluateAuthorization(facts) → decision
│       └── policy.test.ts          # NEW — colocated, mirrors decision.test.ts
└── infra/
    └── supabase/
        └── role.repo.ts            # NEW — role_grants / applications / events queries
```

**Source:** `apps/web/src/server/app/identity/submit-document.ts`, `apps/web/src/server/domain/identity/decision.ts`, `apps/web/src/server/infra/supabase/identity.repo.ts`, `apps/web/src/server/http/{errors,respond}.ts` (all read directly, 2026-08-02).

### Pattern 1: The single authorization helper as composed requirements

**What:** One `app`-layer function, `requireRole`, that (a) fetches the caller's active grant for a role+space from the repo, (b) evaluates a list of independent boolean requirements against the fetched facts in the pure `domain` layer, and (c) returns `ResultAsync<RoleGrant, AppError>` — `forbidden()` on any failed requirement, `ok(grant)` on success.

**When to use:** Every privileged route (the review console's approve/reject/suspend/list endpoints in this phase; any manager-gated route in Phase 6).

**Why this shape satisfies the load-bearing constraint:** CONTEXT.md requires the helper to "require approval **AND** active billing without changing its call sites" in Phase 6. A requirements-list design means Phase 6 adds one more requirement function to the internal list for `community_manager` — the call sites (`requireRole(userId, 'community_manager', spaceId)`) do not change at all.

**Example (illustrative — planner refines names/signatures):**
```ts
// server/domain/authz/policy.ts — pure, no IO
export interface AuthzFacts {
  grant: RoleGrant | null; // active role_grants row for (userId, role, spaceId), or null
  billingActive: boolean;  // Phase 5: always true (no billing requirement exists yet)
}

export type AuthzDecision =
  | { allowed: true; grant: RoleGrant }
  | { allowed: false; reason: 'no_active_grant' | 'billing_inactive' };

export function evaluateAuthorization(facts: AuthzFacts): AuthzDecision {
  if (!facts.grant) return { allowed: false, reason: 'no_active_grant' };
  if (!facts.billingActive) return { allowed: false, reason: 'billing_inactive' };
  return { allowed: true, grant: facts.grant };
}

// server/app/authz/require-role.ts — orchestrates infra + domain
export function requireRole(
  userId: string,
  role: RoleName,
  spaceId: string | null
): ResultAsync<RoleGrant, AppError> {
  return findActiveGrant(userId, role, spaceId).andThen((grant) => {
    // Phase 5: no billing table exists — this is a stable no-op true.
    // Phase 6 replaces this constant with a real repo call; the function
    // signature and every call site above are untouched.
    const billingActive = true;
    const decision = evaluateAuthorization({ grant, billingActive });
    return decision.allowed
      ? okAsync(decision.grant)
      : errAsync(forbidden(decision.reason));
  });
}
```

**Test the shape now, not just the current behavior:** because Phase 5 ships no community-manager-gated resource, `evaluateAuthorization` should get a unit test that passes `billingActive: false` explicitly and asserts `FORBIDDEN` — proving the composition works before Phase 6 needs it. This directly answers the issue's own verification note ("the approval-billing race is... testable in this phase even though billing lands in Phase 6").

### Pattern 2: Atomic status-guarded transitions for approve/reject/suspend

**What:** Every application/grant state transition uses the codebase's established atomic-update guard — the precondition is in the same `.update()` call, not a separate read-then-write.

**When to use:** `approveApplication`, `rejectApplication`, `suspendGrant`, `revokeGrant` — anywhere two admins (or a double-click) could race on the same row.

**Example (source: `CONVENTIONS.md`, pattern already used by `markMerchOrderPaid`):**
```ts
// infra/supabase/role.repo.ts
export function approveApplication(id: string, reviewerId: string, reason: string) {
  const query = supabaseAdmin
    .from('community_manager_applications')
    .update({ status: 'approved', reviewed_by: reviewerId, reviewed_at: new Date().toISOString(), review_reason: reason })
    .eq('id', id)
    .eq('status', 'submitted') // only a still-pending application can be approved
    .select()
    .maybeSingle();
  // .maybeSingle() → null row = already decided (noop), not an error
}
```

### Pattern 3: Main row + append-only event log (the `identity_documents` template)

**What:** A privacy/audit-sensitive feature gets two tables: a mutable "current state" row and an INSERT-only event table that survives any mutation of the first.

**When to use:** Directly maps to RBAC-04. `identity_documents` (mutable, one row per user, `verified_at` etc.) + `identity_document_events` (append-only, `event TEXT CHECK (...)`, `detail JSONB`, no `updated_at`, no update trigger) is the closest existing analogue in this repo for exactly this shape.

**Source:** `supabase/migrations/20260728000004_identity_documents.sql` (read directly, 2026-08-02).

### Recommended Project Structure (new files this phase adds)

```
apps/web/src/
├── server/
│   ├── domain/authz/
│   │   ├── policy.ts                 # evaluateAuthorization() — pure
│   │   └── policy.test.ts            # colocated (matches decision.test.ts)
│   ├── app/authz/
│   │   ├── require-role.ts           # the ONE helper every privileged route calls
│   │   ├── submit-application.ts     # applicant use-case
│   │   └── review-application.ts     # approve/reject/suspend/revoke use-cases
│   └── infra/supabase/
│       └── role.repo.ts              # role_grants / applications / events queries
├── app/api/
│   ├── manager-applications/
│   │   └── route.ts                  # POST (submit), GET (own status) — applicant-facing
│   └── admin/
│       └── manager-applications/
│           ├── route.ts              # GET — list pending (space_admin/super_admin)
│           └── [id]/
│               ├── approve/route.ts
│               ├── reject/route.ts
│               └── suspend/route.ts
├── app/[locale]/
│   ├── settings/community-manager/page.tsx   # applicant-facing submission form (placement: discretion)
│   └── admin/manager-applications/page.tsx   # review console (placement: discretion)
└── __tests__/api/
    ├── manager-applications.test.ts
    └── admin-manager-applications.test.ts

supabase/migrations/
└── 2026080200000N_role_grants_and_applications.sql   # see "Table Shape"
```

Route placement under `app/` (applicant-facing vs. `app/admin/`) and page placement under `[locale]/` are genuinely open — CONTEXT.md leaves both to the planner. The structure above is a reasonable default consistent with the existing `api/verification/`, `api/user/` groupings (resource-named directories) and the existing `[locale]/settings/` pattern for user-facing forms.

### Anti-Patterns to Avoid

- **Do not gate authorization with an RLS policy alone.** Every real query in this app goes through `supabaseAdmin` (service role), which bypasses RLS unconditionally. An RLS policy that "looks like" enforcement (e.g., `USING (space_admin_for(space_id))`) will never actually run against production traffic and creates false confidence. RLS here is anon-key defense-in-depth only.
- **Do not use `auth.uid()`** in any new RLS policy. It returns NULL under this project's custom JWT (confirmed root cause of SEC-01/HIGH finding in `CONCERNS.md`). Use `public.user_id()` if any per-user policy is added at all — see "RLS Reality Check" for whether that's even worth doing.
- **Do not add a boolean `is_admin` / `is_space_admin` column to `users`.** This is explicitly what RBAC-01 forbids ("rows with an explicit lifecycle, not a boolean column"), and it is exactly the anti-pattern the phase exists to replace.
- **Do not let the review-console UI decide authorization.** "Never inferred client-side" (locked decision) means the review console's approve/reject/suspend buttons calling protected API routes is fine; the console *rendering* those buttons based on a client-visible `role` field is a UX nicety, not a security boundary — the route handler must independently call `requireRole` regardless of what the client believes.
- **Do not special-case `community_manager` billing logic inside route handlers.** The whole point of the composed-requirements design is that route handlers never know or care whether a requirement is "grant" or "grant + billing" — they call `requireRole` and get back allow/forbid.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Constant-time secret comparison (if this phase adds any machine-to-machine route, e.g. a future admin API key) | A new `===` or hand-rolled timing check | `secureEqual()` from `apps/web/src/lib/secureCompare.ts` | Already exists, already used by every webhook/cron route, and `CONCERNS.md` explicitly flags the 3 cron routes that skip it as a known unfixed issue — don't add a 4th inconsistent pattern |
| JWT session verification | A second JWT library or a parallel "admin token" scheme | `getSessionFromRequest()` / `requireAuth()` from `@/services/auth/session` | The custom session is already the identity source of truth; RBAC-01..04 says nothing about a separate admin credential, and CONTEXT.md explicitly requires integrating with "the existing session/JWT plumbing... rather than inventing a parallel auth path" |
| Atomic state-machine transitions | Read-then-write with an application-level lock | `.eq('status', <expected>)` guard inside the same `.update()` call | This is the established, tested pattern (`markPaymentCompleted`, `markMerchOrderPaid`) for exactly the applicant/admin race this phase's own verification plan calls out |
| Result/error handling | Try/catch + ad hoc `{ error, code }` shape for the new `server/authz` code | `neverthrow` `ResultAsync<T, AppError>` + `toHttp()` / `respond()` | Already the established pattern for the most recent feature in this codebase; introducing a third error-handling style in the same file tree would fragment the "single enforcement point" the phase is trying to build |

**Key insight:** Every piece of infrastructure RBAC-01..04 needs already has a load-bearing precedent somewhere in this repo, shipped within the last several weeks. The risk in this phase is not "what pattern to invent" — it's picking the *wrong* existing pattern (the legacy flat `db.ts` one) instead of the newer, better-fit layered one.

## Common Pitfalls

### Pitfall 1: Believing `public.user_id()`-based RLS policies provide real enforcement
**What goes wrong:** A plan or implementation adds `USING (user_id = public.user_id())` to `community_manager_applications` and treats that as satisfying "an applicant can only see their own application," when in fact `app.current_user_id` is never set anywhere in the request path this app actually uses.
**Why it happens:** The convention documentation (and CONTEXT.md itself) correctly says "use `public.user_id()`, never `auth.uid()`" — which is right advice for *avoiding the SEC-01 mistake* — but doesn't mention that the helper is currently unreachable in practice because nothing sets its input.
**How to avoid:** Treat every RLS policy on the new tables as anon-key defense-in-depth, not as the mechanism that makes "applicants see only their own application" true. That property must be enforced in the route handler (`WHERE user_id = session.userId` in the repo query), same as every other per-user read in this codebase.
**Warning signs:** A plan step that says "RLS policy enforces X" for a route that uses `supabaseAdmin`.

### Pitfall 2: `set_claim` / `withUserContext` naming mismatch (latent bug, do not repeat or rely on)
**What goes wrong:** `withUserContext(userId)` (`apps/web/src/lib/supabase/server.ts:67`) calls the RPC `set_claim('user_id', userId)`, which executes `set_config('app.' || 'user_id', ...)` → sets `app.user_id`. But `public.user_id()` (`supabase/migrations/20240101000001_rls_policies.sql`) reads `current_setting('app.current_user_id', true)`. These are different keys. If a future change starts calling `withUserContext()` expecting RLS to then "just work," it silently won't.
**Why it happens:** The mismatch predates this phase and is currently inert only because `withUserContext` is never called from application code (confirmed via repo-wide search, 2026-08-02).
**How to avoid:** Do not build this phase's authorization on top of `withUserContext`/`set_claim`. If a future phase wants request-scoped RLS to actually activate, that mismatch needs its own corrective migration (out of scope here — flagged for awareness, not for this phase to fix).
**Warning signs:** Any new code calling `supabaseAdmin.rpc('set_claim', ...)` and then relying on an RLS policy to filter results.

### Pitfall 2b: Postgres ENUM vs. TEXT+CHECK — the codebase already changed its mind once
**What goes wrong:** Following the *oldest* migration's convention (`20240101000000_initial_schema.sql` uses native Postgres `CREATE TYPE ... AS ENUM`) for the new `role` / `status` columns, then discovering that adding a role or a status value later requires `ALTER TYPE ... ADD VALUE`, which cannot run inside the same transaction as other DDL in older Postgres versions and complicates rollback.
**Why it happens:** Two conventions coexist in `supabase/migrations/`: the 2024 tables use native ENUM types; the most recent tables (`identity_documents.document_type`, `identity_documents.status`, `identity_document_events.event`) use `TEXT NOT NULL CHECK (col IN (...))` instead.
**How to avoid:** Follow the newer convention (TEXT + CHECK) for `role`, and for the application/grant `status` columns — it is more recent, is what the closest analogue table (`identity_documents`) actually does, and avoids ENUM-alteration pain if a 4th role or a new status value is ever needed.
**Warning signs:** A migration that does `CREATE TYPE role_name AS ENUM (...)` for this phase's tables.

### Pitfall 3: Treating "space" as needing a new UUID-keyed table
**What goes wrong:** Inventing a `spaces` table with a UUID primary key and back-filling municipality data into it, when `municipalities` already exists, is already the FK target for `users.municipality_id`, `votes.municipality_id`, and `treasury.municipality_id`, and already includes a `kind` discriminator (`'municipality' | 'national'`) with a seeded national pseudo-space (`'כנסת ישראל'`, exposed as the `KNESSET_SCOPE` constant in `@sync/shared`).
**Why it happens:** "Space" sounds like it needs new infrastructure; issue #79 never says the word "municipality."
**How to avoid:** Use `municipalities.code` (TEXT, e.g. `'תל אביב-יפו'`) as the space identifier for `space_admin`/`community_manager` grants — same type, same FK target, same convention as every other space-scoped column in this codebase. `super_admin` grants have `space_id IS NULL` (platform-wide).
**Warning signs:** A migration creating a new `spaces` or `organizations` table.

### Pitfall 4: Assuming Cloudflare Workers constrains this phase the way it constrained OCR
**What goes wrong:** Over-indexing on the tesseract.js-on-Workers failure (project history) and avoiding perfectly Workers-safe libraries for this phase out of misplaced caution.
**Why it happens:** `taruu-id-verification` project memory notes tesseract.js broke on Workers because it needed browser APIs/WASM that the Workers runtime (even with `nodejs_compat`) didn't support well, and OCR was moved on-device specifically because of it.
**How to avoid:** Nothing in this phase touches OCR, native binaries, or heavy browser-only libraries. `neverthrow`, `zod`, `jose`, and `@supabase/supabase-js` are already running in production on this exact Workers/OpenNext deployment (used throughout `payments/`, `merch/`, `verification/`). This phase carries zero new Workers-compatibility risk — flag it and move on.
**Warning signs:** None expected for this phase; noted only because CONTEXT.md explicitly asked the question.

### Pitfall 5: Conflating "who can review applications" with "who can suspend a grant"
**What goes wrong:** Issue #79's verbatim quote restricts *suspend* to super admins ("Allow super admins to suspend access independently of billing"), while the ROADMAP's phase success criterion #3 says generically "an admin... can approve, reject, or suspend it" without naming a tier, and the locked Decisions section says review ("platform or authorized space admins") covers approve/reject but separately states "Super admins can suspend access independently of any other condition" (not that only super admins can). A plan that silently picks one reading without surfacing the ambiguity risks either over- or under-scoping `space_admin` permissions.
**Why it happens:** The issue's original acceptance criteria (billing-era language) and this phase's role-only slice don't perfectly line up on this one point.
**How to avoid:** See Open Questions — recommend `space_admin` can approve/reject/suspend only within their own space, `super_admin` can do all three anywhere, and confirm this reading explicitly during planning rather than inferring silently.
**Warning signs:** A plan that hardcodes "only super_admin can suspend" without a visible decision point, or one that lets `space_admin` suspend cross-space.

## Code Examples

### Session extraction (unchanged, already exists) — every privileged route starts here
```ts
// Source: apps/web/src/services/auth/session.ts (read directly, 2026-08-02)
export async function getSessionFromRequest(request: Request): Promise<Session | null>
// Session = { userId: string; googleId: string; did: string; email: string; expiresAt: Date }
// No role field exists today — this phase does not need to add one to the JWT itself;
// the helper looks up role_grants by userId on every call (grants can change between requests,
// and a JWT-embedded role would go stale until the 7-day token expiry).
```

### AppError already has what this phase needs
```ts
// Source: apps/web/src/server/http/errors.ts (read directly, 2026-08-02)
export type AppError =
  | { kind: 'UNAUTHORIZED' }
  | { kind: 'FORBIDDEN'; reason?: string }   // ← use this for "no active grant" / "wrong role"
  | { kind: 'NOT_FOUND'; entity: string }
  | { kind: 'VALIDATION'; issues: string[] }
  | { kind: 'CONFLICT'; reason: string }      // ← use this for "already approved/rejected"
  | { kind: 'PAYMENT_INVALID'; reason: string }
  | { kind: 'DB'; op: string; cause?: string }
  | { kind: 'INTERNAL'; cause?: string };
```
No new `AppError` variant is needed — `FORBIDDEN` and `CONFLICT` already exist and map to 403/409.

### Partial unique index precedent (for "one active grant per user/role/space")
```sql
-- Source: supabase/migrations/20240101000000_initial_schema.sql (read directly, 2026-08-02)
CREATE INDEX idx_verification_runs_active ON verification_runs(user_id) WHERE status = 'active';
```
The same technique — a partial index scoped to the "live" status — is the right tool for preventing duplicate active `role_grants` rows while still allowing re-granting after revocation:
```sql
CREATE UNIQUE INDEX uq_role_grants_active
  ON role_grants(user_id, role, space_id)
  WHERE status = 'active';
```
(A plain `UNIQUE` constraint would incorrectly block re-granting a role after a prior revocation.)

### The `merch_orders` RLS posture — the actual precedent for RBAC-04's "RLS denies anon-key reads"
```sql
-- Source: supabase/migrations/20260622000001_merch_orders_rls.sql, described in
-- apps/web/src/lib/supabase/db.ts and ARCHITECTURE.md (read directly, 2026-08-02)
ALTER TABLE public.merch_orders ENABLE ROW LEVEL SECURITY;
-- No policies added. Anon key: fully denied. Service role: bypasses RLS, unaffected.
```
This is the simplest and most honest way to satisfy RBAC-04 for `community_manager_applications`, `role_grants`, and `role_grant_events`: enable RLS, add zero anon-reachable policies. It does not pretend to be per-user filtering (which would require `app.current_user_id` to actually be set — see Pitfall 1).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|----------------|--------|
| Flat `lib/supabase/db.ts` + inline try/catch routes | Layered `server/{http,app,domain,infra}/` with `neverthrow` `ResultAsync<T, AppError>` | Introduced with issue #32 (identity verification), shipped 2026-07-27 — after `.planning/codebase/CONVENTIONS.md`'s 2026-06-28 snapshot | New privileged-route code (this phase) should target the newer pattern; `.planning/codebase/CONVENTIONS.md`/`ARCHITECTURE.md` are stale on this point and should not be read as the only sanctioned style |
| Native Postgres `ENUM` types for status/type columns | `TEXT NOT NULL CHECK (col IN (...))` | Shifted by the time of `identity_documents` (2026-07-27) vs. `20240101000000` (2024) | New status/role columns in this phase should use TEXT+CHECK, matching the newer convention |
| Per-user RLS meant to be the enforcement layer | Service-role bypass for all real traffic; RLS as anon-key deny-by-default only | Became visible via SEC-01 (`20260628000002`) and the `merch_orders` RLS pattern; confirmed by direct code search (2026-08-02) that `withUserContext` has zero call sites | Authorization logic for this phase belongs in application code, not RLS policies |

**Deprecated/outdated:** Nothing library-level is deprecated here — Node/Next.js/Supabase-js versions are unaffected by this phase's scope.

## Open Questions

1. **Does `space_admin` (not just `super_admin`) have suspend power, and if so, scoped to their own space only?**
   - What we know: Issue #79's verbatim text names only super admins for suspend ("Allow super admins to suspend access independently of billing and record the reason"). The locked Decisions section repeats this framing ("Super admins can suspend access independently of any other condition") without explicitly forbidding scoped `space_admin` suspension. ROADMAP's phase success criterion #3 says "an admin... can approve, reject, or suspend" generically.
   - What's unclear: Whether `space_admin` can suspend a `community_manager` grant within their own space, or whether suspend is exclusively a `super_admin` action.
   - Recommendation: Default to `space_admin` can approve/reject/suspend only within their own `space_id`; `super_admin` can do all three anywhere (including suspending a `space_admin`, which no `space_admin` can do to another `space_admin` or to a peer). Confirm this reading explicitly at plan time rather than resolving it silently in code — it's a one-line decision in the authorization helper's requirement list but worth a visible plan decision.

2. **Does approval create the `role_grants` row immediately, or only once the (future) billing check passes?**
   - What we know: RBAC's own success criterion 4 requires that "an approved applicant with no billing has no manager access." The composed-requirements design in this research handles this cleanly by creating the grant on approval (status `active`) and adding a second, currently-vacuous `billingActive` requirement that Phase 6 fills in.
   - What's unclear: Whether the planner prefers this "grant exists but a second gate blocks it" model, or a "no grant row at all until both conditions are met" model where Phase 6 additionally creates the grant (rather than just flipping a billing flag).
   - Recommendation: Prefer the "grant exists, requirement gate blocks it" model — it keeps RBAC-01's "grants are rows with an explicit lifecycle" property true starting in Phase 5 (an `active` grant genuinely represents "approved, space-scoped, awaiting Phase 6's billing gate" — not a fiction), and it's what makes the requirements-composition pattern in "Architecture Patterns" work without a schema change in Phase 6.

3. **Where does the "current user's roles" surface for UI gating (show/hide the admin console nav item)?**
   - What we know: `MappedUserProfile` (`apps/web/src/services/user/profile.ts`) is the single choke point every authenticated response (`/api/auth/session`, `/api/auth/session/refresh`, `/api/user/profile`) goes through. It currently has no role field. Client-side role display is explicitly NOT the security boundary (locked decision: "never inferred client-side") — this is purely a UX question.
   - What's unclear: Whether this phase should extend `MappedUserProfile` with a lightweight `roles: { role, spaceId }[]` (or similar) for nav gating, or whether the review console should simply be an unlisted route that 403s for non-admins (server-enforced either way).
   - Recommendation: Extend `transformToProfile`/`MappedUserProfile` with a minimal roles array — it's a one-function change at an already-identified single choke point, and it materially improves the admin console's usability without weakening the security model (the route handlers still call `requireRole` independently).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^1.0.0 |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `cd apps/web && npx vitest run src/server/domain/authz src/__tests__/api/manager-applications.test.ts src/__tests__/api/admin-manager-applications.test.ts` |
| Full suite command | `pnpm --filter @sync/web test` (repo-wide: `pnpm test`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| RBAC-01 | Active-grant lookup returns the correct scoped row; partial-unique-index prevents duplicate active grants | unit (domain) + repo test | `npx vitest run src/server/domain/authz/policy.test.ts` | ❌ Wave 0 |
| RBAC-02 | `requireRole` denies with no grant, denies with a stubbed-false billing requirement, allows with grant + satisfied requirements; every privileged route returns 401/403 appropriately | unit (domain) + route test | `npx vitest run src/server/domain/authz/policy.test.ts src/__tests__/api/admin-manager-applications.test.ts` | ❌ Wave 0 |
| RBAC-03 | Submit creates a `submitted` application; approve/reject/suspend transitions are atomic (`.eq('status', ...)` guard), each records actor/timestamp/reason; double-approve race returns `noop`/`CONFLICT`, not a duplicate transition | route test (mocked repo, per `TESTING.md`'s vi.mock pattern) | `npx vitest run src/__tests__/api/manager-applications.test.ts src/__tests__/api/admin-manager-applications.test.ts` | ❌ Wave 0 |
| RBAC-04 | Every approve/reject/suspend/revoke call also inserts a `role_grant_events` row (mocked assertion); RLS on the three new tables denies the anon key | repo test (mocked) for the audit-insert call; **RLS denial is not covered by any existing automated test in this repo** — no table's RLS policies have an automated test today | `npx vitest run src/__tests__/api/admin-manager-applications.test.ts` (audit-insert assertion only) | ❌ Wave 0 (partial — RLS itself needs manual/SQL verification, no precedent for automating it here) |

### Sampling Rate
- **Per task commit:** `cd apps/web && npx vitest run <changed test files>`
- **Per wave merge:** `pnpm --filter @sync/web test`
- **Phase gate:** Full suite green before `/gsd:verify-work`; additionally, a manual `psql`/Supabase-Studio check that `SELECT * FROM role_grants` with the anon key returns zero rows (no existing automated RLS test to extend — see RBAC-04 row above)

### Wave 0 Gaps
- [ ] `apps/web/src/server/domain/authz/policy.ts` + colocated `policy.test.ts` — does not exist yet
- [ ] `apps/web/src/server/app/authz/require-role.ts` — the helper itself, no test scaffold yet
- [ ] `apps/web/src/server/infra/supabase/role.repo.ts` — no repo module yet
- [ ] `apps/web/src/__tests__/api/manager-applications.test.ts` and `admin-manager-applications.test.ts` — follow the `vi.mock` + dynamic-import pattern documented in `.planning/codebase/TESTING.md` (mock `@/services/auth/session`, the new `role.repo.ts` functions, and `@/lib/logger`)
- [ ] No RLS-policy automated test precedent exists anywhere in this repo (confirmed: no test file references Postgres RLS directly). This phase should not be the first to attempt automating it under time pressure — treat the anon-key-denial check as a manual/documented verification step, consistent with how SEC-01's RLS fix was verified in Phase 1.
- [ ] Framework install: none — Vitest is already configured at the repo root for `apps/web`

## Sources

### Primary (HIGH confidence — all read directly from this repository, 2026-08-02)
- `apps/web/src/middleware.ts`, `apps/web/src/lib/supabase/server.ts`, `apps/web/src/app/api/auth/session/route.ts`, `apps/web/src/app/api/auth/session/refresh/route.ts`, `apps/web/src/services/auth/session.ts` — session/identity plumbing
- `supabase/migrations/20240101000000_initial_schema.sql`, `20240101000001_rls_policies.sql`, `20240101000002_functions.sql`, `20260628000002_fix_rls_user_id_helper.sql`, `20260728000001_municipalities.sql`, `20260728000004_identity_documents.sql`, `20260615000001_user_city.sql` — schema, RLS convention, municipality/space shape, closest audited-table analogue
- `apps/web/src/server/http/{errors,respond}.ts`, `apps/web/src/server/app/identity/submit-document.ts`, `apps/web/src/server/domain/identity/decision.ts`, `apps/web/src/server/infra/supabase/identity.repo.ts`, `apps/web/src/server/app/municipality/get-profile.ts` — the layered architecture template
- `apps/web/src/lib/secureCompare.ts`, `apps/web/src/app/api/cron/*/route.ts` — the adjacent machine-auth pattern (not reused, but confirms webhook/cron conventions)
- `packages/shared/src/constants/index.ts` (`MUNICIPALITIES`, `KNESSET_SCOPE`), `packages/shared/src/contracts/identityDocument.ts`, `apps/web/src/services/user/profile.ts` (`MappedUserProfile`, `transformToProfile`), `apps/web/src/lib/supabase/types.ts` (`InsertTables`/`Tables`/`UpdateTables`, `users` Row shape)
- `apps/web/wrangler.jsonc`, `supabase/config.toml`, `apps/web/package.json`, root `package.json` — deployment target and confirmed installed dependency versions
- `.planning/phases/05-rbac-admin-review/05-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/codebase/{CONVENTIONS,ARCHITECTURE,CONCERNS,TESTING}.md`, `specs/auth-flow.md`, `specs/api-contracts.md`, `CLAUDE.md` — phase scope, requirements, project conventions

### Secondary (MEDIUM confidence)
- None — this phase's research required no external library lookups (no Context7/WebSearch calls were needed; the entire solution space is internal to this repository).

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; every recommendation cites an existing, already-shipped file in this repo
- Architecture: HIGH — the layered `server/` pattern and the `identity_documents` table-shape precedent were read directly, not inferred
- Pitfalls: HIGH for the RLS/`public.user_id()` and `withUserContext` findings (verified by repo-wide grep showing zero call sites); MEDIUM for the suspend-scope ambiguity (genuinely underspecified in source material, flagged as Open Question rather than asserted)

**Research date:** 2026-08-02
**Valid until:** This research is tied to the current state of `apps/web/src/server/` and `supabase/migrations/`; treat as stale if either changes materially before planning executes (~7 days for an actively-developed repo; re-check `withUserContext` call sites and the latest migration filename before planning if more than a few days have passed)
