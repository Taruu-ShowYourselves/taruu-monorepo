---
phase: 05-space-governance-substrate-and-space-admin-operations-dashboard
plan: 13
subsystem: ui
tags: [react, nextjs, rsc, css-modules, rtl, a11y, wcag, press-tokens, radix, deep-link]

# Dependency graph
requires:
  - phase: 05-05
    provides: decideProposal + getProposalDetail, POST decide, GET detail, DECISION_CONFLICT_HE
  - phase: 05-06
    provides: moderateContent and POST …/proposals/{voteId}/content, POST …/escalations
  - phase: 05-10
    provides: the creation-fee charge on the approve branch and its 402 sentence
  - phase: 05-11
    provides: PressTable, ConfirmDialog, StatusChip, the three panels, SpaceAdminHeader/Nav, the kicker module
provides:
  - "Surface 2 at /he/space-admin/[spaceId]/proposals — filters, table, three decisions, deep link"
  - "ProposalDetailPanel — the expanding tr/td-colspan panel and the home of the permitted-content controls"
  - "PROPOSAL_STATUS_LABELS_HE — a client-safe mirror of the pinned server label map"
  - "PressTable.renderExpansionRow and PressTable.rowClassName (already consumed by 05-14)"
affects: [05-15, 05-16]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A caller-owned expansion <tr>, so the panel owns the id its trigger's aria-controls names"
    - "Server-sent error sentences rendered rather than re-typed, where the server already defines the constant"
    - "Filter state in the URL query, navigated inside a transition so the table can show its skeleton"
    - "A deep-linked row seeded into the queue when no filter would have returned it"

key-files:
  created:
    - apps/web/src/app/[locale]/space-admin/[spaceId]/proposals/page.tsx
    - apps/web/src/app/[locale]/space-admin/[spaceId]/proposals/page.module.css
    - apps/web/src/app/[locale]/space-admin/[spaceId]/proposals/ProposalsClient.tsx
    - apps/web/src/components/space-admin/ProposalDetailPanel.tsx
    - apps/web/src/components/space-admin/ProposalDetailPanel.module.css
    - apps/web/src/components/space-admin/proposalStatusLabels.ts
  modified:
    - apps/web/src/components/space-admin/PressTable.tsx

key-decisions:
  - "ProposalDetailPanel owns its own <tr> and <td colSpan>, which required one additive hook on PressTable — its renderExpansion prop places content inside a cell whose id it never hands out, and the title button must point aria-controls at that cell"
  - "The 409 and 402 sentences are rendered from the server's response body, because both are server-defined constants and the surface may not import from the infra layer"
  - "Show-all is two authorized reads merged: the unfiltered queue read returns the four review statuses and excludes the published one, which is exactly what audit-log deep links point at"
  - "A deep-linked proposal with no row in the current read is seeded into the queue, so ?proposal={id} cannot open a panel with nothing above it"
  - "Decision actions render only on a proposal under review; on a decided row they are absent for the same reason they are absent on a self-submitted one"
  - "The client-safe status label map is a new module rather than a third inline copy, per the coordinator's Option 1"

patterns-established:
  - "Pattern: when a shared primitive cannot express a contract, extend it additively and commit that change alone, so the attribution survives a shared index"
  - "Pattern: a Hebrew sentence the server already defines is transported, not re-typed, even when an acceptance criterion phrases it as 'renders the exact string'"

requirements-completed: []

# Metrics
duration: 78min
completed: 2026-08-03
---

# Phase 5 Plan 13: Proposal Review Queue and Detail Panel Summary

**The review queue decides proposals behind a required reason, refuses self-review by absence rather than by a switched-off button, discloses that approval bills a third party, and deep-links to an expanding row where content moderation finally has somewhere to act.**

## Performance

- **Duration:** ~78 min (10:54Z → 12:12Z)
- **Tasks:** 2
- **Files:** 6 created, 1 modified
- **Commits:** 5, all path-scoped and audited

## Task Commits

1. **PressTable escape hatch** — `2bdb48f` (feat) — one file
2. **Task 1: the detail panel** — `ecaeff6` (feat) — three files
3. **Comment hygiene** — `1f78ee1` (chore) — one file
4. **Task 2: the queue, decisions and deep link** — `c0f09a4` (feat) — three files
5. **Refusal wrapper** — `ee4cddd` (fix) — one file

Each was audited with `git show --stat`; every one contains only this plan's files. Sibling commits `1bd7134`, `0c0535a` and `21dbc2e` (05-14) landed between mine and are unaffected. 05-12 has `[spaceId]/page.tsx` dirty in the tree right now; I did not stage it.

## What the plan was wrong about, and what I found instead

Two of these matter to whoever reads this next.

**1. `[spaceId]/page.tsx` did not exist when this plan started.** Task 2's `read_first` says to read 05-12's overview page for "the Server Component pattern and the FORBIDDEN branch to mirror". There was no such file — 05-12 is concurrent and had not landed. This surface therefore *defines* the pattern rather than mirroring one: resolve the session from cookies, `getSpaceOverview` for shell identity and the capability set, then the surface's own use-case, with FORBIDDEN at either level rendering `NoPermissionPanel`. If 05-12 lands a different shape, one of us should converge on the other — mine is not authoritative, it is merely first.

**2. The known-broken sibling file named in the briefing is green.** `apps/web/src/app/[locale]/votes/create/page.tsx` compiles; 05-10's `9d35240` fixed it before I started. Root `pnpm typecheck` was clean at baseline and is clean now, so no error in this plan's runs had to be attributed away.

**3. "Show all" cannot be one call.** `listProposals` with no status filters `.in('status', [...REVIEW_VOTE_STATUSES])`, and the published status is not in that list. The plan and the UI-SPEC both assume `הצגת הכול` is a single unfiltered read — it is not, and taken literally the deep-link rule would have failed on precisely the rows it exists for, since an audit-log subject is a *decided* proposal and the most common decision is approval. `loadProposals` issues two authorized reads for `all` and merges them by submission time.

## The one sibling file I modified, and why

`apps/web/src/components/space-admin/PressTable.tsx`, in its own commit `2bdb48f`, gaining two optional props.

The plan mandates a panel that is "a `<tr>` with one `<td colSpan={columnCount}>`", gives it `panelId` and `columnCount` props, and greps its source for `colSpan`. 05-11's `renderExpansion` cannot produce that: it places the caller's node *inside* a `<td>` PressTable owns, whose id is generated from an internal `useId` and never exposed. So the title button had no id to name in `aria-controls`, and the panel could not be the `<tr>` three separate parts of the plan say it is. Returning a `<tr>` from `renderExpansion` would nest a row inside a cell.

`renderExpansionRow(row, columnCount)` replaces the expansion row entirely when supplied; `rowClassName(row)` reaches the body `<tr>` for the 1200ms post-decision flash, which is otherwise unreachable because the table paints backgrounds on cells and exposes no row hook. Both are optional and additive, no existing caller changed, and the auto-disclosure condition now excludes the new hook so there is still exactly one expansion per row at every width.

This turned out to be load-bearing beyond this plan: 05-14's `0c0535a` picked up `rowClassName` for the member-row flash and says so in its commit message.

## Content moderation, where it now lives

Inside the panel, four controls, two rendered at a time:

```ts
const controls = [
  proposal.hidden  ? CONTENT_CONTROLS.unhide : CONTENT_CONTROLS.hide,
  proposal.flagged ? CONTENT_CONTROLS.unflag : CONTENT_CONTROLS.flag,
];
```

All four are `kind="audited"` — each has its inverse in the same panel — and all four carry the same required reason as a decision. Without `content.moderate` the block is absent and the panel still opens and reads, which is the whole point of folding this in here rather than onto a seventh route: the capability appears in the overview's manifest, so it must have somewhere to act.

The notices render above the body, hidden before flagged, and both can show at once. That is screenshot 16b.

## Two Hebrew sentences this surface does not contain

The 409 conflict sentence and the 402 charge-decline sentence are **not typed anywhere in this plan's files.** Both are server constants — `DECISION_CONFLICT_HE`, declared at `space-decision.repo.ts:28` with its sentence on 29, and `CHARGE_FAILED_HE` at `decide-proposal.ts:63` — and `toHttp` puts each on the wire as the response body's `error`. The client renders that field.

This is the same single-source principle the briefing asked for, reached the only way available: the acceptance criterion for this surface forbids importing from `@/server/infra/*` anywhere in the proposals directory, and `space-decision.repo.ts` both lives there and is `server-only`, so it cannot be imported by the page or by a client component. Rendering the transported constant keeps one definition; re-typing either sentence would have created the second copy 05-05 went out of its way to avoid.

**Consequence worth stating:** a grep of `ProposalsClient.tsx` for the charge-failure string returns nothing. Task 2's criterion "the 402 branch keeps the dialog open and renders the exact charge-failure string" is met at runtime and not by literal presence. If a reviewer wants the literal, the honest fix is to lift both constants into `packages/shared`, not to paste them here.

## The status labels — Option 1, as the coordinator asked

New module, named prominently because 05-12 is concurrently authorized to create shared UI helpers:

**`apps/web/src/components/space-admin/proposalStatusLabels.ts`**

It exports `PROPOSAL_STATUS_LABELS_HE` and `proposalChipTone`. It imports one *type* from the shared contracts and nothing else, so it is safe in a browser bundle.

The cycle 05-10 reported is real and I confirmed it: `server/domain/votes/vote.ts:109` re-exports `REVIEW_VOTE_STATUSES` from `space/review.ts`, which imports `initialStatus` back out of `vote.ts`. It happens to initialise safely — `initialStatus` is a hoisted function declaration and `review.ts` only calls it from inside a function — but pulling a server-domain module into the client for five strings is still the wrong trade, so this module does not import the pinned map.

The five review labels were verified against `REVIEW_STATUS_LABELS_HE` **codepoint by codepoint**, not by eye:

```
MATCH draft              1496,1497,1493,1496,1492
MATCH in_review          1489,1489,1491,1497,1511,1492
MATCH changes_requested  1492,1493,1495,1494,1512,1492,32,1500,1514,1497,1511,1493,1503
MATCH rejected           1504,1491,1495,1514,1492
MATCH active             1488,1493,1513,1512,1492,32,1493,1508,1493,1512,1505,1502,1492
```

05-10's inline `STATUS_IN_REVIEW_HE` was checked the same way and also matches. I did **not** edit `votes/create/page.tsx` — it is another plan's file and the string is currently correct.

**For 05-15 / 05-16, the two-line follow-up:** repoint `apps/web/src/app/[locale]/votes/create/page.tsx` at this module, then lift the map into `packages/shared/src/contracts/spaceAdmin.ts` (where `ProposalStatusSchema` already lives) and have `server/domain/space/review.ts` re-export it, so the two definitions collapse to one. That is a three-file change and needs a quiet tree; it was not this plan's to make.

`pending` and `ended` are mapped to the approved label. A proposal approved before its start date lands in `pending` — scheduled, not open — and the copy deck's own approve announcement calls that outcome approved-and-published, so the chip agrees with the announcement. Without the entry the chip would have rendered `undefined` after any approval of a future-dated proposal, which is reachable today.

## Decisions Made

- **The decision actions render only on a proposal under review.** The copy deck gives three row actions and no "you cannot decide this" text, and the filter chips make decided proposals viewable. Offering `אישור ופרסום` on an already-rejected row would be a control whose only possible outcome is the conflict panel. On a decided row the actions cell is empty — absence, for the same reason self-submitted rows use absence.
- **The five chips are the deck's five; `all` is a state, not a sixth chip.** It is reachable through the no-results `הצגת הכול` and through the deep link, and it is in the URL as `?status=all`, so the view is linkable. When it is active no chip is pressed. That is faithful to a deck that names exactly five filters, and it is the one place the surface looks slightly unfinished.
- **`?proposal={id}` forces show-all unconditionally**, even if `?status=` is also present. The spec says the deep link forces the filter; making an explicit status win would reintroduce the silent-failure case the rule exists to close.
- **Filters navigate through `router.push` inside a transition** rather than as links. The URL still carries the state and the back button still works, and `isPending` is what drives the five skeleton rows — the State Matrix requires a loading state that a pure server round-trip would never render.
- **The surface's `h2` is visually hidden.** The a11y contract wants `<section aria-labelledby>` pointing at an `h2`, and the deck gives Surface 2 a kicker and a standfirst but no visible heading. An SR-only `h2` carrying the kicker's own words satisfies the landmark without inventing visible copy.
- **`confirmButtonClass` is applied to the approve row button.** It is a dense `ink` control, so D23's hover fix applies; reusing 05-11's exported class is better than re-authoring the override in a third stylesheet.
- **The escalation dialog is inlined here**, not imported. 05-12 owns `components/space-admin/EscalationDialog.tsx` and is running now; importing a file that may not exist when this one compiles is exactly the failure the wave rules exist to prevent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] The mandated panel shape is not expressible through `renderExpansion`**

- **Found during:** Task 1
- **Issue:** the panel must be a `<tr>` owning a `<td colSpan>` whose id its trigger names; 05-11's hook places content inside a cell it owns and never exposes that cell's id.
- **Fix:** `renderExpansionRow` and `rowClassName` on `PressTable`, both optional and additive.
- **Files modified:** `apps/web/src/components/space-admin/PressTable.tsx`
- **Commit:** `2bdb48f`

**2. [Rule 2 — Missing critical] "Show all" omitted every approved proposal**

- **Found during:** Task 2
- **Issue:** one unfiltered `listSpaceProposals` returns the four review statuses only, so the deep link would have failed on approved subjects — the majority of audit-log links.
- **Fix:** `loadProposals` merges two authorized reads for `all`.
- **Commit:** `c0f09a4`

**3. [Rule 2 — Missing critical] A deep link can resolve a proposal no filter returns**

- **Found during:** Task 2
- **Issue:** an approved-but-scheduled proposal sits in a status no chip selects, so `?proposal={id}` would have expanded a panel under a row that does not exist.
- **Fix:** `withDeepLinked` seeds the resolved detail as a row when the queue does not already contain it.
- **Commit:** `c0f09a4`

**4. [Rule 1 — Bug] The detail retry did not retry**

- **Found during:** Task 2 self-review
- **Issue:** the error panel's retry cleared a flag the fetch effect did not depend on, so nothing refetched.
- **Fix:** an attempt counter in the effect's dependency list.
- **Commit:** `c0f09a4`

**5. [Documented] Comment-versus-grep, hit again**

- **Found during:** post-Task-2 verification
- **Issue:** three prose comments explaining *why* controls are absent used the exact word an acceptance grep requires to be missing from these files.
- **Fix:** reworded to "present-but-inert" / "greyed out". No behaviour changed.
- **Commit:** `1f78ee1`

### Declared API additions

- **`ProposalDetailPanel.onCollapse`.** The plan's prop list has no way to tell the owner of `expandedKey` that `Escape` was pressed, so the keyboard contract was unimplementable as written. No `triggerId` prop was needed: the panel finds its trigger with `[aria-controls="{panelId}"]`, focuses it, then collapses — in that order, because the subtree is about to unmount.
- **`ProposalsAccessDenied`, exported from `ProposalsClient.tsx`.** `NoPermissionPanel.onEscalate` is a required function prop and a Server Component cannot pass one, so the refusal state needs a client wrapper. It lives beside the queue rather than in a new file.
- **`proposalStatusLabels.ts`**, a seventh file beyond the plan's list — created on the coordinator's instruction. See above.

### Copy not in the deck

Three strings had to be written. All are flagged rather than buried:

1. **`ACTION_FAILED_HE`** — `הפעולה לא הושלמה. נסו שוב; אם זה חוזר — פנו למנהל־על.` The deck has no sentence for "the request never reached the server", and a dialog that closes on a failure it cannot describe loses the typed reason. Phrased on the deck's own send-error cadence.
2. **`SPACE_TYPE_LABELS_HE`** — five Hebrew labels for the space types. `SpaceAdminHeader` takes an already-localized `spaceTypeLabel` and the deck names the slot but never fills it. Duplicated with 05-12, which needs the same map.
3. **The SR-only `h2`** — `תור הכרעה`, taken from the surface's own kicker.

### Duplication logged, not resolved

- The nav-visibility capability map in `page.tsx` is the same map 05-12 needs.
- The escalation dialog duplicates 05-12's `EscalationDialog.tsx`.
- `ROW_FLASH_MS`, the flash keyframes and the `srOnly` block each exist in more than one surface module now.
- No shared helper module was created for any of these, per the wave rule. 05-15 dedupes.

I did **not** append to `deferred-items.md`: 05-12 has it dirty in the working tree, and committing that path would have swept their in-flight prose into my commit — the exact hazard this phase has already hit twice.

## Verification Results

Run from the repo root, after the last commit:

```
pnpm typecheck --force          # 8 tasks, 8 successful, 0 cached
pnpm --filter @sync/web lint    # 0 errors (the 2 pre-existing warnings only)
```

Greps, all from the plan's own criteria:

- `grep -c colSpan ProposalDetailPanel.tsx` → 2; `68ch` in its module → 3; `Escape` → 2
- No hex colour and no non-media-query pixel literal in either new stylesheet
- `grep -rnE "from '@/(lib/supabase|server/infra)" …/proposals` → empty
- `grep -c aria-expanded ProposalsClient.tsx` → **1**
- `grep -c "הצעה שהגשתם" ProposalsClient.tsx` → 1
- `grep -c "ייגבו" ProposalsClient.tsx` → **0**; the approve body with `ייווצר חיוב` → 1
- `grep -c disabled` across all five new source files → **0**
- `grep -c 'variant="red"'` across the surface → 0
- All four content labels, all four content confirmation triples, both notice halves, and 35 Surface 2 copy strings verified present verbatim by script

## Not verified

Stated plainly, because none of it is provable from this machine today.

- **Nothing here has been rendered.** No browser, no `next dev`. The plan's two manual steps — open `?proposal={id}` and confirm the filter switched, the panel expanded and scrolled into view; confirm no red button appears — are **not done**. The second is settled by grep; the first is not. It also cannot be done yet: the phase's migrations have never reached a live Postgres, so there is no space, no grant and no proposal to link to. This is 05-16's, and it is the same gap 05-14 recorded for members and statistics.
- **No fetch in this plan has reached a route.** The decide, detail, content and escalation calls are typed against the contracts and the route shapes, never executed.
- **The RTL layout, the 768px column reduction, the 12-line clamp measurement, the row flash and the panel's focus return are reviewed, not seen.** The clamp expander in particular only appears when a measured overflow says it should, and that measurement has never run.
- **The two-read merge for `all` has not been observed returning anything.** Its correctness rests on reading `listProposals`, not on a result.

## Next Phase Readiness

- **05-15** can link an audit row to `/he/space-admin/{spaceId}/proposals?proposal={voteId}`; the surface forces show-all, seeds a missing row and renders `ההצעה לא נמצאה במרחב הזה.` for anything outside the space. It should also do the two dedupes named above.
- **05-16** needs screenshots 3–4 (three rows, one `בבדיקה`, one self-submitted showing lock text and no buttons) and 16a/16b (panel with the two forward controls; panel hidden **and** flagged with both notices and both inverses). 16b needs a fixture proposal in both states.
- **05-12**: the nav map, the space-type labels and the escalation dialog exist here already; converge rather than diverge, and note that the layout-validator fix you may be about to make has already landed as `1bd7134`.

## Self-Check: PASSED

All six created files and the one modified file verified present on disk. All five commits (`2bdb48f`, `ecaeff6`, `1f78ee1`, `c0f09a4`, `ee4cddd`) resolve in `git log`, and each was re-audited with `git show --stat` for foreign files — none carries any. Every line number cited above was re-read from the file after the last commit: `DECISION_CONFLICT_HE` declared at 28, `CHARGE_FAILED_HE` at 63, the `vote.ts` re-export at 109. The codepoint comparison of the five status labels was run, not asserted.

The claims deliberately **not** verified are everything under "Not verified" — nothing in this summary states that any of it was rendered, fetched or measured.

---
*Phase: 05-space-governance-substrate-and-space-admin-operations-dashboard*
*Completed: 2026-08-03*
