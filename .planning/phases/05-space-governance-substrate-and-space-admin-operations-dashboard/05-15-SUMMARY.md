---
phase: 05-space-governance-substrate-and-space-admin-operations-dashboard
plan: 15
subsystem: ui
tags: [next-app-router, css-modules, rtl, hebrew, wcag, cursor-pagination, state-machine, dedupe]

# Dependency graph
requires:
  - phase: 05-07
    provides: listSpaceAudit, the keyset cursor and the { rows, nextCursor, truncated } page
  - phase: 05-08
    provides: POST /notifications/preview, the previewToken that IS the content hash
  - phase: 05-09
    provides: POST /notifications/send with its error taxonomy, GET /notifications with the top-level quota block
  - phase: 05-11
    provides: PressTable, ConfirmDialog, the panels, the kicker module, the disabled-state contract
  - phase: 05-12
    provides: EscalationDialog, the overview surface
  - phase: 05-13
    provides: the proposals surface and its ?proposal={id} deep link
provides:
  - Surface 5 — /he/space-admin/[spaceId]/dispatch, the composer and its eight-state gate
  - Surface 6 — /he/space-admin/[spaceId]/audit, keyset-paged and read-only
  - QuotaBlock, AudiencePreview, ReceiptKicker
  - chrome.ts — one nav-visibility map and one spaces.type label map for all six surfaces
  - serverSentence.ts — one rule for when an error body may be shown to an admin
  - disabledButton.module.css — the D17/D27 appearance, split from D23's ink-only hover
  - PressTable gains rowFlashClass and ROW_FLASH_MS
affects: [05-16]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A composer state derived from data in one expression, never assigned, so a send control cannot outlive the preview that justified it"
    - "A monotonic edit counter captured at request time, so an in-flight preview overtaken by an edit lands stale instead of enabling a send for text that moved"
    - "The keyset trail carried in the URL, so paging backwards is a navigation the surface can see rather than browser history it cannot"
    - "One rule for which HTTP codes carry a user-facing sentence, derived from which AppError constructors require a reason"

key-files:
  created:
    - apps/web/src/app/[locale]/space-admin/[spaceId]/dispatch/page.tsx
    - apps/web/src/app/[locale]/space-admin/[spaceId]/dispatch/page.module.css
    - apps/web/src/app/[locale]/space-admin/[spaceId]/dispatch/DispatchClient.tsx
    - apps/web/src/app/[locale]/space-admin/[spaceId]/audit/page.tsx
    - apps/web/src/app/[locale]/space-admin/[spaceId]/audit/page.module.css
    - apps/web/src/app/[locale]/space-admin/[spaceId]/audit/AuditClient.tsx
    - apps/web/src/components/space-admin/QuotaBlock.tsx
    - apps/web/src/components/space-admin/QuotaBlock.module.css
    - apps/web/src/components/space-admin/AudiencePreview.tsx
    - apps/web/src/components/space-admin/AudiencePreview.module.css
    - apps/web/src/components/space-admin/ReceiptKicker.tsx
    - apps/web/src/components/space-admin/chrome.ts
    - apps/web/src/components/space-admin/serverSentence.ts
    - apps/web/src/components/space-admin/disabledButton.module.css
  modified:
    - apps/web/src/app/[locale]/space-admin/[spaceId]/page.tsx
    - apps/web/src/app/[locale]/space-admin/[spaceId]/proposals/page.tsx
    - apps/web/src/app/[locale]/space-admin/[spaceId]/proposals/ProposalsClient.tsx
    - apps/web/src/app/[locale]/space-admin/[spaceId]/proposals/page.module.css
    - apps/web/src/app/[locale]/space-admin/[spaceId]/members/page.tsx
    - apps/web/src/app/[locale]/space-admin/[spaceId]/members/MembersClient.tsx
    - apps/web/src/app/[locale]/space-admin/[spaceId]/members/page.module.css
    - apps/web/src/app/[locale]/space-admin/[spaceId]/stats/page.tsx
    - apps/web/src/app/[locale]/space-admin/[spaceId]/stats/StatsFallback.tsx
    - apps/web/src/app/[locale]/votes/create/page.tsx
    - apps/web/src/components/space-admin/ConfirmDialog.tsx
    - apps/web/src/components/space-admin/ConfirmDialog.module.css
    - apps/web/src/components/space-admin/PressTable.tsx
    - apps/web/src/components/space-admin/PressTable.module.css
    - apps/web/src/components/space-admin/kicker.module.css
    - apps/web/src/components/space-admin/proposalStatusLabels.ts
    - apps/web/src/components/space-admin/index.ts

key-decisions:
  - "The composer's state is one derived expression over eight names, never assigned, so no handler can enable a send the preview does not justify"
  - "All three 409s take one branch and render the server's own sentence; re-typing either staleness string would create a copy only a screenshot review would catch drifting"
  - "The disabled-state contract was split out of ConfirmDialog, because the red lg send and the outline pagination must take the appearance without D23's ink-only red hover fill"
  - "The audit actor filter is built from the rows on screen: no endpoint lists a space's actors, and the members endpoint is gated on a different capability"
  - "The keyset trail lives in the URL rather than in client state, so a deep page stays linkable and back-button-correct"
  - "spaceTypeLabel falls back to a Hebrew generic everywhere; three of the four copies printed the raw machine value"

patterns-established:
  - "Pattern: derive UI state from data in one expression rather than assigning it in handlers, when the state gates an irreversible action"
  - "Pattern: decide whether a response body is showable from the error CODE, because only the constructors that require a reason guarantee a sentence"

requirements-completed: []

# Metrics
duration: 38min
completed: 2026-08-03
---

# Phase 5 Plan 15: The notification composer, the audit history, and the deduplication backlog Summary

**A composer whose send control is a derived value rather than a stored one — enabled in exactly one of eight states, absent in two, and everywhere else disabled beside the sentence that unblocks it — plus a read-only keyset-paged audit log, and the five duplications four earlier plans had deliberately been logging for this one, folded into one copy each for a net 145 lines removed before a line of new surface was written.**

## Performance

- **Duration:** 38 min
- **Started:** 2026-08-03T09:32:34Z
- **Completed:** 2026-08-03T10:11Z
- **Tasks:** 3, plus the dedupe pass the orchestrator assigned
- **Files:** 31 (14 created, 17 modified)

## Accomplishments

- **The composer cannot send an audience it did not display, and the reason is structural.** `DispatchClient.tsx` holds four counts and an opaque token. `grep -icE "userIds|recipientIds"` returns 0; there is no recipient list to substitute. The token is 05-08's content hash, the send re-runs 05-08's resolver, and 05-09 compares both fingerprints — so the client's staleness rule is a courtesy to the admin rather than the safety mechanism.
- **The state is derived, never assigned.** Eight names, one `useMemo`, evaluated in priority order. There is no `setState('preview_fresh')` anywhere, which is the mechanism by which a send button outlives the preview that justified it. `canSend` is `state === 'preview_fresh'` and nothing else.
- **Staleness fires through one funnel.** All three fields call `edit()`, which bumps an edit counter and flips the preview stale on change. A preview requested before an edit and arriving after it compares the counter and lands stale — the race the "on change, not on blur" rule exists to close, closed on both sides rather than one.
- **The exhausted quota removes the control rather than dimming it.** State 0 renders `QuotaBlock` and `{showSend ? … : null}` returns null. The block is an ink block whose text is `--np-paper` and whose only red is the `aria-hidden` tick — `QuotaBlock.module.css` declares no red at all, because neither red token clears AA as text on ink.
- **The audit surface offers nothing to change and says so.** `grep -icE "onSubmit|onDelete|ConfirmDialog"` returns 0, `grep -c "offset"` returns 0, and `grep -icE 'סה"כ|total'` returns 0. The live-database evidence committed alongside this plan (`05-DB-EVIDENCE.md`, `9e8e678`) now proves the standfirst's claim three layers down: UPDATE, DELETE and TRUNCATE all refuse with `42501` **against the postgres superuser**, so immutability is trigger-enforced rather than grant-enforced.
- **The dedupe pass removed more than it added.** 442 deletions against 297 insertions, across five separate duplications, with the tree green at every step.

## Task Commits

1. **Dedupe pass** — `35d7cca` (refactor). Five duplications, 16 files.
2. **Task 1: QuotaBlock and AudiencePreview** — `4ae436e` (feat).
3. **Task 2: the dispatch composer** — `b1ec7a7` (feat). Includes the disabled-contract split.
4. **Task 3: the audit surface** — `e858965` (feat).
5. **Follow-up** — `068f28d` (fix). An edit clears a server refusal sentence about the previous text.

Every commit used the path-scoped `git commit -m "…" -- <paths>` form and was audited with `git show --stat`. **The tree was not exclusively mine**: the phase coordinator committed `9e8e678` (`05-DB-EVIDENCE.md`) between my third and fourth commits. Path-scoping meant it did not mix in, and none of my commits contains a file I did not write.

## The deduplication backlog

Four plans logged work for this one. All of it is closed; `deferred-items.md` records each closure at its original item.

**Item 11 + 9 — the nav map and the `spaces.type` labels.** There were **four** copies of each, not the two or three logged: the overview and proposals surfaces carried them as well as members and statistics. They were not identical, and the extraction is what surfaced that:

| | overview | proposals | members | stats |
|---|---|---|---|---|
| `urban_area` | `מרחב עירוני` | `מרחב עירוני` | `אזור עירוני` | `אזור עירוני` |
| unmapped type | `'מרחב'` | `space.type` | `space.type` | `space.type` |

`chrome.ts` settles both. `אזור עירוני`, because `מרחב` is the copy deck's word for "space" itself and `מרחב עירוני` makes the edition line read "space: urban space"; and the Hebrew generic as the fallback everywhere, because `space.type` would print `urban_area` on screen the first time #74 adds a type — a bug that is slower to notice than a blank.

**Item 9 — the escalation dialog.** Four copies, not three. Beyond `MembersClient` and `StatsFallback`, `ProposalsClient` exported a `ProposalsAccessDenied` component used at two call sites, carrying its own comment saying to repoint it once 05-12 landed. All three inline copies are deleted; every refused surface is now `<EscalationDialog trigger="no-permission" />`, including the two new ones.

**Item 8 — the row flash.** `rowFlashClass` and `ROW_FLASH_MS` now come from `PressTable`, with the keyframe and a matching-specificity `prefers-reduced-motion` opt-out in `PressTable.module.css`. Both local keyframes and both `ROW_FLASH_MS = 1200` constants are gone, so the timer that clears the class and the animation that runs under it cannot drift.

**`STATUS_IN_REVIEW_HE`.** `votes/create/page.tsx` reads `PROPOSAL_STATUS_LABELS_HE.in_review`. The second half of that module's note — collapsing it and the server map into one shared definition — is still open and still belongs to 05-16.

**Item 10 — `optional()`.** Not extracted, as instructed. Re-checked: still one call site file.

## The inconsistency the orchestrator asked about

**05-13's pattern is the better one, and members is now in line — but neither surface had it quite right.**

Rendering `payload.error` unconditionally leaks English. `toHttp` in `server/http/errors.ts` is the whole vocabulary, and only two variants guarantee a Hebrew sentence: `conflict(reason)` and `paymentInvalid(reason)` both require one. `forbidden(reason?)` does not — an unreasoned 403 answers the literal `Forbidden` — and `Unauthorized`, `Invalid request`, `Quota exceeded` and `Internal server error` are English too. 05-13's `payload?.error ?? ACTION_FAILED_HE` would print `Forbidden` into a Hebrew dialog.

So the fix is one rule rather than one copy: `components/space-admin/serverSentence.ts` returns the body only for `CONFLICT` and `PAYMENT_REQUIRED`, and for `FORBIDDEN` only when it is not the English default. Members, proposals and dispatch all use it.

It was cheap — one module, three call sites — so it is done rather than logged. What it fixes on members is not a vagueness but a contradiction: `space-member.repo.ts` maps a unique-index collision and a zero-row conditional update to `CONFLICT` with `החבר/ה כבר מושעה/ית במרחב הזה.`, `החבר/ה אינו מושעה/ית במרחב הזה.` and `ההרשאה כבר אינה פעילה.` — all meaning *the state you asked for already exists* — while the generic line said nothing happened and nothing was recorded. Logged as item 13 with the residual open question for 05-16.

## Decisions Made

- **All three 409s take one branch.** The plan asks for "two 409 branches with distinct banners". They are distinct — because the sentence comes off the wire rather than out of this file. Branching would mean re-typing `ההודעה שונתה אחרי חישוב הקהל…` and `הקהל השתנה…` as client literals, creating exactly the second copy 05-13 refused to make. Detail under Deviations, including what this costs on the third 409.
- **The disabled-state contract was split out of `ConfirmDialog`.** `confirmButtonClass` bundled D17/D27's disabled appearance with D23's `ink`-only red hover fill, and 05-11's own docstring both names the dispatch send as a consumer and says "apply to `variant="ink"` controls ONLY". Those cannot both hold for a `red`/`lg` button. `disabledButton.module.css` now carries the appearance alone; `confirmButtonClass` is that plus the hover fix. This also removed `PressTable`'s verbatim copy of the disabled block — it had copied it precisely because its `outline` pagination must not take a red fill — and let the dialog's own **cancel** button take a disabled appearance for the first time, which it could not before without also taking a red hover.
- **`ReceiptKicker` rather than a fork.** The press `Receipt` is on the reused-as-is list and paints its kicker in `--np-red` at the mono data size (4.03:1). It takes its kicker as a *node*, so a colour on the node's children governs their own text — a scoped D9 fix for both receipts on this surface without editing a shared component.
- **The dispatch page calls `listSentCampaigns`, not `fetch('/api/…/notifications')`.** The plan says "past campaigns from `GET …/notifications`". Every other surface in this phase calls the use-case behind its route, for the reason those pages state in their own headers: a page is directly addressable and runs with full server privileges, so its authorization must come from the same place the API's does. `listSentCampaigns` *is* that GET's use-case, gated on `notification.send`.
- **The audit actor filter is built from the rows on screen.** No endpoint lists a space's actors; `getSpaceMembers` is gated on `member.read`, a different capability, so an audit reader without it would get a refusal instead of a filter. `ניקוי סינון` renders whenever any filter is applied, so a narrowed list cannot trap anyone. Logged as item 16 with what closing it would take.
- **The keyset trail rides in the URL.** `?cursor=C3&trail=C1~C2`. The repository offers a forward cursor only, so paging back needs the previous page's key from somewhere; client state would break a deep link and `router.back()` would leave the surface entirely if the admin arrived by one. Cursors are base64url, so `~` cannot occur inside one.
- **One disclosure trigger on the audit row, two labels.** The deck names both `הצג נימוק מלא ▾` and a mobile `הצג פרטים ▾`, but two triggers pointing at one expansion is two accessible names for one disclosure — the defect the spec calls out for the proposals panel. Both labels are rendered and one is `display: none` per width, which removes it from the accessibility tree, so exactly one is ever announced and the visible label always matches what the expansion actually contains.
- **`QuotaBlock` prints `{limit}/{limit}`, and `used` is accepted but not destructured.** The deck specifies the doubled limit. Lowering a space's quota mid-month would otherwise render `9/8`, and a fraction whose numerator exceeds its denominator reads as a bug rather than as a refusal.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug] A disabled preview CTA would have been a seventh `disabled` state**

- **Found during:** Task 2.
- **Issue:** The natural implementation disables `חשבו קהל יעד` until the title, body and audience are all filled. Rule B's list of permitted `disabled` uses is declared exhaustive and does not include it, and "any other disabled control is a spec violation" — a visible hint would not have rescued it.
- **Fix:** The CTA is disabled only while its own request is in flight, which *is* on Rule B's list (row 6, label swaps to `…מחשב קהל יעד`). An empty field is answered by a field error on the field itself, using the repo's existing required-field microcopy through `PressInput`'s `error` prop.
- **Cost:** a fifth copy of `'צריך למלא את השדה הזה כדי להמשיך.'`, which already existed as four independent local constants in unrelated surfaces before this phase. Logged as item 17 rather than started as a repo-wide microcopy extraction from inside a phase-5 plan.
- **Committed in:** `b1ec7a7`.

**2. [Rule 2 — Missing functionality] The dialog's cancel button had no disabled appearance**

- **Found during:** Task 2, while splitting the disabled contract.
- **Issue:** `ConfirmDialog`'s cancel is `disabled={pending}` with no class, so while a request was in flight it rendered identically to an enabled control and kept `cursor: pointer` — precisely the gap D17 exists to close. It could not be fixed before, because the only shared class also carried the `ink` hover fill an `outline` control must never take.
- **Fix:** `disabledButtonClass` on the cancel.
- **Committed in:** `b1ec7a7`.

**3. [Rule 1 — Bug] A server refusal sentence survived the edit that answered it**

- **Found during:** post-Task-2 review.
- **Issue:** After a 409, editing the body left `הקהל השתנה — הציגו תצוגה מקדימה מחדש.` on screen while the admin rewrote the text the refusal was about.
- **Fix:** `edit()` clears the banner; the shared stale banner still states what unblocks the send, and the polite announcement still fires only on the 3 → 4 transition.
- **Committed in:** `068f28d`.

**4. [Documented] Two comment-versus-grep collisions, the phase's fifth and sixth**

- **Found during:** Task 1 and Task 3.
- **Issue:** (a) The criterion "`QuotaBlock.module.css` contains no `--np-red-ink` at all" was tripped by the file's own contrast table explaining why that token cannot be used there. (b) "No non-media-query pixel literal" was tripped by comments citing font sizes in px, and by an `outline-offset: 2px` I had written from the spec's literal text.
- **Fix:** 05-04's resolution (1) for the comments — "the dark red used for red text on paper backgrounds", "a kicker at the smallest mono size", "below the breakpoint" — and `var(--np-rule)` for the offset, which is the same 2px through the token, matching what the other modules in the phase already do.
- **Verification:** `grep -c -- "--np-red" QuotaBlock.module.css` → 0. No `px` outside a media query in any module this plan wrote.

### Criteria met differently than written

- **"The two 409 branches switch to state 4 with distinct banners."** There is one branch. The banners are distinct because they arrive from the server; branching would require the client literals 05-13 established a house rule against. The substance — a 409 returns the composer to state 4, and the admin sees which of the two things went wrong — holds more robustly than two hardcoded comparisons would.
  **What this costs:** 05-09 asks for the sent receipt rather than a banner on the third 409, `ההתראה כבר נשלחה.` An error response carries no recipient count, no send time and no remaining quota, so that receipt could only be fabricated; the surface refreshes instead, which puts the dispatch into the history list where it is visible and true. It is also all but unreachable from this UI: every preview inserts its own campaign row, the send disables while a request is in flight, and success leaves the composer entirely.
- **"Staleness fires on change: `grep -c "setState('preview_stale')"` or equivalent returns at least 3."** The equivalent is `grep -c "edit({"` → **3**, one per field. The transition itself lives once inside `edit()`, which is what makes "no field can forget it" true rather than repeated three times and hoped for.
- **"The send button uses the `:disabled`-qualified class exported by 05-11."** It uses `disabledButtonClass`, which is that class's disabled half, exported from the same module. Taking `confirmButtonClass` whole would have given a `red`/`lg` button D23's `--np-red-dark` hover — replacing a compliant 16.66:1 red→ink inversion with a 6.03:1 red→red-dark one, which is the identical mistake the checker caught and reverted for `outline`, and which 05-11's own docstring forbids two lines below the sentence naming this button as a consumer.
- **"The reason clamp uses both `-webkit-line-clamp: 2` and `line-clamp: 2`."** Through `ClampedText lines={2}`, whose `.clamp2` in `PressTable.module.css` declares both. Writing a second clamp into `audit/page.module.css` would have satisfied a grep by duplicating the primitive this plan spent its first commit deduplicating.
- **"Past campaigns from `GET …/notifications`."** The page calls that route's use-case directly. See Decisions.

### Deliberate departures

- **The barrel was reopened, narrowly.** The plan says not to edit `components/space-admin/index.ts`. Its stated reason is wave collision, and its own docstring closes it to *the five components created by 05-12 through 05-15* — `QuotaBlock`, `AudiencePreview` and `ReceiptKicker` respect that and are imported by direct path. What was added is three exports of primitives the barrel already owns: `rowFlashClass` and `ROW_FLASH_MS` from `PressTable`, and `disabledButtonClass` from `ConfirmDialog`, in the same category as `confirmButtonClass` which the barrel already exports for the same reason. Every plan that could have collided has landed.
- **State 0 hides the preview CTA as well as the send.** The state table names only the send as absent. With read-only fields there is nothing new to cost and an empty payload could only answer 400.
- **Files outside `files_modified` were edited.** Required by the dedupe assignment; all owning plans are complete. Listed in full below.

## Files edited outside this plan's `files_modified`

| File | Why |
|---|---|
| `space-admin/[spaceId]/page.tsx` | chrome.ts migration (items 9/11) |
| `space-admin/[spaceId]/proposals/page.tsx` | chrome.ts + `EscalationDialog` at two call sites |
| `space-admin/[spaceId]/proposals/ProposalsClient.tsx` | deleted `ProposalsAccessDenied`; `rowFlashClass`; `serverSentence` |
| `space-admin/[spaceId]/proposals/page.module.css` | removed the local flash keyframe |
| `space-admin/[spaceId]/members/page.tsx` | chrome.ts migration |
| `space-admin/[spaceId]/members/MembersClient.tsx` | `EscalationDialog`; `rowFlashClass`; the 409 sentence |
| `space-admin/[spaceId]/members/page.module.css` | removed the local flash keyframe |
| `space-admin/[spaceId]/stats/page.tsx` | chrome.ts migration |
| `space-admin/[spaceId]/stats/StatsFallback.tsx` | `EscalationDialog` — the file shrank from 96 lines to 36 |
| `votes/create/page.tsx` | `STATUS_IN_REVIEW_HE` repoint |
| `components/space-admin/ConfirmDialog.tsx` / `.module.css` | split the disabled contract; cancel-button fix |
| `components/space-admin/PressTable.tsx` / `.module.css` | `rowFlashClass`, `ROW_FLASH_MS`, dropped the copied disabled block |
| `components/space-admin/kicker.module.css` | the two `ReceiptKicker` classes |
| `components/space-admin/proposalStatusLabels.ts` | note updated — half its named follow-up is now done |
| `components/space-admin/index.ts` | three primitive exports, as above |

## Verification Results

- Root `pnpm typecheck` — **green, 8/8**, at every task gate and at plan close.
- `pnpm --filter @sync/web lint` — **0 errors**, and back to the same **2 pre-existing warnings** the baseline had (`postcss.config.mjs`, `worker.ts`). One new `react-hooks/exhaustive-deps` warning appeared on `AuditClient` and was fixed by restructuring, not suppressed.
- `pnpm --filter @sync/web exec vitest run` — **987 tests, 74 files, all passing**, unchanged from the baseline, re-run after the dedupe pass and after each surface.
- `grep -rn "np-block-red"` across `[locale]/space-admin` and `components/space-admin` → **nothing**.
- `variant="red"` across the whole phase → **one hit**, the dispatch send. A script that parses each `<NewsButton …>` opening tag confirms **every** button in the phase declares a variant — `NewsButton` defaults to `red`, so an omitted variant is an invisible second red button and a line-wise grep does not catch one.
- Dispatch: `previewToken` present; both disabled hints verbatim; `grep -icE "userIds|recipientIds"` → 0; no `@/lib/supabase` or `@/server/infra` import; `kind="irreversible"` with all four confirmation strings verbatim; state 0 returns `null` rather than a disabled button.
- Audit: `listSpaceAudit` imported and `listAuditRows` absent; `grep -icE 'סה"כ|total'` → 0; `grep -c "offset"` → 0; `grep -icE "onSubmit|onDelete|ConfirmDialog"` → 0; `?proposal=` present; both pagination hints verbatim; `toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })`.
- Token discipline: no hex and no non-media-query pixel literal in any of the five stylesheets this plan wrote.

### Not run, and why

- **`next build`** and the full repo suite. Every sibling deferred these to 05-16, which owns the phase's one whole-repo run, and the coordinator was committing into this tree while this plan ran.
- **The plan's manual step** — "preview an audience, edit one character, confirm the send disables and the stale banner appears without a blur event". **Not executed, and it could not be.** It needs a session, a seeded space with members, and a running Supabase; and `apps/web` has no React test harness at all (`vitest.config.ts` sets `environment: 'node'`, and `@testing-library/react` is not a dependency), so there was no way to assert it in a test either. The behaviour is argued from the code — every field routes through one `edit()` that flips `stale` synchronously on `onChange`, and `canSend` is `state === 'preview_fresh'` which `preview_stale` pre-empts — but it is **argued, not observed**. It belongs on 05-16's screenshot pass, where it is screenshots 9–10 and 14 anyway.

## Issues Encountered

- **The tree was not exclusively mine.** The orchestrator's brief said no siblings were running; the phase coordinator committed `9e8e678` (`05-DB-EVIDENCE.md`) between my third and fourth commits. No harm — every commit here is path-scoped and was audited — but the "any red you see is yours" assumption did not strictly hold.
- **`05-DB-EVIDENCE.md` closes several concerns this summary would otherwise have repeated.** The zero-row conditional `UPDATE` behaviour that 05-06 and 05-09 both flagged as first-priority is confirmed, which is what `claimCampaignForSend`'s 409 and the members surface's conflict sentences both rest on. Worth reading before 05-16.
- **Two spec tensions found and left as spec questions, not resolved in code.** The state-0 copy promises a draft the read-only fields prevent (item 14), and the audit `הרשאות` chip selects grant rows only, so a member suspension — the most consequential authority change on the dashboard — is invisible under it (item 15). Both are copy-deck decisions.
- **`gsd-tools` behaved as documented.** `state advance-plan` fails on this project's STATE.md format and `roadmap update-plan-progress` reports success while changing nothing; both files were hand-edited and verified, as every plan since 05-01 has done.

## User Setup Required

None. No new dependency, no new environment variable, no migration.

## Next Phase Readiness

**Ready for 05-16.** All six surfaces exist and the dashboard is feature-complete for #75's UI requirement.

Three things 05-16 should take from here. The screenshot pass is the first execution of any of this against a browser — nothing on these two surfaces has been rendered, only compiled. Items 14 and 15 are copy-deck decisions that a screenshot review will notice (#14 in particular shows a read-only composer beside a sentence inviting the admin to draft in it). And the residual half of item 13: no surface should print an English response body, which is now enforced by one shared rule but has never been exercised against a live 403.

## Self-Check: PASSED

All 14 created files verified present on disk. All 17 modified files verified to exist and to contain the changes claimed. All five commits (`35d7cca`, `4ae436e`, `b1ec7a7`, `e858965`, `068f28d`) resolve in `git log`, and `git show --stat` on each confirms it carries only this plan's files.

Claims deliberately **not** verified, and named as such above: every rendered behaviour of both surfaces, the staleness interaction the plan asks to confirm manually, and anything requiring a browser or a live database.
