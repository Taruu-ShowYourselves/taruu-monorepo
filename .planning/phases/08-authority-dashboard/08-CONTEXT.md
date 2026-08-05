# Phase 8: Municipality Onboarding + Authority Dashboard — Context

**Gathered:** 2026-08-03
**Status:** Ready for planning
**Source:** GitHub issue #76 (`Taruu-ShowYourselves/taruu-monorepo`), triaged 2026-08-02

<domain>
## Phase Boundary

Issue #76 asks for the whole municipal-authority lifecycle: an organization claims its city,
a human verifies it, representatives are invited and offboarded, and the verified authority
reads its own civic aggregates, answers residents on the record, and tracks what it said it
would do.

**This phase is a continuation of the Phase 5 line, not an independent build.** Every guardrail
in the issue maps one-to-one onto a Phase 5 primitive that already exists on disk:

| Issue #76 guardrail | Phase 5 primitive it consumes |
|---|---|
| "super-admin approval before a verified badge" | the `community_manager_applications` → review-console pattern (RBAC-03) |
| "representatives see only their municipality" | `requireRole()` in `apps/web/src/server/app/authz/require-role.ts` (RBAC-02) |
| "histories remain auditable after staff changes" | append-only `role_grant_events` + `public.reject_audit_mutation()` (RBAC-04) |
| "roles scoped to one space" | `role_grants` rows with an explicit lifecycle (RBAC-01) |
| RLS on the new tables | `public.user_id()`, `public.is_platform_admin()`, `public.can_admin_space()` + the `src/__tests__/rls/harness.ts` harness (RLS-01..05) |

Phase 5's migration `20260802000002_role_grants_and_applications.sql` anticipates this phase in
three inline comments — `role_grants.source` ("Issue #76 adds 'authority_claim' here"),
`community_manager_applications.evidence_urls` ("Issue #76 reuses this column for
authority-claim evidence"), and `role_grant_events.subject_type` ("generalizes past role grants
so issue #76 can record authority-claim decisions in the same table"). **Honour those comments.
Extend the CHECK constraints; do not create a parallel role table, a parallel audit table, or a
second authorization helper.**

**Ground truth, verified against the repo on 2026-08-03:**

- There is **no** `/authority` and **no** `/municipality-admin` route under
  `apps/web/src/app/[locale]/` (dirs present: about, coin, dashboard, download, economics,
  explore, faq, feed, how-it-works, knesset, live, municipality, onboarding, payments, pricing,
  privacy, refund, settings, sign-in, sign-up, store, support, terms, treasury, verification,
  votes).
- There is **no** authority API namespace under `apps/web/src/app/api/`.
- There is **no** organization, representative, official-response, commitment, or satisfaction
  table in any of the 30 migrations under `supabase/migrations/`.
- The only adjacent surface is the **public** `apps/web/src/app/[locale]/municipality/[slug]/page.tsx`
  and `apps/web/src/app/api/municipalities/[municipality]/route.ts` →
  `apps/web/src/server/app/municipality/get-profile.ts` → `getMunicipalityProfile()` in `db.ts`
  → the SQL function `municipality_profile_metrics(m)`.
- Phase 5 status on disk: plans 05-01 and 05-02 are committed (`96448b3`, `3dedcf0`); plan 05-03's
  artifacts (`server/domain/authz/policy.ts`, `server/app/authz/require-role.ts`,
  `server/app/authz/mappers.ts`, `server/infra/supabase/role.repo.ts`) exist **untracked** in the
  working tree on branch `feat/rls-transport`. Plans 05-04..05-09 have not run.

**Explicitly out of scope, from the issue itself:** government-level dashboard, legal filing,
resident identity access, and automatic authority verification.

</domain>

<hard_dependencies>
## Hard Dependencies

**Phase 5 must be EXECUTED, not merely planned.** Nine plans, six waves, ending with 05-09 —
which applies both migrations to the live database, sets `SUPABASE_JWT_SECRET` as a Worker
secret, and bootstraps the first `super_admin`. Without 05-09 there is no super-admin to perform
the evidence review this phase's first success criterion demands, and every `/admin/*` route
403s for every human.

Two of Phase 5's own unresolved blockers propagate into this phase and must be cleared before
08-13 can sign off:
1. `SUPABASE_JWT_SECRET` is unset (readable only from the Supabase dashboard).
2. The HS256 assumption is unverified against the live project — a project migrated to
   asymmetric signing keys has the legacy HS256 secret disabled, in which case RLS-01's minter
   does not apply and this phase's RLS policies are unprovable.

**Phase 7 is not a hard dependency, and this is a recorded risk, not an oversight.**

Every read and write in this phase goes through `supabaseAdmin` (the service-role client), which
bypasses RLS entirely — that is the established pattern of the whole codebase and of Phase 5's
own `role.repo.ts`. Authorization is enforced in application code by `requireRole()` and its
Phase 8 composition, never by a policy. The RLS policies this phase adds are a defence-in-depth
backstop against the anon key and against Phase 7's future user-scoped reads.

> **RISK, accepted in writing (2026-08-03).** Shipping authority access before Phase 7 (MIG-01..04)
> means the boundary between two municipalities' organizational data is enforced by exactly one
> layer — the application. A single route that forgets `resolveAuthorityScope()` and trusts a
> client-supplied `municipalityId` leaks municipality B to municipality A with nothing underneath
> to catch it. Mitigations, all mandatory in the plans below:
> 1. **No route in this phase accepts a municipality from the client.** Scope is derived
>    server-side from the caller's active `role_grants` rows. This is enforced by an automated
>    grep guard in 08-13, not by review discipline.
> 2. Every authority table gets working RLS policies (via `public.is_authority_member()`) in the
>    same migration that creates it, so Phase 7 has nothing to retrofit here.
> 3. The RLS harness from 05-04 is extended to the new tables in 08-13, proving cross-municipality
>    invisibility at the database layer even though no production read depends on it yet.
>
> If Phase 7 lands first, plans 08-03 and 08-13 gain a straightforward follow-up (swap the repo
> onto `createUserScopedClient()`); nothing in this phase's design has to change.

</hard_dependencies>

<decisions>
## Implementation Decisions — LOCKED

### 1. Two new roles, on the existing `role_grants` table

`role_grants.role`'s CHECK constraint is **altered** to admit `authority_admin` and
`authority_rep`. No new role table. `role_grants_scope_ck` already requires
`role <> 'super_admin' ⇒ space_id IS NOT NULL`, so both new roles are space-scoped for free.

- `authority_admin` — the verified organization's lead. Granted **only** by a super-admin, at the
  moment the organization's claim is approved, to the claimant. Can invite, suspend, reinstate and
  offboard representatives inside its own municipality.
- `authority_rep` — an invited representative. Read access to the dashboard, authorship of
  official responses and targets. Cannot manage other representatives.

`role_grants.source`'s CHECK gains `authority_claim` and `authority_invitation` (Phase 5's inline
comment already reserves the first). `role_grant_events.subject_type`'s CHECK gains
`authority_claim`, `authority_rep_invitation` and `authority_organization`. The existing `event`
vocabulary (`submitted`, `approved`, `rejected`, `granted`, `suspended`, `reinstated`, `revoked`)
covers every access transition in this phase without extension.

`ADMIN_TIER_ROLES` in `apps/web/src/server/domain/authz/policy.ts` gains both new roles, so
`canReview()` restricts acting on an authority grant from the admin console to `super_admin`
alone — a `space_admin` (a community-moderation tier) can neither grant nor revoke authority
access.

### 2. Representative lifecycle maps onto the primitives — it does not invent a new one

AUTH-02 names four states: invited, active, suspended, offboarded.

| AUTH-02 state | Where it lives |
|---|---|
| invited | `authority_rep_invitations.status = 'pending'` — **no** `role_grants` row exists yet |
| active | `role_grants.status = 'active'`, role `authority_rep`, `space_id` = the municipality |
| suspended | `role_grants.status = 'suspended'` |
| offboarded | `role_grants.status = 'revoked'`, `ended_at` set |

Acceptance of an invitation is the only path that creates the grant. Offboarding uses Phase 5's
`setGrantStatus(grantId, 'active', 'revoked', endedAt)` guarded transition — it never deletes a
row, and it writes a `role_grant_events` row that outlives the grant.

### 3. Verification is a super-admin decision, enforced structurally

`authority_organizations.verification_status` starts `unverified` and carries a table CHECK:

```sql
CHECK (
  verification_status <> 'verified'
  OR (verified_by IS NOT NULL AND verified_at IS NOT NULL AND verification_reason IS NOT NULL)
)
```

A verified row without a recorded actor, timestamp and reason is **not representable**. Evidence
is stored on the claim (`authority_claims.evidence_urls`, mirroring Phase 5's column) and copied
onto the organization at approval (`verification_evidence`) so the record survives claim deletion.

A partial unique index `uq_authority_org_verified ON authority_organizations (municipality_id)
WHERE verification_status = 'verified'` makes "two organizations are the official municipality"
unrepresentable — success criterion 1, in the schema.

`resolveAuthorityScope()` additionally requires the organization to be `verified` at read time, so
suspending an organization removes all dashboard, response and target access on the next request
without touching a single grant row or deleting any history (success criterion 6).

### 4. The public municipality page is untouched by this phase

Success criterion 6 says the public council page must "continue to render exactly as it did
before the authority joined". There is a surface reading of the issue that would put a verified
badge there. **That reading is rejected.** The verified badge lives where it is actually load
bearing — on official responses, where a resident is deciding whether they are reading the
municipality or Taruu.

Concretely: no plan in this phase edits `apps/web/src/app/[locale]/municipality/[slug]/page.tsx`,
`apps/web/src/app/api/municipalities/[municipality]/route.ts`,
`apps/web/src/server/app/municipality/get-profile.ts`, `getMunicipalityProfile()` in `db.ts`, or
`MunicipalityProfileResponse` in `packages/shared/src/contracts/municipality.ts`.

Plan 08-02 lands an automated regression guard **before any authority code exists**: a test that
reads those source files and asserts they contain no authority identifier, plus a frozen key list
for `MunicipalityProfileResponse` so any additive authority field fails the suite. The guard is
wave 1 on purpose — a regression guard written after the regression is a formality.

### 5. Minimum cohort size = **10**. Withheld, never rounded.

`MIN_COHORT_SIZE = 10`, exported from `apps/web/src/server/domain/authority/cohort.ts` and
recorded on every snapshot row (`min_cohort_size`) so a historical figure can be read back against
the floor that was in force when it was captured.

The withheld representation carries **no numeric value at all**:

```ts
type Aggregate<T> =
  | { withheld: true;  cohortSize: number; minCohortSize: number }
  | { withheld: false; cohortSize: number; value: T };
```

Not a rounded value, not a bucketed value, not `0`. The 08-02 test asserts the serialized payload
does not contain the suppressed number anywhere.

**Scope of the rule — this matters.** The floor governs aggregates this phase *introduces*. It
does not retroactively suppress data that is already public by product design: vote tallies,
participant counts and the municipality profile's satisfaction average are on the public council
page today and stay exactly as they are. Applying a floor to already-public numbers would be
incoherent (the same figure visible to anonymous visitors and withheld from the authority) and
would violate decision 4. The floor applies to: satisfaction broken down by any cut, engagement
segments, response-rate cuts, per-vote demographic slices, and every CSV export.

### 6. Official responses and targets are append-only version chains

Both `official_responses` and `authority_commitments` are **insert-only**. A revision is a new row
with `version = previous + 1`; the prior text, its author byline and its timestamp stay on the
prior row forever. Both tables get a `BEFORE UPDATE OR DELETE` trigger calling Phase 5's existing
`public.reject_audit_mutation()` — the same function, not a copy. Retraction is a new version with
`publication_state = 'retracted'`, not an UPDATE and not a delete.

Because a row must remain readable after its author is offboarded or deleted, every version row
carries **denormalized byline snapshots** alongside the nullable FK:
`author_user_id UUID REFERENCES users(id) ON DELETE SET NULL`, plus `author_display_name TEXT NOT
NULL` and (for responses) `author_org_name_he TEXT NOT NULL`. Success criterion 4 is then a
property of the schema rather than a promise.

`official_responses` is deliberately world-readable — `USING (true)`, with the written reason
Phase 7's MIG-01 requires: *an official response is a public statement by a public authority, and
its revision history is public by design; suppressing prior versions would defeat the point of
versioning them.*

### 7. Deadlines and escalations are tracking states, in the data model and in the copy

`authority_commitments.workflow_state ∈ {draft, published, in_progress, done, stalled, escalated,
withdrawn}` and `target_date DATE`. No column is named `deadline`, `due`, `obligation`, `sla` or
`breach`. The table COMMENT states that these carry no legal claim.

Hebrew copy uses **יעד** (target), never **התחייבות** (undertaking). Every authority page renders
the single shared constant:

```
AUTHORITY_TRACKING_DISCLAIMER_HE =
  'מצבי מעקב ותאריכי יעד הם מידע ציבורי בלבד, ללא תוקף משפטי.'
```

Plan 08-11 lands a source-scanning copy test (the pattern already used by
`apps/web/src/__tests__/services/participation-receipt-honesty.test.ts`) asserting every authority
page contains the disclaimer and none contains any of: `התחייבות משפטית`, `מחויבות משפטית`,
`חובה חוקית`, `אכיפה`, `הפרה`, `תביעה`, `קנס`.

### 8. Satisfaction snapshots are written on read, not by cron

`.planning/STATE.md` records that Cloudflare rejected this account's cron list behind an
account-level gate; only `0 */6 * * *` is live. A monthly-snapshot cron would inherit Phase 6's
blocker for no reason.

Instead `authority_satisfaction_snapshots` is written idempotently at most once per UTC day, on a
dashboard read, guarded by `uq_satisfaction_snapshot_day (municipality_id, snapshot_date)`. A
duplicate insert (SQLSTATE 23505) is a no-op, exactly like `recordUserVoteOnce`'s idempotency in
Phase 02.1. Snapshots carry no author FK, so they survive every staff change (AUTH-05).

### 9. Invitation tokens

32 random bytes, base64url, returned **once** in the invite response and never stored — only
`sha256(token)` is persisted in `authority_rep_invitations.token_hash` (UNIQUE). Acceptance looks
up by hash. The raw token is never logged, never written to an audit `detail` blob, and never
included in a repository return value. Invitations expire after 14 days
(`expires_at`), and an expired or already-accepted token returns the same generic error as an
unknown one.

### 10. Claude's Discretion (decided here, recorded so plans do not re-litigate)

- Route placement: `/[locale]/authority/onboarding` (claimant-facing) and
  `/[locale]/municipality-admin` (the verified authority's dashboard) — both named by the issue.
  The super-admin claim queue lives at `/[locale]/admin/authority-claims`, matching Phase 5's
  `/[locale]/admin/manager-applications`.
- API namespace: `/api/authority/*` for authority-scoped surfaces, `/api/admin/authority-*` for
  super-admin surfaces, both mirroring Phase 5's split.
- No notification emails in this phase. Invitations surface their accept URL to the inviting
  representative, who forwards it. Resend integration is a follow-up, not a criterion.
- No new visual vocabulary: the brutalist tech-press system is locked. Authority pages compose
  `@/components/press` and `@/components/uikit` only.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase definition
- `.planning/ROADMAP.md` — "### Phase 8" (line 194): goal, six success criteria, out-of-scope list
- `.planning/REQUIREMENTS.md` — AUTH-01..AUTH-06 (lines 72-77); RBAC-01..04 (lines 81-84)
- `.planning/STATE.md` — Blockers/Concerns; the Phase 8 roadmap-evolution entry (line 138)
- GitHub issue #76 — acceptance criteria, verification plan, visual evidence, rollback

### Phase 5 primitives this phase consumes (read before writing any migration or route)
- `.planning/phases/05-rbac-admin-review/05-CONTEXT.md` — forward-compatibility constraints for #76
- `.planning/phases/05-rbac-admin-review/05-02-SUMMARY.md` — exact table, index, policy and helper names
- `.planning/phases/05-rbac-admin-review/05-VALIDATION.md` — the validation contract this phase's mirrors
- `supabase/migrations/20260802000002_role_grants_and_applications.sql` — the three tables, the two
  `SECURITY DEFINER` scope helpers, `public.reject_audit_mutation()`, the six SELECT policies
- `supabase/migrations/20260802000001_rls_transport.sql` — `public.user_id()`, JWT-only
- `apps/web/src/server/app/authz/require-role.ts` — `requireRole`, `requireReviewAuthority`,
  `requireAdminScope`, `toGrantFacts`, `AdminScope`
- `apps/web/src/server/domain/authz/policy.ts` — `evaluateAuthorization`, `canReview`,
  `AUTHZ_REQUIREMENTS`, `ADMIN_TIER_ROLES`
- `apps/web/src/server/infra/supabase/role.repo.ts` — `findLiveGrant`, `listActiveGrants`,
  `findGrantById`, `insertGrant`, `setGrantStatus`, `insertAuditEvent`, `listAuditEvents`
- `apps/web/src/server/app/authz/mappers.ts` — `toGrantSummary`
- `packages/shared/src/contracts/role.ts` — `RoleNameSchema`, `RoleGrantStatusSchema`,
  `SpaceIdSchema`, `ReviewReasonSchema`, `RoleGrantSummarySchema`
- `apps/web/src/__tests__/rls/harness.ts` (created by plan 05-04) — `describeRls`, `anonClient`,
  `rlsUserClient`, `seedThrowawayUsers`, `expectAnonReadsNothing`, `expectCrossUserInvisible`

### The public surface this phase must not disturb
- `apps/web/src/app/[locale]/municipality/[slug]/page.tsx`
- `apps/web/src/app/api/municipalities/[municipality]/route.ts`
- `apps/web/src/server/app/municipality/get-profile.ts`
- `supabase/migrations/20260728000002_municipality_profile_metrics.sql`

### Conventions
- `CLAUDE.md` — design tokens, Hebrew/RTL, naming, import order, no hardcoded values
- `.planning/codebase/CONVENTIONS.md`, `ARCHITECTURE.md`, `TESTING.md`, `CONCERNS.md`
- `apps/web/src/server/http/errors.ts` + `respond.ts` — the `AppError` taxonomy and `parse`/`respond`
- `apps/web/src/server/infra/supabase/identity.repo.ts` — the `ResultAsync.fromPromise` repo idiom
- `apps/web/src/app/api/verification/document/route.ts` — the thin-shell route idiom
- `apps/web/src/__tests__/api/identity-document.test.ts` — the `vi.mock` route-test idiom
- `apps/web/src/__tests__/services/participation-receipt-honesty.test.ts` — the source-scanning
  copy-guard idiom (the only way to test `.tsx` copy in this repo)

</canonical_refs>

<repo_constraints>
## Repo Constraints (violating these breaks the suite)

- pnpm monorepo. Typecheck gate: `pnpm --filter @sync/web typecheck` (and
  `pnpm --filter @sync/shared typecheck` when contracts change).
- Vitest 1.6.1, `environment: 'node'`, `include: ['src/**/*.test.ts', 'src/**/*.spec.ts']`.
  **The glob does not collect `.tsx`.** There is no jsdom and no `@testing-library/react`.
  **Do not plan component-render tests.** Test extracted logic modules with injected dependencies,
  and assert page copy by reading the source file.
- **Never write a task whose verify command runs a test file a later task in the same plan creates**
  — vitest exits 1 with "No test files found". Either create the test in the same task as the code,
  or gate on `pnpm --filter @sync/web typecheck` plus a positive `grep`.
- DDL is applied through the Supabase Management API (keychain token) or the Studio SQL editor.
  There is no `supabase db push` script in this repo.
- Hebrew-only, RTL. All user-facing strings in Hebrew, no `en` copy for these surfaces.
- **Never add Claude or Anthropic as a git co-author, trailer, or collaborator on any commit.**
- Never print or copy a secret value.

</repo_constraints>

<specifics>
## Specific Ideas Carried From Issue #76

- "An unverified organization cannot appear as the official municipality" — enforced by the
  partial unique index plus the verified-requires-evidence CHECK, not by a code path that could be
  forgotten.
- "Representatives see only their municipality and permitted aggregate data" — enforced by
  `resolveAuthorityScope()` deriving the municipality from grants; no route reads a municipality
  from the request.
- "Residents can distinguish Taruu-generated content from official authority responses" — the
  response block on the vote page carries the organization's Hebrew name, the verified marker,
  the author byline and the revision count, and is visually separated from Taruu's own copy.
- "Commitment and satisfaction histories remain auditable after staff changes" — byline snapshots
  on every version row, author FK `ON DELETE SET NULL`, snapshots with no author FK at all.
- Verification plan (issue): invite and verification lifecycle, role isolation, official response
  versioning, cohort privacy, exports, representative offboarding — all six are rows in
  `08-VALIDATION.md`.
- Visual evidence (issue): screenshots of `/authority/onboarding`, `/municipality-admin`, the vote
  inbox, an official response, and the target/satisfaction views — plan 08-13.
- Rollback (issue): suspend verification and representative access without deleting history, and
  revert to public council pages only. Decision 4 makes the second half free — the public pages
  never changed.

</specifics>

<deferred>
## Deferred / Out of Scope

From the issue, explicitly out of scope:
- Government-level (national) dashboard
- Legal filing of any kind
- Resident identity access — no route in this phase returns a resident's name, email, phone, DID
  or identity fields to an authority, under any aggregation
- Automatic authority verification

Deferred by this phase's own decisions:
- Email/SMS notification of invitations, approvals and rejections (Resend integration)
- Migrating authority reads onto `createUserScopedClient()` — Phase 7, MIG-01..04
- A verified-authority badge anywhere on the public council page (decision 4)
- Cron-scheduled satisfaction snapshots (decision 8)
- Any billing or subscription for authority accounts — Phase 6 owns billing, and authority access
  is deliberately unpriced here

</deferred>

---

*Phase: 08-authority-dashboard*
*Context gathered: 2026-08-03 from GitHub issue #76, ROADMAP Phase 8, REQUIREMENTS AUTH-01..06,
and the executed/planned artifacts of Phase 5*
