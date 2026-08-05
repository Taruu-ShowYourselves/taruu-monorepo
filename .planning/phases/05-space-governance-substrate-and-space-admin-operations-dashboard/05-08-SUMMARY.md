---
phase: 05-space-governance-substrate-and-space-admin-operations-dashboard
plan: 08
subsystem: api
tags: [notifications, postgres, supabase, sha256, web-crypto, neverthrow, quota, vitest]

# Dependency graph
requires:
  - phase: 05-01
    provides: spaces.notification_monthly_quota, the types.ts table-entry convention, the governance FK style
  - phase: 05-02
    provides: AudienceFilterSchema, PreviewAudienceRequestSchema, AudiencePreviewResponseSchema, quotaExceeded()
  - phase: 05-04
    provides: branded SpaceScope, authorize(), the scope-taking repository signature
provides:
  - space_notification_campaigns / space_notification_deliveries / user_notifications tables and their row types
  - resolveAudience — the ONE function that decides who receives a space notification
  - contentHash — the previewToken definition, server-derivable and therefore enforceable
  - space-notify.repo.ts — listAudienceCandidates, countCampaignsSentThisMonth, readSpaceQuota, insertCampaign, findCampaignInScope, currentMonthStartIso, nextMonthStartIso
  - push.repo.ts gains usersWithActiveChannel — the user-level projection of channel state
  - POST /api/space-admin/[spaceId]/notifications/preview
affects: [05-09, 05-14, 05-16]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One resolver called by two endpoints, with a fingerprint, so an equality between two sets is checkable rather than intended"
    - "Quota counted from durable rows, never from a rate limiter that degrades to a per-isolate Map"
    - "A calendar-month boundary computed in TypeScript because PostgREST filter values cannot be SQL expressions"
    - "A second projection of an existing batched query lives beside the first in the same repository, rather than becoming a second access path"

key-files:
  created:
    - supabase/migrations/20260802000014_space_notifications.sql
    - apps/web/src/server/infra/supabase/space-notify.repo.ts
    - apps/web/src/server/app/space-admin/audience.ts
    - apps/web/src/server/app/space-admin/preview-audience.ts
    - apps/web/src/app/api/space-admin/[spaceId]/notifications/preview/route.ts
    - apps/web/src/__tests__/api/space-admin-audience.test.ts
  modified:
    - apps/web/src/lib/supabase/types.ts
    - apps/web/src/server/infra/supabase/push.repo.ts

key-decisions:
  - "Null notification_settings means opted IN — an absent preference is not a refusal, and reading it as one would silently mute every existing resident"
  - "previewToken IS content_hash; there is one hash definition, not a token plus a hash that could drift"
  - "The preview does not 429 on an exhausted quota — composer state 0 needs the true counts to render at all; the send enforces"
  - "usersWithActiveChannel was added to push.repo because the token-level helper cannot answer 'how many people have no channel'"
  - "The calendar-month boundary is computed in UTC in TypeScript, matching date_trunc('month', now()) on the database's UTC clock"
  - "excludedNoChannel counts recipients who stay in the audience — in-app is the delivery of record, push is best effort"

patterns-established:
  - "Pattern: when a helper's return shape destroys the granularity a caller needs, add a sibling projection in the same repository rather than a new query elsewhere"
  - "Pattern: a hash used as an API token should have exactly one definition, exported from the module that computes it, so the verifier cannot re-derive it differently"

requirements-completed: []

# Metrics
duration: 15min
completed: 2026-08-03
---

# Phase 5 Plan 08: Notification substrate and audience preview Summary

**One `resolveAudience` that both the preview and the send call, fingerprinting its sorted recipient list with sha256 so "delivered equals previewed" is a comparison plan 05-09 can actually run — plus three tables, a calendar-month quota counted from campaign rows rather than from a rate limiter that would give each Workers isolate its own allowance, and a preview endpoint that persists what it showed.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-03T07:36:22Z
- **Completed:** 2026-08-03T07:51:18Z
- **Tasks:** 3 (two TDD pairs)
- **Files:** 8 (6 created, 2 modified)

## Accomplishments

- **There is no second code path.** `resolveAudience` is the only function in the codebase that decides who receives a space notification, and `preview-audience.ts` has no query of its own. 05-09's send calls the same function. The guarantee is structural, not a convention someone has to remember.
- **The equality is provable, not asserted.** The resolver sorts before hashing, so the fingerprint is order-independent; the test that matters adds exactly one member and shows the hash moves. That single test is what makes 05-09's send-time comparison meaningful — a hash that did not move on a membership change would pass the comparison while the delivered set differed from the previewed one.
- **The quota cannot be multiplied by isolate count.** `countCampaignsSentThisMonth` is a `head: true, count: 'exact'` over campaign rows with `sent_at >= <month start>`. `createRateLimiter` appears nowhere under `server/app/space-admin/`, and the one limiter in the preview route says in prose that it is not the quota.
- **Opt-outs are applied before the number the admin sees**, inside the resolver, so a caller cannot obtain a candidate list and forget them.
- **A zero-recipient preview still returns four numbers.** Asserted with `Object.keys(body)`, because the Receipt renders four rows unconditionally and a missing row reads as "not checked".

## Task Commits

1. **Task 1: Notification tables and row types** — `7dd8980` (feat)
2. **Task 2 RED: resolver and fingerprint tests** — `dad4868` (test) → **GREEN** `df748fb` (feat). 16 tests.
3. **Task 3 RED: preview endpoint tests** — `8e4b884` (test) → **GREEN** `3e7a047` (feat). 29 tests total.

No refactor commits were needed. All five were audited with `git show --stat` and contain only this plan's files. Siblings 05-05, 05-06 and 05-07 committed into the same working tree between mine; every commit used the path-scoped `git commit -m "…" -- <paths>` form, which ignores whatever else is in the shared index.

## For plan 05-09 — the exact definitions to verify against

This is the section 05-09 should read before writing its send. Both hashes must be re-derived **identically** or the comparison will fail on correct input.

**Algorithm:** SHA-256 via `crypto.subtle.digest`, rendered lowercase hex, 64 characters. Web Crypto rather than `node:crypto` because this runs on Cloudflare Workers; `server/infra/crypto/hmac.ts` already establishes that primitive as the one that works there.

**`audience_hash`** = sha256Hex of the **sorted** recipient ids joined by `,` — the same `userIds` array the resolver returns, after opt-out filtering, with no separator on the ends. An empty audience hashes the empty string.

**`content_hash`** = sha256Hex of `[title.trim(), body.trim(), audienceFilter.trim()].join('\n')`. Trimmed at the edges **only**: interior whitespace is part of the message the admin approved, so reflowing a paragraph must invalidate the preview.

**`previewToken` IS `content_hash`.** Not derived from it, not a wrapper around it — the same string. The preview returns `previewToken: hash` and persists `content_hash: hash` from one variable. 05-09 should compare the request's `previewToken` against the campaign row's `content_hash` and, separately, re-run `contentHash(cmd)` and compare that too; the two comparisons catch different failures (a replayed token versus an edited message).

**Function shapes, as shipped:**

```ts
export function resolveAudience(scope: SpaceScope, filter: AudienceFilter):
  ResultAsync<{ userIds: string[]; hash: string; excludedOptedOut: number; excludedNoChannel: number }, AppError>;

export function contentHash(input: { title: string; body: string; audienceFilter: string }): Promise<string>;
```

`contentHash` is a bare `Promise`, deliberately. Lift it with `ResultAsync.fromSafePromise(contentHash(cmd))`. There is no `contentHashAsync` — `grep -rc contentHashAsync apps/web/src` returns 0.

**Repository surface available to the send** (`space-notify.repo.ts`): `countCampaignsSentThisMonth(scope)`, `readSpaceQuota(scope)`, `findCampaignInScope(scope, campaignId)`, `insertCampaign(scope, row)`, plus two exported helpers the send and the `GET /notifications` route will both want — `currentMonthStartIso()` and `nextMonthStartIso()`. Use `nextMonthStartIso()` for `SpaceNotificationQuotaSchema.resetsAt` rather than computing a second boundary; two boundaries that disagree by a day is exactly the bug this exports to prevent.

**`findCampaignInScope` returns `null`, not a 404**, for a campaign belonging to another space — the space predicate is in the SQL. Fold that `null` into `forbidden()`.

## Decisions Made

- **Null `notification_settings` means opted IN.** This was an open product question and this plan settles it, with the reasoning written at the constant. `users.notification_settings` is nullable JSONB holding `{ newVotes, voteEnding, voteResults, marketing }`, and the existing vote fan-out ignores the column entirely — so a resident who has never opened the settings screen has no stored preference. Reading absence as refusal would silently mute every existing resident the first time an admin sent anything: a product change disguised as a default. Only an explicit `false` on `spaceAnnouncements` excludes. If the product later wants opt-in, that is a migration backfilling the key, not a one-character edit.
- **The preview returns 200 on an exhausted quota.** Composer state 0 renders the fields read-only with the send control *absent* and needs `{used}/{limit}` plus a reset date to say why; a 429 would leave the UI with nothing to display. The preview writes no notification and consumes no quota. The rationale is a comment in `preview-audience.ts` so it is not later "fixed".
- **The calendar-month boundary is computed in TypeScript, in UTC.** PostgREST filter values are literals, so `date_trunc('month', now())` cannot go in the query. `currentMonthStartIso()` is its equivalent under the database's UTC clock, and the SQL form is named in the comment beside it. The window is a calendar month, not a rolling 24 hours — the copy says `מכסה חודשית` with a reset date, which only means anything against a month boundary. Any 24-hour example in `05-RESEARCH.md` is superseded.
- **`excludedNoChannel` counts recipients who remain in the audience.** They get the in-app row; only the push is missing. The count exists so the admin knows the reach is smaller than the recipient count, not so those people are dropped.
- **`user_notifications.user_id` is the one `ON DELETE CASCADE` in the file**, against the governance chain's RESTRICT everywhere else. A resident's inbox is their copy of a message whose authoritative record lives in the campaign and delivery rows, which RESTRICT. The comment says so in place, because otherwise it reads as an inconsistency.
- **`space_notification_campaigns.Update` is narrowed to `{ status, reason, sent_at }`** in `types.ts` rather than the full column set. Those are the only fields any legal transition touches; a typed `Update` that admitted `audience_hash` would make tampering with the fingerprint a compiling operation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] `activeTokensForUsers` cannot produce `excludedNoChannel`**

- **Found during:** Task 2
- **Issue:** The plan specifies that `excludedNoChannel` be computed with one `activeTokensForUsers` call over the candidate list. That function returns `[...new Set(rows.map(r => r.token))]` — deduplicated bare tokens, with the owning user discarded. It is the right shape for a fan-out and structurally cannot answer "how many *people* have no channel", which is the number the Receipt must show before the admin is allowed to send. The plan's own `<behavior>` bullet ("a user with no active push token is still included in `userIds` but counted in `excludedNoChannel`") is unsatisfiable with it.
- **Fix:** Added `usersWithActiveChannel(userIds): ResultAsync<Set<string>, AppError>` to `apps/web/src/server/infra/supabase/push.repo.ts`, immediately beside `activeTokensForUsers`. Same table, same single batched query, same repository — a second projection, not a second access path. `resolveAudience` calls it once for the whole audience; a test asserts `toHaveBeenCalledTimes(1)` with the full id list, so the N+1 the original helper was written to kill cannot creep back.
- **Contention check:** `push.repo.ts` appears in **no** plan's `files_modified` anywhere in phase 5 — checked against all sixteen before editing. 05-09 consumes `activeTokensForUsers` for its fan-out, which is untouched. The edit is purely additive: 30 insertions, 0 deletions.
- **Spirit of the criterion preserved:** the substantive requirement was that channel state not be queried directly from the notification repository. `grep -c push_tokens apps/web/src/server/infra/supabase/space-notify.repo.ts` returns 0.
- **Committed in:** `df748fb`

**2. [Documented] Two more comment-versus-grep collisions**

- **Found during:** Task 1 and Task 2
- **Issue:** The phase's established pattern, hit twice more. (a) Task 1's verify requires `! grep -q "auth.uid()"` on the migration, while the plan's own supplied SQL body contains a comment naming that helper to explain why it is wrong here. (b) Task 2's criterion forbids `createRateLimiter` in the two new modules, and the module header comment explaining *why the quota is not a rate limiter* naturally names it; the same collision applied to a prose mention of the push-token table.
- **Fix:** Resolution (1) from 05-04's convention in all three cases — the prose keeps its meaning without the literal. "the built-in Supabase session helper returns NULL under this project's custom JWT", "counted from rows rather than from a request-rate limiter", "no query here touches the device-token table". The third carries a parenthetical saying why it is phrased that way, so the next reader does not restore the literal.
- **Verification:** `grep -c "auth.uid()"` → 0; `grep -c createRateLimiter` across `audience.ts` + `space-notify.repo.ts` → 0; `grep -c push_tokens` in the notify repo → 0.
- **Committed in:** `7dd8980`, `df748fb`

### Deliberate departures

- **`listAudienceCandidates`' participants branch carries a join-only embed.** The plan requires "one query per filter branch" *and* "selects only `id, notification_settings`". For `active_vote_participants` those pull against each other: reaching votes needs either a nested `!inner` embed or three round trips. The embed was chosen — it matches the house pattern 05-04 established — and is documented in place as a join filter whose rows the mapper discards. The two named columns are still the only user data read. **This embed has never been executed** (see below).
- **`currentMonthStartIso` / `nextMonthStartIso` are exported** beyond the plan's function list, so 05-09's send and its `GET /notifications` quota block cannot derive a boundary that disagrees with the one the count uses.
- **`CAMPAIGN_COLUMNS` is a hand-written constant** shared by `insertCampaign` and `findCampaignInScope`, following 05-04's `selectSpaceRow` precedent: one column list, no star select, so a future private column cannot join a response.

---

**Total deviations:** 1 auto-fixed (missing functionality), 1 documented pattern recurrence, 3 deliberate departures.
**Impact:** None on the design. Deviation 1 is required for the plan's own stated behaviour to be implementable.

## Verification Results

- `pnpm --filter @sync/web exec vitest run src/__tests__/api/space-admin-audience.test.ts` — **29 tests, all passing** (16 resolver/hash, 13 preview endpoint)
- `grep -c "^export function" .../audience.ts` → `2` (`resolveAudience`, `contentHash`)
- `grep -rc contentHashAsync apps/web/src` → `0`
- `grep -q "\.sort()" .../audience.ts` → present
- `grep -rn createRateLimiter apps/web/src/server/app/space-admin/` → `0` matches
- `grep -c "notification_settings" .../audience.ts` → `2` (the opt-out read is inside the resolver)
- Migration: `CREATE TABLE public.` → `3`; `uq_delivery_once` → present on `(campaign_id, user_id, channel)`; `public.user_id()` → `2`; `auth.uid()` → `0`; `ON DELETE CASCADE` → `1`
- `git diff <05-01's commit> -- apps/web/src/lib/supabase/types.ts | grep -c '^-[^-]'` → **`0`** — additions only, 05-01's entries untouched
- Route: `await params` present, zero `@/lib/supabase` imports, `not the quota` comment present

### On the shared typecheck

`pnpm --filter @sync/web typecheck` was **green at Task 1** and is **red at plan close**, entirely from concurrent wave-3 siblings: seven `TS2307` in 05-06's and 05-07's RED test files whose route modules have not landed yet, plus two `TS2322` in 05-06's `moderate-content.ts`. **Not one error names a file this plan created or modified**, and my files compile inside that same program — if they had errors, `tsc` would have listed them. These resolve when the siblings finish their GREEN steps; they are not deferred items.

Deliberately **not** run: the full suite, `next build`, `prettier --check`. Three siblings are live in this working tree; the phase's one full-suite run is 05-16's, alone in wave 6.

## Issues Encountered

- **Nothing here has touched a live Postgres.** `20260802000014` joins 05-01's three unapplied migrations. Two things in this plan are reviewed rather than executed and should go on 05-16's checklist:
  1. **The nested PostgREST embed** in the `active_vote_participants` branch — `users` → `user_votes!inner` → `votes!inner`, filtered at `user_votes.votes.status`. Two-level embed filtering fails at *runtime*, not compile time, if either relationship does not resolve as expected. It depends on an FK `user_votes.vote_id → votes.id` that this plan did not verify exists.
  2. **`GRANT SELECT ON public.user_notifications TO authenticated`** with a `public.user_id()` policy — the inbox is the only anon-key-readable table in the notification set, so if that helper misbehaves the failure mode is a resident reading nothing (safe) or, if the policy were wrong in the other direction, reading another resident's inbox (not safe). Worth an explicit probe.
- **The unique index `uq_delivery_once` is untested against a real retry.** Its whole purpose is idempotency under a re-run, which cannot be exercised without a database.
- **Wave-3 concurrency was live throughout.** 05-05, 05-06 and 05-07 all committed between my commits, and one `git add` hit an `index.lock` held by a sibling — retried and succeeded. All five code commits were audited for foreign files and are clean.
- **Attribution note, same class as `5979545`.** My `.planning/STATE.md` and `.planning/ROADMAP.md` edits — the 05-08 resume bullet, the six new decisions, the P08 metrics row, and the ROADMAP checkbox tick — were written to the working tree and then **swept into 05-07's commit `7ea8fc9`**, which committed those two shared accumulator files in the window between my edit and my commit. My own `docs(05-08)` commit `11f520d` therefore carries only the SUMMARY. **No content was lost** — all of it is verifiably present in `HEAD`. Path-scoped committing cannot prevent this for a file two plans both legitimately append to; only serialising the docs step could. Recorded because 05-16 owns plan-to-commit attribution.

## User Setup Required

None. No new dependency, no new environment variable. `spaces.notification_monthly_quota` already defaults to 8 from 05-01.

## Next Phase Readiness

**Ready for 05-09.** The send has a campaign row to verify against, one resolver to re-run, two hash definitions it must not re-derive differently, and a quota function that is a database count.

Read "For plan 05-09" above before writing the send. The two things most likely to go wrong are re-implementing `contentHash` with a different join string, and reaching for `createRateLimiter` when the quota check feels like rate limiting.

## Self-Check: PASSED

All 6 created files and both modified files verified present on disk. All 5 commits (`7dd8980`, `dad4868`, `df748fb`, `8e4b884`, `3e7a047`) resolve in `git log`. `git status` shows no stray files from this plan — the untracked entries in the tree belong to siblings 05-05 and 05-06.

The claims deliberately **not** verified are the migration's behaviour against a live Postgres and the nested embed's resolution — see Issues Encountered. Nothing in this summary asserts either was executed.
