---
phase: 03-payment-rails-hardening
plan: 03
subsystem: payments
tags: [zod, contracts, api-client, expo, react-native, green-invoice, vitest]

# Dependency graph
requires:
  - phase: 02.1-participation-truth
    provides: free participation (cfa5d25) and the persisted free ballot, which is what makes a participation payment rail dead weight
provides:
  - "CreatablePaymentTypeSchema — a z.literal('vote_creation') naming the only payment Taruu sells"
  - "CreatePaymentRequestSchema narrowed to creation, with voteId/optionId dropped"
  - "GetPricingResponseSchema publishing creation pricing only"
  - "A paymentsApi that posts a type string the server accepts and reads the key it returns"
  - "A creation-only mobile checkout screen"
affects: [03-02 (server-side rejection of vote_participation), 03-08 (idempotencyKey removal), 04-go-live, 06-manager-billing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Request contracts narrow; stored-row contracts keep the full DB enum"
    - "Client posts a module-level literal instead of forwarding a route param"

key-files:
  created: []
  modified:
    - packages/shared/src/contracts/payment.ts
    - packages/api-client/src/payments.ts
    - packages/api-client/src/__tests__/payments.test.ts
    - apps/mobile/src/hooks/usePayment.ts
    - apps/mobile/src/__tests__/hooks/usePayment.test.ts
    - apps/mobile/app/payment/checkout.tsx

key-decisions:
  - "Narrowing lives on the request contract, not on PaymentTypeSchema: a stored legacy participation row must still parse"
  - "The api-client keeps a local CreatePaymentResponse built on the shared contract, with paymentUrl required, because POST /api/payments/create always issues a hosted-form URL"
  - "checkout.tsx posts a PAYMENT_TYPE literal rather than params.type, so a stale deep link cannot request the retired rail"
  - "The Zod behaviours from Task 1 are asserted in the api-client suite, since @sync/shared has no test runner wired"
  - "STATE.md / ROADMAP.md / REQUIREMENTS.md were deliberately NOT written — five executors share this worktree concurrently"

patterns-established:
  - "Creatable vs stored type split: CreatablePaymentType for requests, PaymentType for rows"
  - "Screen-scope docstring naming what a payment surface may and may not charge for"

requirements-completed: [PAY-08]

# Metrics
duration: 24min
completed: 2026-08-04
---

# Phase 03 Plan 03: Retire the Participation Payment Rail from Every Client Summary

**Creation-only Zod request/pricing contracts, an api-client that finally posts `vote_creation` and reads `payment` instead of two strings and a key the server never accepted or returned, and a mobile checkout that can only be a vote-creation checkout.**

## Performance

- **Duration:** ~24 min
- **Started:** 2026-08-04T17:07Z
- **Completed:** 2026-08-04T17:31Z
- **Tasks:** 3 of 3
- **Files modified:** 6

## Accomplishments

- **The planner's central claim is confirmed true: `paymentsApi`'s two payment methods have never worked.** `createVotePayment` posted `{ type: 'vote' }` and `createVoteCreationPayment` posted `{ type: 'create_vote' }`; `/api/payments/create` validates against `['vote_participation','vote_creation']`, so both were rejected on every call. Both then read `response.paymentIntent`, and the route returns `payment`. Verified line by line before rewriting (`packages/api-client/src/payments.ts:37,49` and `:39,51` at the pre-change HEAD).
- No client can request a participation payment any more: the request schema is a `z.literal`, `createVotePayment` is deleted, and the mobile checkout posts a literal.
- The published pricing contract describes creation only — a consumer parsing it cannot expect a participation price.
- `PaymentTypeSchema` and `GetPaymentStatusResponseSchema` still parse a stored legacy `vote_participation` row, now with a comment saying why so nobody "tidies" it.
- api-client suite grew 126 → 131 tests, all green; payments describe went 9 → 14 tests.

## Task Commits

1. **Task 1: Narrow the shared payment contracts to creation only** — `872b3f8` (feat)
2. **Task 2: Fix the api-client's payment methods and their tests** — `16bbd05` (fix)
3. **Task 3: Make the mobile checkout screen creation-only** — `3d320f7` (fix)

No plan-metadata commit was made — see Deviations #4.

## Files Created/Modified

- `packages/shared/src/contracts/payment.ts` — adds `CreatablePaymentTypeSchema` / `CreatablePaymentType`; `CreatePaymentRequestSchema` takes the creatable type and drops `voteId`/`optionId`; `GetPricingResponseSchema` loses `voteParticipation`; `PaymentTypeSchema` untouched with a load-bearing comment.
- `packages/api-client/src/payments.ts` — `createVotePayment` deleted; `createVoteCreationPayment` posts `vote_creation` and returns `response.payment`; `CreatedPayment` / `CreatePaymentResponse` describe the real body; params take `CreatablePaymentType`; `Record<string, any>` → `Record<string, unknown>`.
- `packages/api-client/src/__tests__/payments.test.ts` — participation describe replaced by a surface lock; creation describe asserts the corrected wire contract; a `shared payment contracts` describe proves Task 1's five behaviours.
- `apps/mobile/src/hooks/usePayment.ts` — follows the narrowed param and return types (deviation #1).
- `apps/mobile/src/__tests__/hooks/usePayment.test.ts` — two `createPaymentIntent` calls moved off `vote_participation` (deviation #1).
- `apps/mobile/app/payment/checkout.tsx` — creation-only params, literal `PAYMENT_TYPE` in the body, no `voteId` in the request, creation-fee Hebrew copy, scope docstring.

## Verification Results

| Check | Result |
|---|---|
| `pnpm --filter @sync/shared typecheck` | exit 0 |
| `pnpm --filter @sync/api-client test` | exit 0 — 10 files, **131 tests** (baseline 126) |
| `pnpm --filter @sync/api-client typecheck` | exit 0 |
| `pnpm --filter @sync/mobile typecheck` | exit 0 (baseline exit 0) |
| `pnpm --filter @sync/web typecheck` | exit 1 — **not this plan**, see Issues |
| `pnpm --filter @sync/web test` | 6 failed / 895 passed — **not this plan**, see Issues |
| `grep -rn "type: 'vote'" packages/api-client/src` | no matches |
| `grep -c "voteParticipation" packages/shared/src/contracts/payment.ts` | 0 |
| `grep -c "z.enum(['vote_participation', 'vote_creation'])" …/payment.ts` | 1 — `PaymentTypeSchema` intact |
| `grep -c "vote_participation" apps/mobile/app/payment/checkout.tsx` | 0 |
| `git diff --stat apps/mobile/app/(tabs)/create.tsx apps/mobile/app/payment/failed.tsx` | empty |
| `git diff --stat apps/mobile/.expo/` | empty |

## Decisions Made

- **`CreatablePaymentType` is surfaced via `@sync/shared/contracts`, not the root `@sync/shared`.** `packages/shared/src/index.ts` deliberately exports only `types`, `constants` and `utils`; adding `export * from './contracts'` would collide with `types/payment.ts`'s `PaymentType` and `PaymentStatus` and break the package build. `contracts/index.ts` already does `export * from './payment'`, so the new export is reachable with no barrel edit. `apps/mobile` and `apps/web` already import that subpath, and it resolves under `moduleResolution: bundler`.
- **The api-client keeps its own `CreatePaymentResponse`, built from the shared one** (`extends Omit<CreatePaymentBody, 'payment'>`). The shared contract marks `paymentUrl` optional because it also describes stored-payment reads; the create route always issues one. Typing it required here keeps `WebBrowser.openBrowserAsync(url)` well-typed on mobile instead of forcing a non-null assertion.
- **`voteId` stays in checkout's param generic but never reaches the request body.** `payment/failed.tsx:17` forwards it back on retry, exactly the case the plan called out.
- **Task 1's Zod behaviours are asserted from the api-client suite.** `@sync/shared` has a `test` script but zero test files, and its tsconfig excludes `__tests__`; adding a runner there was out of scope, and the plan's own acceptance criterion said these behaviours should hold "once Task 2's tests land".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Narrowing `CreatePaymentIntentParams.type` broke `apps/mobile`**

- **Found during:** Task 2
- **Issue:** The plan required narrowing `CreatePaymentIntentParams.type` to `CreatablePaymentType` and required `pnpm --filter @sync/mobile typecheck` to exit 0, but did not trace the consumers. `apps/mobile/src/hooks/usePayment.ts` passes `type: PaymentType` straight through, and changing `CreatePaymentResponse` to the real body also changed the return shape. Five errors: `usePayment.ts(33,11)` type not assignable, `(48,13)` and `(58,13)` `Property 'status' is missing in type 'CreatedPayment' but required in type 'PaymentIntent'`, plus two in `usePayment.test.ts` at the mocked `createPaymentIntent` calls.
- **Fix:** `usePayment.ts` now takes `CreatablePaymentType`, derives the payment shape as `Awaited<ReturnType<typeof paymentsApi.createPaymentIntent>>` (no new subpath import for the value type), re-exports both `PaymentType` and `CreatablePaymentType` with a comment on the difference, and swaps `Record<string, any>` for `Record<string, unknown>`. The two jest-mocked calls moved from `vote_participation`/300 agorot to `vote_creation`/5000 — semantically the correct fixture now that participation is free.
- **Files modified:** `apps/mobile/src/hooks/usePayment.ts`, `apps/mobile/src/__tests__/hooks/usePayment.test.ts`
- **Verification:** `pnpm --filter @sync/mobile typecheck` back to exit 0
- **Committed in:** `16bbd05` (Task 2 commit)

**2. [Rule 3 - Blocking] The `createPaymentIntent` describe could not be left untouched**

- **Found during:** Task 2
- **Issue:** The plan said "leave the remaining describes untouched", but `packages/api-client/tsconfig.json` includes `src/**/*`, so the describe's `type: 'vote_participation' as const` fails typecheck against the narrowed param, and its `{ paymentIntent: … }` mocks fail against the corrected response key. The plan's own acceptance criterion demands api-client typecheck exit 0.
- **Fix:** Minimal fixture edits only — `vote_participation` → `vote_creation`, and `{ paymentIntent }` → `{ success: true, payment }`. No assertions removed.
- **Files modified:** `packages/api-client/src/__tests__/payments.test.ts`
- **Verification:** `pnpm --filter @sync/api-client test && pnpm --filter @sync/api-client typecheck` both exit 0
- **Committed in:** `16bbd05` (Task 2 commit)

**3. [Rule 1 - Bug] The one navigator the plan said to keep also sends an invalid type**

- **Found during:** Task 3
- **Issue:** `apps/mobile/app/(tabs)/create.tsx:89` pushes `params: { type: 'create_vote', … }` — the same string the server has never accepted. The plan described this navigator as "vote creation — **keep**" and forbade editing it.
- **Fix:** Not by editing it. Task 3's instruction to post a `PAYMENT_TYPE` literal instead of forwarding `params.type` already makes the invalid value harmless: the screen no longer reads it. `create.tsx` is byte-identical (`git diff --stat` empty), as the plan required. **Left for a follow-up:** the stale `'create_vote'` param, the four params `checkout.tsx` never reads (`title`, `description`, `options`, `duration`), and the "Navigate to Stripe payment screen" comment on a Green Invoice flow. Logged in `03-03-deferred-items.md`.
- **Files modified:** none beyond `apps/mobile/app/payment/checkout.tsx`
- **Verification:** `git diff --stat "apps/mobile/app/(tabs)/create.tsx"` empty; checkout body contains no `params.type`
- **Committed in:** `3d320f7` (Task 3 commit)

**4. [Rule 4-adjacent - deliberate omission] STATE.md, ROADMAP.md and REQUIREMENTS.md were not updated**

- **Found during:** post-execution bookkeeping
- **Issue:** The executor flow calls for `state advance-plan`, `state update-progress`, `roadmap update-plan-progress` and `requirements mark-complete PAY-08`. Six executors are running concurrently against this single worktree and branch (commit `50befd5` from plan 03-06 landed between my Task 2 and Task 3). `advance-plan` increments a shared counter and would be run six times; `requirements mark-complete PAY-08` would be wrong regardless, since PAY-08 also spans plans 02, 04, 05 and 09, none of which are finished.
- **Fix:** Skipped, and reported instead. The orchestrator should run these once at wave end. No shared planning file was staged or committed by this plan.
- **Files modified:** none
- **Verification:** `git status --porcelain` before each commit showed only this plan's files staged
- **Committed in:** n/a

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug — the third fixed by design rather than by edit) + 1 deliberate omission
**Impact on plan:** Deviations 1 and 2 were forced consequences of changes the plan mandated; both are minimal and keep every package check green. No scope creep — six files touched, three of them the plan's own.

## Issues Encountered

**The web suite is red, and none of it is this plan.** This plan touched zero files under `apps/web` (`git show --stat 872b3f8 16bbd05 3d320f7 | grep apps/web` → nothing), and no web file imports the narrowed schemas.

- `pnpm --filter @sync/web typecheck` reports exactly one error: `src/components/sections/index.ts(7,35): Cannot find module './MoneyTransparency'`. Plan **03-04 T1** deletes that component; the directory's three files show as `D` in `git status` while `sections/index.ts` has not yet been updated. Mid-task state of another executor.
- `pnpm --filter @sync/web test` → 6 failed / 895 passed, all six in `src/__tests__/api/payments.test.ts`, all asserting behaviour plan **03-02** has already changed in the route (e.g. `:150` expects `data.pricing.voteParticipation.amount === 3`, but `api/payments/create/route.ts` now carries 03-02's `CREATABLE_PAYMENT_TYPE` / `RETIRED_PAYMENT_TYPE` constants). `03-VALIDATION.md` assigns that test file to 03-02 T3, which has not run yet. This is 03-02's documented RED window.
- The stated baseline (71 files / 876 tests) had already moved to 73 files / 901 tests before this plan's first commit, from other executors' work.

**Recommendation:** re-run `pnpm --filter @sync/web typecheck` and `test` after 03-02 T3 and 03-04 T1 complete, at wave end, not against this plan.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Ready:** 03-02 can rely on no client sending `vote_participation` to `POST /api/payments/create` any more. 03-08 can drop the server's honouring of `idempotencyKey`; the field is still on `CreatePaymentRequestSchema` and should be removed there in the same plan.
- **Watch:** `packages/shared` has a `test` script and a vitest devDependency but zero test files, so `pnpm --filter @sync/shared test` exits 1 with "No test files found". Any future task must not gate on it.
- **Follow-ups logged in `03-03-deferred-items.md`:** the `'create_vote'` param and dead params in `(tabs)/create.tsx`; `payment/failed.tsx`'s `params.type || 'vote_participation'` fallback (now inert, since checkout ignores it); the ₪3/300-agorot fixtures in `apps/mobile/src/__tests__/hooks/usePayment.test.ts`'s "Payment amounts" describe; and the "1 ש\"ח = 1 טוקן" block still on the checkout screen, which is a token claim rather than a per-vote price and so sits outside PAY-08's money-model scope.

## Self-Check: PASSED

All six modified source files exist on disk; all three task commits (`872b3f8`, `16bbd05`, `3d320f7`)
resolve in `git log`. Every verification result in the table above was measured, not assumed.

---
*Phase: 03-payment-rails-hardening*
*Completed: 2026-08-04*
