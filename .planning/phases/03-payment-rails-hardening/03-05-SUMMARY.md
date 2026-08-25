---
phase: 03-payment-rails-hardening
plan: 05
subsystem: ui
tags: [copy, hebrew, rtl, economics, money-model, source-guard, vitest]

# Dependency graph
requires:
  - phase: 02.1-free-ballot
    provides: free participation, and the `dashboard-free-mvp.test.ts` source-assertion pattern for copy guards
provides:
  - "/economics states the real money model: free participation, ₪50 creation to the platform, civic fund filled by outside BAG purchases"
  - "the unbacked 70/30 revenue split removed from all four components that repeated it"
  - "the unbacked 1% trading-fee rate removed from the revenue table"
  - "a source guard (`economics-fee-split-copy.test.ts`) that fails the suite if any of them returns"
  - "an explicit, test-asserted COIN-04 boundary marking which /economics claims plan 03-13 still owns"
affects: [03-09 closing money-model sweep, 03-13 COIN-04 claim rewording]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "copy guards assert against component SOURCE with a comment stripper, since vitest never collects .tsx"
    - "a gated boundary is asserted POSITIVELY so a later plan must deliberately flip it"

key-files:
  created:
    - apps/web/src/__tests__/services/economics-fee-split-copy.test.ts
  modified:
    - apps/web/src/app/[locale]/economics/components/FAQ.tsx
    - apps/web/src/app/[locale]/economics/components/CTASection.tsx
    - apps/web/src/app/[locale]/economics/components/HowItWorks.tsx
    - apps/web/src/app/[locale]/economics/components/FlywheelDiagram.tsx

key-decisions:
  - "Kept the HowItWorks ink-block callout (the plan's *preferred* branch) and restated it as ₪50, so no CSS-module rule changed"
  - "Restated the flywheel's trading row rather than deleting it, keeping a three-row table against the three real streams"
  - "Restated the external-purchase allocation as a direction ('מזין את קופת הקרן') rather than the hard '100%' guarantee, which has no ledger behind it"
  - "Left the ₪50 creation row and CTA 'חינם' stat byte-identical — they are the model"
  - "Did not touch REQUIREMENTS.md / STATE.md / ROADMAP.md: PAY-08 spans plans 02, 03, 04, 05 and 09, and five executors share this worktree"

patterns-established:
  - "Boundary comment in source (`// COIN-04 …`) plus a positive test assertion, so a gated decision cannot be pre-empted silently"
  - "`it.each` over a component list, so a fifth money-copy component is a one-line addition to the guard"

requirements-completed: [PAY-08]

# Metrics
duration: 21min
completed: 2026-08-04
---

# Phase 03 Plan 05: /economics money-model copy Summary

**The `/economics` page now states only what the ledger can produce — free participation, ₪50 creation to the platform, and a civic fund filled by outside BAG purchases — with the unbacked 70/30 split and 1% trading fee gone from all four components and a 9-test source guard holding them out.**

## Performance

- **Duration:** ~21 min
- **Started:** 2026-08-04T17:10:00Z
- **Completed:** 2026-08-04T17:31:00Z
- **Tasks:** 3 of 3
- **Files modified:** 4 components + 1 new test file

## Accomplishments

- Removed the `70% / 30%` revenue split from every surface on `/economics` that repeated it (FAQ ×2, CTA trust stat, HowItWorks ink block, FlywheelDiagram step + revenue row). **Nothing in the codebase implements it** — re-verified first-hand, see below.
- Removed the `1% על כל עסקה` trading-fee rate, a rate nothing charges.
- Replaced them with the two figures the ledger can actually produce, reusing wording already shipped and approved in `faq/data/faqData.ts:65-67` and `terms/page.tsx:99`.
- Left the page's investment language untouched **on purpose**, marked with a source comment and asserted positively by a test, so the COIN-04 boundary is visible in the diff rather than assumed.

## Premise verification (done before any edit)

The plan's central premise — assumption **A6**, that no code implements a 70/30 split — holds, and is stronger than the plan states:

- `createDefaultFeeShareConfig` (`apps/web/src/services/bags/index.ts:326`) splits **10 / 10 / 80** (platform / creator / municipality), not 70/30. Its only caller is `services/treasury/bagSeeding.ts:123`.
- `app/api/payments/webhook/route.ts` calls `recordTreasuryDeposit({ amountAgorot: payment.amount, … })` — the **full** amount, never a fraction.
- Repo-wide, no route or ledger applies any 70/30 division.

So the figure was not stale; it was never real.

## Task Commits

1. **Task 1: FAQ and CTA — drop the split percentage** — `67a470e` (fix)
2. **Task 2: HowItWorks and the flywheel — drop the fee-split callout and the 1% trading fee** — `6e6175a` (fix)
3. **Task 3: Guard the economics page against the split claim returning** — content landed in `50befd5`, **a sibling executor's commit** (see Deviation 1). Content is byte-identical to what this plan wrote; `git diff HEAD` on the file is empty.

No separate plan-metadata commit: this SUMMARY is the only remaining artifact and STATE/ROADMAP updates were deliberately left to the orchestrator (see Deviation 4).

## Copy changed — every string, before → after

**`FAQ.tsx` — answer to `מה קורה לכסף?`** (all nine `question:` strings are byte-identical; `git diff` shows no question line touched)

- before: `70% זורם ישירות לקרן הקהילתית. 30% מממן את הפלטפורמה. הכל שקוף על הבלוקצ'יין, ואפשר לראות כל עסקה בזמן אמת.`
- after: `ההשתתפות בהצבעות חינם. יצירת הצבעה חדשה עולה ₪50, שמממנים את תפעול הפלטפורמה. הקרן הקהילתית מתמלאת מהשקעות חיצוניות ב-BAG של כל הצבעה, לא מכסף של תושבים, וכל תנועה שלה גלויה.`

**`FAQ.tsx` — answer to `איך הפלטפורמה מרוויחה כסף?`**

- before: `30% מעמלות המסחר ומדמי יצירת הצבעות. אנחנו לא תלויים במשקיעים חיצוניים. המודל הכלכלי מתקיים מעצמו מהיום הראשון.`
- after: `מדמי יצירת הצבעה: ₪50 על כל הצבעה חדשה. אנחנו לא תלויים במשקיעים חיצוניים. המודל הכלכלי מתקיים מעצמו מהיום הראשון.`

**`FAQ.tsx` — new source comment above the first entry**

- added: `// COIN-04 owns this answer's investment wording; it is gated on COIN-01's written legal sign-off and is left verbatim on purpose.`

**`CTASection.tsx` — trust stat**

- before: `{ value: '70%', label: 'לקרן הקהילתית' }`
- after: `{ value: '₪50', label: 'ליצירת הצבעה' }`

**`HowItWorks.tsx` — the ink-block callout** (kept, per the plan's *preferred* branch)

- before: `70%` / `מכל עמלות המסחר זורמים לקרן הקהילתית של הרשות` / `30% מממנים את התחזוקה והפיתוח של הפלטפורמה`
- after: `₪50` / `עלות יצירת הצבעה חדשה, שמממנת את תפעול הפלטפורמה` / `הקרן הקהילתית מתמלאת מהשקעות חיצוניות ב-BAG של ההצבעה, לא מכסף של תושבים`
- JSX comment `{/* Fee split - ink block callout */}` → `{/* Creation fee - ink block callout */}`

**`FlywheelDiagram.tsx` — the `fees` step** (six steps preserved; `icon: 'split'` unchanged)

- before: `title: 'עמלות מחולקות'`, `description: '70% לקרן הרשות, 30% לפלטפורמה'`
- after: `title: 'עמלות לקרן ההצבעה'`, `description: 'עמלות המסחר ב-BAG מיועדות לקרן של אותה הצבעה'`

**`FlywheelDiagram.tsx` — revenue table** (three rows preserved)

- row 2 before: `{ stream: 'עמלות מסחר', source: '1% על כל עסקה', allocation: '70% לקרן · 30% לפלטפורמה' }`
- row 2 after: `{ stream: 'עמלות מסחר', source: 'מסחר ב-BAG של ההצבעה', allocation: 'מיועד לקרן ההצבעה' }`
- row 3 before: `allocation: '100% לקופת הקרן'`
- row 3 after: `allocation: 'מזין את קופת הקרן'`
- row 1 (`₪50 להצבעה חדשה` → `תפעול הפלטפורמה`): **unchanged**, as required.

Every replacement is Hebrew, RTL-correct, and states only: participation is free; creating a vote costs ₪50 and funds the platform; the civic fund is filled by outside BAG purchases, not residents' money; fund movements are visible. No percentage, no rate, no pool size, no expected return, no guarantee.

## Verification

| Check | Result |
|---|---|
| `grep -rnE "70%\|30%" ".../economics/components/"*.tsx` | no matches |
| `grep -c "1% על כל עסקה" FlywheelDiagram.tsx` | `0` |
| `grep -c "id: '" FlywheelDiagram.tsx` | `6` — six flywheel steps survive |
| `grep -c "₪50 להצבעה חדשה" FlywheelDiagram.tsx` | `1` — the true row untouched |
| `grep -c "question: '" FAQ.tsx` | `9`, identical to HEAD; no `question` line in the diff |
| `grep -c "בדיוק כמו במניה" FAQ.tsx` | `1` — COIN-04 line deliberately preserved |
| `grep -c "residentSteps\|supporterSteps" HowItWorks.tsx` | `4`, identical to HEAD |
| `git diff HowItWorks.module.css` | empty — no CSS-module rule changed |
| `pnpm --filter @sync/web test -- …/economics-fee-split-copy.test.ts` | **9 passed** (plan required ≥8) |
| My two commits' file lists | only the four components — `HeroSection.tsx`, `economics/page.tsx`, `Ticker/`, `services/email/` untouched |

**Full-suite / typecheck status at hand-off** (see Deviations 2 and 3 — neither failure is this plan's):

- `pnpm --filter @sync/web typecheck` → **1 error**, `src/components/sections/index.ts(7,35)`: cannot find `./MoneyTransparency`. That directory is deleted by **plan 03-04-T1**; the barrel-export edit is 03-04's to land. Zero errors in any file this plan touched.
- `pnpm --filter @sync/web test` → **73 files, 901 tests, 6 failed**, all six in `src/__tests__/api/payments.test.ts` and all six on `vote_participation` pricing / treasury-accrual cases — precisely the describes **plan 03-02-T3** is contracted to rewrite in place. Baseline at plan start was 71 files / 876 tests / 0 failed; the growth and the failures are both siblings'.

## Deviations from Plan

### 1. [Cross-executor] Task 3's file was swept into a sibling's commit

- **Found during:** Task 3 commit
- **Issue:** Five executors share this worktree and therefore share one git index. Between my `git add` of `economics-fee-split-copy.test.ts` and my `git commit`, plan 03-06's executor committed with a broad add. Commit `50befd5` ("fix(03-06): delete the fabricated creation seal…") contains **three plans' files**: 03-01's `env-contract.test.ts` and `worker.ts`, my `economics-fee-split-copy.test.ts`, and its own two.
- **Fix:** None attempted. The content is committed and byte-identical to what this plan wrote (`git diff HEAD` on the file is empty). Rewriting or reverting to re-attribute it would rewrite shared history under three plans' in-flight work — strictly worse than a mis-attributed commit message.
- **Consequence:** Task 3 has no dedicated commit SHA. `50befd5` is the SHA of record.
- **Recommendation for the orchestrator:** concurrent executors in one worktree need `git commit -- <pathspec>` as the default, not `git add` followed by `git commit`. My Tasks 1 and 2 were safe only because I re-checked `git status --porcelain` immediately before each commit.

### 2. [Out of scope] Tree-wide typecheck is red from a sibling's in-flight work

- **Found during:** Task 1 verification, and still true at hand-off.
- **Issue:** The plan's per-task gate is `pnpm --filter @sync/web typecheck` exits 0. It did not, at any point during execution — but the errors migrated across sibling-owned files as they worked: `api/payments/create/route.ts` → `api/payments/webhook/route.ts` → `payments/return/page.tsx` + `payments.test.ts` → finally `components/sections/index.ts`. Not one error was ever in a file this plan touches.
- **Action:** Not fixed — out of scope per the executor's scope boundary. Verified instead that the error set never intersects this plan's files.

### 3. [Out of scope] Full suite is red from `payments.test.ts`

- Same class as Deviation 2. Six failures, all in plan 03-02's contended file, all on the retired `vote_participation` rail. Left alone; 03-02-T3 owns the rewrite.

### 4. [Deliberate] STATE.md / ROADMAP.md / REQUIREMENTS.md not updated

- PAY-08 spans plans 02, 03, 04, 05 and **09 (the closing sweep)**. Marking it complete here would be false. Concurrently, five executors sharing this worktree would race on those three files. Left to the orchestrator.

### 5. [Minor] Two acceptance criteria as written are unsatisfiable; the intent was met

- `grep -c "question:" FAQ.tsx` returns **10**, not the plan's `9` — because `FAQItem`'s prop type `question: string;` also matches. It returned 10 at HEAD too. The intent (nine FAQ entries, unchanged) is met and is what the guard asserts, via `question: '` = 9.
- Plan verification step 4, `grep -rn "1% על כל עסקה" apps/web/src` → no matches, cannot hold, because Task 3 of the same plan requires the guard to assert `not.toContain('1% על כל עסקה')`. The only remaining match repo-wide is that assertion. No shipped UI copy contains the rate.

### 6. [Minor] Guard is slightly stronger than specified

- The trading-fee test also asserts `not.toContain('1%')`, so a reworded rate (`עמלה של 1%`) is caught too. Within the plan's file, no other plan affected.

### 7. [Riding along] Pre-existing WIP in two of my files

- `HowItWorks.tsx` and `FlywheelDiagram.tsx` already carried an uncommitted em-dash → hyphen normalisation inside JSDoc/JSX comments (part of the 322-file mirrored WIP). Hunk-level staging is not available non-interactively and surgery on a shared index is dangerous, so those comment-only lines rode along in `6e6175a`. Noted in that commit's body. `FAQ.tsx` and `CTASection.tsx` had no pre-existing WIP; `67a470e` is 4 insertions / 3 deletions, exactly this plan's edits.

---

**Total deviations:** 7 — 3 cross-executor/out-of-scope (not fixed, by design), 1 deliberate scope call, 3 minor recorded notes. **No auto-fixes were required.**
**Impact on plan:** None on the deliverable. Every `must_have` truth and artifact holds. No scope creep.

## For plan 03-09 (closing sweep) — false claims found outside this plan's file set

Recorded, **not fixed**, per the file-ownership boundary:

1. **`app/[locale]/treasury/components/TreasuryDashboard.tsx:325-341`** — verified live in this worktree. A `Receipt` computes `formatCurrency(treasury.totalILS * 0.7)` labelled `70% לקרן הרשות` and `formatCurrency(treasury.totalILS * 0.3)` labelled `30% תפעול הפלטפורמה`. This is the same split no code implements, except here it is *arithmetic* presented as a ledger reading, which is worse than prose: it renders a specific shekel figure a user could reconcile against nothing. Already scoped to **03-09-T1**, whose grep (`\* 0\.7|\* 0\.3|70%|30%`) covers it.
2. **The same `Receipt`'s footer: `כל סכום מתועד · חתום בבלוקצ׳יין · ביקורת חשבונאית עצמאית`.** Two unbacked claims that 03-09-T1's grep does **not** catch, so flagging explicitly:
   - `ביקורת חשבונאית עצמאית` ("independent accounting audit") — no audit exists, and nothing in `.planning/` or `apps/web/docs/` schedules one. This is the strongest claim on the page and the one with the clearest exposure.
   - `חתום בבלוקצ׳יין` on a **fiat** treasury ledger — `treasury_transactions` is a Postgres table; the on-chain mirror is a BAG-side artefact, not a seal over these ILS figures. Note `03-CONTEXT.md` defers chain-seal copy generally, but this instance sits inside a *money* receipt, which is squarely PAY-08.
3. **`FAQ.tsx`'s `המודל הכלכלי מתקיים מעצמו מהיום הראשון` / `sustainabilityPoints`' `הפלטפורמה מתקיימת מהיום הראשון`** — kept verbatim because the plan explicitly says to leave `sustainabilityPoints` alone and to change only the `30%` clause. With ₪50 creation fees as the sole revenue line, "self-sustaining from day one" is a forward-looking business claim, not a ledger fact. Worth a decision in the sweep; deliberately not this plan's call.

## Issues Encountered

Concurrency in a shared worktree was the only real friction: a red tree-wide typecheck and suite for the whole execution window, and one commit-attribution loss. Both were diagnosed by confirming the failing set never intersected this plan's files, and neither blocked delivery.

## User Setup Required

None.

## Next Phase Readiness

- **03-09 (wave 2)** can proceed: its `TreasuryDashboard` and `PricingContent` targets are untouched by this plan, and the three findings above are enumerated with file:line.
- **03-13 (wave 3, blocked on COIN-01)** has its flip target in place exactly as specified: `describe('COIN-04 boundary is intact')` in `apps/web/src/__tests__/services/economics-fee-split-copy.test.ts`, asserting `FAQ.tsx` still contains `בדיוק כמו במניה`. That plan's T2 will leave the suite red until T3 flips it — the intended, documented behaviour.
- **Not ready:** the phase-level gate `pnpm --filter @sync/web typecheck && pnpm --filter @sync/web test` cannot go green until 03-02-T3 and 03-04-T1 land their halves.

## Self-Check: PASSED

All four modified components and the new guard file exist on disk; commits `67a470e`, `6e6175a` and `50befd5` all resolve in `git log`.

---
*Phase: 03-payment-rails-hardening*
*Completed: 2026-08-04*
