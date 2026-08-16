---
phase: 03-payment-rails-hardening
plan: 06
subsystem: payments
tags: [green-invoice, checkout, vitest, next-app-router, rtl-hebrew, payment-integrity]

# Dependency graph
requires:
  - phase: 02.1-participation-truth
    provides: "the pure-module + injected-fetch test pattern (submitParticipation) and the source-assertion copy guard (participation-receipt-honesty)"
provides:
  - "a vote-creation funnel whose only success path is a settled Green Invoice payment"
  - "startVoteCreationCheckout / decideReturnPhase / classifyFinalizeResponse as pure, testable decisions"
  - "a return page that honours Green Invoice's ?status=failed redirect"
affects: [04-go-live, 03-07-webhook-hardening, 03-08-idempotency]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pure decision module + injected fetch, so `.tsx`-only logic becomes testable under environment: 'node'"
    - "read one-off URL params via new URLSearchParams(location.search) on Suspense-less client pages, never the Next search-params hook"

key-files:
  created:
    - apps/web/src/services/payments/createVoteCheckout.ts
    - apps/web/src/__tests__/services/create-vote-checkout.test.ts
  modified:
    - apps/web/src/app/[locale]/votes/create/page.tsx
    - apps/web/src/app/[locale]/payments/return/page.tsx

key-decisions:
  - "A 200 with no checkout URL is an error, not a success — the fabricated seal had no server call behind it"
  - "Kept the Receipt import on the create page: the plan called it unused, but the step-4 payment plate still renders it"
  - "Bound globalThis.fetch when injecting it, so the module cannot hit an Illegal-invocation unbound-method throw in the browser"
  - "Required both payment.id and payment.paymentUrl before redirecting — without the id, assertPaymentUsable can never match and the resident would be charged for a vote that can never publish"

patterns-established:
  - "Failure copy states what did not happen, in Hebrew, with a retry and a support route"
  - "Source-assertion guards fail the suite if a fabricated seal is reintroduced"

requirements-completed: [PAY-06]

# Metrics
duration: 35min
completed: 2026-08-04
---

# Phase 03 Plan 06: Creation-Funnel Truth Summary

**The vote-creation funnel can no longer claim a vote that does not exist: the `Math.random()` seal and its ₪50 receipt are deleted, and a declined card now lands on Hebrew copy that says the payment did not go through.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 of 3
- **Files created:** 2
- **Files modified:** 2
- **Tests added:** 32 (all passing)

## Accomplishments

- **The fabricated seal is gone.** `votes/create/page.tsx` treated a 200 with no `paymentUrl` as a success: it set `sealHash` to a random hex string and rendered the `הצבעה נוצרה · CREATED` masthead, a `Receipt` reading `דמי יצירה ₪50`, and a `SealCard` with `status="sealed"` — while `POST /api/votes` was never called. The fallback, the `sealHash` state and the whole (now unreachable) success surface are deleted. The only success path is a real Green Invoice redirect.
- **The failure redirect is honoured.** Green Invoice registers `failureUrl=…&status=failed`; the return page never read it, so a declined card saw *"התשלום עדיין נחתם. ההצבעה תפורסם תוך רגעים."* It now reads the param, clears the draft, **POSTs nothing**, and shows a `failed` phase with a retry and a support route.
- **The decisions are pure and tested.** `startVoteCreationCheckout`, `decideReturnPhase` and `classifyFinalizeResponse` live in a `.ts` module with an injected `fetch`, so all 32 tests run under `environment: 'node'` with no DOM stack added.
- **Nothing correct was weakened.** `assertPaymentUsable`, the 402-retry loop, the 400 already-consumed handling, the 4-attempt cap and the form's true `CREATE_VOTE_COST` rows are untouched.

## Task Commits

1. **Task 1: Extract the checkout-start and return-phase decisions** — `3457ce3` (feat)
2. **Task 2: Wire both pages — delete the fabricated seal, honour the failure redirect** — `50befd5` (fix)
3. **Task 3: Prove it — unit-test the module and assert the funnel's source** — `551a3f6` (test)

## Files Created/Modified

- `apps/web/src/services/payments/createVoteCheckout.ts` — created. Checkout start with injected `fetch`; a 200 without a usable checkout is an error. Plus `decideReturnPhase` (failed outranks any draft) and `classifyFinalizeResponse` (2xx created / 402 retry / 400 processing / else error).
- `apps/web/src/app/[locale]/votes/create/page.tsx` — modified. `handleSubmit` delegates to the module; mock fallback, `sealHash`, the success surface and the `SealCard` import removed.
- `apps/web/src/app/[locale]/payments/return/page.tsx` — modified. Reads `status` off `window.location.search`, adds the `failed` phase and its Hebrew copy, routes the finalisation loop through `classifyFinalizeResponse`.
- `apps/web/src/__tests__/services/create-vote-checkout.test.ts` — created. 32 tests in three describes.

## Verification

| Check | Result |
|---|---|
| `pnpm --filter @sync/web typecheck` | **exit 0, clean** |
| `pnpm --filter @sync/web test -- src/__tests__/services/create-vote-checkout.test.ts` | **32/32 passing** |
| `pnpm --filter @sync/web test` (full) | 931 passed / 6 failed — all 6 in `payments.test.ts`, owned by concurrent plan 03-02 |
| `grep -rn "Math.random" "apps/web/src/app/[locale]/votes/"` | no matches |
| `grep -rn "SealCard" "apps/web/src/app/[locale]/votes/"` | no matches |
| `create-vote.ts` / `db.ts` touched by this plan | no — server payment gate untouched |
| `greenInvoice.ts` touched by this plan | no — owned by 03-02 / 03-07 |
| `payments/return/page.module.css` | no class added, no CSS written |

## Decisions Made

- **Kept the `Receipt` import.** The plan said to remove both `Receipt` and `SealCard` as unused after deleting the success surface. `Receipt` is still rendered by the step-4 payment plate (the `דמי יצירת הצבעה` row the plan explicitly says must survive), so removing it would have broken the build. Only `SealCard` was genuinely orphaned.
- **Bound `fetch` at the injection site** (`globalThis.fetch.bind(globalThis)`) rather than passing the bare identifier. An unbound `fetch` can throw *Illegal invocation* in browsers; on a payment path that is not a risk worth taking for one token of brevity.
- **A checkout needs both `id` and `paymentUrl`.** The id becomes `paymentTxId` on the finalisation POST; without it `assertPaymentUsable` can never match, so the resident would be charged for a vote that can never publish. A URL without an id is therefore an error, not a redirect.
- **Failure copy admits the edge case.** `'התשלום לא הושלם, וההצבעה לא נוצרה. אין חיוב. אפשר לנסות שוב, ואם חויבתם בטעות פנו אלינו ונסדר.'` — states the non-event, and still leaves a route open if the gateway and reality disagree.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Kept the `Receipt` import the plan told me to delete**
- **Found during:** Task 2
- **Issue:** The plan's action block says to remove the `Receipt` and `SealCard` imports as unused once the success surface goes. `Receipt` is still used by the step-4 payment plate at the old `:441`, which the same plan says must stay. Following the instruction literally fails the build.
- **Fix:** Removed only `SealCard`. `grep -c Receipt` on the create page is 2 (import + use).
- **Verification:** `pnpm --filter @sync/web typecheck` exits 0.
- **Committed in:** `50befd5`

**2. [Rule 3 - Blocking] Reworded two comments that tripped the plan's own literal greps**
- **Found during:** Tasks 1 and 2
- **Issue:** The plan's action text asks for a comment naming `Math.random()` in `createVoteCheckout.ts` and, separately, its acceptance criterion requires `grep -c "Math.random"` on that file to return `0`. The same collision hit `useSearchParams` in the return page's explanatory comment.
- **Fix:** Kept both warnings but phrased them without the literal tokens ("a randomly generated hex string", "the Next search-params hook"). Intent preserved, gates satisfied.
- **Verification:** both greps return 0.
- **Committed in:** `3457ce3`, `50befd5`

### Concurrency accident — three foreign files swept into `50befd5`

**Not an auto-fix; a shared-worktree hazard worth recording precisely.**

Five executors run concurrently in this worktree and **share one git index**. Between my `git add` of the two page files (verified via `git diff --cached --name-only` as exactly two) and the `git commit` in the next shell invocation, another executor staged their own files into the same index, so commit `50befd5` also carries:

- `apps/web/src/__tests__/lib/env-contract.test.ts` (plan 03-01)
- `apps/web/worker.ts` (plan 03-01)
- `apps/web/src/__tests__/services/economics-fee-split-copy.test.ts` (plan 03-05)

**No work was lost or altered** — the content committed is exactly what those executors had written, and their working trees were untouched by the commit. **No remediation was attempted deliberately:** a `reset`/rebase to split the commit would move `HEAD` under four actively-committing executors and is far more destructive than an over-broad commit message. The correct primitive for this worktree is `git commit -- <explicit paths>` (pathspec mode bypasses the shared index); this summary's own commit uses it.

Separately and unavoidably: the two page files already carried a handful of em-dash→hyphen hunks from an unrelated in-flight typography sweep. They cannot be separated from a same-file edit and are noted in the commit body.

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking), plus 1 recorded concurrency accident.
**Impact on plan:** No scope creep. Both auto-fixes were required for the plan's own acceptance criteria to pass.

## Issues Encountered

- **The shared working tree is live.** `typecheck` and the full suite failed twice mid-execution on files this plan never touches (`api/payments/create/route.ts`, `components/sections/index.ts`, `api/treasury-transactions.test.ts`) as plans 03-01/03-02/03-04 landed their edits. Each resolved on its own within minutes. Per the scope boundary, none were fixed here. Final typecheck is clean.
- **`payments.test.ts` is still red (6 tests).** All six are the retired ₪3 participation rail and the treasury-accrual webhook assertion — plan 03-02 owns that file in wave 1 and rewrites exactly those describes. Not a regression from this plan; the baseline suite was green before 03-02 began editing the route.

## User Setup Required

None. One manual verification is already recorded in `03-VALIDATION.md`: in the Green Invoice sandbox, use a declining test card and confirm the return page shows the `failed` phase, that the draft is cleared, and that no `POST /api/votes` fires.

## Next Phase Readiness

- PAY-06's funnel-truth half is closed. The rail itself is untouched and still works end to end.
- 03-07 (webhook two-factor auth, document-id integrity) and 03-08 (server-derived idempotency) are unblocked by this plan and do not conflict: `startVoteCreationCheckout` deliberately sends no `idempotencyKey`, which is the client behaviour 03-08 requires.
- The fabricated-seal class of defect is now guarded on both funnels — `participation-receipt-honesty.test.ts` for casting, `create-vote-checkout.test.ts` for creation.

## Self-Check: PASSED

All four source files and the summary exist on disk; all three task commits resolve in `git log`.

## Shared planning state — deliberately NOT mutated

`STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md` were **not** written by this executor. Six wave-1 executors are running concurrently against one worktree; six racing `state advance-plan` / `update-progress` / `requirements mark-complete` calls would double-count the plan counter and interleave writes on the same files. The rollup belongs to the orchestrator once the wave completes. For that rollup: this plan completed **PAY-06**'s funnel-truth half, 3 tasks, 3 commits, 4 files.

---
*Phase: 03-payment-rails-hardening*
*Completed: 2026-08-04*
