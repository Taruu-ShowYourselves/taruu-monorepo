# Spec — issue #101 rls-isolation-harness v1

## Current state

The deployed RBAC tables and six authenticated SELECT policies have no automated cross-user isolation proof.  
RESEARCH.md identifies `createUserScopedClient(userId)` as the RLS seam and the current ES256/JWKS token transport as the authentication mechanism.  
Service-role access in `role.repo.ts` remains the repository/write seam and must be used only for isolated fixture setup.  
The harness must exercise `public.user_id()`, own-row policies, anonymous denial, and the `can_admin_space()` anti-recursion path.  
No files currently exist under `apps/web/src/__tests__/rls/`, and the stale 05-04 HS256 instructions must not be implemented.

## Goal

Add a reusable real-database test harness proving RLS-04: a token minted for user A resolves through `public.user_id()`, user A can read their own rows but not user B’s rows, anonymous access returns zero rows from all three RBAC tables, and the existing admin-scope policy executes without 42P17 recursion. The harness must refuse production, isolate its fixtures, and loudly report when credentials are absent.

This issue must be split: the proposed follow-up slices are applicant routes (05-05), admin routes (05-06), applicant UI (05-07), admin console (05-08), and super-admin bootstrap/evidence (05-09).

## In scope

- claim: apps/web/src/__tests__/rls/harness.ts
- claim: apps/web/src/__tests__/rls/role-tables.rls.test.ts
- claim: apps/web/docs/RLS-TESTING.md

## Out of scope

All 05-05 through 05-09 routes, use-cases, screens, navigation, screenshots, and production bootstrap work are deferred to separate PR-sized slices.

Also excluded:

- Any application or admin API route.
- Any billing or payment behavior.
- Any UI work.
- Creating a production `super_admin`.
- Changing schemas, policies, triggers, or SECURITY DEFINER helpers.
- Adding write policies or moving service-role queries to user-scoped clients.
- Migrating the other 25 tables to user-scoped transport.
- Modifying the pilot authorization fallback.
- Creating persistent evidence files beyond the claimed operator documentation.

The issue-wide append-only mutation proof belongs in the later grant-action or verification slice; this slice only verifies SELECT isolation.

## Contracts

The reusable harness must export:

- `readRlsTestEnv`
- `describeRls`
- `anonClient`
- `serviceClient`
- `rlsUserClient`
- `seedThrowawayUsers`
- `expectAnonReadsNothing`
- `expectCrossUserInvisible`
- `RLS_TEST_MARKER`

Credential handling must follow the current ES256/JWKS integration identified by RESEARCH.md:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `SUPABASE_TP_PRIVATE_JWK`

The harness must use `mintSupabaseAccessToken()` from `apps/web/src/lib/supabase/user-token.ts`; it must not introduce `SUPABASE_JWT_SECRET`, HS256 signing, or a second token implementation. The configured database must already trust the issuer and published JWKS.

Integration invariants:

- User probes use the anon key plus an ES256 access token.
- Anonymous probes use the anon key without an access token.
- Service-role access is limited to fixture setup and permitted cleanup, never RLS assertions.
- Fixture users and mutable rows carry a unique run marker and cleanup targets only those fixtures.
- The harness refuses to run when `NODE_ENV=production`.
- Missing credentials produce a visible warning and skipped tests, never a silent passing suite.
- `rpc('user_id')` returns user A’s UUID for A’s token and `null` anonymously.
- User A sees their own seeded `role_grants` row and not user B’s.
- Anonymous clients read zero rows from `role_grants`, `community_manager_applications`, and `role_grant_events`.
- Granting A an active `space_admin` role for B’s space makes B’s in-scope application visible to A, exercising `can_admin_space()` without 42P17.
- Existing migrations `20260802000001_rls_transport.sql` and `20260802000002_role_grants_and_applications.sql` remain unchanged.
- No INSERT, UPDATE, DELETE, or ALL RLS policy is added.
- Append-only audit rows created by the test may remain with an unmistakable test marker because the database correctly forbids their cleanup.

## Acceptance gates

- G-1: With current real-database credentials loaded, the focused suite exits zero, reports no skipped tests, and proves JWT transport plus cross-user `role_grants` isolation. → evidence: `cd apps/web && npx vitest run src/__tests__/rls/role-tables.rls.test.ts --reporter=verbose`

- G-2: The focused suite asserts anonymous `public.user_id()` is null and anonymous SELECT returns zero rows from all three RBAC tables. → evidence: `cd apps/web && npx vitest run src/__tests__/rls/role-tables.rls.test.ts --reporter=verbose`

- G-3: The focused suite exercises the `space_admin` visibility path and exits zero without Postgres error 42P17. → evidence: `cd apps/web && npx vitest run src/__tests__/rls/role-tables.rls.test.ts --reporter=verbose`

- G-4: Removing any required database or ES256 credential produces the documented warning and marks the focused suite skipped rather than passed. → evidence: `cd apps/web && env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY -u SUPABASE_SERVICE_ROLE_KEY -u NEXT_PUBLIC_APP_URL -u SUPABASE_TP_PRIVATE_JWK npx vitest run src/__tests__/rls/role-tables.rls.test.ts --reporter=verbose`

- G-5: The existing JWT transport still reaches `public.user_id()` after the harness work. → evidence: `node apps/web/scripts/verify-rls-transport.mjs`

- G-6: The complete web test suite has no regression. → evidence: `pnpm --filter @sync/web test`

- G-7: Claimed TypeScript files typecheck and the web package remains lint-clean, with no more than the two documented pre-existing warnings. → evidence: `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web lint`

- G-8: No forbidden schema or runtime changes appear in the PR. → evidence: `git diff --name-only -- supabase/migrations/ .github/workflows/ apps/web/src/app/api/payments/` returns no paths.

## Protected paths

- `supabase/migrations/` — protected and unclaimed; existing migrations, policies, triggers, and SECURITY DEFINER helpers must not change.
- `.github/workflows/` — protected and unclaimed; this slice does not alter CI or credential handling.
- `apps/web/src/app/api/payments/` — protected and unclaimed; payment behavior is unrelated and explicitly out of scope.

## Risk & rollback

The principal risk is a harness that passes while using service-role access or while all real-database tests are skipped. Separate client factories, explicit user/anonymous assertions, visible skip output, and G-1 prevent that false proof. Running against a shared database also risks fixture leakage, so setup must use uniquely marked throwaway records, refuse production, and clean only records created by the current run; append-only test audit rows remain intentionally marked.

Rollback is a revert of the three claimed files. No database migration or production policy changes are made, so rollback leaves the deployed RBAC foundation unchanged.