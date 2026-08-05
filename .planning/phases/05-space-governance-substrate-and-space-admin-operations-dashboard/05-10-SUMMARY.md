---
phase: 05-space-governance-substrate-and-space-admin-operations-dashboard
plan: 10
subsystem: api
tags: [payments, neverthrow, zod, vitest, hexagonal, idempotency, react, typescript]

# Dependency graph
requires:
  - phase: 05-03
    provides: the in_review vote_status label and the PUBLIC_VOTE_STATUSES allow-list that hides it
  - phase: 05-05
    provides: decideProposal and the marked charge seam between guard steps 4 and 5
provides:
  - CreationFeePort + CREATION_FEE_AGOROT — the one seam between a review decision and a payment rail
  - createCreationFeePort() — today's implementation, a deterministic pending vote_creation obligation
  - submissionStatus() — every new proposal enters review, whatever its start date
  - CHARGE_FAILED_HE — the approve dialog's charge-failure sentence, owned by the use-case
  - DecideProposalDeps — the injection point a test uses to make the charge decline
  - a free submission path on both sides of the wire
  - 10 tests in space-admin-approve-charge.test.ts
affects: [05-13, 05-16, PAY-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A port interface in server/app/**/ports/ with its implementation in server/infra/**, so a phase-3 rail swap is one file"
    - "Deterministic server-generated idempotency key as the only double-charge defence (SEC-04)"
    - "Charge-then-commit: the money request precedes the state transition, so a decline leaves nothing behind"
    - "An optional defaulted deps parameter, so the thin route shell keeps its shape and tests still inject"

key-files:
  created:
    - apps/web/src/server/app/space-admin/ports/creation-fee.ts
    - apps/web/src/server/infra/payments/creation-fee.ts
    - apps/web/src/__tests__/api/space-admin-approve-charge.test.ts
  modified:
    - packages/shared/src/contracts/vote.ts
    - apps/web/src/server/domain/votes/vote.ts
    - apps/web/src/server/app/votes/create-vote.ts
    - apps/web/src/app/api/votes/route.ts
    - apps/web/src/app/[locale]/votes/create/page.tsx
    - apps/web/src/app/[locale]/payments/return/page.tsx
    - packages/api-client/src/votes.ts
    - packages/api-client/src/__tests__/votes.test.ts
    - apps/web/src/server/app/space-admin/decide-proposal.ts
    - apps/web/src/__tests__/api/votes.test.ts
    - apps/web/src/__tests__/api/space-admin-decide.test.ts
    - apps/web/src/__tests__/api/space-admin-audit.test.ts

key-decisions:
  - "The idempotency key follows SEC-04's documented component order {userId}:{type}:{voteId}, not the plan's literal, so PAY-06 inherits one convention across creation and participation"
  - "The port's generic decline reason is replaced by CHARGE_FAILED_HE in the use-case, because the dialog's promise belongs to the surface making it, not to infra"
  - "deps is an optional defaulted parameter rather than threaded through the route, so no undeclared route file changes"
  - "The in_review Hebrew label is copied into the client page with a pointer comment, not imported from server/domain"
  - "A lost insert race re-reads the winning row instead of surfacing a spurious 402"

requirements-completed: []

# Metrics
duration: 58min
completed: 2026-08-03
---

# Phase 5 Plan 10: Charge on approval, not on submission Summary

**The ₪50 moved from submission to approval on both sides of the wire — the browser no longer opens a checkout before a vote exists, the server no longer verifies a payment to accept one, and an approval asks a single `CreationFeePort` for the fee *before* it publishes, so a decline leaves no vote and no payment row.**

## Performance

- **Duration:** ~58 min (07:56Z → 08:55Z, including a ~10 min stall between Task 1 and Task 2)
- **Tasks:** 4 (two of them TDD)
- **Files:** 3 created, 12 modified
- **Commits:** 7, all path-scoped, all audited with `git show --stat` — none contains a sibling's file

## What today's `CreationFeePort` implementation does and does not do

The phase-3 planner should read this paragraph and nothing else if pressed for time.

**It does:** write one `payments` row — `type: 'vote_creation'`, `amount: 5000` agorot, `currency: 'ILS'`, `status: 'pending'`, `vote_id` set, `idempotency_key` deterministic, `metadata: { chargedAt: 'approval', phase: '05', note: 'capture pending PAY-06' }`. It looks the key up before inserting, so a second approval attempt returns the original row. It returns `outcome: 'obligation'`.

**It does not:** move money. No provider is contacted, no invoice is issued, no capture is attempted, and `outcome: 'captured'` is unreachable from anything this file writes — it is returned only if a row is found already `completed`, which nothing in phase 5 can produce. A `vote_creation` row created by this code means "₪50 is owed", not "₪50 was taken".

**What PAY-06 changes:** the body of `charge` in `apps/web/src/server/infra/payments/creation-fee.ts`, and nothing else. The port interface, `decide-proposal.ts`, the audit row shape and the approve dialog's copy are already written against a rail that either captures or declines. That single-file swap is the whole point of the seam, and the file's header comment says so.

## The stranded-obligation hazard PAY-06 must reconcile

**A lost approve/reject race can strand a `pending` `vote_creation` obligation, and PAY-06 must reconcile stranded rows before it can capture.**

Concretely: the charge fires before `transitionProposal`. If two admins decide the same proposal concurrently and the approver loses the race, the obligation has already been recorded. When the concurrent decision was also an *approve*, the deterministic idempotency key collapses both attempts onto one payment row and nothing is wrong. When the concurrent decision was a *reject*, the proposal will never publish and a `pending` `vote_creation` row is left standing against the submitter for a proposal that was refused.

Nothing captures money today, so nothing is actually owed — the row is inert. But a rail that captures must sweep `pending` `vote_creation` rows whose `vote_id` resolves to a `rejected` or `changes_requested` proposal, and cancel them, before it starts charging. This is not hypothetical bookkeeping: it is the direct and accepted cost of charging before publishing, which is itself required so that a declined charge cannot leave a published unbilled vote.

## `/api/payments/create` still carries an unreachable `vote_creation` branch

The route at `apps/web/src/app/api/payments/create/route.ts` still handles `type: 'vote_creation'`. After this plan **no shipped surface calls it with that type**: the create-vote page now posts the proposal directly, and mobile's `apps/mobile/app/payment/checkout.tsx` forwards a `type` parameter that no mobile caller sets to `vote_creation`. The branch is therefore dead from the product's point of view but still exercised by `payments.test.ts`.

It was left in place deliberately. Removing it is a separate cleanup with its own test churn, and doing it here would have meant editing a payments route and a payments test that this plan never declared. The single remaining `payments/create` call under `[locale]` is `votes/[id]/flow/ParticipationFlow.tsx` — the participation checkout, which is untouched and must stay.

## Task Commits

1. **Task 1 RED: free-submission tests** — `f835a07` (test)
2. **Task 1 GREEN: submission is free and enters review** — `9eccfe9` (feat)
3. **Task 1 tail: route docblock** — `cf182f2` (docs)
4. **Task 2: retire the pay-before-submit browser flow** — `9d35240` (feat)
5. **Task 3: the port and today's implementation** — `10b2296` (feat)
6. **Task 4 RED: charge tests** — `584e153` (test)
7. **Task 4 GREEN: charge on the approve branch** — `4bff34a` (feat)

## The client half, which was the sharp part

Before this plan the ₪50 was requested by the *browser*: `handleSubmit` POSTed `/api/payments/create`, stashed the draft in `sessionStorage['pendingVote']`, and redirected to a Green Invoice checkout **before any vote row existed**; the payments return page then POSTed `/api/votes` with the payment id and told the user their topic was `פורסם · PUBLISHED`.

Freeing only the server would have charged the submitter at submission *and* created a second obligation at approval. Both halves moved:

- The create page POSTs `/api/votes` once, with no payment reference and no retry — there is no webhook to wait for. `payments/create`, `paymentUrl`, `pendingVote`, `sessionStorage` and the random-hex mock fallback are all gone (each greps to 0).
- The `SealCard` is deleted from the success surface along with `sealHash`. It rendered `חתום בבלוקצ׳יין` over a hash; at submission nothing is signed and no chain record exists, so it was the same class of untruth as the `PUBLISHED` copy. The surface is gated on the returned vote id instead.
- The payments return page is now a static acknowledgement with no state, no effect and no knowledge of proposals — 170 lines down to 48. `pendingVote`, `PendingVote`, `paymentTxId`, `api/votes` and `useEffect` all grep to 0.

**Copy.** The obligation wording is the locked one throughout: `ייווצרו` / `רק אם ההצעה תאושר`, never `ייגבו`. `grep -c "ייגבו"` on the create page returns 0. The submitted surface reads `ההגשה לא חויבה — דמי יצירה של ₪50 ייווצרו רק אם ההצעה תאושר ותתפרסם.`, and the step-4 plate shows `עלות הגשה = ללא תשלום` above `דמי יצירה = ₪50 — רק אם ההצעה תאושר`.

## Decisions Made

- **The idempotency key uses SEC-04's component order, not the plan's literal.** The plan specified `` `${submitterUserId}:${voteId}:vote_creation` ``; REQUIREMENTS.md SEC-04 documents the platform convention as `{userId}:{type}:{voteId|optionId}`. The shipped key is `` `${submitterUserId}:vote_creation:${voteId}` ``. Same three components, same determinism, same uniqueness, and it satisfies every stated criterion (built from submitter, vote and the literal `vote_creation`; the task's `grep -q ":vote_creation"` passes). The reason to prefer it: PAY-06 will key participation charges the same way, and one convention beats two orderings that differ for no reason.
- **`CHARGE_FAILED_HE` lives in the use-case, not the port.** The port returns a generic `paymentInvalid('התשלום נכשל')` — it does not know it is being called from a review dialog. `decideProposal` maps a `PAYMENT_INVALID` from the port onto the UI spec's sentence and passes every other error kind through untouched, so a database fault from the port is never dressed up as a payment decline. The 402 body is therefore exactly what the dialog's `role="alert"` renders.
- **`deps` is an optional defaulted fifth parameter.** The plan said to default `createCreationFeePort()` "in the route", but the decide route is not in this plan's `files_modified`. Defaulting inside `decideProposal` keeps both routes untouched and unchanged in shape, and app→infra imports are already this codebase's norm (`create-vote.ts` imports four repos directly). Tests still inject by passing `deps` or by mocking the infra module.
- **The `in_review` Hebrew label is copied into the client page, not imported.** `REVIEW_STATUS_LABELS_HE` lives in `server/domain/space/review.ts`, which imports the votes domain, which re-exports back from review — a cycle that is harmless server-side but that I was not willing to pull into a client bundle for one word on a live page, with no build run available to prove it initialises cleanly. The page declares `STATUS_IN_REVIEW_HE = 'בבדיקה'` with a comment naming the constant as source of truth; `review.test.ts` already pins that exact string, so a change there fails a test rather than drifting silently. **This satisfies the plan's "reuse that string" criterion by value, not by import** — flagged here because it is a judgement call, and 05-13 may reasonably decide the shared-label question differently for the admin surface.
- **A lost insert race re-reads the winner.** Two concurrent approvals both read `null` and both insert; the loser hits the UNIQUE constraint. That is the idempotency key working, not a failure, so the implementation re-reads and returns the winning row rather than surfacing a spurious 402.
- **The port takes `amountAgorot` and the implementation inserts the value passed**, rather than the plan's literal `amount: CREATION_FEE_AGOROT`. A port with an amount parameter that ignores it would be a lie in the signature. The caller passes `CREATION_FEE_AGOROT`, and a test asserts it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 05-05's two test files reach the real payment rail on every approve case**

- **Found during:** Task 4
- **Issue:** Once the route's `decideProposal` charges through a defaulted real port, the four approve cases in `space-admin-decide.test.ts` and the approve cases in `space-admin-audit.test.ts` invoke `createCreationFeePort()` for real. It calls `getPaymentByIdempotencyKey`, which reaches `supabaseAdmin`, which throws on the missing service-role key under Vitest — mapped to `paymentInvalid`, so those cases got 402 where they expected 200/500. The plan's own acceptance criterion requires `space-admin-decide.test.ts` to pass, so this could not be left.
- **Fix:** Added a `vi.mock('@/server/infra/payments/creation-fee')` stub returning a fixed successful charge to both files, with a comment saying the charge's own behaviour is `space-admin-approve-charge.test.ts`'s subject. In `space-admin-audit.test.ts` the two approve cases' `new_state` assertions were widened to include `paymentId` and `amountAgorot` — a deliberate semantic change, since 05-10 is precisely what puts the payment id in that row. The reject/request_changes case still asserts `new_state` equals `{ status }` exactly, which now doubles as proof that a decline records no payment keys.
- **Verification:** all three space-admin files green — 39 tests.
- **Committed in:** `4bff34a`

**Both files are outside this plan's `files_modified`.** No wave-4 sibling declares either (checked 05-09, 05-12, 05-13, 05-14, 05-16), so there was no contention, but the plan should have listed them.

**2. [Rule 1 - Bug] My own comment defeated an acceptance criterion**

- **Found during:** Task 3
- **Issue:** The criterion is `grep -c "Date.now()" creation-fee.ts` returns `0`. My idempotency-key comment said "Never `Date.now()`" — the grep found the comment and reported 1. A checker running only the grep would have seen a false failure; a checker running a looser grep could have seen a false pass on the inverse criterion.
- **Fix:** Reworded to "A clock reading or a fresh uuid is forbidden here". Now 0.
- **Committed in:** `10b2296`

**3. [Rule 3 - Blocking] `deps.now` became dead once `initialStatus` left the submission path**

- **Found during:** Task 1
- **Issue:** `CreateVoteDeps.now?: () => Date` existed only to feed `initialStatus(start, now)`. With the status forced to `submissionStatus()`, the local `now` was unused (a lint error) and the deps field became a knob nothing read.
- **Fix:** Removed both. No caller ever set it (`route.ts` passes `{ defer }`; the two other `createVote` call sites are the unrelated `@/lib/supabase/db` helper).
- **Committed in:** `9eccfe9`

### Deliberate departures

- **Task 2's `<verify>` block contains `! grep -q "paymentTxId" packages/api-client/src/votes.ts`, which cannot pass and must not.** That file's `participate` method legitimately sends `paymentTxId` — participation is still a paid action. Satisfying the command literally would have deleted working payment code. The phase-level verification line is the correct one ("no hits outside comments and the participation flow") and it passes. **The acceptance criterion as written is wrong; the criterion below it — `createVote(input: VoteCreateInput)` with no intersection — is the real one and holds.**
- **Task 1's `<read_first>` cites `CreateVoteRequestSchema` at line 99 with `paymentTxId`; it is at line 121, the field at 128.** Line drift only, no behavioural difference.
- **A third `CreateVoteRequest` consumer exists that the plan does not name:** `packages/api-client/src/create-api.ts:120`, `create: (body: Omit<CreateVoteRequest, 'municipality'>)`. The plan said to stop and record rather than edit an undeclared file. It needed no edit — removing a field from the source type only widens what callers may omit — and root typecheck confirms it. Recorded, not touched.
- **`apps/web/src/app/api/votes/route.ts` needed one change beyond the schema:** its docblock claimed the endpoint "requires authentication and a completed payment". Left alone it would have been the only remaining place in the server path asserting the old contract. Corrected in `cf182f2`.

**Total deviations:** 3 auto-fixed (2× Rule 3, 1× Rule 1), 4 deliberate departures.

## Issues Encountered

- **`pnpm --filter @sync/web typecheck` is red on one file that is not mine.** `src/__tests__/api/space-admin-notifications.test.ts` (05-09) imports `claimCampaignForSend`, `insertDeliveries`, `insertUserNotifications` and `@/server/app/space-admin/send-notification`, none of which exist yet — a sibling mid-TDD in this shared worktree. `tsc --noEmit | grep "error TS" | sed 's/(.*//' | sort -u` returns exactly that one path and nothing else. **Root `pnpm typecheck` was green across all 8 workspace packages after Task 1 and after Task 2**, including `apps/mobile`, so the contract change is clear of the mobile exhaustive-`Record<VoteStatus, T>` hazard. (This plan did not widen the status union; 05-03 already added `in_review`.)
- **Nothing here has touched a live Postgres.** The `payments` insert, the `idempotency_key` lookup and the UNIQUE-constraint race behaviour are reviewed, not executed. In particular the claim "a retried approval reuses one row" rests on the constraint existing (`idempotency_key TEXT UNIQUE NOT NULL`, `20240101000000_initial_schema.sql:157`) — the test proves only the precondition, that both attempts pass identical arguments. 05-16 should add this to the never-executed list.
- **`payments.provider` is left to its column default** (`green_invoice`, per `20260703000001`). An obligation created by approval has no provider yet; recording the eventual rail is PAY-06's call, and the `Insert` type does not permit null.
- **The `?status=failed` query parameter remains unhandled** on the payments return page, exactly as before this plan. Green Invoice sets it on the failure URL (`greenInvoice.ts:155`) and the page has never read it, so a declined *participation* payment sees the success acknowledgement. That is a real gap in the participation flow, it predates this work, and adding a failure branch here would be scope this plan cannot test. Documented in the page's own docblock as a known gap.

## Verification Results

- `pnpm typecheck` (root, all 8 packages) — green after Task 1 and Task 2. After Task 4, `@sync/web` is red on 05-09's file only; every other package green.
- `pnpm --filter @sync/web lint` — **exit 0**, 0 errors, 2 pre-existing warnings in `postcss.config.mjs` and `worker.ts` (neither touched).
- `pnpm --filter @sync/web exec vitest run votes.test.ts space-admin-approve-charge.test.ts space-admin-decide.test.ts space-admin-audit.test.ts` — **52 tests, 4 files, all passing**
- `pnpm --filter @sync/api-client exec vitest run src/__tests__/votes.test.ts` — **15 tests passing**
- `grep -rn "creationFee.charge" apps/web/src` (excluding tests) — **exactly one call site**, `decide-proposal.ts:180`
- Charge at line 180 < `transitionProposal(` at line 187, in the same branch. `submitterUserId: row.creator_id` at 174; `scope.userId` never appears as the charged party.
- `grep -rn "payments/create" "apps/web/src/app/[locale]"` — one hit, `votes/[id]/flow/ParticipationFlow.tsx` (participation). **Nothing under `votes/create`.**
- `grep -rn "paymentTxId" apps/web/src packages/shared/src packages/api-client/src` — remaining hits are the participation flow, `payment.repo.ts`, `Participation`/`ParticipationInput` types, and the replacement comment in `contracts/vote.ts`. None on a creation path.
- Create page: `sealHash`, `SealCard`, `CREATE_VOTE_COST`, `formatCurrency`, `sessionStorage`, `pendingVote`, `paymentUrl`, `payments/create`, `paymentTxId`, `צרו הצבעה · ` — all **0**. `fetch('/api/votes'` — **1**.
- Return page: `pendingVote`, `PendingVote`, `paymentTxId`, `api/votes`, `useEffect`, `פורסם · PUBLISHED`, `אנחנו מפרסמים את הנושא שלכם` — all **0**.
- `create-vote.ts`: `paymentTxId` 0, `assertPaymentUsable` 0, `submissionStatus()` 1.
- `creation-fee.ts` (infra): `Date.now()` **0**, `:vote_creation` 1, `paymentInvalid(` 1. Port: `CREATION_FEE_AGOROT = 5000` present with the `CREATE_VOTE_COST` tie in its comment.
- `CreateVoteRequestSchema` is a plain `z.object` — **not `.strict()`** — on zod `^3.23.0`, so unknown keys are stripped. A bundle deployed before this change that still sends `paymentTxId` validates and succeeds rather than 400-ing. Stated as the plan asked; it is a grace period, not a substitute for Task 2.

Deliberately **not** run: the full suite, `next build`, `prettier --check`. Wave 4 has four other plans live in this tree; the phase's one full-suite run is 05-16's, alone in wave 6.

## User Setup Required

None.

## Next Phase Readiness

- **PAY-06 (phase 3)** inherits: one file to change, `outcome: 'captured'` to start returning, and a reconciliation sweep for stranded `pending` `vote_creation` rows it must run before it captures anything.
- **05-13** (the proposals surface) can render the approve dialog against a real 402: the body carries `CHARGE_FAILED_HE` verbatim, which is the `role="alert"` string, and the proposal's status is provably unchanged when it fires. It also inherits the open question of where a client-side copy of `REVIEW_STATUS_LABELS_HE` should live — see Decisions.
- **05-16** should add to its never-executed list: the `payments` insert and idempotency-key lookup in `infra/payments/creation-fee.ts`, and should exercise the free-submission path end to end, since `in_review` on submission is now what keeps an unapproved proposal off `/he/votes`.
- **A proposal submitted today cannot be published by any shipped surface until 05-13 ships the admin queue.** The API path exists and is tested; the button does not. That is the intended wave ordering, not a gap.

---
*Phase: 05-space-governance-substrate-and-space-admin-operations-dashboard*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 15 claimed source files exist on disk and all 7 claimed commits resolve in `git log`. Every line number cited above was re-read after the last commit: `submitterUserId: row.creator_id` at 174, `deps.creationFee.charge` at 180, `transitionProposal(scope` at 187. Each of the 7 commits was inspected with `git show --stat`; none contains a file belonging to another plan.

Claims deliberately **not** verified, and stated as unverified in Issues Encountered: the `payments` insert and idempotency-key lookup against a live Postgres, and the UNIQUE-constraint race behaviour that "a retried approval reuses one row" depends on. Nothing above asserts those were executed.
