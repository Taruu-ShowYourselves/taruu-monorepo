---
phase: 05-space-governance-substrate-and-space-admin-operations-dashboard
plan: 14
subsystem: ui
tags: [nextjs, server-components, rtl, css-modules, privacy, k-anonymity, accessibility, press-design-system]

# Dependency graph
requires:
  - phase: 05-06
    provides: getSpaceMembers, the grants and members/suspension endpoints, and the privacy allow-list that SpaceMember *is*
  - phase: 05-07
    provides: getSpaceMetrics and the three-status SpaceMetric contract the statistics cards render
  - phase: 05-11
    provides: PressTable, ConfirmDialog, StatusChip, the three panels, SpaceAdminHeader/Nav, and the phase-local kicker
  - phase: 05-12
    provides: getSpaceOverview's wired figures (used here only for the space identity and the capability set)
  - phase: 05-13
    provides: PressTable's rowClassName hook, which landed mid-execution and made the post-decision row flash possible
provides:
  - /he/space-admin/[spaceId]/members — Surface 3, the members and roles table with grant, revoke, suspend and reinstate
  - /he/space-admin/[spaceId]/stats — Surface 4, four inert aggregate cards with the k-anonymity rendering rules
  - MembersClient — the members island, including its own escalation dialog
  - StatsFallback — the statistics surface's only client code
affects: [05-15, 05-16, issue-91]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A surface that must not be interactive is server-rendered end to end, so no figure can acquire a handler by accident"
    - "Two statuses that mean different things get two renderings and no shared fallback, because collapsing them re-asserts a bound the server withheld"
    - "A caller-owned expansion id, so the disclosure trigger's aria-controls points at markup the caller can name"
    - "A keyframed background beats a table's static cell background from the animation origin, so a row flash needs no specificity contest — only a matching-specificity reduced-motion opt-out"

key-files:
  created:
    - apps/web/src/app/[locale]/space-admin/[spaceId]/members/page.tsx
    - apps/web/src/app/[locale]/space-admin/[spaceId]/members/page.module.css
    - apps/web/src/app/[locale]/space-admin/[spaceId]/members/MembersClient.tsx
    - apps/web/src/app/[locale]/space-admin/[spaceId]/stats/page.tsx
    - apps/web/src/app/[locale]/space-admin/[spaceId]/stats/page.module.css
    - apps/web/src/app/[locale]/space-admin/[spaceId]/stats/StatsFallback.tsx
  modified:
    - apps/web/src/app/[locale]/space-admin/[spaceId]/layout.tsx
    - .planning/phases/05-space-governance-substrate-and-space-admin-operations-dashboard/deferred-items.md

key-decisions:
  - "suppressed and unavailable are rendered by two separate branches with no shared fallback, and the participation-rate card gets no special case — if that figure is ever marked suppressed the fix belongs in the SQL, not in the renderer"
  - "A missing metric object is treated as withheld rather than zero, a second time, even though the use-case already folds a missing row into four withheld figures"
  - "EmptyPanel is NOT rendered on the statistics surface: 05-07 never returns an empty response, so the only reachable 'nothing here' state is four withheld figures, and captioning that 'not enough data yet' would be a fabricated explanation"
  - "verificationStatus and identityVerified are read from the contract and deliberately not rendered anywhere — the five columns are the contract, and a verification flag derived from a document does not belong on the surface that promises those documents are unreachable"
  - "The capability editor is a panel below the table rather than a row expansion, so the row's one expansion stays the hidden-column recovery the responsive contract needs"
  - "A role preset sets grantedViaRole provenance and shows its expanded list; it never batch-applies, because every grant keeps its own confirmation with the capability named in the singular"
  - "The space-admin layout's locale is narrowed after the route param rather than in its signature — a cross-plan fix, because Next's generated LayoutConfig rejects the narrowed form and it broke the repo typecheck"

patterns-established:
  - "Pattern: the comment-versus-grep collision, hit twice more here — `listSpaceMembers` in a page that must not name it, and `:hover` next to `statCard` in a stylesheet whose criterion greps for exactly that adjacency"
  - "Pattern: a criterion phrased as a grep can be satisfied by a named constant (`const SUPPRESSED_FIGURE = '<5'`) where JSX cannot carry the literal directly"

requirements-completed: []

# Metrics
duration: 35min
completed: 2026-08-03
---

# Phase 5 Plan 14: Members, Roles and Aggregate Statistics Summary

**Two surfaces whose promises are mostly about what they refuse: a members table that shows five administration columns and states on screen that identity documents are unreachable, and a statistics surface with no control anywhere near a figure, where "fewer than five people" and "we are not telling you this" are two visibly different answers.**

## Performance

- **Duration:** ~35 min (11:36Z start → 12:10:07+03:00 last commit)
- **Tasks:** 2, both autonomous, no checkpoints
- **Files:** 6 created, 2 modified
- **Commits:** 4 code + 1 metadata

## Task Commits

1. **Task 1: members and roles surface** — `385e531` (feat)
2. **Task 2: aggregate-only statistics surface** — `2c8f705` (feat)
3. **Post-decision row flash** — `0c0535a` (feat) — see Deviations
4. **Layout locale narrowing** — `1bd7134` (fix) — cross-plan, see Deviations

All four audited with `git show --stat`; each contains only the files named in its message. 05-09, 05-12 and 05-13 committed into this working tree between mine — `2c8f705` sits between two of 05-12's — and every commit used the path-scoped `git commit -m "…" -- <paths>` form. At the time of the final commit, `apps/web/src/app/[locale]/space-admin/[spaceId]/page.tsx` and the shell layout both carried a sibling's uncommitted edits; neither was staged.

## The suppression semantics, and where they live

The whole of Surface 4 turns on three statuses meaning three different things, so the renderer has three branches and no shared fallback:

| status | renders | the claim being made |
| --- | --- | --- |
| `available` | the number, Heebo 900 at `--text-3xl`, tabular figures | a measurement. `0` means measured zero |
| `suppressed` | `<5` in mono, plus `מוסתר — קבוצה קטנה מדי` | "fewer than five people" |
| `unavailable` | an em dash in mono, plus `הנתון לא זמין` | "we are not telling you this" |

Three things about that table are load-bearing and easy to undo by accident:

**A withheld figure is never printed as `<5`.** `<5` is a bound. Re-asserting it for a figure the server declined to publish would hand back exactly what 05-07's participation-rate fix withheld.

**A suppressed figure is never printed as an em dash.** It is real information the admin is entitled to, and flattening it loses the distinction between a small bucket and a broken one.

**The rate card gets no special case.** 05-07 marks `participationRate` `unavailable` rather than `suppressed` precisely because `<5` on a percentage asserts "under five percent" — a different and possibly false claim. It was tempting to defend that with a guard here that maps a suppressed rate to the withheld rendering. That guard is deliberately absent: it would be a branch for a state the shipped SQL cannot produce, it would blur the one distinction this surface exists to keep crisp, and it would put the fix in the wrong layer. The reasoning is recorded in the file's header comment instead, naming the SQL and the mapping as the place to fix it if that state ever becomes reachable.

**The zero-row case.** `space_admin_metrics` returns no row for a space it cannot resolve, and `get-metrics.ts` already folds that into four withheld figures rather than a row of zeroes. This surface guards it a second time anyway: `metric ?? WITHHELD`, where `WITHHELD` is `{ value: null, status: 'unavailable' }`. `grep -c "?? 0"` returns `0`; no code path here can produce a zero that was not measured.

## Members: the two absences that carry SPACE-06

**A suspended member offers reinstatement and nothing else.** The row renders the inverted-ink `מושעה/ית` chip and `ביטול השעיה`; `ניהול הרשאות` and `השעיה במרחב` are both absent from that branch. Not disabled — absent, per Rule A. Changing the capabilities of someone who cannot act writes audit rows nobody can interpret later.

**A capability control the admin does not hold is not rendered.** `ניהול הרשאות` needs `grant.create` or `grant.revoke`; the suspend and reinstate triggers need `member.suspend`; inside the panel, `הענקת הרשאה` needs `grant.create` and `שלילת הרשאה` needs `grant.revoke`, evaluated per row of the manifest. The nav does the same at surface granularity.

**Reinstatement copy is narrow on purpose.** `אותן הרשאות שהיו לפני ההשעיה` is literally true of 05-06's implementation — the lift restores only the grants that suspension itself took, matched on the suspension's own timestamp — and the dialog carries a comment saying so, so nobody later "clarifies" it into a broader promise the server does not keep.

Suspension is `kind="audited"` with the history-preserved consequence line. `grep -c "irreversible"` over `MembersClient.tsx` returns `0`, comments included.

## Privacy, concretely

`grep -icE "email|phone|idNumber|dateOfBirth|firstName|lastName"` over `MembersClient.tsx` returns `0`, and `grep -rnE "email|phone|idNumber|dateOfBirth"` over the whole `space-admin` app directory returns nothing.

The surface renders four of `SpaceMember`'s eight fields: `displayName`, `joinedAt`, `suspended`, `capabilities` — plus `id`, in the row disclosure, as the identifier the search placeholder `…שם או מזהה` promises. **`verificationStatus` and `identityVerified` are read from the contract and deliberately rendered nowhere.** The five columns are the contract, neither field is among them, and 05-06 narrowed `identity_verified_at` to a boolean specifically because a verification fact points at the document that produced it. Putting that flag on the surface whose standfirst promises those documents are unreachable would be the wrong instinct even though the field is allow-listed. `municipality` is likewise unrendered — every member of a space shares it.

Capability identifiers never reach the screen. The cell shows a count; the labels appear in the row disclosure and in the management panel, always through `CAPABILITY_LABELS_HE`.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — Blocking] The shell layout failed Next's generated route validator, breaking `tsc --noEmit` repo-wide**

- **Found during:** final verification, after Task 2.
- **Issue:** `apps/web/src/app/[locale]/space-admin/[spaceId]/layout.tsx` declares `params: Promise<{ locale: Locale; spaceId: string }>`. Next generates `.next/types/validator.ts` and constrains every layout to `LayoutConfig<Route>`, whose `params` come from the route segments as plain strings — so the narrowed signature fails with `TS2344: Type 'string' is not assignable to type 'Locale'`. Pages are exempt: `AppPageConfig` intersects its props with `any`, which is why this plan's two pages (and 05-12's) declare `Locale` and pass. The defect has existed since 05-11 landed the layout; it only became observable when `.next/types` was regenerated at 12:07, after this plan's routes appeared in the manifest. It fails `pnpm typecheck` and would fail `next build`.
- **Fix:** the pattern already used by `src/app/[locale]/layout.tsx` — take the segment as `string`, narrow once in the body. Eight lines of comment explain why a layout and a page differ here.
- **Why fixed rather than deferred:** it blocked this plan's own acceptance criterion (`typecheck` exits 0) and the phase gate for everyone downstream, and `layout.tsx` is declared by no wave-4 or wave-5 plan — 05-11 is complete.
- **Files modified:** `apps/web/src/app/[locale]/space-admin/[spaceId]/layout.tsx` (one file, alone in its commit)
- **Commit:** `1bd7134`
- **Note:** a sibling has since edited the same file further, adding an `i18n`-backed `notFound()` locale guard on top of this change. That is a strict improvement and was left alone.

### The plan was wrong about a file's current state, and so was I

**`PressTable` does have a per-row hook.** This plan was written, and its execution begun, against a `PressTable` with no way to reach a body `<tr>` — which made Interaction Contract 2's "1200ms `--np-paper-2` flash on the affected row" unimplementable from a surface. It was on its way into `deferred-items.md` as such. **05-13 committed `rowClassName` at 11:58**, twenty minutes into this execution and two minutes before this plan's first commit, explicitly "for the post-decision row flash". The flash is therefore implemented (`0c0535a`) rather than deferred, and the deferred entry was rewritten to record the two non-obvious traps instead:

1. the flash must target `> th, > td`, because `PressTable` paints cell backgrounds and a `<tr>` background never shows through;
2. the `prefers-reduced-motion` opt-out needs matching specificity — a `.surface *` wildcard at `(0,1,0)` silently loses to `.flashRow > td` at `(0,1,1)`.

A keyframed background needs no specificity contest against the table's static declarations, because animations win from a higher cascade origin. That is the part worth copying rather than rediscovering.

### Criteria met differently than written

**`EmptyPanel` is not rendered on the statistics surface.** The plan's States sentence lists it with no trigger condition, and neither the verify block nor the acceptance criteria mention it. There is no reachable empty *response*: 05-07 answers a missing row with four `unavailable` figures and a 200, so the only "nothing here" state is four em dashes. Swapping in `אין עדיין מספיק נתונים / המספרים יופיעו כאן אחרי ההצבעות הראשונות במרחב` would attribute the absence to "no votes yet" when the actual cause is an unresolvable space — a fabricated explanation, which is the specific failure D13 exists to prevent. The four withheld cards say the true thing.

**`TallyBar` is not used.** The plan says "if bars are used"; none are. Four figures need no chart, and a bar is one more element that could acquire a hover state on a surface whose contract forbids exactly that.

**The members surface has no `pagination`.** `PressTable`'s pagination block always renders both controls, and on a surface with one page they would be two disabled buttons — which Rule B's exhaustive list does not admit. The `{n} חברים במרחב` total is rendered as its own line instead. The read is capped at the repository's page maximum; a members surface that outgrows one page will need real cursor controls, which nothing in this phase provides.

**A sixth file was created.** `stats/StatsFallback.tsx`, beyond the two declared for Task 2. `NoPermissionPanel` requires an `onEscalate` callback and `ErrorPanel`'s retry needs a router, so both need a client boundary — and `stats/page.tsx` must stay a Server Component to call the use-case. The file is local to the statistics route and collides with no other plan's territory. Everything else about the surface is server-rendered, which is what keeps the "nothing is interactive" property structural.

**Two invented Hebrew strings, and one invented heading.** The copy deck is exhaustive for what it covers and silent on three things this surface needs:

| Where | String | Why it is not in the deck |
| --- | --- | --- |
| Dialog error row | `הפעולה לא בוצעה ולא נרשמה ביומן. נסו שוב; אם זה חוזר — פנו למנהל־על.` | the deck's error sentence is about a failed *load* |
| Escalation error row | `הפנייה לא נשלחה. נסו שוב; אם זה חוזר — פנו למנהל־על בדרך אחרת.` | same |
| Capability panel | heading `ניהול הרשאות — {name}`, select label `תפקיד`, placeholder `…בחרו תפקיד`, note `התפקיד כולל את ההרשאות הבאות. כל הרשאה מוענקת בנפרד ובאישור נפרד.`, close `סגירה` | the deck names the row action but not the panel it opens |

All are written in the deck's voice and reuse its vocabulary (`הרשאה`, `מנהל־על`). They are flagged here because the spec calls itself prescriptive; a spec amendment can overwrite any of them without touching logic.

### Deliberate departures

**`getSpaceOverview` is called by both pages, for the shell.** Neither surface can render its header, its nav, or the members table caption without the space name and the viewer's capability set, and the only app-layer path to those is `getSpaceOverview` — `findSpaceSummaryByMembership` is a repository function, and importing it would break this plan's own criterion that the page reaches nothing under `@/server/infra/*`. The cost is the proposal-queue count and the five-row queue read that the overview performs and these two surfaces discard: two wasted queries per page load. A `getSpaceShell` use-case returning just `SpaceSummary` would remove it; that is a server-layer change no wave-4 plan owns.

**The capability editor is a panel below the table, not a row expansion.** The plan says `ניהול הרשאות` "opens a grant editor"; it does not say where. The row's one `<tr>` expansion is already spoken for by the responsive contract — below 768px it is how the joined date and the capability count stay reachable — and putting a second thing there would mean two triggers driving one expansion. The panel is a `<section>` with an `h3`, and the row trigger carries `aria-expanded`/`aria-controls` pointing at it.

**A role preset never batch-applies.** The plan requires both "a role-preset picker that shows the expanded capability list before applying" and "each grant is its own `ConfirmDialog`", and the grant copy names one capability in the singular. Those reconcile in one way: selecting a preset reveals its expanded list and stamps `grantedViaRole` on subsequent grants, and the admin then grants each missing capability through its own confirmation. Applying `space_admin` therefore costs eleven dialogs. That is tedious and it is what the plan's own rule requires; a batch path would need a plural copy triple the deck does not have.

**Search uses the URL, debounced at 300ms.** Filter state in the query keeps the view linkable and back-button-correct as the spec requires. `router.replace` inside a transition drives `PressTable`'s skeleton rows while the server re-reads.

**`optional()` was not reused, extracted, or copied.** Neither surface folds a per-widget `FORBIDDEN`: members and metrics are each gated on a single capability, so a denial is the whole surface's `NoPermissionPanel`, not an absent widget. Nothing to share.

**Three duplications logged, not extracted.** The surface→capability nav map and the `spaces.type` Hebrew labels are byte-identical in both pages, and the escalation `ConfirmDialog` is inlined in both `MembersClient` and `StatsFallback` — a third copy of what 05-12 has since landed as `components/space-admin/EscalationDialog.tsx`. 05-12 was mid-flight and its component was uncommitted when this plan needed it; importing an uncommitted sibling's component is how a surface breaks on a rename. Deferred item 9 names all of it for 05-15.

---

**Total deviations:** 1 auto-fixed (Rule 3, cross-plan), 1 plan-state correction, 5 criteria met differently, 6 deliberate departures.
**Impact:** no interface changed. The layout fix is the only edit outside this plan's territory.

## Verification Results

- `pnpm typecheck` (root, all eight tasks) — **exit 0, repo-wide clean**, re-run after the layout fix
- `npx next lint --dir "src/app/[locale]/space-admin"` — **no warnings or errors** (covers 05-12's overview page as well as these two surfaces)

Task 1:

- `grep -c "getSpaceMembers" members/page.tsx` → `4`; the repository read's name → `0`
- `grep -rnE "from '@/(lib/supabase|server/infra)" members/` → nothing
- `grep -c "מסמכי זהות אינם נגישים מלוח זה" members/page.tsx` → `1`, in a rendered `<p>`
- `grep -icE "email|phone|idNumber|dateOfBirth|firstName|lastName" MembersClient.tsx` → `0`
- `grep -c "irreversible" MembersClient.tsx` → `0`
- All four confirmation triples, all four announcements, all five column headers, both chips, both empty states and the table caption verified present **verbatim** by a 35-string `grep -F` sweep
- `page.module.css`: no hex, and the only `px` is `@media (min-width: 768px)`

Task 2:

- `grep -c "מוסתר — קבוצה קטנה מדי" stats/page.tsx` → `1`; `grep -Fc "<5"` → `4`
- `grep -c "?? 0" stats/page.tsx` → `0`
- `grep -nE "<a |<button|<Link|onClick" stats/page.tsx` → nothing
- `grep -nE "statCard[^{]*:hover" stats/page.module.css` → nothing; `cursor: default` present
- Four card labels, the standfirst, both status notes and the footer note verified verbatim
- `page.module.css`: no hex; the only `px` are the two breakpoints; `tabular-nums` on both figure classes

Phase-wide:

- `grep -rnE "email|phone|idNumber|dateOfBirth" apps/web/src/app/[locale]/space-admin` → nothing

Deliberately **not** run: the full test suite, `next build`, `prettier --check`. Three siblings are live in this tree; the phase's one full-suite run is 05-16's.

## Unverified claims

Stated plainly, because none of this has met a browser or a database:

- **No page here has been rendered.** Both surfaces typecheck and lint; neither has been loaded. The RTL layout, the responsive column reduction at 768px, the 2×2-then-four card grid, the row flash, and the LTR isolation of `<5` are all reviewed, not seen. Screenshots 5–8 remain outstanding — they are 05-16's.
- **No request from these surfaces has reached a route.** The five fetches (`POST`/`DELETE` on `grants`, `POST`/`DELETE` on `members/suspension`, `POST` on `escalations`) were written against the shipped route files and the contract schemas, and the bodies match field for field on inspection. They have not been executed. 05-06 lists four runtime-only behaviours behind those endpoints that are still unproven, including whether `.select()` after an `UPDATE` returns the affected rows — if it does not, every conflict this UI can provoke silently succeeds.
- **`space_admin_metrics` has never run.** 05-07's `WHERE EXISTS (SELECT 1 FROM s)` guard is the reason a nonexistent space yields no row rather than a row of zeroes, and it is unexecuted. This surface handles the no-row case as withheld at two layers, so a guard failure would show up as fabricated zeroes from the database, not from here.
- **The error taxonomy is flattened in the UI.** A 409 (already in that state) and a 500 both render the same `הפעולה לא בוצעה` line. The endpoints distinguish them; this surface does not. No copy exists for the conflict case and inventing a fourth string felt worse than one honest generic one — but an admin who suspends an already-suspended member gets a vaguer answer than the server gave.
- **Contrast was reasoned from the spec's measured table, not re-measured.** Every colour here is a token used in the pairing the table sanctions: `--np-ink-faint` on paper and paper-box, `--np-red-ink` only through the shared kicker module, `--np-red-dark` only as an `ink` hover fill, and no `outline` control given a red fill anywhere.

## Next Phase Readiness

**Ready for 05-15 and 05-16.**

For **05-15**: `deferred-items.md` gained two entries. Item 8 is the row-flash keyframe, with the two traps written down and a working implementation in `members/page.module.css` to copy. Item 9 lists the three duplications to fold — the nav capability map, the space-type labels, and the two inline escalation dialogs now that `EscalationDialog` exists.

For **05-16**: the layout fix in `1bd7134` is the only edit this plan made outside its own territory; it is one file, alone in its commit, and trivially reviewable. Screenshots 5–8 need a space with at least three members including one suspended, and a space small enough to produce a suppressed bucket — the second is the harder fixture and it needs the metrics migration applied first.

Nothing here changes `STATE.md`'s blocker list. `requirements mark-complete` was **not** run.

## Self-Check: PASSED

All six created files verified present on disk. Both modified files verified present. All four commits (`385e531`, `2c8f705`, `0c0535a`, `1bd7134`) resolve in `git log`, and `git show --stat` on each shows only the files its message names — no sibling's file appears in any of them. `git status --short` shows no untracked file belonging to this plan.

The claims deliberately **not** verified are the five listed under Unverified Claims. Nothing in this document asserts that any of them was executed.

---
*Phase: 05-space-governance-substrate-and-space-admin-operations-dashboard*
*Completed: 2026-08-03*
