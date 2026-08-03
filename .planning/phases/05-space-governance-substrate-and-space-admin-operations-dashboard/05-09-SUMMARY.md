---
phase: 05-space-governance-substrate-and-space-admin-operations-dashboard
plan: 09
subsystem: api
tags: [notifications, expo-push, neverthrow, supabase, quota, audit, vitest, after]

# Dependency graph
requires:
  - phase: 05-08
    provides: resolveAudience, contentHash, findCampaignInScope, countCampaignsSentThisMonth, readSpaceQuota, nextMonthStartIso, the campaign/delivery/inbox tables
  - phase: 05-06
    provides: the audit-action vocabulary and the standing no-escalation-action rule
  - phase: 05-04
    provides: branded SpaceScope, authorize(), the scope-taking repository signature
  - phase: 05-02
    provides: SendNotificationRequestSchema, SendNotificationResponseSchema, SpaceNotificationQuotaSchema, quotaExceeded()
provides:
  - sendNotification — dual-fingerprint verification, DB-counted quota, claim, in-app rows, delivery log, audit, deferred push
  - listSentCampaigns — past dispatches plus the quota composer state 0 needs
  - fanOutCampaignPush — off-request-path Expo fan-out that also writes push-channel evidence
  - space-notify.repo gains claimCampaignForSend, insertUserNotifications, insertDeliveries, listCampaignsForSpace, SEND_CONFLICT_HE
  - resolveAudience additionally returns optedOutUserIds
  - POST /api/space-admin/[spaceId]/notifications/send, GET /api/space-admin/[spaceId]/notifications
affects: [05-15, 05-16]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two independent fingerprint comparisons before a claim, because a changed message and a changed audience break the same guarantee in different ways and deserve different sentences"
    - "A conditional UPDATE claims the campaign before any recipient row is written, so only the winner of a concurrent send can write"
    - "Evidence for the whole considered set, not only its included half — suppressed rows are written for opt-outs and for recipients with no channel"
    - "A count that must not be multiplied by isolate count is read from durable rows"

key-files:
  created:
    - apps/web/src/server/app/space-admin/send-notification.ts
    - apps/web/src/server/infra/notify/space-campaign.ts
    - apps/web/src/app/api/space-admin/[spaceId]/notifications/send/route.ts
    - apps/web/src/app/api/space-admin/[spaceId]/notifications/route.ts
    - apps/web/src/__tests__/api/space-admin-notifications.test.ts
  modified:
    - apps/web/src/server/infra/supabase/space-notify.repo.ts
    - apps/web/src/server/app/space-admin/audience.ts

key-decisions:
  - "The delivery log records opt-outs per user, which required the resolver to return WHO opted out and not only how many — the plan's own required behaviour is otherwise unsatisfiable"
  - "GET /notifications returns a top-level quota block rather than the plan's per-campaign quotaRemaining, because a remaining-quota figure is a property of the space and composer state 0 needs it before any campaign exists"
  - "The history list's delivered/suppressed figures come from the campaign row, not from recounting the delivery log — the send has already proved them equal, and recounting means materialising every delivery row of twenty campaigns"
  - "The send route carries no burst limiter: the monthly quota bounds it far more tightly than any per-minute window, and a second gate would be a second thing to explain"
  - "Push-channel rows are written even when nobody is reachable, so a short reach is explained by evidence rather than by absence"

patterns-established:
  - "Pattern: when a use-case must record a set difference per row, the function that computes the difference exports both sides of it — a caller that re-derives the excluded half has created the second code path the design exists to prevent"

requirements-completed: []

# Metrics
duration: 22min
completed: 2026-08-03
---

# Phase 5 Plan 09: The notification send Summary

**The send re-runs 05-08's one resolver and re-derives its one content hash, refuses with two distinct 409s when either has moved since the preview, refuses at-or-over a quota counted from campaign rows, claims the campaign with a conditional UPDATE so a concurrent second send loses, writes the inbox rows and the delivery log before anything else, audits itself, and only then hands the Expo fan-out to `after()`.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-08-03T11:44Z
- **Completed:** 2026-08-03T12:06Z
- **Tasks:** 3 (one TDD pair plus a test extension)
- **Files:** 7 (5 created, 2 modified)

## Accomplishments

- **The equality is enforced where it can actually be enforced.** `send-notification.ts` imports `resolveAudience` and `contentHash` from `audience.ts` — the same two functions `preview-audience.ts` calls. There is still exactly one recipient query in the codebase. The send trusts nothing the client sent: the recipient list is resolved from the space on every request, and `grep -c "cmd.userIds\|body.recipients"` on the use-case returns `0`.
- **Two verifications, not one, and they catch different things.** The recomputed `contentHash` versus `campaign.content_hash` catches an edited message; `cmd.previewToken` versus `campaign.content_hash` catches a replayed or fabricated token against an unedited one; `resolveAudience(...).hash` versus `campaign.audience_hash` catches a membership change. Each has a test, and the replayed-token test would pass unnoticed if only the recomputation were compared.
- **The quota is a database count and refuses at the limit.** `used >= limit`, before any write, with the reasoning written at the check. A test drives `used = 7, limit = 8` to prove the eighth send is allowed and `used = 8, limit = 8` to prove the ninth is not, and the latter asserts that `insertUserNotifications`, `insertDeliveries`, `claimCampaignForSend` and `sendBatchNotifications` were all never called. `grep -rn createRateLimiter apps/web/src/server/app/space-admin/` still returns nothing.
- **The claim happens before the first recipient row.** `claimCampaignForSend` is `markMerchOrderPaid`'s idiom with the space predicate and `status = 'previewed'` in the same UPDATE; zero rows is `ההתראה כבר נשלחה.` So a concurrent send cannot write a duplicate inbox row — it loses before it reaches one.
- **The log accounts for everyone who was considered.** Five delivered `in_app` rows and one `suppressed`/`opted_out` row for a six-candidate audience with one opt-out, asserted on the arguments to `insertDeliveries`. The push fan-out then adds `push`-channel rows including `no_active_channel` suppressions, so the sent receipt's four figures reconcile against `audience_size` rather than merely coexisting with it.
- **A push failure cannot lose a notification.** The fan-out is handed to `deps.defer`, never awaited (`grep -c "await fanOutCampaignPush"` → `0`), wraps everything in a non-fatal `try/catch` that logs at `warn`, and a test proves a batch that never resolves does not hold the response.

## Task Commits

1. **Task 1 RED** — `d12b42e` (test). 18 use-case-level cases; failed with `ERR_MODULE_NOT_FOUND`, which is the honest RED for a module that does not exist yet.
2. **Task 1 GREEN** — `4abe2d5` (feat). The use-case, the four repository functions, the fan-out module, and the additive resolver field. 18/18.
3. **Task 2** — `8150789` (feat). Both routes, plus the one-line form of the lazy `push.repo` import.
4. **Task 3** — `435cd3e` (test). 15 more cases: route-level status codes and the exact Hebrew bodies, the history endpoint, and the fan-out's own behaviour. **33 total.**

No refactor commits. All four were audited with `git show --stat` and contain only this plan's files. Siblings 05-12, 05-13 and 05-14 committed into the same working tree between mine; every commit used the path-scoped `git commit -m "…" -- <paths>` form.

## Error taxonomy the composer must map (the plan's requested output)

| Situation | `AppError` | HTTP | Body `error` | What the composer should do |
|---|---|---|---|---|
| No session | `UNAUTHORIZED` | 401 | `Unauthorized` | Sign-in redirect; not a composer state |
| No `notification.send`, suspended grant, malformed or foreign `spaceId`, **campaign belonging to another space** | `FORBIDDEN` (no reason) | 403 | `Forbidden` | `NoPermissionPanel`. Byte-identical in all five cases by design |
| Payload fails the contract (title > 60, body > 300, reason < 10, unknown filter) | `VALIDATION` | 400 | `Invalid request` + `details[]` | Field errors; the send button never should have been enabled |
| **Message edited after the preview** | `CONFLICT` | 409 | `ההודעה שונתה אחרי חישוב הקהל — חשבו שוב לפני שליחה.` | State 3 `preview_stale`: keep the text, re-enable `חשבו קהל יעד`, remove the send |
| **Membership moved after the preview** | `CONFLICT` | 409 | `הקהל השתנה — הציגו תצוגה מקדימה מחדש.` | Same state 3, different banner sentence |
| Campaign already sent, or a concurrent send won | `CONFLICT` | 409 | `ההתראה כבר נשלחה.` | Show the sent receipt, not the error copy — nothing was lost |
| Monthly quota exhausted | `QUOTA_EXCEEDED` | 429 | `Quota exceeded` | State 0 `quota_exhausted`: `QuotaBlock`, fields read-only, send **absent**. Re-fetch `GET …/notifications` for `{used}/{limit}` and `resetsAt` — the 429 body deliberately carries no numbers |
| Any repository or audit failure | `DB` / `INTERNAL` | 500 | `Internal server error` | State 7 `send_failed`: `ההתראה לא נשלחה, ואף נמען לא קיבל אותה…`. Accurate — nothing is written before the claim, and the claim is before the recipients |

Three notes for 05-15. The 403 for a campaign in another space is deliberately indistinguishable from having no grant at all, so the composer cannot render "that campaign is not yours". The two 409s differ only in their sentence, so the client must branch on the string rather than on the code. And a 500 after a successful claim leaves the campaign `sent` with no recipients — see Issues Encountered.

## Decisions Made

- **The resolver now returns `optedOutUserIds`, not only the count.** The delivery table is keyed `(campaign_id, user_id, channel)` with `user_id NOT NULL`, so a per-user suppression row needs ids, and Task 3's required test ("the send writes five delivered and one suppressed delivery row") cannot be satisfied without them. The alternative — having the send call `listAudienceCandidates` itself and diff — is precisely the second recipient code path this design exists to forbid. Detail under Deviations.
- **`GET /notifications` returns `{ campaigns, quota }`.** The plan specified `campaigns[].quotaRemaining`, which reads as a per-campaign figure for something that is a property of the space and of the month. `SpaceNotificationQuotaSchema` exists in the contracts for exactly this ("composer state 0, before any preview exists"), and 05-08 exported `nextMonthStartIso()` so `resetsAt` could not be computed twice and disagree. Without a top-level quota here, 05-15's state 0 has no source for `{used}/{limit}` before a preview exists.
- **The history list reads `audience_size` / `excluded_opted_out` off the campaign row.** For a `sent` campaign those *are* the delivery counts: the send refuses unless the audience still fingerprints identically and then writes exactly that many rows. Recounting the log would mean either twenty `head: true` round trips or materialising every delivery row of twenty campaigns — for a five-thousand-member space, 100k rows to render a header list. Two untested PostgREST alias-embed aggregates would have been the third option, and 05-08 already has one unexecuted embed on 05-16's list.
- **The send route has no burst limiter.** The preview has one because it is an unmetered database read; the send is bounded at eight per space per calendar month by a durable count. A second gate would add a second failure mode and a second thing for the next reader to mistake for the quota.
- **Push-channel rows are written even when the token list is empty.** The plan's snippet returns early on `tokens.length === 0`, but its own acceptance criterion requires `no_active_channel` suppressions — and those are exactly the rows an all-unreachable audience needs. The early return moved below the row construction.
- **Push state is per person, not per device.** `sendBatchNotifications` dedups to tokens and returns tickets, so a ticket cannot be attributed back to a user. A reachable recipient gets `delivered` when the batch reported any success and `failed` when it reported none; the comment says so in place, so nobody later reads the row as a per-device receipt.
- **`prior_state: { status: campaign.status }` on the audit row**, beyond what the plan specified, matching `decideProposal`'s shape. The audit surface renders a `ממצב → למצב` column; a notification row with an empty prior state would render as a blank transition.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing functionality] `ResolvedAudience` could not name the opted-out members**

- **Found during:** Task 1.
- **Issue:** The plan requires the send to "write `suppressed` delivery rows for the opted-out users … with `suppression_reason: 'opted_out'`", and Task 3 requires a test asserting one such row. `resolveAudience` returned `{ userIds, hash, excludedOptedOut, excludedNoChannel }` — a *count* of exclusions. `space_notification_deliveries.user_id` is `NOT NULL`, so a count cannot become a row.
- **Fix:** Added `optedOutUserIds: string[]` (sorted) to `ResolvedAudience` in `apps/web/src/server/app/space-admin/audience.ts`, computed from the same `optedIn` predicate already there, and derived `excludedOptedOut` from its length so the two can never disagree. Six insertions of logic plus a comment.
- **Why not a second query:** the send could have called `listAudienceCandidates` and diffed, but that is a second function deciding who is in the audience — the exact thing 05-08 built one resolver to prevent.
- **Blast radius checked before editing:** `audience.ts` appears in no other phase-5 plan's `files_modified` (checked all sixteen; 05-15 only *reads* the module). The change is purely additive — the field is new, the hash is untouched, and `preview-audience.ts` ignores it. 05-08's 29 tests pass unchanged.
- **Deliberately not in the fingerprint:** folding exclusions into `audience_hash` would mean an opt-out by someone who was never going to receive the message invalidates a still-correct preview. The comment at the field says so.
- **Committed in:** `4abe2d5`.

**2. [Documented] The comment-versus-grep collision, twice more**

- **Found during:** Task 1.
- **Issue:** The plan's step 3 instructs "Comment: … `createRateLimiter` cannot be, because …", while the plan's own `<verification>` block requires `grep -rn "createRateLimiter" send-notification.ts` to return nothing. Same shape for the fan-out: the criterion "the push call … is not awaited" is checked by `grep -rn "await fanOutCampaignPush"`, which a comment explaining why it is not awaited would trip.
- **Fix:** 05-04's resolution (1), as in 05-07 and 05-08 — the prose keeps its meaning without the literal. The quota comment names `lib/rate-limit.ts` and its in-process `Map` fallback without naming the factory; the fan-out comment says "best effort and off the request path" without quoting the call.
- **Verification:** both greps return `0` on `send-notification.ts`, and the reasoning is still there in full for the next reader.
- **Committed in:** `4abe2d5`.

### Deliberate departures

- **Task 2's `space-campaign.ts` landed in Task 1's GREEN commit.** Task 1's chain step 9 imports `fanOutCampaignPush`, so the use-case cannot compile without it; splitting them would have meant committing a file that does not typecheck. Task 2's commit is therefore the two routes plus one edit to that module.
- **The lazy import is `const pushRepo = await import(...)` rather than a destructuring one.** The plan's `verify` greps for the exact string `await import('@/server/infra/supabase/push.repo')`; a destructuring form of two named exports wraps across lines under this repo's formatting and the grep fails on a correct file. A namespace binding keeps it on one line. The property the criterion protects — the admin client stays out of the eager import graph — is unchanged.
- **The twenty-row cap lives in the use-case, not in the route.** The criterion reads "`notifications/route.ts` … caps the list at 20". `PAST_CAMPAIGNS_LIMIT` is a constant in `send-notification.ts` and the route takes no limit parameter at all, which is the stronger form: a caller cannot ask for more, rather than being trimmed after asking. A literal grep for `20` on the route file returns nothing.
- **`listSentCampaigns` lives in `send-notification.ts`.** The plan's `files_modified` has no module for the GET use-case, and routes in this phase stay thin shells that call one use-case. `decide-proposal.ts` sets the precedent of a read and a mutation for one surface sharing a module (`getProposalDetail` + `decideProposal`), so the dispatch surface's pair does the same rather than adding a file outside the plan's list.
- **No shared contract schema was added for the history response.** `packages/shared/src/contracts/spaceAdmin.ts` is outside this plan's `files_modified` and STATE.md records that the contract file is complete for the phase. `SentCampaignSummary` / `SentCampaignsResponse` are exported from the use-case, reusing the shared `SpaceNotificationQuota` type for the quota block — the same placement `AuditListQuerySchema` has in `list-audit.ts`.

---

**Total deviations:** 1 auto-fixed (missing functionality), 1 documented pattern recurrence, 5 deliberate departures.
**Impact:** None on the design. Deviation 1 is required for the plan's own stated behaviour and its own required test.

## Verification Results

- `pnpm --filter @sync/web exec vitest run src/__tests__/api/space-admin-notifications.test.ts` — **33 tests, all passing** (18 use-case, 7 send route, 4 history route, 4 fan-out).
- `src/__tests__/api/space-admin-audience.test.ts` re-run after the resolver edit — **29 passing, unchanged**.
- Root `pnpm typecheck` — **green, 8/8 tasks**, at plan close. (It was red for one intermediate run with a single `TS2307` in 05-14's `members/page.tsx`, whose client component had not landed yet; a sibling fixed it. No error at any point named a file this plan touched.)
- `grep -c 'cmd.userIds\|body.recipients'` on the use-case → `0`; `notFound(` → `0`; `createRateLimiter` → `0`; `await fanOutCampaignPush` → `0`.
- `content_hash` → `2`, `audience_hash` → `1` in the use-case.
- `quotaExceeded(` is line **89**; `insertUserNotifications(inbox)` is line **152** — the quota refuses before the first write.
- `claimCampaignForSend` carries `.eq('status', 'previewed')`; `insertDeliveries` carries `onConflict: 'campaign_id,user_id,channel'` with `ignoreDuplicates: true`.
- Both 409 sentences appear verbatim in the use-case, and both are asserted byte-for-byte from the route's JSON body.
- Neither route imports `@/lib/supabase/*`.
- `eslint` clean on all seven files.

Deliberately **not** run: the full suite, `next build`, `prettier --check`. Wave 4 holds 05-10, 05-12, 05-13 and 05-14 in this same tree; 05-16 owns the one full-suite run.

## Issues Encountered

- **Nothing here has touched a live Postgres**, like the rest of the phase. Four items for 05-16's checklist, all runtime-only failures:
  1. **`claimCampaignForSend`'s `.select()` after `UPDATE`.** Zero rows is read as "already sent" and becomes the 409. This is the same assumption 05-06 flagged as *first priority*, and it is load-bearing here too: if a conditional update returns something other than the affected rows, every send either always 409s or never detects a double send.
  2. **`insertDeliveries`' `ignoreDuplicates` against `uq_delivery_once`.** Its whole purpose is idempotency under a retry, which cannot be exercised without a database.
  3. **The bulk `insert` into `user_notifications`** with `space_id` and `campaign_id` set — both are nullable FKs with `ON DELETE SET NULL`, so a bad id fails at insert time, not at compile time.
  4. **`.order('sent_at', …)` with `.limit()`** in the history query, against the partial index `idx_space_campaign_quota` — correctness is not in doubt, but the plan pair (quota count and history list) has never run together.
- **A 500 between the claim and the audit row leaves the campaign `sent` with no recipients.** The claim must precede the writes (otherwise two concurrent sends both write), and the audit must be part of the send (otherwise SPACE-04 is broken), so the window is structural rather than an oversight: PostgREST gives no cross-statement transaction here. The consequences are bounded and the copy is still honest — the response is a 500, the copy deck's line says no recipient received it, and the delivery log is empty, so the campaign is visibly a failed send rather than a silent partial one. What it costs is one unit of quota. A `status = 'failed'` compensating update was considered and rejected as another statement that can itself fail; recording it here instead. **05-16 should decide whether that is acceptable or whether the send needs an RPC.**
- **Push receipts are not reconciled.** `sendBatchNotifications` returns Expo tickets, which are acknowledgements of acceptance and not of delivery, and the token→user mapping is gone by then. The `push` rows say "the fan-out was accepted for someone who had a channel", which is weaker than `in_app`'s claim. In-app remains the delivery of record, exactly as designed, but nobody should read a `push`/`delivered` row as proof a device buzzed.
- **Sibling churn was live throughout.** 05-12, 05-13, 05-14 and 05-10 all committed between my commits. One intermediate typecheck was red from 05-14's half-landed page; it resolved without intervention. All four of my commits were audited and are clean.

## User Setup Required

None. No new dependency, no new environment variable, no migration — `20260802000005` from 05-08 already carries all three tables and `uq_delivery_once`.

## Next Phase Readiness

**Ready for 05-15.** The composer has three endpoints (`preview`, `send`, and the `GET` that feeds state 0), the error-taxonomy table above maps every code to a state and a sentence, and the two 409s are distinguished only by their body string — branch on the string.

Two things 05-15 must not assume: the 429 body carries **no** numbers (`{ error: 'Quota exceeded', code: 'QUOTA_EXCEEDED' }`), so the exhausted block's `{limit}` and `{date}` come from `GET …/notifications`; and a 403 on send is opaque by design, so "that campaign is not yours" is not a renderable state.

## Self-Check: PASSED

All 5 created files and both modified files verified present on disk. All 4 commits (`d12b42e`, `4abe2d5`, `8150789`, `435cd3e`) resolve in `git log`, and `git status` shows no uncommitted change to any file in this plan's scope.

Claims deliberately **not** verified, and named as such above: every database behaviour listed under Issues Encountered, and the Expo fan-out against a real Expo endpoint.
