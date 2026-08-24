# Research — issue #101

## Already-done check

1. `05-04` cross-user `role_grants` isolation harness — **MISSING**. `apps/web/src/__tests__/rls/` does not exist.
2. Harness loudly skips without credentials — **MISSING**. No harness or `apps/web/docs/RLS-TESTING.md`.
3. Harness asserts anon reads zero rows from all three tables — **MISSING**.
4. `POST /api/manager-applications` creates an application and audit row — **MISSING**. No `apps/web/src/app/api/manager-applications/route.ts`.
5. Duplicate submitted application returns conflict — **MISSING** at the API/use-case layer. The database constraint exists as `uq_cm_applications_open` in `supabase/migrations/20260802000002_role_grants_and_applications.sql`.
6. `GET /api/manager-applications` returns the caller’s application and live grants — **MISSING**.
7. Scoped admin queue — **MISSING**. `requireAdminScope()` and `listSubmittedApplications()` exist, but no review use-case or route calls them.
8. Approve creates an application-sourced active grant and audit row — **MISSING**.
9. Reject records a reason without creating a grant — **MISSING**.
10. Concurrent second review returns conflict — **MISSING** at the route/use-case layer. `decideApplication()` already provides the guarded `status='submitted'` update and returns `null` after a lost race (`apps/web/src/server/infra/supabase/role.repo.ts`).
11. Suspend/reinstate/revoke each audit actor and reason — **MISSING**.
12. A `space_admin` cannot act out of scope or on an admin-tier grant — **PARTIAL FOUNDATION ONLY**. The rule is encoded in `canReview()` (`apps/web/src/server/domain/authz/policy.ts:69`), but no grant-action route exercises it.
13. Audit-event UPDATE and DELETE raise in a real database — **PARTIAL**. The append-only trigger exists in `supabase/migrations/20260802000002_role_grants_and_applications.sql`; local database evidence covers append-only testing generally, but no issue-specific verification record exists.
14. At least one `super_admin` exists and can reach the console — **MISSING/UNVERIFIABLE**. No `INSERT INTO role_grants` fixture or bootstrap record exists, and the console route is absent.
15. Hebrew RTL, design-token-only applicant and admin screens — **MISSING**. Neither planned page exists.
16. Web typecheck, test, and lint acceptance gate — **MISSING for this scope**, because the required implementation and tests do not exist.

**Verdict: proceed.** The tree does not satisfy the issue and should not be closed.

## Current-state map

The RBAC foundation is present:

- Database transport:
  - `apps/web/src/lib/supabase/user-token.ts`
  - `apps/web/src/lib/supabase/signing-key.ts`
  - `apps/web/src/lib/supabase/user-client.ts`
  - `supabase/migrations/20260802000001_rls_transport.sql`
- RBAC schema and RLS:
  - `supabase/migrations/20260802000002_role_grants_and_applications.sql`
  - Defines `role_grants`, `community_manager_applications`, and append-only `role_grant_events`.
  - Defines six authenticated SELECT policies and no write policies.
  - Defines `public.is_platform_admin()` and `public.can_admin_space(TEXT)` as `SECURITY DEFINER` with `SET search_path = public`.
- Shared API contracts:
  - `packages/shared/src/contracts/role.ts`
  - Already defines submit, own-state, pending-queue, review-decision, and grant-action schemas.
- Repository layer:
  - `apps/web/src/server/infra/supabase/role.repo.ts`
  - Contains all twelve planned grant, application, and audit queries.
  - Reads and writes use `supabaseAdmin`, intentionally bypassing RLS.
- Authorization:
  - `apps/web/src/server/domain/authz/policy.ts`
  - `apps/web/src/server/app/authz/require-role.ts`
  - Exposes `requireRole`, `requireReviewAuthority`, and `requireAdminScope`.
- Contract mappers:
  - `apps/web/src/server/app/authz/mappers.ts`
  - Exposes `toManagerApplication()` and `toGrantSummary()`.
- Existing consumer:
  - `apps/web/src/server/app/pilot/authorize.ts`
  - Contrary to the issue’s “nothing uses them” statement, pilot authorization already attempts `requireRole(userId, 'super_admin', null)`, then falls back to `users.is_platform_admin`.

Still absent:

- `apps/web/src/__tests__/rls/harness.ts`
- `apps/web/src/__tests__/rls/role-tables.rls.test.ts`
- `apps/web/docs/RLS-TESTING.md`
- `apps/web/src/server/app/authz/submit-application.ts`
- `apps/web/src/server/app/authz/review-application.ts`
- All manager-application API routes and route tests
- `apps/web/src/app/[locale]/settings/community-manager/`
- `apps/web/src/app/[locale]/admin/manager-applications/`
- `apps/web/docs/RBAC-VERIFICATION.md`

## Integration points

- Authentication seam: route handlers use `getSessionFromRequest(request)` from `apps/web/src/services/auth/session`, return `unauthorized()` through `apps/web/src/server/http/respond.ts`, and pass `session.userId` into application use-cases. The thin-route pattern is visible in `apps/web/src/app/api/space-admin/[spaceId]/route.ts`.
- Authorization seam: privileged use-cases must call `requireReviewAuthority()` or `requireAdminScope()` from `apps/web/src/server/app/authz/require-role.ts`. Those compose the sole grant decision function, `requireRole()`.
- Repository seam: use the existing functions in `apps/web/src/server/infra/supabase/role.repo.ts`; routes should not query Supabase directly.
- Atomicity seam:
  - `decideApplication()` guards on `status='submitted'`.
  - `setGrantStatus()` guards on the expected current status.
  - A `null` result means conflict/lost race, not database failure.
- Platform grant seam: `findLiveGrant()` correctly uses `.is('space_id', null)` for `super_admin` grants (`apps/web/src/server/infra/supabase/role.repo.ts:35`).
- Audit seam: every transition inserts through `insertAuditEvent()`; there is deliberately no update/delete repository function.
- Mapping seam: use `toManagerApplication()` and `toGrantSummary()` from `apps/web/src/server/app/authz/mappers.ts`.
- Contract seam: parse all bodies and shape all responses with `packages/shared/src/contracts/role.ts`.
- RLS seam: create per-user clients through `createUserScopedClient(userId)`; anonymous probes use the anon key without an access token.
- Migration order:
  1. `20260802000001_rls_transport.sql`
  2. `20260802000002_role_grants_and_applications.sql`
  3. Later same-day migrations begin at `20260802000010_space_governance.sql`.
- Runtime constraint: no new route may declare `export const runtime = 'edge'`.
- UI precedent: copy structure and token usage from `apps/web/src/app/[locale]/settings/municipality/page.tsx` and `page.module.css`; preserve Hebrew and RTL conventions.

## Prior art

The nearest merged PR is commit `bc227bd` — **“RLS transport, authz enforcement, re-scoped money model, press homepage (#95)”**. It introduced the two RBAC migrations, user-scoped Supabase transport, shared role contracts, repository, policy core, authorization helpers, and their unit tests.

For route/use-case shape, the nearest later merged work is PR **#93**, commit `9d6bc53`, which added the space-admin application-service and thin-route architecture. Copy its session → application use-case → `respond()` boundary, while using the RBAC-specific authorization helpers and repositories already present.

## Constraint register

- The old plan text is stale about token transport. Plans 05-04 and 05-09 refer to `SUPABASE_JWT_SECRET` and HS256, but the current tree uses ES256, an issuer, `kid`, and published JWKS (`apps/web/src/lib/supabase/user-token.ts:1`; `apps/web/src/lib/supabase/signing-key.ts`). Do not implement the obsolete HS256 harness instructions verbatim.
- Production application state cannot be established from the working tree. `.planning/STATE.md` records that all migrations applied successfully to a local database, while the older RBAC summaries say the two migrations were unapplied. Neither is proof of current production state.
- Existing migration files `20260802000001` and `20260802000002` are protected dependencies. Do not alter the six policies or the two `SECURITY DEFINER` helpers.
- Any change under `supabase/migrations/` is a protected-path change under `docs/PR-AUTOPILOT.md:96`. The currently reviewed plans require no new migration.
- `role_grants`, applications, and audit queries remain service-role queries. User-scoped transport is for the real RLS harness; writes must not gain INSERT, UPDATE, DELETE, or ALL policies.
- `apps/web/src/server/app/pilot/authorize.ts` retains a legacy fallback to `users.is_platform_admin`. Therefore `role_grants` is not yet the exclusive platform-admin source across the whole application.
- `SECURITY-AUDIT.md:103` has an open low-severity finding concerning older tables whose policies use `auth.uid()`. It does not directly invalidate these three tables, which use `public.user_id()`, but it reinforces the need for a real JWT isolation test.
- `.planning/phases/05-space-governance-substrate-and-space-admin-operations-dashboard/05-EVIDENCE.md:641` explicitly says no RLS policy was exercised under a real end-user JWT. Local service-role/anon evidence does not satisfy RLS-04.
- No repository fixture or evidence document proves a `role_grants.role='super_admin'` row exists.
- `supabase/seed.sql` is recorded as broken in `.planning/STATE.md`; real-database tests must use an isolated fixture/cleanup path rather than assuming the default seed succeeds.
- The working tree was clean during research; no unrelated user changes need preservation.

## Open questions

1. Should implementation follow the issue’s current ES256/JWKS transport and revise plans 05-04/05-09 accordingly, replacing every `SUPABASE_JWT_SECRET`/HS256 instruction with the current signing-key and issuer requirements?
2. What authoritative production evidence should be used to establish whether migrations `20260802000001` and `20260802000002` are applied? The working tree contains conflicting historical records but no current production transcript.
3. Should bootstrap create a real `role_grants` `super_admin`, or is the newer `users.is_platform_admin` pilot fallback intended to remain a supported bootstrap mechanism? The issue requires the former, while current pilot code supports both.
4. Which applicant URL is authoritative for screenshots and navigation: the issue’s `/he/manager-application` or plan 05-07’s `/he/settings/community-manager`?
5. Where should sanitized visual evidence files be stored? Plan 05-09 requires screenshots but names only the Markdown verification record, not an evidence directory or filename convention.