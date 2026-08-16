---
phase: 05-space-governance-substrate-and-space-admin-operations-dashboard
plan: 11
subsystem: ui
tags: [react, nextjs, css-modules, radix, alert-dialog, rtl, a11y, wcag, press-tokens]

# Dependency graph
requires:
  - phase: 05-02
    provides: capability vocabulary and the shared space-admin contract surface (consumed by the surface plans, not by these presentational primitives)
provides:
  - "np-native route shell at /[locale]/space-admin/[spaceId] (Masthead + main + Colophon), documented as NOT the authorization boundary"
  - "SpaceAdminHeader — kicker, h1, mono edition meta, SUSPENDED ink banner"
  - "SpaceAdminNav — six routed links with honest ARIA and per-capability link absence"
  - "PressTable — RTL data-table contract with semantics preserved at every width"
  - "StatusChip — three AA-compliant appearances"
  - "ConfirmDialog — Radix AlertDialog with a compiler-enforced consequence line and a required reason"
  - "EmptyPanel / ErrorPanel / NoPermissionPanel — the three non-happy-path panels"
  - "The phase disabled-state contract, authored :disabled-qualified, exported as confirmButtonClass"
  - "kicker.module.css — the AA-compliant phase-local kicker for both paper and ink backgrounds"
affects: [05-12, 05-13, 05-14, 05-15, 05-16]

# Tech tracking
tech-stack:
  added: ["@radix-ui/react-alert-dialog@^1.1.15"]
  patterns:
    - "Radix for behaviour, press CSS-Module tokens for paint (the Masthead precedent)"
    - "Specificity-qualified overrides of a shared component through its className prop"
    - "Responsive table reduction by paired data-col display:none, never display:block on a cell"
    - "Layouts render chrome only; identity and authorization resolve per page"

key-files:
  created:
    - apps/web/src/app/[locale]/space-admin/[spaceId]/layout.tsx
    - apps/web/src/app/[locale]/space-admin/[spaceId]/layout.module.css
    - apps/web/src/components/space-admin/index.ts
    - apps/web/src/components/space-admin/kicker.module.css
    - apps/web/src/components/space-admin/SpaceAdminHeader.tsx
    - apps/web/src/components/space-admin/SpaceAdminNav.tsx
    - apps/web/src/components/space-admin/PressTable.tsx
    - apps/web/src/components/space-admin/StatusChip.tsx
    - apps/web/src/components/space-admin/Panels.tsx
    - apps/web/src/components/space-admin/ConfirmDialog.tsx
  modified:
    - apps/web/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Nav active state is an explicit `active` prop rather than usePathname(), keeping SpaceAdminNav a Server Component"
  - "PressTable expansion is controlled when renderExpansion is supplied and uncontrolled otherwise, so there is exactly one <tr> expansion per row at every width"
  - "ConfirmDialog's confirm is a plain button, not AlertDialog.Action, because Action closes the dialog and a failed request must keep the typed reason"
  - "Backdrop cancel is wired on AlertDialog.Overlay because AlertDialog hard-codes preventDefault on outside pointer events"
  - "NoPermissionPanel.onEscalate is a required prop, so SPACE-09's escalation path cannot ship as a decorative button"
  - "PressTable repeats the four disabled declarations locally for its pagination controls rather than importing ConfirmDialog's module, keeping each task's commit independently valid"
  - "index.ts additionally exports confirmButtonClass — the disabled contract must reach the dispatch send button, which lives in another plan"

patterns-established:
  - "Disabled contract: .x:disabled (0,2,0) and .x:disabled:hover (0,2,1), paper-2 fill, ink-faint text, not-allowed, no dimming"
  - "Dense ink hover override to --np-red-dark; outline is never given a red fill at rest or on hover"
  - "Phase-local kicker: --np-red-ink text on paper, --np-paper text on ink, red only on the aria-hidden tick"
  - "Latin identifiers render dir=ltr with unicode-bidi: isolate and overflow-wrap: anywhere"
  - "Every new CSS module ends with a prefers-reduced-motion block"

requirements-completed: [SPACE-10]

# Metrics
duration: 870min wall clock (~50min active; a mid-run network failure and a restart account for the gap)
completed: 2026-08-03
---

# Phase 05 Plan 11: Space-Admin Shell and Presentational Primitives Summary

**One np-native route shell plus eight token-only components — including an RTL table that keeps `<th scope="row">` at every width and a Radix confirmation whose disabled button is authored `:disabled`-qualified so it actually disables.**

## Performance

- **Duration:** 870 min wall clock (~50 min active)
- **Started:** 2026-08-02T16:18:14Z
- **Completed:** 2026-08-03T06:50:00Z
- **Tasks:** 3
- **Files modified:** 19 (17 planned + 2 comment-hygiene touch-ups)

## Accomplishments

- The dashboard has a locale-correct `np-page` shell that composes `Masthead`, `main` and `Colophon` with no top offset and no reference to the undefined masthead-height property.
- `PressTable` is one implementation serving three column sets, and it never trades table semantics for responsiveness: hidden columns are a paired `display: none` on `th[data-col]` + `td[data-col]`, and the values stay reachable through a single `<tr>` disclosure.
- The two genuinely subtle pieces landed in one reviewable place — the `:disabled`-qualified override at (0,2,0)/(0,2,1), and the dense-`ink` hover fix to `--np-red-dark` that leaves the already-compliant `outline` variant alone.
- Every red string in the phase is now AA-compliant per background: `--np-red-ink` on paper, `--np-paper` on ink, `--np-red` only on `aria-hidden` tick glyphs.
- The barrel is written and closed, so plans 05-12 through 05-15 compose rather than invent, and cannot collide on it.

## Task Commits

1. **Task 1: Radix dependency, shell, header, nav, local kicker** — `5979545`, which is labelled `fix(05-03)`. See "Issues Encountered": a sibling executor committed the shared index while this plan's commit was in flight. The files are correct and are on the branch; only the attribution is wrong.
2. **Task 2: PressTable, StatusChip, the three panels** — `ac5bb89` (feat)
3. **Task 3: ConfirmDialog, disabled contract, barrel** — `e446b42` (feat)

**Follow-up:** `83b59c0` (chore: keep the banned-token greps literal-clean)

## Component API — what the surface plans consume

Import the eight from `@/components/space-admin`. Import anything you add yourself by direct path; **do not reopen the barrel.**

### `SpaceAdminHeader`

```ts
{ spaceName: string; spaceTypeLabel: string; slug: string; spaceId: string;
  date?: Date; suspended?: boolean; className?: string }
```

Renders the kicker, the `h1`, the mono edition-meta line, and — when `suspended` — the ink SUSPENDED banner with its full Hebrew body. `spaceId` is sliced to eight characters for display; the full value is the `title`. **Rendered by each page, never by the layout.**

### `SpaceAdminNav`

```ts
type SpaceAdminNavHref = '' | 'proposals' | 'members' | 'stats' | 'dispatch' | 'audit';
{ spaceId: string; active: SpaceAdminNavHref;
  visibleHrefs?: readonly SpaceAdminNavHref[]; locale?: Locale; className?: string }
```

`active` gets `aria-current="page"`. `visibleHrefs` filters: a surface the admin lacks the capability for is **not rendered** (Rule A). Omit it to show all six. `SPACE_ADMIN_NAV_ITEMS` is exported if you need the label list. Returns `null` when nothing is visible.

### `PressTable<Row>`

```ts
interface PressTableColumn<Row> {
  key: string;                       // emitted as data-col on the th/td pair
  header: React.ReactNode;
  cell: (row: Row) => React.ReactNode;
  primary?: boolean;                 // rendered as <th scope="row">; defaults to columns[0]
  secondary?: boolean;               // hidden below 768px, reachable via the disclosure
  omitFromDetails?: boolean;         // keep out of the disclosure list (actions columns)
}

interface PressTablePagination {
  onOlder?: () => void; onNewer?: () => void;
  olderDisabled?: boolean; newerDisabled?: boolean;
  olderHint?: string; newerHint?: string;   // Rule B visible unblock text
  meta?: React.ReactNode;                   // `מוצגות {n} רשומות` / `{n} חברים במרחב`
}

{ columns; rows; rowKey: (row) => string; description: string;
  loading?: boolean; skeletonRows?: number;             // default 5
  renderExpansion?: (row) => React.ReactNode;
  expandedKey?: string | null; onExpandedKeyChange?: (key: string | null) => void;
  pagination?: PressTablePagination; className?: string }
```

- `description` is the SR-only `<caption>` — use the UI-SPEC caption deck verbatim.
- Supply `renderExpansion` **and** the controlled `expandedKey`/`onExpandedKeyChange` pair when you own the trigger (05-13's title-cell button). The built-in `הצג פרטים ▾` disclosure is then not rendered, so there is never a second expansion.
- Omit both and the table drives its own mobile-only disclosure over the `secondary` columns.
- `loading` renders the skeleton, sets `aria-busy`, and announces `…טוען` through a polite live region. Do not add a spinner alongside.
- The scroll region takes `role="region"`, its caption label and `tabIndex={0}` **only while it actually overflows** (`ResizeObserver`), and the `החליקו לצדדים…` hint appears on the same condition.
- Helpers exported alongside: `<ShortId value>` (eight chars, `dir="ltr"`, full value in `title`) and `<ClampedText lines={1|2}>`.
- Pagination buttons already carry the disabled contract; pass the hint strings.

### `StatusChip`

```ts
{ tone?: 'review' | 'suspended' | 'neutral'; children: React.ReactNode; className?: string }
```

`review` = `בבדיקה` only (red-ink text + red hairline). `suspended` = `מושעה/ית` (inverted ink). `neutral` = everything else. There is no red fill.

### `ConfirmDialog`

```ts
// Discriminated union — the compiler requires `consequence` on irreversible.
| { kind: 'audited';       consequence?: string; ...base }
| { kind: 'irreversible';  consequence:  string; ...base }

base = {
  open: boolean; onOpenChange: (open: boolean) => void;
  heading: string; body: string; confirmLabel: string;   // the action verb, never אישור
  reasonLabel?: string;    // default 'נימוק ההחלטה (חובה)'
  reasonError?: string;    // default 'נדרש נימוק — לפחות 10 תווים.'
  unblockHint?: string;    // default 'הנימוק נדרש כדי להמשיך.'
  placeholder?: string; cancelLabel?: string;            // default 'ביטול'
  pending?: boolean; pendingLabel?: string;              // default '…שולח'
  error?: string | null;
  onConfirm: (reason: string) => void;                   // receives the TRIMMED reason
}
```

- `irreversible` is exactly three actions phase-wide: **approve, reject, send.** The test is whether the admin can undo the effect from this dashboard. It is written in the component docblock so nobody re-labels suspension later.
- Initial focus is the reason textarea. Reason is trimmed 10–500, live `{n}/500` counter, no truncation on paste.
- The dialog does **not** close itself on confirm. The caller closes it on success and leaves it open on failure, passing `error` — the typed reason is preserved either way.
- Escape and a backdrop click both cancel (both suppressed while `pending`).
- Escalation reuses this with `kind="audited"`, overriding `reasonLabel`, `reasonError` and `unblockHint` per the UI-SPEC escalation table.
- `REASON_MIN_LENGTH` / `REASON_MAX_LENGTH` are exported for server-side parity.

### `EmptyPanel` / `ErrorPanel` / `NoPermissionPanel`

```ts
EmptyPanel        { heading: string; body: string; kicker?: ReactNode; action?: ReactNode; className? }
ErrorPanel        { onRetry?: () => void; body?: string; retryLabel?: string; className? }   // role="alert"
NoPermissionPanel { onEscalate: () => void; className? }                                     // onEscalate REQUIRED
```

`ErrorPanel`'s default body is the generic copy; pass `body` for the audit surface's own sentence. `NoPermissionPanel` ships its heading, body, CTA and the mono server-check note verbatim.

### `confirmButtonClass`

Pass through `NewsButton`'s `className` on `variant="ink"` controls that can be `disabled` — the dispatch send button, and any pagination outside `PressTable`. **Never on `variant="outline"`.**

## Files Created/Modified

- `apps/web/src/app/[locale]/space-admin/[spaceId]/layout.tsx` — chrome-only shell; carries the comment explaining why it is not the authorization boundary
- `apps/web/src/app/[locale]/space-admin/[spaceId]/layout.module.css` — `main` padding and the single `--np-container` / `--np-gutter` wrapper
- `apps/web/src/components/space-admin/kicker.module.css` — `.kicker`, `.tick`, `.kickerOnInk`
- `apps/web/src/components/space-admin/SpaceAdminHeader.{tsx,module.css}` — page masthead + suspension banner
- `apps/web/src/components/space-admin/SpaceAdminNav.{tsx,module.css}` — six links, Segmented look, no Segmented ARIA
- `apps/web/src/components/space-admin/PressTable.{tsx,module.css}` — the data-table contract, `ShortId`, `ClampedText`
- `apps/web/src/components/space-admin/StatusChip.{tsx,module.css}` — three appearances
- `apps/web/src/components/space-admin/Panels.{tsx,module.css}` — the three non-happy-path panels
- `apps/web/src/components/space-admin/ConfirmDialog.{tsx,module.css}` — confirmation + the canonical disabled contract
- `apps/web/src/components/space-admin/index.ts` — closed barrel
- `apps/web/package.json`, `pnpm-lock.yaml` — `@radix-ui/react-alert-dialog@^1.1.15`

## Decisions Made

- **Nav active state is a prop, not `usePathname()`.** Keeps `SpaceAdminNav` a Server Component and makes each page state its own identity explicitly.
- **`PressTable` expansion is dual-mode.** Controlled with `renderExpansion` (05-13 owns the trigger), uncontrolled otherwise. This is what guarantees "exactly one `<tr>` expansion per row at every width" without 05-13 having to suppress a second mechanism.
- **The confirm button is not `AlertDialog.Action`.** Action closes on click; the failure contract requires the dialog to stay open with the reason intact.
- **Backdrop cancel lives on the Overlay.** Radix `AlertDialog` hard-codes `preventDefault` on `onPointerDownOutside` / `onInteractOutside` and does not compose caller handlers, so an `onClick` on the overlay is the only reliable route to the spec's "backdrop click cancels".
- **`NoPermissionPanel.onEscalate` is required.** SPACE-09 says the escalation must be a real path; an optional handler invites a dead button on the one control that must work for an admin holding nothing.
- **The generic row disclosure underlines in ink, not red.** The UI-SPEC's red-underline hover belongs to the audit reason disclosure specifically; keeping `--np-red` in this module to focus outlines only also keeps the plan's own red-usage gate mechanically checkable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `PressTable` pagination needed the disabled contract before `ConfirmDialog` existed**
- **Found during:** Task 2
- **Issue:** The plan puts the canonical disabled contract in `ConfirmDialog.module.css` (Task 3) but also makes the pagination controls one of the six permitted `disabled` states — and those ship in Task 2. Importing a Task-3 module from Task 2 would have made Task 2's commit non-compiling in isolation.
- **Fix:** `PressTable.module.css` repeats the four declarations as `.pageBtn:disabled` / `.pageBtn:disabled:hover`, correctly `:disabled`-qualified, with a comment naming `ConfirmDialog.module.css` as canonical.
- **Files modified:** `apps/web/src/components/space-admin/PressTable.module.css`
- **Verification:** Both selectors present at (0,2,0)/(0,2,1); no dimming; typecheck and lint green.
- **Committed in:** `ac5bb89`

**2. [Rule 1 — Bug] The plan's own mechanical gates failed on prose comments**
- **Found during:** Task 2 and post-task verification
- **Issue:** The acceptance greps match bare substrings. Comments that *explained* the bans (`11.1px`, `13.3px`, `768px`, `1px`, `var(--header-height)`, `.np-block-red`) made `grep -rc "header-height"` return non-zero and the pixel-literal grep return four hits, against code that uses none of them.
- **Fix:** Reworded six comments to name the tokens descriptively instead of literally. No declaration changed.
- **Files modified:** `kicker.module.css`, `StatusChip.module.css`, `SpaceAdminNav.module.css`, `PressTable.module.css`, `ConfirmDialog.module.css`, `layout.tsx`, `layout.module.css`
- **Verification:** All five plan-level greps now return empty.
- **Committed in:** `ac5bb89` and `83b59c0`

**3. [Rule 2 — Missing Critical] `kicker.module.css` had no reduced-motion block**
- **Found during:** Task 2
- **Issue:** "Every new module ends with a `prefers-reduced-motion` block" is a blanket rule the spec calls non-regressing; the kicker module was the one exception.
- **Fix:** Added the block.
- **Committed in:** `ac5bb89`

### Additions beyond the literal file list

- **`unblockHint` prop on `ConfirmDialog`.** Rule B requires visible unblock text on every disabled control, and the escalation dialog overrides it to `התיאור נדרש כדי להמשיך.`. Without the prop that override was unreachable.
- **`ShortId` and `ClampedText` exported from `PressTable.tsx`.** The plan specifies both treatments as table behaviour; exporting them stops five surface plans from re-implementing the `dir="ltr"` / `unicode-bidi: isolate` detail five different ways.
- **`confirmButtonClass` exported from the barrel.** Required by Task 3's action text; the acceptance line "and nothing else" is read as "no other *components*".

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 bug, 1 missing critical) + 3 declared API additions
**Impact on plan:** No scope creep. Every addition serves a contract the plan or the UI-SPEC already states; nothing was invented.

## Issues Encountered

- **A sibling executor absorbed Task 1's commit.** Plans 05-03, 05-04 and 05-11 share one working directory and therefore one git index. Between this plan's `git add` and its `git commit`, plan 05-03's executor committed the whole index, so commit `5979545` ("fix(05-03): apply the public status allow-list…") carries all seven of Task 1's files plus 05-04's `package.json` and `pnpm-lock.yaml` additions. **Nothing was lost and no file is wrong — only the attribution.** History was deliberately not rewritten while two agents were actively committing. Tasks 2 and 3 used path-scoped `git commit -- <paths>` and landed clean.

  Task 1's files inside `5979545`, for the record:
  `apps/web/package.json` (the `@radix-ui/react-alert-dialog` line only), `kicker.module.css`, `SpaceAdminHeader.{tsx,module.css}`, `SpaceAdminNav.{tsx,module.css}`, `layout.{tsx,module.css}`. The rest of that commit — `db.ts`, the `server-only` dependency, and the lockfile — belongs to 05-03 and 05-04.

- **A sibling `git reset HEAD~1` destroyed an empty marker commit.** An earlier `chore(05-11)` commit recording the attribution above was created, then orphaned when another executor reset the shared branch (visible at `git reflog` HEAD@{10}–{11}). It was deliberately not recreated: in a tree where any agent may reset, a commit-hash reference in a summary is less durable than the summary text itself. **This is the sharper hazard of the shared worktree** — the index collision only mislabels work, but a stray `reset` on a shared branch can drop it. No non-empty commit was affected.
- **A mid-run network failure (ENOTFOUND) killed the first attempt** after Task 1's files were written but before they were committed. Work resumed from the on-disk state without rewriting anything.
- **`apps/web/package.json` and `pnpm-lock.yaml` carry two plans' additions.** `@radix-ui/react-alert-dialog` (this plan) and `server-only` (05-04) went in concurrently. Both resolve; neither was reverted.

## Verification

Run from the repo root:

```bash
pnpm --filter @sync/web typecheck   # exits 0
pnpm --filter @sync/web lint        # 0 errors (2 pre-existing warnings in postcss.config.mjs, worker.ts)

grep -rnE "#[0-9a-fA-F]{3,8}\b" apps/web/src/components/space-admin/*.css                        # empty
grep -rnE "[^-a-z(]([0-9]+)px" apps/web/src/components/space-admin/*.css | grep -v "@media"      # empty
grep -rn "header-height\|np-block-red\|components/layout/Header" \
  apps/web/src/components/space-admin "apps/web/src/app/[locale]/space-admin"                    # empty
grep -c "opacity" apps/web/src/components/space-admin/ConfirmDialog.module.css                   # 0
grep -n ":disabled" apps/web/src/components/space-admin/ConfirmDialog.module.css                 # (0,2,0) + (0,2,1)
```

**Not performed:** the plan's manual step — rendering the shell at `/he/space-admin/00000000-…` with a stub page. There is no page under `[spaceId]` yet (05-12 owns the overview), and starting `next dev` in a worktree shared with two live executors risks clobbering `.next`. The shell composes from the same three pieces as `/he/knesset`, which renders today. Logged for 05-12, which will be the first plan able to load the route.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Ready:** 05-12 through 05-15 can compose all eight primitives from `@/components/space-admin` using the API above. 05-13 should drive `PressTable` in controlled-expansion mode with `renderExpansion`.
- **Still to build in this phase:** `CapabilityManifest` (05-12), `AudiencePreview` and `QuotaBlock` (05-14), `ProposalDetailPanel` (05-13). None exists in the repo. Each must be imported by direct path — `apps/web/src/components/space-admin/index.ts` is closed.
- **Carry forward:** `QuotaBlock` is an ink block, so its kicker text must be `--np-paper` with a `--np-red` tick — use `kicker.kickerOnInk`, not `kicker.kicker` (D16).
- **Concern:** SPACE-10 spans six plans and is **not** yet complete. `requirements mark-complete` was deliberately not run.

## Self-Check: PASSED

All 16 source files verified present on disk. All referenced commits verified
on `feat/75-space-admin-dashboard`: `5979545` (Task 1, mislabelled), `ac5bb89`
(Task 2), `e446b42` (Task 3), `83b59c0` (follow-up). One empty marker commit
was found orphaned and the summary was corrected to stop referencing it.

---
*Phase: 05-space-governance-substrate-and-space-admin-operations-dashboard*
*Completed: 2026-08-03*
