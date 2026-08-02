---
phase: 5
slug: rbac-admin-review
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-02
updated: 2026-08-02
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `05-RESEARCH.md` → Validation Architecture, revised 2026-08-02 when the RLS
> foundation (RLS-01..05) was folded into this phase.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^1.0.0 (already configured — no install needed) |
| **Config file** | `apps/web/vitest.config.ts` (unchanged by this phase) |
| **Quick run command** | `cd apps/web && npx vitest run src/lib/supabase src/server/domain/authz src/server/app/authz src/__tests__/api/manager-applications.test.ts src/__tests__/api/admin-manager-applications.test.ts` |
| **Full suite command** | `pnpm --filter @sync/web test` |
| **RLS suite command** | `cd apps/web && set -a && . ./.dev.vars && set +a && npx vitest run src/__tests__/rls` |
| **Estimated runtime** | ~20 seconds quick, ~60 seconds full, ~15 seconds RLS (network-bound) |

The RLS suite is separated because it is the only suite that needs a real database. It **skips** —
loudly, with an actionable message — when `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_JWT_SECRET` is missing, so
`pnpm --filter @sync/web test` stays green in a credential-free environment. **A run reporting 0
tests is a skip, not a pass** — check the count.

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npx vitest run <changed test files>`
- **After every plan wave:** Run `pnpm --filter @sync/web test`
- **Before `/gsd:verify-work`:** Full suite green, **plus** the RLS suite green against a real
  database with a non-zero test count (plan 05-09 Task 1 step 4)
- **Max feedback latency:** 60 seconds

No watch-mode flags anywhere — every command above is a single-shot `vitest run`.

---

## Per-Task Verification Map

Task IDs are assigned by the planner; this map binds each requirement to its verification and is the
contract plans must satisfy.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|---|---|---|---|---|---|
| RLS-01 | The minter issues an HS256 token over `SUPABASE_JWT_SECRET` with `sub` = user UUID, `role`/`aud` = `authenticated`, `exp - iat` = 300s; it does not verify against `JWT_SECRET`; it carries no email/googleId/did | unit (no DB) | `npx vitest run src/lib/supabase/user-token.test.ts` | ❌ W0 | ⬜ pending |
| RLS-02 | `createUserScopedClient` passes the **anon** key (never the service-role key) plus an `accessToken` callback whose token has the right `sub`, and memoizes it within the TTL | unit (mocked `createClient`) | `npx vitest run src/lib/supabase/user-client.test.ts` | ❌ W0 | ⬜ pending |
| RLS-03 | `withUserContext` is no longer exported from `@/lib/supabase/server`; `set_claim` appears nowhere in `apps/web/src` or `packages`; the migration drops the SQL function and removes the `app.current_user_id` fallback | unit + grep | `npx vitest run src/__tests__/lib/supabase-server.test.ts` and the plan 05-01 Task 3 grep block | ✅ exists (must be edited) | ⬜ pending |
| RLS-04 | A token minted for user A reads A's rows and **not** B's across all three tables; anon-key reads return zero rows; `rpc('user_id')` returns A's uuid under A's token and null for anon; a `space_admin` grant widens visibility without raising 42P17; a user-scoped write is rejected | integration (real DB, env-gated) | `cd apps/web && set -a && . ./.dev.vars && set +a && npx vitest run src/__tests__/rls` | ❌ W0 | ⬜ pending |
| RLS-05 | Six `FOR SELECT TO authenticated` policies exist on the three new tables, zero write policies, and both scope helpers are `SECURITY DEFINER` with `SET search_path = public` | grep on the migration + the RLS-04 suite proving they actually filter | plan 05-02 Task 1 grep block, then the RLS suite above | ❌ W0 | ⬜ pending |
| RBAC-01 | Active-grant lookup returns the correct scoped row; a partial unique index prevents duplicate active grants | unit (domain) + repo test | `npx vitest run src/server/domain/authz/policy.test.ts` | ❌ W0 | ⬜ pending |
| RBAC-02 | `requireRole` denies with no grant, denies with a stubbed-false billing requirement, allows with grant + satisfied requirements; every privileged route returns 401/403 appropriately | unit (domain) + route test | `npx vitest run src/server/domain/authz/policy.test.ts src/__tests__/api/admin-manager-applications.test.ts` | ❌ W0 | ⬜ pending |
| RBAC-03 | Submit creates a `submitted` application; approve/reject/suspend transitions are atomic via an `.eq('status', ...)` guard and each records actor, timestamp, and reason; a double-approve race returns `noop`/`CONFLICT` rather than a duplicate transition | route test (mocked repo, per `TESTING.md` `vi.mock` pattern) | `npx vitest run src/__tests__/api/manager-applications.test.ts src/__tests__/api/admin-manager-applications.test.ts` | ❌ W0 | ⬜ pending |
| RBAC-04 | Every approve/reject/suspend/revoke also inserts a `role_grant_events` row (mocked assertion); the append-only trigger rejects UPDATE and DELETE | repo test (mocked) + manual SQL probe | `npx vitest run src/__tests__/api/admin-manager-applications.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> **Changed 2026-08-02.** The previous `RBAC-04 (RLS half)` row read "RLS on the three new tables
> denies the anon key — **manual**, no automated RLS test precedent exists in this repo." That row
> is **removed**. RLS-04 automates exactly that check and creates the precedent; the manual SQL
> session it described is no longer acceptable evidence.

---

## Wave 0 Requirements

Nothing to install — Vitest is already configured for `apps/web` at the repo root, and
`@supabase/supabase-js@2.90.1` and `jose` are already dependencies. Wave 0 is purely scaffolding
files that do not exist yet:

- [ ] `apps/web/src/lib/supabase/user-token.ts` + colocated `user-token.test.ts` — the minter (RLS-01)
- [ ] `apps/web/src/lib/supabase/user-client.ts` + colocated `user-client.test.ts` — the user-scoped client (RLS-02)
- [ ] `apps/web/src/__tests__/rls/harness.ts` — reusable RLS primitives, extended by Phase 7 (RLS-04)
- [ ] `apps/web/src/__tests__/rls/role-tables.rls.test.ts` — the Phase 5 RLS assertions (RLS-04)
- [ ] `apps/web/docs/RLS-TESTING.md` — how to point the harness at a database
- [ ] `apps/web/src/server/domain/authz/policy.ts` + colocated `policy.test.ts`
- [ ] `apps/web/src/server/app/authz/require-role.ts` — the single authorization helper (RBAC-02)
- [ ] `apps/web/src/server/infra/supabase/role.repo.ts` — repository module
- [ ] `apps/web/src/__tests__/api/manager-applications.test.ts` — applicant-side routes
- [ ] `apps/web/src/__tests__/api/admin-manager-applications.test.ts` — admin review routes

One existing file must be **edited**, not created:
- [ ] `apps/web/src/__tests__/lib/supabase-server.test.ts:50` asserts `withUserContext` is a
      function. Plan 05-01 deletes that function, so the assertion flips to
      `expect('withUserContext' in mod).toBe(false)` in the same plan or the suite breaks.

All new mocked test files follow the `vi.mock` + dynamic-import pattern documented in
`.planning/codebase/TESTING.md`, mocking `@/services/auth/session`, the new `role.repo.ts`
functions, and `@/lib/logger`. The RLS suite mocks nothing — mocking is the one thing that would
make it worthless.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| Both migrations are applied to the live database, in order | RLS-03, RLS-05, RBAC-01 | No `supabase db push` script and no running local Postgres; DDL goes through the Supabase Management API with a keychain token | Plan 05-09 Task 1, steps 2–3 |
| `SUPABASE_JWT_SECRET` is set locally and as a Worker secret | RLS-01 | The value exists only in the Supabase dashboard and cannot be read by any automation here | Plan 05-09 Task 1, step 1 |
| The append-only trigger rejects UPDATE and DELETE | RBAC-04 | The trigger fires only against a real Postgres; the mocked repo tests assert the call, not the constraint | Plan 05-09 Task 1, step 5 |
| A first `super_admin` grant exists | RBAC-01 | Bootstrap — there is no in-app path to create the first platform admin, by design | Plan 05-09 Task 1, step 6 |
| Visual evidence of the applicant form, review console and approve/suspend flow | RBAC-03 | Issue #79 explicitly asks for screenshots with sanitized test records | Plan 05-09 Task 2 |

> Every remaining manual item is genuinely un-automatable from this repo (a dashboard secret, a DDL
> application path, a screenshot). The RLS behaviour that used to be here is now RLS-04 and runs as
> a command.

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify command or a declared Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references listed above
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `pnpm --filter @sync/web test` green
- [ ] RLS suite green against a real database with a **non-zero** test count (0 tests = skipped, not passed)
- [ ] Remaining manual verifications performed and recorded in `apps/web/docs/RBAC-VERIFICATION.md`
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
