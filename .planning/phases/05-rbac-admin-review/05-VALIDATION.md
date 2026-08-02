---
phase: 5
slug: rbac-admin-review
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-02
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `05-RESEARCH.md` → Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^1.0.0 (already configured — no install needed) |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `cd apps/web && npx vitest run src/server/domain/authz src/server/app/authz src/__tests__/api/manager-applications.test.ts src/__tests__/api/admin-manager-applications.test.ts` |
| **Full suite command** | `pnpm --filter @sync/web test` |
| **Estimated runtime** | ~15 seconds quick, ~60 seconds full |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npx vitest run <changed test files>`
- **After every plan wave:** Run `pnpm --filter @sync/web test`
- **Before `/gsd:verify-work`:** Full suite must be green, **plus** the manual anon-key RLS check below
- **Max feedback latency:** 60 seconds

No watch-mode flags anywhere — every command above is a single-shot `vitest run`.

---

## Per-Task Verification Map

Task IDs are assigned by the planner; this map binds each requirement to its verification and is the contract plans must satisfy.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|---|---|---|---|---|---|
| RBAC-01 | Active-grant lookup returns the correct scoped row; a partial unique index prevents duplicate active grants | unit (domain) + repo test | `npx vitest run src/server/domain/authz/policy.test.ts` | ❌ W0 | ⬜ pending |
| RBAC-02 | `requireRole` denies with no grant, denies with a stubbed-false billing requirement, allows with grant + satisfied requirements; every privileged route returns 401/403 appropriately | unit (domain) + route test | `npx vitest run src/server/domain/authz/policy.test.ts src/__tests__/api/admin-manager-applications.test.ts` | ❌ W0 | ⬜ pending |
| RBAC-03 | Submit creates a `submitted` application; approve/reject/suspend transitions are atomic via an `.eq('status', ...)` guard and each records actor, timestamp, and reason; a double-approve race returns `noop`/`CONFLICT` rather than a duplicate transition | route test (mocked repo, per `TESTING.md` `vi.mock` pattern) | `npx vitest run src/__tests__/api/manager-applications.test.ts src/__tests__/api/admin-manager-applications.test.ts` | ❌ W0 | ⬜ pending |
| RBAC-04 | Every approve/reject/suspend/revoke also inserts a `role_grant_events` row (mocked assertion) | repo test (mocked) | `npx vitest run src/__tests__/api/admin-manager-applications.test.ts` | ❌ W0 | ⬜ pending |
| RBAC-04 (RLS half) | RLS on the three new tables denies the anon key | **manual** — see below | none | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Nothing to install — Vitest is already configured for `apps/web` at the repo root. Wave 0 is purely scaffolding files that do not exist yet:

- [ ] `apps/web/src/server/domain/authz/policy.ts` + colocated `policy.test.ts`
- [ ] `apps/web/src/server/app/authz/require-role.ts` — the single authorization helper (RBAC-02)
- [ ] `apps/web/src/server/infra/supabase/role.repo.ts` — repository module
- [ ] `apps/web/src/__tests__/api/manager-applications.test.ts` — applicant-side routes
- [ ] `apps/web/src/__tests__/api/admin-manager-applications.test.ts` — admin review routes

All new test files follow the `vi.mock` + dynamic-import pattern documented in `.planning/codebase/TESTING.md`, mocking `@/services/auth/session`, the new `role.repo.ts` functions, and `@/lib/logger`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| Anon-key reads of `role_grants`, `community_manager_applications`, and `role_grant_events` are denied | RBAC-04 | **No RLS-policy automated test precedent exists anywhere in this repo** — confirmed by the researcher; no test file references Postgres RLS directly. Phase 5 should not be the first to attempt automating it under launch-week pressure. This matches how SEC-01's RLS fix was verified in Phase 1. | With the anon key (not the service-role key), run `SELECT * FROM role_grants;`, `SELECT * FROM community_manager_applications;`, and `SELECT * FROM role_grant_events;` via Supabase Studio or `psql`. Each must return zero rows. Record the result in the phase summary. |

> This is a known, accepted gap rather than an oversight. If RLS automation is wanted, it belongs in its own phase covering **every** table, not bolted onto this one.

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify command or a declared Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references listed above
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] Manual anon-key RLS check performed and recorded
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
