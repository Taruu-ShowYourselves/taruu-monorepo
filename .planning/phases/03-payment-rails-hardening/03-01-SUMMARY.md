---
phase: 03-payment-rails-hardening
plan: 01
subsystem: infra
tags: [cloudflare-workers, opennext, zod, env-validation, vitest, security]

# Dependency graph
requires:
  - phase: 02.1-participation-persistence
    provides: source-assertion test precedent (`dashboard-free-mvp.test.ts`) and the pure-core / thin-shell split
  - phase: 05-rls (executing out of roadmap order)
    provides: `SUPABASE_JWT_SECRET` as a real optional runtime variable (`96448b3`)
provides:
  - env schema whose every key has at least one real `process.env` reader in `apps/web/src`
  - pure `checkRuntimeEnv()` gate returning variable NAMES only, never values
  - fail-closed per-isolate 503 gate in `apps/web/worker.ts`
  - SEC-02 closed on the record with a source-level regression guard
affects: [04-go-live, 07-service-role-migration, phase-4-preview-deploy-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "worker.ts as the per-isolate startup hook; decision logic lives in src/lib/env.ts so vitest can reach it"
    - "gate results carry names only, so they are safe to log"
    - "source-assertion guards lock in the ABSENCE of a reintroduced identifier"

key-files:
  created:
    - apps/web/src/__tests__/lib/env-contract.test.ts
  modified:
    - apps/web/src/lib/env.ts
    - apps/web/worker.ts
    - apps/web/src/__tests__/api/treasury-transactions.test.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Fixed the schema before wiring it — wiring the previous schema would have rejected a correctly configured production environment"
  - "checkRuntimeEnv() is a plain function over a record, deliberately NOT the Zod schema, because it runs pre-Next-boot against the Cloudflare env binding"
  - "The 503 body names nothing; the missing names go to console.error only"
  - "SEC-05 left OPEN pending the manual preview-deploy verification (assumption A7)"

patterns-established:
  - "Pattern: env gate returns { ok } | { ok: false, missing: string[] } — a name list is loggable, a value list is a breach"
  - "Pattern: a fixed reader-file map in the test proves schema/reader parity deterministically without a tree walk"

requirements-completed: [SEC-02]

# Metrics
duration: 20min
completed: 2026-08-04
---

# Phase 3 Plan 01: Env Truth + Fail-Closed Worker Gate Summary

**`env.ts` now names exactly the variables this app reads, and a misconfigured Cloudflare isolate returns 503 with the missing names in the log and nothing in the body — plus SEC-02 locked at the source.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-04T14:10:21Z
- **Completed:** 2026-08-04T14:30:00Z
- **Tasks:** 3 of 3
- **Files modified:** 4 (3 modified, 1 created)

## Accomplishments

- Deleted six orphaned variables from the env schema — the four `AUTH0_*` names (zero readers since the Auth0 service was removed) and the two un-prefixed Supabase names. Wiring the old schema would have taken production down, which is precisely why `validateEnv()` had been left as dead code rather than hooked up.
- Added `checkRuntimeEnv()`: a pure decision over a plain record, with the always-required set and a production-only Green Invoice set, treating an empty string as absent because Workers surface unset secrets that way.
- Wired `worker.ts` — the only real per-isolate startup hook on this platform — so a missing required secret fails the request closed at 503 instead of surfacing later as a confusing 500 from a module that silently captured `''`.
- Closed SEC-02 against the commit that actually satisfied it (`35b0709`) and added a source guard so a future refactor cannot silently re-add `userId`/`paymentId` to the municipality ledger.

## Task Commits

1. **Task 1: Make the env schema name the variables this app actually reads** — `b709284` (fix)
2. **Task 2: Fail the isolate closed in worker.ts, and prove the gate with a unit test** — `50befd5` (see deviation 1 — swept into a sibling executor's commit before this executor could commit it; content is byte-identical to what this plan wrote)
3. **Task 3: Close SEC-02 on the record with a regression guard** — `55fd8e5` (test)

## Files Created/Modified

- `apps/web/src/lib/env.ts` — schema keys now match the runtime readers; adds `checkRuntimeEnv`, `ALWAYS_REQUIRED_SERVER_VARS`, `PRODUCTION_PAYMENT_VARS`, `RuntimeEnvCheck`. Still imports nothing but `zod`, so `worker.ts` can import it before Next boots.
- `apps/web/worker.ts` — `fetch: handler.fetch` became a gated wrapper; `gateEnv()` memoizes one `checkRuntimeEnv` call per isolate and logs names only. `scheduled` / `CRON_ROUTES` untouched.
- `apps/web/src/__tests__/lib/env-contract.test.ts` — new, 17 tests: the gate's truth table, the empty-string rule, per-variable isolation, a canary proving no value reaches the result, plus source assertions that the schema and the readers agree.
- `apps/web/src/__tests__/api/treasury-transactions.test.ts` — appended `describe('SEC-02 source guard')`, 4 tests. All 20 pre-existing tests untouched.
- `.planning/REQUIREMENTS.md` — SEC-02 checkbox and traceability row only.

## Verification

| Check | Result |
|---|---|
| `pnpm --filter @sync/web typecheck` | exits 0 (tree-wide, confirmed after siblings settled) |
| `pnpm --filter @sync/web test -- src/__tests__/lib/env-contract.test.ts` | 17 passed |
| `pnpm --filter @sync/web test -- src/__tests__/api/treasury-transactions.test.ts` | 24 passed (20 existing + 4 new) |
| Full web suite | 73 of 74 files pass, 931 of 937 tests — the 6 failures are all in `src/__tests__/api/payments.test.ts`, which plan 03-02 T3 is contracted to rewrite. Baseline was 71 files / 876 tests. |
| `grep -c "AUTH0" apps/web/src/lib/env.ts` | `0` |
| Reader parity for all five always-required vars | 12 / 4 / 2 / 2 / 4 readers outside `lib/env.ts` |
| Treasury route modified? | No — its last commit is still `35b0709` |
| Secret-shaped strings in any commit from this plan | none |

## Decisions Made

- **Schema first, wiring second.** The plan's ordering was load-bearing and is worth restating: the previous schema hard-required six variables with zero readers, so wiring `validateEnv()` at any point before Task 1 would have refused to serve a correctly configured production isolate.
- **The gate is not the Zod schema.** `checkRuntimeEnv()` takes a plain record because it runs against the Cloudflare `env` binding merged over `process.env`, before the Next bundle boots. It never throws, never allocates a client, and never reads a value into its result.
- **`RESEND_API_KEY` relaxed to optional.** One reader, which already falls back to `''`, and every send site treats email as best-effort. A missing key should degrade a notification, not refuse the isolate.
- **SEC-05 deliberately left unchecked in REQUIREMENTS.md.** See "Issues Encountered".

## Deviations from Plan

### 1. [Environmental — not a code deviation] Task 2's commit was absorbed by a sibling executor

- **Found during:** Task 2 commit
- **Issue:** Five plans execute concurrently in this shared worktree against one git index. Between this executor's `git add` and its `git commit`, plan 03-06's executor ran a broad `git add` and committed, sweeping `worker.ts` and `env-contract.test.ts` into `50befd5` ("fix(03-06): delete the fabricated creation seal, honour the failure redirect").
- **Impact:** Attribution only. The content in `HEAD` was verified byte-complete: the gate's 4 `checkRuntimeEnv` references, the 503 branch, both `handler.fetch` call sites and all 175 lines of the test file are present, and the 17 tests pass.
- **Resolution:** Not rewritten — history rewriting on a branch with five live executors would be far more destructive than a misattributed commit. Recorded here instead. All three of this plan's own commits used the explicit-pathspec form (`git commit -m … -- <paths>`), which is why `b709284` and `55fd8e5` are clean single-plan commits.

### 2. [Documentation drift] The treasury test file had 20 existing tests, not 22

- **Found during:** Task 3
- **Issue:** `03-CONTEXT.md` and the plan's acceptance criterion both state 22 existing tests and therefore require ≥26 after the append. The file actually contains 20 (`git show HEAD~:… | grep -cE '^\s*it\('` = 20), so the total is 24.
- **Resolution:** No code change. Exactly the 4 tests the plan specified were added, and all 20 pre-existing tests still pass. The `≥26` figure is a miscount in the context document, not a missing test.

### 3. [Cosmetic, pre-existing] Two files carried unrelated em-dash normalisation

- **Found during:** Task 3
- **Issue:** The parallel session's in-progress redesign had already replaced `—` with `-` in comments in `treasury-transactions.test.ts` (1 line) and the treasury route (3 lines).
- **Resolution:** The test file's 1-line change rode along in `55fd8e5`, since git stages whole files and this plan owns that file. The **route was not staged and not committed** — its last commit remains `35b0709`, so the "route is byte-identical" criterion holds in substance; only the working tree carries the sibling's comment typography.

---

**Total deviations:** 3, none of them code changes to this plan's scope. No auto-fixes were required — every premise the plan asserted about the code was verified true before editing.
**Impact on plan:** None on behaviour or scope.

## Issues Encountered

- **SEC-05 is implemented but NOT marked complete, on purpose.** Task 3 explicitly instructed "Do not touch the SEC-03/04/05 … rows". That instruction is also the safer reading: SEC-05's text asks that validation "runs at app startup (fail-fast)", and assumption **A7** — that `worker.ts`'s wrapper genuinely runs once per isolate on the deployed Worker — is recorded in `03-VALIDATION.md` as a **manual-only** verification that nothing in this repo can perform. The code is in place; the requirement should be checked off only after the preview-deploy verification below. Flagged here so the phase verifier decides deliberately rather than by omission.
- **The tree-wide typecheck and test suite were intermittently red throughout execution**, with errors in `votes/create/page.tsx`, `services/payments/greenInvoice.ts`, `payments/return/page.tsx`, `components/sections/index.ts` and `payments.test.ts` — all owned by sibling plans mid-flight. This plan's three files were isolated and typechecked independently (exit 0) to separate signal from noise before each commit.
- **One unverified build-time risk worth a reviewer's eye:** `worker.ts` imports the gate as `@/lib/env`, per the plan. `tsc` resolves it (confirmed), and esbuild honours tsconfig `paths`, so wrangler should too — but this has not been proven by an actual `opennextjs-cloudflare build`. If it does not resolve, the failure is a loud build error rather than a silently skipped gate, so it is discoverable and safe; it would be closed by switching to a relative import.

## User Setup Required

None for this plan. One **manual verification** is owed before Phase 4 go-live (already listed in `03-VALIDATION.md`):

> Deploy to a preview Worker with `SUPABASE_SERVICE_ROLE_KEY` unset. Confirm every request returns 503 and that the tail log names the missing variables **and no values**. Restore the secret and confirm normal serving.

Note that `wrangler.jsonc` sets `vars.GREENINVOICE_ENV = "production"`, so on the deployed Worker the four `GREENINVOICE_*` secrets are gate-required too. If any of them is unset in the production environment today, this gate will 503 the whole site — that is the intended fail-closed behaviour, and it makes the preview verification a prerequisite, not a formality.

## Next Phase Readiness

- SEC-02 is closed on the record and locked at the source.
- SEC-05's code is complete and unit-proven; its requirement row stays open pending the preview-deploy check.
- Nothing here blocks plans 03-02 through 03-09. This plan touched no payment route, no contract, and no copy surface.

## Self-Check: PASSED

All four claimed files exist on disk (`env.ts`, `worker.ts`, `env-contract.test.ts`, `treasury-transactions.test.ts`, plus `REQUIREMENTS.md`), and all three claimed commits resolve in `git log --all` (`b709284`, `50befd5`, `55fd8e5`).

---
*Phase: 03-payment-rails-hardening*
*Completed: 2026-08-04*
