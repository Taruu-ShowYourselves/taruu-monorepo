---
phase: 03-payment-rails-hardening
plan: 08
subsystem: payments
tags: [payments, idempotency, sha256, green-invoice, SEC-04, security]

requires:
  - phase: 03-payment-rails-hardening (plan 03-02)
    provides: "creation-only POST /api/payments/create, and payments.test.ts with no client-supplied idempotencyKey in any request body"
provides:
  - "apps/web/src/services/payments/idempotency.ts — pure, clock-free key derivation with an injected lookup"
  - "server-derived {userId}:{type}:{scope} key on the payment create route; the client override is gone"
  - "a bounded, deterministic spent-key chain so determinism does not lock a user out of a second vote"
  - "409 (not 500) when the chain is exhausted"
affects:
  - "plan 03-03 / whoever next owns packages/shared/src/contracts/payment.ts — its idempotencyKey field is now vestigial (see deferred-items.md)"
  - "Phase 4 GO-02 reconciliation — a retry no longer mints a second pending payment row to reconcile"

tech-stack:
  added: []
  patterns:
    - "pure core + async shell with an injected lookup (mirrors services/verification/eligibility.ts, plan 02.1-02)"
    - "pin a derived identifier's exact shape with a regex in the test, so a reintroduced clock fails the pattern rather than only the review"
    - "chain off the spent row's own id instead of a nonce when a deterministic key must be escapable"

key-files:
  created:
    - apps/web/src/services/payments/idempotency.ts
    - apps/web/src/__tests__/services/payment-idempotency.test.ts
    - .planning/phases/03-payment-rails-hardening/deferred-items.md
  modified:
    - apps/web/src/app/api/payments/create/route.ts

key-decisions:
  - "A creation request has no voteId and no optionId, so the SEC-04 scope segment is a sha256 of the draft title — implementing the requirement's literal shape would have collapsed every vote a user ever creates onto one UNIQUE key"
  - "A spent key escapes via deriveRetryKey(base, spentPaymentId): deterministic, bounded at 4 hops, no clock and no nonce"
  - "A client-supplied voteId is deliberately NOT fed into the key on a creation request — that would hand key control back to the caller"
  - "The docstring may not contain the literal forbidden expression: the plan's own verify gate greps for it"

patterns-established:
  - "Injected-lookup resolution: every branch of a database-shaped decision is unit-testable without a database"
  - "Assert the bound on any retry loop explicitly — that assertion is what stops an infinite loop shipping"

requirements-completed: [SEC-04]

duration: ~20 min
completed: 2026-08-04
---

# Phase 03 Plan 08: Server-Derived Payment Idempotency Summary

**The payment key is now `{userId}:vote_creation:{sha256(title)[0:16]}`, derived server-side from the request's own identity, with a bounded deterministic chain past a spent key — the clock suffix and the client override are both gone, so a double-submitted creation returns the pending payment instead of minting a second row and a second hosted Green Invoice form.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-04T17:35:00Z
- **Completed:** 2026-08-04T17:46:00Z
- **Tasks:** 3
- **Files created/modified:** 4 (3 created, 1 modified)

## Accomplishments

- **The UNIQUE constraint can finally do its job.** `payments.idempotency_key` has been `TEXT UNIQUE NOT NULL` since the initial schema, but the route appended a millisecond timestamp to every key, so the lookup two lines below it could never hit. It now hits.
- **The client cannot pin a key.** `idempotencyKey` is off the `CreatePaymentRequest` interface and off the destructuring; a body that still sends one is ignored, not honoured. A caller can no longer aim at another user's flow.
- **Determinism did not become a lifetime lock.** This was the non-obvious hazard the plan named. Because a creation request has neither `voteId` nor `optionId`, the naive `{userId}:vote_creation:` key would be identical for every vote that user ever creates, and the route would keep returning their first, already-completed payment forever. Scoping on a title hash plus chaining off the spent payment's id fixes that without a clock.
- **The retry loop is provably bounded.** `MAX_IDEMPOTENCY_CHAIN = 4`, and the test asserts the lookup is called exactly that many times before `{ kind: 'exhausted' }` — the assertion that stops an infinite loop shipping. An exhausted chain answers 409 in Hebrew, not 500.

## Task Commits

1. **Task 1: A pure, clock-free idempotency-key derivation** — `0f66cf6` (feat)
2. **Task 2: Wire the route and ignore whatever the client sent** — `c56b83d` (fix)
3. **Task 3: Unit-test derivation, reuse, and the spent-key chain** — `db7b255` (test)

## Files Created/Modified

- `apps/web/src/services/payments/idempotency.ts` — **created.** `derivePaymentIdempotencyKey`, `deriveRetryKey`, `resolveIdempotencyKey`, `MAX_IDEMPOTENCY_CHAIN`. Imports nothing from `next/*` and nothing from `@/lib/supabase/db`; the lookup arrives as an argument, so the module is pure enough to test exhaustively and cannot acquire a hidden dependency on request context.
- `apps/web/src/app/api/payments/create/route.ts` — **modified.** The `:79` expression and the inline existing-payment block collapse into one `resolveIdempotencyKey` call with three outcomes: `exhausted` → 409, `reuse` → the byte-identical idempotent response body, `fresh` → carry on into `createPayment`. Nothing else changed: session check, user lookup, amount, `createVoteCreationPayment` call and response shape are exactly as plan 03-02 left them.
- `apps/web/src/__tests__/services/payment-idempotency.test.ts` — **created.** 23 tests across four describes.
- `.planning/phases/03-payment-rails-hardening/deferred-items.md` — **created.** One out-of-scope observation, below.

## Decisions Made

**The requirement could not be implemented literally, and the plan said so first.** `REQUIREMENTS.md` SEC-04 specifies `{userId}:{type}:{voteId|optionId}`. Neither identifier exists on a creation request — the vote is created *after* the payment settles. The shipped scope is `voteId ?? optionId ?? sha256(voteTitle)[0:16]`, which honours the literal shape when a flow does have a vote (asserted by a test) and degrades to a title hash when it does not.

**The escape hatch chains off the spent payment's id, not a nonce.** `deriveRetryKey(base, spentPaymentId)` is a hash of `{base}:{spentPaymentId}`, so a double-submit *at the retry point* still collapses to a single new payment. A nonce or a counter would have reopened the exact hole this plan closes.

**A client-supplied `voteId` is not fed into the key.** The route passes only `userId`, `type` and `voteTitle` into the resolver, exactly as the plan specified. Threading `body.voteId` through would have handed key control back to the caller by another door — the same defect in a different costume.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan's own docstring failed the plan's own verify gate**

- **Found during:** Task 1
- **Issue:** The literal module source in the plan's `<action>` block quotes the defective expression, including `Date.now()`, inside its docstring. Task 1's `<automated>` gate is `! grep -q "Date.now" …/idempotency.ts`, and its acceptance criteria demand `grep -c "Date.now"` return `0`. Written as printed, the file fails its own gate on the first run — confirmed, it did.
- **Fix:** Kept the full explanation but described the defect in prose ("fell back to `{userId}-{type}-{voteId|create}-` followed by a millisecond timestamp") instead of pasting the forbidden literal, and added a line pointing at the test that pins the key's shape. No behavioural difference; the module is otherwise byte-for-byte the plan's.
- **Verification:** `grep -c "Date.now" apps/web/src/services/payments/idempotency.ts` → `0`; typecheck exits 0.
- **Committed in:** `0f66cf6`

**2. [Rule 3 - Structural] Tasks 1 and 2 carry `tdd="true"` but the plan puts the test in Task 3**

- **Found during:** Task 1
- **Issue:** A literal TDD RED step for Tasks 1 and 2 would create `payment-idempotency.test.ts`, which is Task 3's declared file, and would violate this phase's verification-gate rule (a task must never gate on a test file a later task in the same plan creates — vitest 1.6.1 exits 1 with "No test files found").
- **Fix:** Followed the plan's explicit structure and its own note (*"Self-contained: the unit test is Task 3 of this plan"*): Tasks 1 and 2 gate on typecheck plus greps, and the behavioural proof lands one task later. This is what `03-VALIDATION.md` rows 03-08-T1..T3 prescribe.
- **Committed in:** n/a (execution-order decision, no code impact)

### Not a deviation, recorded for attribution

**`grep -c "idempotencyKey"` on the create route returns 1, not 0.** The single occurrence is the comment the plan's Task 2 `<action>` explicitly instructed be added (*"Add a one-line comment recording that a client-supplied key is deliberately not accepted (SEC-04)"*). The criterion scopes itself to *the client field*, and no field, destructuring binding or `body.` read remains — the test asserts `not.toMatch(/\bidempotencyKey\b/)` against comment-stripped source.

---

**Total deviations:** 2 auto-fixed (2 blocking/structural)
**Impact on plan:** No scope change. The shipped module and route match the plan's intent exactly; only a docstring's wording and the internal ordering rationale differ.

## Issues Encountered

**Eight tests in `payments.test.ts` are red at handoff, and none of them are mine.** All eight are in the `POST /api/payments/webhook` describe — plan 03-07's surface, being rewritten by a concurrent executor in this same worktree right now. The causal chain is measured, not assumed:

- Immediately after my Task 2 commit, `payments.test.ts` ran **28/28 green**.
- The sibling then committed `73a3663` (`fix(03-07): take the webhook secret out of the URL…`) and left `apps/web/src/app/api/payments/webhook/route.ts` with 63 uncommitted insertions.
- The failures are of the form `expected 500 to be 404` — the rewritten route now calls `confirmDocumentIssued`, which the not-yet-rewritten test file does not mock. Plan 03-07's Task 3 rewrites exactly these cases; this is its RED window, anticipated by `03-VALIDATION.md`.
- My changes touch the **create** route only. All 7 tests in the `POST /api/payments/create` describe pass (`-t "POST /api/payments/create"` → 7 passed, 21 skipped).

Per the scope-boundary rule I did not touch them. `git diff apps/web/src/__tests__/api/payments.test.ts` is **empty** — the file 03-07 owns this wave was never opened for writing.

## Out of Scope — Observed, Not Fixed

`packages/shared/src/contracts/payment.ts:35` still declares `idempotencyKey: z.string().optional()`. The server ignores it, so SEC-04 holds at the enforcement point; what remains is a wire contract advertising a field the server discards. That file belongs to plan 03-03 and is outside this plan's `files_modified`. Logged in `deferred-items.md`.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **SEC-04 is closed in code.** The one behaviour a unit test cannot prove is genuine concurrency against the real `UNIQUE(idempotency_key)` constraint; `03-VALIDATION.md` already records it as a manual check ("double-click the create button; confirm exactly one `payments` row and one redirect").
- **Plan 03-07 is unaffected by this work** and its files are untouched: `payments.test.ts`, `greenInvoice.ts` and `webhook/route.ts` carry zero changed lines from any of my three commits. Its Task 3 rewrite will take the suite green again.
- **Phase 4 GO-02 reconciliation gets a cleaner ledger**: a retried creation no longer leaves an orphan pending row behind.

## Verification

| Check | Result |
|---|---|
| `pnpm --filter @sync/web typecheck` | exit 0 |
| `pnpm --filter @sync/web test -- src/__tests__/services/payment-idempotency.test.ts` | 23 passed (≥12 required) |
| `pnpm --filter @sync/web test -- src/__tests__/api/payments.test.ts` (after Task 2) | 28 passed |
| `pnpm --filter @sync/web test` (full, at handoff) | 953 passed / 8 failed — all 8 in 03-07's webhook describe, mid-rewrite |
| `grep -rn "Date.now()" apps/web/src/app/api/payments/` | no matches |
| `grep -c "Date.now"` in `idempotency.ts` | 0 |
| `grep -cE "Math.random\|randomUUID\|crypto.getRandomValues"` in `idempotency.ts` | 0 |
| `grep -cE "from '@/lib/supabase/db'\|from 'next/"` in `idempotency.ts` | 0 |
| `grep -c ": any"` in `idempotency.ts` / test | 0 / 0 |
| `resolveIdempotencyKey` in create route | 2 occurrences |
| `409` in create route | present |
| `git diff apps/web/src/__tests__/api/payments.test.ts` | **empty** |
| `git diff` from my commits on `greenInvoice.ts` / `webhook/route.ts` | none (sibling's uncommitted WIP only) |
| `.only(` / `--watch` in the new test | 0 |

## Self-Check: PASSED

All four created/modified files exist on disk. All three task commits (`0f66cf6`, `c56b83d`, `db7b255`) are present in `git log`, and each touched exactly one file — none of them a file owned by plan 03-07 or by any other executor in this worktree.

**STATE.md, ROADMAP.md and REQUIREMENTS.md were deliberately not updated.** Three other executors share this worktree; the wave-end rollup (`state advance-plan`, `update-progress`, `roadmap update-plan-progress`, `requirements mark-complete`) is the orchestrator's, run once when wave 2 closes.

---
*Phase: 03-payment-rails-hardening*
*Completed: 2026-08-04*
