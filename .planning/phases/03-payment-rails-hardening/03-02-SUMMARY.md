---
phase: 03-payment-rails-hardening
plan: 02
subsystem: payments
tags: [payments, green-invoice, webhook, api-contract, PAY-08, PAY-06]
requires:
  - "packages/shared CREATE_VOTE_COST (₪50)"
  - "free participation path (plan 02.1-04, /api/votes/[id]/participate)"
provides:
  - "creation-only payment service (no VOTE_PARTICIPATION_AMOUNT, no createVotePayment)"
  - "creation-only POST + GET contract on /api/payments/create"
  - "webhook fulfilment with no participation branch and no civic-pool credit"
affects:
  - "plan 03-03 (shared contract + api-client + mobile) — the wire contract this server now enforces"
  - "plan 03-07 (verifyWebhook / parseWebhookEvent / notifyUrl) — surface deliberately left untouched"
  - "plan 03-08 (idempotency) — the :77 expression and Date.now() left exactly as found"
tech-stack:
  added: []
  patterns:
    - "retire a rail rather than reprice it to zero — a ₪0 payment is still a payment"
    - "recognise a legacy enum value without fulfilling it"
key-files:
  created: []
  modified:
    - apps/web/src/services/payments/greenInvoice.ts
    - apps/web/src/services/greenInvoice/index.ts
    - apps/web/src/app/api/payments/create/route.ts
    - apps/web/src/app/api/payments/webhook/route.ts
    - apps/web/src/__tests__/api/payments.test.ts
    - apps/web/src/__tests__/services/participation-cost-legacy.test.ts
  deleted:
    - apps/web/src/__tests__/e2e/payment.test.ts
decisions:
  - "Task order executed T2 → T1 → T3 (not T1 → T2 → T3): T1's own typecheck gate is unsatisfiable before T2 lands"
  - "A vote_participation request is rejected in Hebrew, not priced at ₪0"
  - "payments.type keeps its database enum; only creating a participation payment is retired"
metrics:
  duration: ~35 min
  tasks: 3
  files: 7
  completed: 2026-08-04
---

# Phase 03 Plan 02: Retire the ₪3 Rail Summary

Participation payments are gone from the web app — the service, the API contract, and the webhook now know exactly one payment: a ₪50 vote creation that credits no civic pool.

## What Shipped

**The payment service is single-purpose.** `VOTE_PARTICIPATION_AMOUNT` and `createVotePayment` are deleted, `getPaymentAmounts()` returns `{ voteCreation, currency }`, and the module docstring records why participation is absent and that the creation fee is 100% platform. `createVoteCreationPayment` is unchanged in signature and behaviour.

**The API can only create one thing.** `POST /api/payments/create` accepts `vote_creation` alone. An explicit `vote_participation` request returns 400 with `ההשתתפות בהצבעה חינם - אין תשלום ליצור.` and opens no payment row — it is rejected, not priced at zero, because a published ₪0 is still a price. `GET` publishes creation pricing only. The three participation-only guards (identity score, GPS verification) are gone; they were participation gates and now live on the free path, while creation keeps its stricter publish-time gate in `create-vote.ts`.

**A settled creation fee credits no civic pool.** The `recordTreasuryDeposit` block is deleted outright, with a comment naming PAY-06 so it is not re-added. The entitlement is unconditionally `create_vote`, and the vote-recording block is gone — a payment must never be the thing that records a ballot.

**A legacy participation settlement is recognised and ignored.** A pre-`cfa5d25` row that somehow settles is logged (`Legacy vote_participation payment settled - no fulfilment`) and fulfils nothing. The database enum is untouched, so the comparison stays legal and historical rows still parse.

## Deviations from Plan

### 1. [Rule 3 - Blocking] Task order reversed to T2 → T1 → T3

**Found during:** Task 1, before any edit.

**Issue:** Task 1's `<automated>` gate requires `typecheck` to exit 0, but Task 1 narrows `getPaymentAmounts()` and drops `paymentService.createVotePayment` while `create/route.ts` still consumes both (`:97`, `:122`, `:181`, `:183`). Task 1 could not typecheck clean before Task 2 landed. The plan's own task boundaries and its own verify gate are mutually unsatisfiable in the stated order.

**Fix:** Executed Task 2 (routes) first, then Task 1 (service), then Task 3. Task 2 standing alone typechecks clean because it only *stops using* the participation exports, which still exist at that point. Final state is byte-identical to what the plan specifies; only commit ordering differs.

**Commits:** `ff515af` (T2), `9fa88ed` (T1), `b2f10d1` (T3)

### 2. [Rule 3 - Blocking] A pre-existing guard pinned the exact line Task 1 deletes

**Found during:** Task 1.

**Issue:** `apps/web/src/__tests__/services/participation-cost-legacy.test.ts:149` asserted `greenInvoiceCode` contains `'const VOTE_PARTICIPATION_AMOUNT = 3;'`. The plan never enumerated this file. Its own comment named the owner: *"Retiring it belongs to the Phase 3 payment re-scope."* This is that plan.

**Fix:** Flipped the assertion from "the ₪3 amount is pinned" to "no participation amount and no `createVotePayment` exist at all", and corrected the file docstring which claimed the rail was deliberately unchanged. No other assertion in that suite was touched. Verified no sibling plan edits this file — 03-04 and 03-09 only read it.

**Commit:** `9fa88ed`

### 3. [Rule 3 - Blocking] Two Task 3 deletions pulled forward into Task 1

**Found during:** Task 1.

**Issue:** `tsconfig.json` includes `**/*.ts`, so tests are typechecked. `payments.test.ts:278` and `:298` reference `paymentService.createVotePayment`, which becomes TS2339 the moment Task 1 removes the export.

**Fix:** Landed exactly the two deletions Task 3 already prescribes — the `'should create checkout successfully for vote participation'` case and the `createVotePayment: vi.fn()` mock entry — one commit early, in `9fa88ed`. Nothing beyond what Task 3 specified.

### 4. [Rule 1 - Correctness] Two required test-body changes the plan did not spell out

- The idempotency case sent `type: 'vote_participation'`, which now 400s before reaching the idempotency lookup. Changed to `vote_creation` (in addition to dropping `idempotencyKey: 'key-123'` as instructed) so the test still exercises what it names.
- The 401 case also sent `vote_participation`. Changed to `vote_creation` so every remaining `vote_participation` occurrence sits in a negative assertion or a legacy fixture, as the acceptance criteria require.

### 5. Stale counts in the plan's acceptance criteria

Task 3 expects the full suite at **69 files**. The measured baseline at execution start was **71 files / 876 tests** — five sibling executors have been landing files concurrently. Final: **73 files / 927 tests, all passing**. My own delta is exactly −1 file (the deleted E2E) and −2 tests in `payments.test.ts` (30 → 28 `it()` blocks: −3 deleted, +1 new). The rest of the movement is siblings'.

### 6. Foreign WIP inside my own files (not my edits, unavoidable)

This worktree mirrors the parallel session's 322 uncommitted files, which include a repo-wide em-dash→hyphen sweep. Seven such cosmetic lines sit inside `greenInvoice.ts` and four inside the two route files. Because staging is file-granular, they were committed alongside my changes. No behaviour is affected; flagged for attribution only.

## Out of Scope — Observed, Not Fixed

`apps/web/src/components/sections/index.ts` referenced a deleted `./MoneyTransparency` for several minutes mid-execution, breaking tree-wide typecheck. That is plan 03-04's file and 03-04's task; I waited rather than fixing it, and the sibling resolved it. Both typecheck and the suite are green at handoff.

## Verification

| Check | Result |
|---|---|
| `pnpm --filter @sync/web typecheck` | exit 0 |
| `pnpm --filter @sync/web test` | exit 0 — 73 files, 927 tests |
| `pnpm --filter @sync/web test -- src/__tests__/api/payments.test.ts` | 28 passed |
| `voteParticipation` under `services/payments/` or `app/api/payments/` | none |
| `recordTreasuryDeposit` in `webhook/route.ts` | 0 |
| `recordUserVote` / `incrementVoteOption` in `webhook/route.ts` | 0 / 0 |
| `randomUUID` in `create/route.ts` | 0 |
| `Date.now()` in `create/route.ts` | 1 — unchanged (03-08 owns it) |
| Generated `lib/supabase/types.ts` | not touched by any of my commits |
| `notifyUrl` / `verifyWebhook` / `parseWebhookEvent` changed lines | 0 (03-07's surface intact) |
| `apps/web/src/__tests__/e2e/` | deleted, directory removed |

## Next Phase Readiness

- **03-07** takes `verifyWebhook`, `parseWebhookEvent` and `notifyUrl` exactly as it left them; the `?token=` transport is still in place and still described in the docstring, untouched on purpose.
- **03-08** finds `:77`'s idempotency expression and its `Date.now()` byte-identical, and `payments.test.ts` no longer sends a client-supplied `idempotencyKey`, so the override can be dropped without a cross-plan edit.
- **03-03** must still retire `createVotePayment` from `packages/api-client`, `voteParticipation` from `packages/shared/src/contracts/payment.ts:58`, and the mobile checkout branch. The server now rejects what those clients can still ask for.
- `chargeToken()` remains orphaned; only its docstring changed.

## Self-Check: PASSED

All six modified files exist; the deleted E2E file and its directory are gone; commits `ff515af`, `9fa88ed`, `b2f10d1` all present in `git log`.
