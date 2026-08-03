---
phase: 8
slug: authority-dashboard
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-03
updated: 2026-08-03
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from ROADMAP Phase 8's six success criteria and issue #76's verification plan
> ("Test invite and verification lifecycle, role isolation, official response versioning,
> cohort privacy, exports, and representative offboarding").

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 1.6.1 (already configured — no install needed) |
| **Config file** | `apps/web/vitest.config.ts` (unchanged by this phase) |
| **Quick run command** | `cd apps/web && npx vitest run src/server/domain/authority src/server/app/authority src/__tests__/api/authority-*.test.ts src/__tests__/api/municipality-public-surface.test.ts` |
| **Full suite command** | `pnpm --filter @sync/web test` |
| **RLS suite command** | `cd apps/web && set -a && . ./.dev.vars && set +a && npx vitest run src/__tests__/rls` |
| **Typecheck gate** | `pnpm --filter @sync/web typecheck` (+ `pnpm --filter @sync/shared typecheck` when contracts change) |
| **Estimated runtime** | ~25s quick, ~90s full, ~20s RLS (network-bound) |

The RLS suite is inherited from plan 05-04 and is separated because it is the only suite needing a
real database. It **skips loudly** when `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_JWT_SECRET` is missing. **A run reporting 0 tests is a
skip, not a pass** — check the count.

**Two hard constraints on every verify command in this phase:**
1. `environment: 'node'`, no jsdom, no `@testing-library/react`, and `include` never collects
   `.tsx`. No task may plan a component-render test. Page copy is asserted by reading the source
   file (`participation-receipt-honesty.test.ts` is the precedent).
2. No task may verify against a test file a **later** task in the same plan creates — vitest exits
   1 with "No test files found". Such tasks gate on `pnpm --filter @sync/web typecheck` plus a
   positive `grep` instead.

---

## Sampling Rate

- **After every task commit:** `cd apps/web && npx vitest run <the test files that task touched>`
- **After every plan wave:** `pnpm --filter @sync/web test`
- **Before `/gsd:verify-work`:** full suite green, **plus** the RLS suite green against a real
  database with a non-zero test count (plan 08-13)
- **Max feedback latency:** 60 seconds

No watch-mode flags anywhere — every command is a single-shot `vitest run`.

---

## Per-Requirement Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Plan | Status |
|---|---|---|---|---|---|---|
| AUTH-01 | A `verified` organization row without `verified_by` + `verified_at` + `verification_reason` is rejected by the table CHECK; two verified orgs for one municipality are rejected by `uq_authority_org_verified` | grep on the migration + live SQL probe | 08-01 Task 1 grep block, then plan 08-13 step 3 | ❌ W0 | 08-01, 08-13 | ⬜ pending |
| AUTH-01 | Approving a claim writes `authority_organizations.verification_status='verified'` with actor/time/reason, copies the evidence, inserts one `role_grants` row (`authority_admin`, source `authority_claim`) and exactly one `role_grant_events` row; a second approve returns 409, not a second grant | route test (mocked repo) | `npx vitest run src/__tests__/api/authority-claims.test.ts` | ❌ W0 | 08-05 | ⬜ pending |
| AUTH-01 | A caller with no `super_admin` grant gets 403 from every `/api/admin/authority-*` route regardless of what the client sends | route test | `npx vitest run src/__tests__/api/authority-claims.test.ts` | ❌ W0 | 08-05 | ⬜ pending |
| AUTH-01 | An unverified/suspended organization yields FORBIDDEN from `resolveAuthorityScope` even with an active grant — no dashboard, no authorship | unit (mocked repo) | `npx vitest run src/server/app/authority/require-authority.test.ts` | ❌ W0 | 08-03 | ⬜ pending |
| AUTH-02 | `requireAuthority` composes `requireRole` only: admin first, then rep, and a non-FORBIDDEN failure propagates instead of falling through to 403 | unit | `npx vitest run src/server/app/authority/require-authority.test.ts` | ❌ W0 | 08-03 | ⬜ pending |
| AUTH-02 | A rep of municipality A calling any authority route with a body/query naming municipality B is scoped to A — the client value is never read | unit + route test + grep guard | `npx vitest run src/server/app/authority/require-authority.test.ts src/__tests__/api/authority-dashboard.test.ts` and the 08-13 grep block | ❌ W0 | 08-03, 08-07, 08-13 | ⬜ pending |
| AUTH-02 | Invite → accept creates exactly one `role_grants` row (`authority_rep`, source `authority_invitation`); an expired, revoked, already-accepted or unknown token returns the same generic failure; the raw token is never persisted or returned twice | route test | `npx vitest run src/__tests__/api/authority-representatives.test.ts` | ❌ W0 | 08-06 | ⬜ pending |
| AUTH-02 | `ADMIN_TIER_ROLES` includes both authority roles, so `canReview` denies a `space_admin` acting on an authority grant and allows a `super_admin` | unit (Phase 5 file, extended) | `npx vitest run src/server/domain/authz/policy.test.ts` | ✅ exists (must be edited) | 08-03 | ⬜ pending |
| AUTH-03 | `applyCohortFloor` withholds below 10 and the serialized withheld payload contains **no** numeric value — not rounded, not bucketed, not 0 | unit (pure) | `npx vitest run src/server/domain/authority/cohort.test.ts` | ❌ W0 | 08-02 | ⬜ pending |
| AUTH-03 | Every non-public aggregate the dashboard returns passes through `applyCohortFloor`; the response for a small municipality is `{withheld:true}` | route test | `npx vitest run src/__tests__/api/authority-dashboard.test.ts` | ❌ W0 | 08-07 | ⬜ pending |
| AUTH-03 | No authority response or CSV export contains a resident identifier (`user_id`, `email`, `phone`, `did`, `first_name`, `last_name`) | route test asserting on the serialized body | `npx vitest run src/__tests__/api/authority-dashboard.test.ts` | ❌ W0 | 08-07 | ⬜ pending |
| AUTH-04 | `official_responses` has no UPDATE/DELETE path: the migration installs a `BEFORE UPDATE OR DELETE` trigger calling `public.reject_audit_mutation()`, and the repo exports no update or delete function | grep on the migration + grep on the repo | 08-04 Task 1 + Task 2 grep blocks | ❌ W0 | 08-04 | ⬜ pending |
| AUTH-04 | Publishing a revision inserts version N+1 and leaves version N's body, author byline and timestamp untouched; retraction is a new version, not a mutation | route test | `npx vitest run src/__tests__/api/authority-responses.test.ts` | ❌ W0 | 08-08 | ⬜ pending |
| AUTH-04 | The public vote payload marks an official response as authority-authored — organization name, verified marker, byline, revision count — and the Taruu-generated blocks carry no such marker | route test + source copy scan | `npx vitest run src/__tests__/api/official-response-public.test.ts` | ❌ W0 | 08-12 | ⬜ pending |
| AUTH-05 | Offboarding calls `setGrantStatus(id,'active','revoked',ended_at)` and inserts a `role_grant_events` row; no response, target or snapshot row is deleted or updated by the offboard path | route test asserting the absence of delete calls | `npx vitest run src/__tests__/api/authority-representatives.test.ts` | ❌ W0 | 08-06 | ⬜ pending |
| AUTH-05 | Every response and target version row carries `author_display_name NOT NULL` captured at write time, so the byline survives `author_user_id` going NULL | grep on the migration + route test asserting the snapshot is written | 08-04 Task 1 grep + `npx vitest run src/__tests__/api/authority-responses.test.ts` | ❌ W0 | 08-04, 08-08 | ⬜ pending |
| AUTH-05 | A satisfaction snapshot is written at most once per municipality per UTC day and a duplicate is a silent no-op | route test (23505 path) | `npx vitest run src/__tests__/api/authority-dashboard.test.ts` | ❌ W0 | 08-07 | ⬜ pending |
| AUTH-06 | `authority_commitments` carries no column named deadline/due/obligation/sla/breach, and its `workflow_state` CHECK is the tracking vocabulary | grep on the migration | 08-04 Task 1 grep block | ❌ W0 | 08-04 | ⬜ pending |
| AUTH-06 | State transitions are recorded as new version rows; the prior state and its author remain readable | route test | `npx vitest run src/__tests__/api/authority-commitments.test.ts` | ❌ W0 | 08-08 | ⬜ pending |
| AUTH-06 | Every authority page contains `AUTHORITY_TRACKING_DISCLAIMER_HE` and none contains `התחייבות משפטית`, `מחויבות משפטית`, `חובה חוקית`, `אכיפה`, `הפרה`, `תביעה` or `קנס` | source-scanning copy test | `npx vitest run src/__tests__/api/authority-copy-guard.test.ts` | ❌ W0 | 08-11 | ⬜ pending |
| AUTH-06 (criterion 6) | The public municipality page, its API route, its use-case and its response contract are free of every authority identifier, and `MunicipalityProfileResponse`'s key set is unchanged | source scan + frozen key list | `npx vitest run src/__tests__/api/municipality-public-surface.test.ts` | ❌ W0 | 08-02 | ⬜ pending |
| AUTH-01..06 (RLS backstop) | A rep of municipality A reads no authority row belonging to B through the user-scoped client, and anon reads of the five new non-public tables return zero rows | integration (real DB, env-gated) — extends the 05-04 harness | `cd apps/web && set -a && . ./.dev.vars && set +a && npx vitest run src/__tests__/rls` | ❌ W0 (05-04 harness is the dependency) | 08-13 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Nothing to install. Vitest, `neverthrow`, `zod` and `jose` are already dependencies. Wave 0 is
scaffolding that does not exist yet, created by the plan named in each row above:

- [ ] `apps/web/src/server/domain/authority/cohort.ts` + colocated `cohort.test.ts` — 08-02
- [ ] `apps/web/src/__tests__/api/municipality-public-surface.test.ts` — 08-02 (**wave 1 on purpose**)
- [ ] `apps/web/src/server/infra/supabase/authority.repo.ts` — 08-03
- [ ] `apps/web/src/server/app/authority/require-authority.ts` + colocated `require-authority.test.ts` — 08-03
- [ ] `apps/web/src/server/infra/supabase/authority-content.repo.ts` — 08-04
- [ ] `apps/web/src/__tests__/api/authority-claims.test.ts` — 08-05
- [ ] `apps/web/src/__tests__/api/authority-representatives.test.ts` — 08-06
- [ ] `apps/web/src/__tests__/api/authority-dashboard.test.ts` — 08-07
- [ ] `apps/web/src/__tests__/api/authority-responses.test.ts` — 08-08
- [ ] `apps/web/src/__tests__/api/authority-commitments.test.ts` — 08-08
- [ ] `apps/web/src/__tests__/api/authority-copy-guard.test.ts` — 08-11
- [ ] `apps/web/src/__tests__/api/official-response-public.test.ts` — 08-12
- [ ] `apps/web/src/__tests__/rls/authority-tables.rls.test.ts` — 08-13 (extends 05-04's harness)

Two existing files must be **edited**, not created:
- [ ] `apps/web/src/server/domain/authz/policy.ts` — `ADMIN_TIER_ROLES` gains both authority roles (08-03)
- [ ] `apps/web/src/server/domain/authz/policy.test.ts` — two new `canReview` cases (08-03)

All mocked route tests follow the `vi.mock` + fixture pattern in
`.planning/codebase/TESTING.md` and `apps/web/src/__tests__/api/identity-document.test.ts`,
mocking `@/services/auth/session`, the two new repos, `@/lib/rate-limit` and `@/lib/logger`.
The RLS suite mocks nothing.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| Both Phase 8 migrations applied to the live database, in order, after Phase 5's two | AUTH-01..06 | No `supabase db push` script; DDL goes through the Supabase Management API with a keychain token | Plan 08-13, step 1 |
| Phase 5's plan 05-09 completed — migrations applied, `SUPABASE_JWT_SECRET` set as a Worker secret, first `super_admin` bootstrapped | hard dependency | Phase 5 owns it; this phase cannot proceed without it | Plan 08-13, step 0 (blocking precondition check) |
| The append-only triggers on `official_responses` and `authority_commitments` reject UPDATE and DELETE | AUTH-04, AUTH-06 | The trigger fires only against real Postgres; mocked repo tests assert the call, not the constraint | Plan 08-13, step 3 |
| `uq_authority_org_verified` rejects a second verified organization for one municipality | AUTH-01 | Same — a unique index only exists in a database | Plan 08-13, step 3 |
| Visual evidence: `/authority/onboarding`, `/admin/authority-claims`, `/municipality-admin`, the vote inbox, an official response with its revision history, the targets and satisfaction views | issue #76 | The issue explicitly asks for screenshots with sanitized test records | Plan 08-13, step 4 |
| The public `municipality/[slug]` page renders byte-identically before and after an authority is verified | criterion 6 | The automated guard proves the *code* is untouched; a human confirms the *rendering* | Plan 08-13, step 5 |

Everything else in this phase runs as a command.

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify command or gate on typecheck + a positive grep
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers every MISSING reference listed above
- [ ] No watch-mode flags
- [ ] No component-render test anywhere (no jsdom in this repo)
- [ ] No task verifies against a test file a later task in the same plan creates
- [ ] Feedback latency < 60s
- [ ] `pnpm --filter @sync/web test` green
- [ ] `pnpm --filter @sync/web typecheck` and `pnpm --filter @sync/shared typecheck` green
- [ ] RLS suite green against a real database with a **non-zero** test count
- [ ] Manual verifications performed and recorded in `apps/web/docs/AUTHORITY-VERIFICATION.md`
- [ ] `wave_0_complete: true` set in frontmatter

**Approval:** pending
