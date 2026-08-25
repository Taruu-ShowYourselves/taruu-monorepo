---
phase: 03-payment-rails-hardening
plan: 07
subsystem: payments
tags: [security, webhook, green-invoice, authentication, constant-time, sqlstate, reconciliation, SEC-03, PAY-07]

requires:
  - phase: 03-02
    provides: "the rewritten webhook route (no treasury accrual, no vote recording) and the creation-only payment service this plan hardens"
  - phase: 02.1-02
    provides: "the SQLSTATE 23505 discrimination precedent in db.ts (recordUserVoteOnce)"
provides:
  - "header-only constant-time verifyWebhook - the notify URL carries no secret"
  - "confirmDocumentIssued: server-side document confirmation as the second authenticity factor for the hosted-form path"
  - "extractDocumentId: a Green Invoice document id or null, with no order-id fallback"
  - "fail-closed webhook route: 401 when neither auth factor holds, 503 on a non-23505 database failure"
  - "createWebhookEvent propagates Postgres's SQLSTATE on the thrown error"
  - "two external checklist questions that retire assumption A1 and PAY-07's private-payer field question"
affects:
  - "phase 04 (GO-02 reconciliation) - payments.provider_id now holds a real GI document id or nothing, and a missing one is logged"
  - "phase 04 (go-live) - the merch rail still puts the same secret in a URL; see deferred-items.md"
  - "plan 03-08 - shares payments.test.ts's file but not its describes; create/route.ts untouched"

tech-stack:
  added: []
  patterns:
    - "two independent authenticity factors when the provider cannot present a header: shared-secret header OR provider-vouched resource lookup over an already-authenticated API"
    - "an untrusted webhook is a PING, not a payload: re-fetch the claimed resource from the provider before mutating anything"
    - "discriminate SQLSTATE at the boundary that can see it - propagate error.code out of db.ts rather than guessing from a message"
    - "a correlation key and a provider reference are different values; never let the fallback of one become the other"

key-files:
  created: []
  modified:
    - apps/web/src/services/payments/greenInvoice.ts
    - apps/web/src/app/api/payments/webhook/route.ts
    - apps/web/src/lib/supabase/db.ts
    - apps/web/src/__tests__/api/payments.test.ts
    - apps/web/docs/GI-PRIME-CHECKLIST.md
    - apps/web/docs/GI-LEGAL-CHECKLIST.md
    - .planning/phases/03-payment-rails-hardening/deferred-items.md

key-decisions:
  - "createWebhookEvent had to be changed too: it threw a plain Error, so the plan's 23505 discrimination would have been dead code in production and every duplicate race would have returned 503"
  - "extractDocumentId and confirmDocumentIssued are consumed through paymentService, matching verifyWebhook/parseWebhookEvent, so the route needs no second import surface and the test needs no second mock surface"
  - "the real verifyWebhook, extractDocumentId and confirmDocumentIssued are tested against the unmocked module via vi.importActual - the route-level test alone cannot prove the forbidden transport is gone, because the route never reads the query string"
  - "the receipt lookup prefers the real document id over event.paymentId, which may be our own order id that Green Invoice cannot resolve"

patterns-established:
  - "Fail-closed webhook: neither factor holding is 401 and nothing is mutated; a database outage is 5xx so the provider retries, never 200"
  - "Provider-reference integrity: payments.provider_id is written from a no-fallback extractor, and a settled payment without one is logged for reconciliation rather than silently seeded"

requirements-completed: [SEC-03, PAY-07]

duration: ~25min
completed: 2026-08-04
---

# Phase 03 Plan 07: Webhook Secret Off the URL, Two-Factor Authenticity Summary

**The payments webhook now authenticates on a constant-time `x-greeninvoice-token` header or on Green Invoice vouching for the claimed document over the authenticated API, rejects everything else, returns 5xx on a database outage instead of a fake replay, and stores a real Green Invoice document id or nothing at all.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-04T17:35Z (approx.)
- **Completed:** 2026-08-04T17:52Z
- **Tasks:** 3
- **Files modified:** 7 (6 source/doc + the phase deferred-items log)

## Accomplishments

- **The shared secret is out of the URL.** `notifyUrl` is the bare endpoint and `verifyWebhook` reads only the `x-greeninvoice-token` header. The `searchParams.get('token')` read is gone; a secret arriving as a query parameter can never match, and there is a test that says so against the real function.
- **The hosted-form path got a real authenticity proof instead of a URL secret.** `confirmDocumentIssued` asks Green Invoice, over the JWT-authenticated API, whether the claimed document exists. Guessing an order id achieves nothing, because an attacker cannot make Green Invoice produce a document that was never issued. It is best-effort by design and never throws; the route fails closed on false.
- **A database outage is no longer a silent data loss.** Only SQLSTATE `23505` is treated as a replay (200). Every other failure returns 503 so Green Invoice retries. This required propagating the SQLSTATE out of `createWebhookEvent`, which previously discarded it.
- **`payments.provider_id` is honest.** It is written from `extractDocumentId`, which has no order-id fallback, so the column holds a real Green Invoice document reference or stays empty. A settled payment with no document id is logged by name for Phase 4's reconciliation.
- **Assumption A1 is now a question on a checklist, not a comment in a source file.** Four questions for the Green Invoice rep about notify headers, payload signing, alternative authentication and the document-id field. PAY-07's private-payer field question, with the exact fields the app sends today, is on the accountant's checklist.

## Task Commits

1. **Task 1: header-only verification, token-free notify URL, honest document id** — `73a3663` (fix)
2. **Task 2: two-factor authentication in the route, fail closed in production** — `76c8a29` (fix)
3. **Task 3: webhook auth tests + the two external checklists** — `d323960` (test)
4. *(follow-up to Task 3)* **shorten the auth fixtures so they cannot read as credentials** — `6f92c3b` (test)

Commit 4 exists rather than an amend because a sibling executor committed on top of `d323960` before I could amend; the shared worktree makes `--amend` unsafe once HEAD has moved.

## Files Created/Modified

- `apps/web/src/services/payments/greenInvoice.ts` — token-free `notifyUrl`; header-only `verifyWebhook` (constant-time compare and length pre-check kept verbatim); new `confirmDocumentIssued` and `extractDocumentId`, both exported and on `paymentService`; a warning on `parseWebhookEvent` naming what its fallback must never be used for.
- `apps/web/src/app/api/payments/webhook/route.ts` — body read before auth so the second factor can run; `headerOk || confirmDocumentIssued(documentId)`; 401 + no mutation when neither holds; `23505` vs everything else at the `createWebhookEvent` catch; `markPaymentCompleted(payment.id, documentId ?? undefined)`; a warning when a settled payment has no document id; the receipt lookup prefers the real document id.
- `apps/web/src/lib/supabase/db.ts` — `createWebhookEvent` now throws an error carrying Postgres's `code`. **See deviation 1.**
- `apps/web/src/__tests__/api/payments.test.ts` — the webhook auth cases rewritten (8 new/rewritten cases) plus a new `webhook authenticity factors (SEC-03)` describe that exercises the **real** service through `vi.importActual`. 28 → 44 tests.
- `apps/web/docs/GI-PRIME-CHECKLIST.md` — new `## Webhook transport` section, 4 unchecked questions, stating plainly that the code no longer puts the secret in the URL and that a "yes" to the first two questions would promote the header to primary factor.
- `apps/web/docs/GI-LEGAL-CHECKLIST.md` — a `- [ ]` item under `## Document type per flow` tabulating the exact fields sent for the ₪50 charge and asking (1) which additional private-payer fields are required and (2) whether `vatType: 0` is correct. No field name was invented.
- `.planning/phases/03-payment-rails-hardening/deferred-items.md` — the merch-rail exposure below.

## Decisions Made

- **`paymentService.extractDocumentId(...)` rather than a bare named import.** The plan's route snippet used a bare call while its test instruction said to add both functions to the `paymentService` mock. Going through `paymentService` satisfies both, matches how `verifyWebhook`/`parseWebhookEvent` are already consumed, and keeps the mock surface to one object.
- **The real functions are tested, not just the route.** The route never reads the query string — `verifyWebhook` does. A route-level test with a mocked verifier therefore cannot prove the forbidden transport is gone. The new `SEC-03` describe imports the unmocked module and asserts the header-only contract, the length behaviour, the production/dev fail-closed split, `extractDocumentId`'s missing fallback, and that `confirmDocumentIssued` resolves rather than rejects on failure.
- **`?token=` prose was rewritten to avoid the literal.** Task 1's own gate is `! grep -q "token=" greenInvoice.ts`, which a docstring *explaining* that the query transport is rejected would trip. The docstring says "a secret arriving as a query parameter" instead.
- **401 body is `{ error: 'Unauthorized' }`**, per the plan snippet, replacing `'Invalid token'`. The test that asserted the old string was one of the auth cases this plan owns and rewrites.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `createWebhookEvent` discarded the SQLSTATE, which would have made the plan's `23505` branch dead code in production**

- **Found during:** Task 2 (fail-closed database handling)
- **Issue:** The plan's catch reads `(insertError as { code?: string })?.code`, and the plan's precedent (`recordUserVoteOnce`) reads `error.code` *inside* `db.ts`, where Supabase's error object is still in hand. But `createWebhookEvent` threw `new Error(\`Failed to create webhook event: ${error.message}\`)`, discarding `error.code`. Implemented literally, **every** insert failure — including a genuine unique-constraint race — would have been classified as "not 23505" and returned 503. The behaviour the plan states ("a failure whose code is 23505 is treated as a replay") would have been true only under a mock.
- **Fix:** `createWebhookEvent` now builds `const failure: Error & { code?: string }`, sets `failure.code = error.code`, and throws that. Five lines, inside one function, with a docstring naming the caller that depends on it. No signature change, no new exported type, no other caller (verified: the payments webhook is the only one).
- **Files modified:** `apps/web/src/lib/supabase/db.ts`
- **Verification:** typecheck clean; the two new discrimination tests pass; `grep -rn createWebhookEvent` confirms a single non-test caller.
- **Committed in:** `76c8a29` (Task 2 commit)
- **Why not a Rule 4 stop:** the premise the plan asserts (Postgres reports `23505`) is true and unchanged; what was false was the assumption that the code survives the throw. The fix is deterministic, local, and its absence would have shipped a comment that lies about behaviour — the exact defect class this phase exists to remove.

**2. [Rule 1 - Bug] Test fixtures long enough to trip the plan's own credential-leak scan**

- **Found during:** the plan's verification step 7 (`git diff | grep -iE "(secret|token)\s*[:=]\s*['\"][A-Za-z0-9_-]{16,}"`)
- **Issue:** Two synthetic header fixtures (`'shared-secret-value'`, `'unit-test-webhook-secret'`) matched the scan. No real secret was ever written, but a leak scan with known false positives stops being read.
- **Fix:** shortened both to `'valid-header'` and `'unit-fixture'`, with a comment saying why.
- **Files modified:** `apps/web/src/__tests__/api/payments.test.ts`
- **Verification:** scan clean; 44 tests still pass.
- **Committed in:** `6f92c3b`

---

**Total deviations:** 2 auto-fixed (2 bugs). **No architectural change, no Rule 4 stop, no scope creep.**
**Impact on plan:** deviation 1 is load-bearing — without it the plan's stated fail-closed behaviour is untrue in production. Deviation 2 is hygiene on the plan's own verification.

## Out of Scope — Observed, Not Fixed

**The merch rail still transmits the same shared secret in a URL.** `api/merch/checkout/route.ts:161-163` registers `notifyUrl=…/api/merch/webhook?token=<secret>` and `api/merch/webhook/route.ts:37-40` reads `searchParams.get('token')` **first** — a verbatim clone of the payments verifier as it stood before this plan, reading the same `GREENINVOICE_WEBHOOK_SECRET`. The plan's verification step 4 (`grep -rn "searchParams.get('token')" apps/web/src` → no matches) therefore **does not hold repo-wide**; it holds for the payments rail, which is this plan's scope.

Not fixed here: neither file is in `files_modified`, both are covered by a test suite nobody in this phase owns, and the merch rail has no `confirmDocumentIssued` equivalent — a straight header-only swap would break merch notifies exactly the way this plan's own analysis says it would have broken payments. Recorded in full in `deferred-items.md` with a recommendation to close it **before Phase 4 go-live**, since go-live is when the freshly rotated production secret first travels those URLs.

Also observed and benign: `api/user/push-token/route.ts:129` reads `searchParams.get('token')` — an Expo push token identifying a device registration, behind a session check, not a shared secret.

## Issues Encountered

- **A sibling executor's uncommitted file broke tree-wide typecheck mid-task.** `TreasuryDashboard.tsx` (plan 03-09's file) had `error TS2304: Cannot find name 'Receipt'` while 03-09 was mid-edit. Not mine to fix; polled until the sibling resolved it, exactly as 03-02 did. My own files never errored.
- **Foreign cosmetic hunks rode along in two commits, as expected.** The parallel session's em-dash→hyphen sweep sits uncommitted inside files I edited: **12 lines in `db.ts`** (commit `76c8a29`) and **~23 lines across the two checklists** (commit `d323960`). Staging is file-granular, so they were unavoidable. Every one was inspected before staging and is comment/prose punctuation only — no behaviour. `greenInvoice.ts`, `webhook/route.ts` and `payments.test.ts` were clean before I touched them, so `73a3663` and `6f92c3b` carry only my work.
- **`--amend` is unsafe in this worktree.** HEAD moved to a sibling's commit between `d323960` and my follow-up, so the fixture rename is a separate commit rather than an amend.

## Verification

| Check | Result |
|---|---|
| `pnpm --filter @sync/web typecheck` | exit 0 |
| `pnpm --filter @sync/web test` (full) | exit 0 — **76 files, 986 tests** (baseline 74 / 938; my delta +16 tests in `payments.test.ts`, 28 → 44; the rest are siblings') |
| `pnpm --filter @sync/web test -- src/__tests__/api/payments.test.ts` | 44 passed |
| `grep -rn "token=" apps/web/src/services/payments/ apps/web/src/app/api/payments/` | no matches |
| `grep -c "searchParams" services/payments/greenInvoice.ts` | 0 |
| `grep -c "timingSafeEqual" services/payments/greenInvoice.ts` | 2 (import + the compare) |
| `grep -c "x-greeninvoice-token" services/payments/greenInvoice.ts` | 2 |
| `grep -c "documentId \|\| orderId" services/payments/greenInvoice.ts` | 1 — the correlation fallback kept deliberately, now with its warning |
| `grep -c "createVotePayment\|VOTE_PARTICIPATION_AMOUNT" services/payments/greenInvoice.ts` | 0 — 03-02's work intact |
| `grep -c "recordTreasuryDeposit\|recordUserVote" webhook/route.ts` | 0 — 03-02's work intact |
| `grep -c "TOCTOU" webhook/route.ts` | 1 — the atomic-claim comment survives |
| `grep -c "markPaymentCompleted(payment.id, event.paymentId)" webhook/route.ts` | 0 |
| `git diff --stat apps/web/src/app/api/payments/create/route.ts` | empty — 03-08's file untouched |
| Credential-literal scan over my diff | no matches |
| `## Webhook transport` unchecked questions | 4 |
| `vatType` in `GI-LEGAL-CHECKLIST.md` | 3 occurrences |

## User Setup Required

None in this plan's code. Two **external human** actions it created:

- Ask the Green Invoice rep the four `## Webhook transport` questions on `GI-PRIME-CHECKLIST.md`. A "yes" to custom notify headers or payload signing lets the header become the primary factor and demotes the document lookup to a backstop.
- Ask the accountant the two private-payer/`vatType` questions on `GI-LEGAL-CHECKLIST.md` before the first real ₪50 charge.

**Operational note for go-live:** the notify URL registered in the Green Invoice dashboard must now be the **bare** `https://<host>/api/payments/webhook`. Any previously registered URL carrying a query secret keeps working (the secret is simply ignored) but should be re-registered clean, and `GREENINVOICE_WEBHOOK_SECRET` should be rotated — its current value has been travelling in URLs.

## Next Phase Readiness

- **Phase 4 (GO-02 reconciliation)** can trust `payments.provider_id`: it is a Green Invoice document id or `NULL`, never our own order id. Rows with no document reference are logged at settle time with the payment id.
- **Phase 4 (GO-01 go-live)** should not ship before the merch-rail exposure in `deferred-items.md` is closed, and before the manual verification `03-VALIDATION.md` names: `curl -X POST` an unauthenticated notify at the deployed Worker with a plausible `custom` order id and confirm 401 with no row change.
- **Plan 03-08** is unaffected: `create/route.ts` has zero diff from me, and I edited no describe it reads as a regression gate.

## Self-Check: PASSED

All six modified source/doc files exist on disk; `deferred-items.md` updated; commits `73a3663`, `76c8a29`, `d323960`, `6f92c3b` all present in `git log`.

---
*Phase: 03-payment-rails-hardening*
*Completed: 2026-08-04*
</content>
</invoke>
