---
phase: 7
slug: service-role-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
updated: 2026-08-03
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Extends `.planning/phases/05-rbac-admin-review/05-VALIDATION.md` — the RLS suite defined there is
> the same suite, widened. Nothing here forks it.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 1.6.1 (already configured — no install) |
| **Config file** | `apps/web/vitest.config.ts` — **unchanged by this phase** |
| **Environment** | `environment: 'node'`. No jsdom, no `@testing-library/react`. `include` is `src/**/*.test.ts` — `.tsx` is never collected. |
| **Unit/route suite** | `pnpm --filter @sync/web test` |
| **Typecheck gate** | `pnpm --filter @sync/web typecheck` |
| **Lint gate** | `pnpm --filter @sync/web lint` (2 pre-existing warnings — the baseline, not zero) |
| **RLS suite (needs a real DB)** | `cd apps/web && set -a && . ./.dev.vars && set +a && npx vitest run src/__tests__/rls` |
| **Estimated runtime** | ~60s unit, ~40s RLS with credentials (network-bound, 8 tables × ~6 assertions) |

**A run reporting 0 tests is a skip, not a pass.** The RLS suite skips loudly when
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or
`SUPABASE_JWT_SECRET` is missing, so `pnpm --filter @sync/web test` stays green in a
credential-free environment. Always check the count.

### Verification-command rules for this phase (violating these breaks execution)

1. **Never verify a task against a test file a later task in the same plan creates.** vitest exits
   1 with `No test files found`. Where a plan's task 1 creates a module and task 2 creates its
   test, task 1 gates on `pnpm --filter @sync/web typecheck` plus a positive `grep -c`.
2. **`npx vitest run src/__tests__/rls/<x>.rls.test.ts` exits 0 whether it passes or skips.** It is
   therefore never sufficient evidence on its own. Every wave-4 test task pairs it with
   `pnpm --filter @sync/web test` (proves nothing regressed) and a `grep -c` (proves the assertions
   were actually written). The live non-zero-count proof is plan **07-16**, a blocking checkpoint.
3. **Never print a secret.** Commands may reference `SUPABASE_JWT_SECRET` by name; no command in
   any plan may echo, cat, or log its value.

---

## Sampling Rate

- **After every task:** the task's own `<automated>` command.
- **After every plan:** `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web test`.
- **After the wave-2 → wave-3 boundary:** the checkpoint at 07-07 applies both migrations and runs
  the RLS suite live; nothing in wave 4 may start before it reports a non-zero pass count.
- **Before `/gsd:verify-work`:** full unit suite green **and** the RLS suite green against a real
  database covering all 25 tables with a non-zero count (plan 07-16).
- **Max feedback latency:** 60 seconds.

No watch-mode flags anywhere.

---

## Per-Requirement Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|---|---|---|---|---|---|
| MIG-01 (inventory) | All 25 RLS-enabled tables and all 36 live policies are enumerated; each of the 14 `USING (true)` policies carries a keep-or-replace verdict with a written reason | doc + grep | plan 07-01 grep block over `apps/web/docs/RLS-POLICY-AUDIT.md` and the migrations | ❌ W0 | ⬜ pending |
| MIG-01 (FINDING-1) | `webhook_events`'s `FOR ALL USING (true)` policy is scoped `TO service_role`; anon reads and writes of `webhook_events` are denied | grep + RLS suite | plan 07-01 grep, then `npx vitest run src/__tests__/rls/system-tables.rls.test.ts` (07-14) | ❌ W0 | ⬜ pending |
| MIG-01 (FINDING-2) | `vote_nfts` no longer exposes `user_id`/`wallet_address` to the anon key | grep + RLS suite | plan 07-05 grep, then `system-tables.rls.test.ts` (07-14) | ❌ W0 | ⬜ pending |
| MIG-01 (corrective) | Every "replace" verdict and every policy the classification requires exists in `20260803000002_rls_policy_audit.sql`, applied to the live database | grep + manual apply | plan 07-05 grep block; applied at 07-07 | ❌ W0 | ⬜ pending |
| MIG-02 (classification) | All **114** `db.ts` exports are classified user-initiated vs system with a target client; the count in the doc equals the count in the source | doc + grep count equality | plan 07-02: `grep -cE "^\| \`" apps/web/docs/DB-ACCESS-CLASSIFICATION.md` equals `grep -cE "^export " db.ts` | ❌ W0 | ⬜ pending |
| MIG-02 (split) | `db.ts` is gone, `db/index.ts` re-exports 15 domain modules, and all 62 importers of `@/lib/supabase/db` still resolve | typecheck + full suite | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web test` (plans 07-04, 07-06) | ✅ exists (must be split) | ⬜ pending |
| MIG-02 (migration) | Every export the classification marks user-initiated reads through `createUserScopedClient` or `createAnonClient`; no user-initiated read still calls `supabaseAdmin` | grep per module + route tests | per-slice: `pnpm --filter @sync/web test` + `grep -c supabaseAdmin apps/web/src/lib/supabase/db/<module>.ts` | ❌ W0 | ⬜ pending |
| MIG-03 (justification) | Every file importing `supabaseAdmin` carries a `PRIVILEGED:` block, and every remaining privileged export in `db/` carries an `@privileged` JSDoc tag with a reason | guard test walking the source tree | `npx vitest run src/__tests__/lib/privileged-access.test.ts` (plan 07-15) | ❌ W0 | ⬜ pending |
| MIG-03 (legitimacy) | The routes that keep privileged access are exactly webhooks, cron, minting, notification fan-out, and public aggregates — enumerated in the guard test's allow-list | guard test | same command | ❌ W0 | ⬜ pending |
| MIG-04 (per table) | For each of the 25 tables, a test proves user A's user-scoped client cannot read user B's rows, and anon reads return zero rows | integration (real DB, env-gated) | `cd apps/web && set -a && . ./.dev.vars && set +a && npx vitest run src/__tests__/rls` | ❌ W0 | ⬜ pending |
| MIG-04 (suite green) | The full RLS suite runs against a live database with a **non-zero** test count and 25 tables covered | integration + manual count check | plan 07-16 checkpoint | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Table → RLS test file map (MIG-04 coverage ledger)

All 25 pre-Phase-5 tables must appear here. Phase 5's three are already covered by
`role-tables.rls.test.ts`.

| Test file | Plan | Tables proven |
|---|---|---|
| `src/__tests__/rls/role-tables.rls.test.ts` | *Phase 5 / 05-04* | role_grants, community_manager_applications, role_grant_events |
| `src/__tests__/rls/identity.rls.test.ts` | 07-08 | users, social_proofs, identity_documents, identity_document_events |
| `src/__tests__/rls/verification.rls.test.ts` | 07-09 | verification_runs, verification_schedule, verification_attempts, phone_verifications |
| `src/__tests__/rls/ballots.rls.test.ts` | 07-10 | user_votes, vote_options |
| `src/__tests__/rls/catalogue.rls.test.ts` | 07-11 | votes, vote_sources, knesset_items, knesset_rankings, municipalities |
| `src/__tests__/rls/payments.rls.test.ts` | 07-12 | payments, entitlements |
| `src/__tests__/rls/treasury.rls.test.ts` | 07-13 | treasury, treasury_transactions, issue_coins, issue_coin_holdings |
| `src/__tests__/rls/system-tables.rls.test.ts` | 07-14 | vote_nfts, push_tokens, webhook_events, merch_orders |

**25/25 covered.** Plan 07-16 asserts this ledger against the harness's `RLS_TABLES` constant so a
table cannot be silently dropped.

---

## Wave 0 Requirements

Nothing to install. Vitest, `@supabase/supabase-js@2.90.1`, `jose`, and `neverthrow` are already
dependencies. Wave 0 is scaffolding that does not exist yet:

- [ ] `apps/web/docs/RLS-POLICY-AUDIT.md` — the 25-table, 36-policy inventory with verdicts (07-01)
- [ ] `supabase/migrations/20260803000001_webhook_events_rls_hotfix.sql` (07-01)
- [ ] `apps/web/docs/DB-ACCESS-CLASSIFICATION.md` — the 114-export classification (07-02)
- [ ] `apps/web/src/lib/supabase/anon-client.ts` + colocated `anon-client.test.ts` (07-03)
- [ ] `apps/web/src/lib/supabase/db/*.ts` — 15 domain modules + `index.ts` barrel (07-04, 07-06)
- [ ] `supabase/migrations/20260803000002_rls_policy_audit.sql` (07-05)
- [ ] `apps/web/src/__tests__/rls/{identity,verification,ballots,catalogue,payments,treasury,system-tables}.rls.test.ts` (07-08..07-14)
- [ ] `apps/web/src/__tests__/lib/privileged-access.test.ts` — the MIG-03 guard (07-15)
- [ ] `apps/web/docs/SERVICE-ROLE-MIGRATION.md` — the phase proof record (07-16)

Files that must be **edited**, not created — a dependency of every wave-4 slice:

- [ ] `apps/web/src/__tests__/rls/harness.ts` (created by Phase 5 plan 05-04): its two assertion
      helpers hardcode `'role_grants' | 'community_manager_applications' | 'role_grant_events'`.
      Plan 07-03 widens that to an exported `RlsTable` union covering all 28 tables and adds
      `expectUserWriteDenied` and `seedOwnedRows`. **Every wave-4 slice depends on this edit.**
- [ ] `apps/web/docs/RLS-TESTING.md` (created by Phase 5 plan 05-04): its "Phase 7" section
      prescribes the widening; plan 07-03 replaces that section with the realised API.
- [ ] `apps/web/src/lib/supabase/db.ts` → deleted in 07-06, replaced by `db/index.ts`.

All new mocked test files follow `.planning/codebase/TESTING.md`'s `vi.mock`-before-import pattern.
**The RLS suite mocks nothing** — mocking is the one thing that would make it worthless.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| Phase 5's `20260802000001` and `20260802000002` are applied, and `SUPABASE_JWT_SECRET` is set locally and as a Worker secret | **the phase gate** | Dashboard secret + no `supabase db push` script and no local Postgres (`docker info` fails on this machine); DDL goes through the Supabase Management API | Phase 5 plan 05-09 Task 1 — **must be done before Phase 7 wave 3** |
| The HS256 assumption holds (the project has not migrated to asymmetric signing keys) | RLS-01 → the whole phase | Only observable from the Supabase dashboard | Plan 07-07 Task 1, step 1 — stop-and-report if it does not hold |
| `20260803000001` and `20260803000002` applied to the live database, in order | MIG-01 | Same DDL path | Plan 07-07 Task 1 |
| The anon key can no longer read or write `webhook_events` against the live project | MIG-01 / FINDING-1 | Needs a live PostgREST round trip with the real anon key | Plan 07-07 Task 2, then permanently automated by `system-tables.rls.test.ts` |
| Full RLS suite green with a non-zero count covering 25 tables | MIG-04 | Needs a real database | Plan 07-16 |

Every other check in this phase is a command.

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify command or a declared Wave 0 dependency
- [ ] No task verifies against a test file created later in the same plan
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references listed above
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `pnpm --filter @sync/web typecheck` green
- [ ] `pnpm --filter @sync/web test` green (≥827 passing, the Phase 5 baseline)
- [ ] RLS suite green against a real database with a **non-zero** count and all 25 tables covered
- [ ] `privileged-access.test.ts` green — every remaining privileged call site justified
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
