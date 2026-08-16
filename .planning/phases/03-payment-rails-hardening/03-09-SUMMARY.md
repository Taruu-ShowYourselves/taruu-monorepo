---
phase: 03-payment-rails-hardening
plan: 09
subsystem: ui
tags: [copy, hebrew, rtl, pay-08, money-model, treasury, pricing, source-guard, vitest]

# Dependency graph
requires:
  - phase: 03-payment-rails-hardening
    provides: "03-02/03-03 retired the ₪3 rail and its contract; 03-04 cleared the ticker, email and mobile welcome; 03-05 cleared /economics — the sweep in Task 3 could only go green because all four had landed"
provides:
  - "treasury board shows only figures the ledger produces — the computed 70/30 allocation is gone"
  - "the receipt's independent-audit and chain-signature claims removed rather than reworded"
  - "pricing rate card names what funds the civic pool, so a reader cannot assume their vote pays for it"
  - "money-model-sweep.test.ts: one repo-wide walk of apps/web/src + apps/mobile/app, PAY-08's closing proof"
affects: [PAY-08 closure, 03-13 COIN-04 claim rewording]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Requirement-level sweep: a recursive source walk with a collected {file, phrase} violation array, so the failure diff names the offending file instead of a bare boolean"
    - "Whitespace-normalise before matching Hebrew copy, because JSX wraps sentences mid-phrase (`אין` / `דמי חבר` straddle a line break in PricingContent)"
    - "Narrow matchers over broad regexes: a bare `70%` is CSS-in-JS and a bare `* 0.7` is animation code, so the split rules list shipped phrases plus currency-scoped multiplications"

key-files:
  created:
    - apps/web/src/__tests__/services/money-model-sweep.test.ts
  modified:
    - apps/web/src/app/[locale]/treasury/components/TreasuryDashboard.tsx
    - apps/web/src/app/[locale]/treasury/components/TreasuryDashboard.module.css
    - apps/web/src/app/[locale]/pricing/components/PricingContent.tsx
    - .planning/phases/03-payment-rails-hardening/deferred-items.md

key-decisions:
  - "Took the plan's *acceptable* branch (delete the Receipt) over its *preferred* one (rebuild it from local/external/total), because those three figures come from two different sources and do not sum — a receipt totalling them would have replaced one fabricated derivation with another"
  - "Deleted the receipt's `ביקורת חשבונאית עצמאית` and `חתום בבלוקצ׳יין` footer rather than trimming it: no audit exists and the ILS ledger is Postgres, and there was nothing true left to say once both claims went"
  - "Did not touch the `המודל הכלכלי מתקיים מעצמו מהיום הראשון` claim — it lives in /economics, which this plan's own verification requires to be untouched; recorded with a proposed replacement instead of edited silently"
  - "Sweep skips every test file, not just `__tests__/`, so a colocated `*.test.ts` assertion string is never read as shipped copy"

patterns-established:
  - "A union guard proves the requirement; per-plan guards prove the plan. The union names no surface, so a page added later is covered without extending a list"

requirements-completed: []

# Metrics
duration: 14min
completed: 2026-08-04
---

# Phase 03 Plan 09: Treasury board, rate card, and PAY-08's closing sweep Summary

**The treasury board stopped multiplying the fund balance by two percentages nothing implements and printing the products as audited accounting; the pricing page now says the civic fund is financed by outside BAG investment rather than by residents' money; and one repo-wide test over 484 source files is PAY-08's proof instead of five per-surface arguments.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-04T14:37:00Z
- **Completed:** 2026-08-04T14:51:19Z
- **Tasks:** 3 of 3
- **Files modified:** 3 source files + 1 new test + 1 planning doc

## Premise verification (done before any edit)

Every claim the plan and the wave-1 summaries handed over was re-checked against the working tree first.

| Handed over by | Claim | Verdict |
|---|---|---|
| plan + 03-05 | `TreasuryDashboard.tsx:325-341` computes `formatCurrency(treasury.totalILS * 0.7)` / `* 0.3` under labels `70% לקרן הרשות` / `30% תפעול הפלטפורמה` | **TRUE**, verbatim, at `:324-343` |
| 03-05 | nothing implements a 70/30 split | **TRUE and stronger.** `createDefaultFeeShareConfig` (`services/bags/index.ts:326`) splits 10/10/80, and `api/payments/webhook/route.ts` deposits `payment.amount` in full. Repo-wide, no route or ledger divides by any percentage |
| 03-05 | the same receipt's footer claims `ביקורת חשבונאית עצמאית` and `חתום בבלוקצ׳יין` | **TRUE** — and the audit claim also appears **twice more** in `TreasuryHero.tsx` (see Findings) |
| 03-04 | `Ticker.tsx:12` hardcodes `1,247 קולות` | **TRUE**, still live |
| 03-04 | `sections/FundTransparency/` unmounted, `monthlyAccumulation` | **TRUE** — zero usages outside its own directory |
| 03-04 | `services/greenInvoice/index.ts:218` still cites the ₪6 membership | **NO LONGER TRUE** — a sibling already rewrote that docstring; the ₪6 is gone |
| 03-05 | `FAQ.tsx` + `sustainabilityPoints` claim `מתקיים מעצמו מהיום הראשון` | **TRUE**, and it is **two** strings, both in `/economics` |
| coordinator | `apps/mobile/app/vote/[id].tsx:159`'s ₪3 comment is correct in context | **TRUE** — left untouched |

No task's premise was false. Nothing was improvised.

## Task Commits

1. **Task 1: Stop the treasury board computing an allocation it cannot back** — `4c8b820` (fix)
2. **Task 2: Make the rate card say what funds the civic pool** — `fec7943` (fix)
3. **Task 3: One repo-wide sweep — PAY-08's closing proof** — `13fd21a` (test)

Each commit contains only its own files. Verified with `git show --name-only` on all three.

## Copy changed — every string, before → after

### `TreasuryDashboard.tsx` — the allocation receipt (removed)

| Was | Now |
|---|---|
| `kicker="חלוקה · ALLOCATION"` | *(removed)* |
| row `70% לקרן הרשות` → `formatCurrency(treasury.totalILS * 0.7)` | *(removed)* |
| row `30% תפעול הפלטפורמה` → `formatCurrency(treasury.totalILS * 0.3)` | *(removed)* |
| row `סך הקרן` → `formatCurrency(treasury.totalILS)` (strong) | *(removed — the same figure is already the `יתרה כוללת` stat card)* |
| footer `כל סכום מתועד · חתום בבלוקצ׳יין · ביקורת חשבונאית עצמאית` | *(removed, not reworded)* |
| JSX comment `{/* Allocation breakdown - ledger split + receipt */}` | `{/* Allocation breakdown - ledger split, real figures only */}` |

No Hebrew string was *added* to this file. A twelve-line source comment now stands where the receipt was, recording that the split is COIN-02's ledger to establish, that it is gated on COIN-01, and why the footer went with it.

### `PricingContent.tsx` — the free-participation card's note

- before: `בלי תשלום ובלי חסמים. נדרש רק אימות זהות ומיקום, כדי שכל קול ישויך לתושב אמיתי אחד.`
- after: `בלי תשלום ובלי חסמים. נדרש רק אימות זהות ומיקום, כדי שכל קול ישויך לתושב אמיתי אחד. הקרן הקהילתית של כל הצבעה ממומנת מהשקעות חיצוניות ב-BAG של ההצבעה, לא מכספי תושבים.`

The added sentence is the shipped `terms/page.tsx:99` wording minus its `ב-bags.fm` clause, so nothing new was invented. It states a funding **source** and no quantity: no percentage, no pool size, no return, no guarantee. Everything else on the page is byte-identical — both prices, `TRUST_ITEMS`, the standfirst, `CREATE_SPEC`, the trust strip, the CTA, and `PARTICIPATION_SPEC[1]`'s deferred `חתום בבלוקצ׳יין` line.

## Decisions Made

### 1. Deleted the receipt instead of rebuilding it — the plan's *acceptable* branch, chosen over its *preferred* one

The plan preferred keeping the `Receipt` and reducing it to *local · external · total*, on the grounds that all three are real. They are real — but **they do not sum**, and a receipt is a format whose whole grammar asserts that they do:

- `localContributions` and `externalContributions` are computed client-side from `/api/treasury/{m}/transactions?limit=25` — the **last 25 rows**, filtered to `deposit` and to `token_purchase | fee_claim` respectively (`TreasuryDashboard.tsx:200-205`). Types `allocation`, `withdrawal` and `nft_mint` are excluded by construction.
- `totalILS` is `total_collected_ils` off the **treasury row** (`api/treasury/[municipality]/route.ts:51`).

Printing those three under a `strong` total line would assert an arithmetic identity the data cannot honour — which is the same defect as the `× 0.7`, one step less obvious. The task exists to stop the page presenting invented derivations; swapping one for a subtler one would have missed the point.

What the board keeps instead: `AllocationLedger` directly above, which is internally consistent (it shows each contribution type as a share of their own sum, never of `totalILS`), and the four stat cards, which already carry the fund total. The `התפלגות הכנסות` heading survives — the board was corrected, not emptied. Consequential cleanup: `.allocReceipt` removed from the CSS module and `Receipt` dropped from the `@/components/press` import.

### 2. The footer's audit and chain claims were deleted, not trimmed

The plan allowed keeping the footer *"only if every row above it is a real ledger figure"*. Once the receipt went, so did its footer — which was the right outcome for both claims independently:

- **`ביקורת חשבונאית עצמאית`** asserts an independent accounting audit. No audit has been commissioned and none is scheduled anywhere in `.planning/` or `apps/web/docs/`; `GI-LEGAL-CHECKLIST.md` (0/19) is a merchant-of-record question, not an audit engagement. This was the strongest claim on the page.
- **`חתום בבלוקצ׳יין`** asserts a chain signature over these figures. `treasury_transactions` is a Postgres table; the on-chain artefact is BAG-side and is not a seal over ILS. `03-CONTEXT.md` defers chain-seal copy generally, but 03-05 was right that this instance sat inside a *money* receipt and is squarely PAY-08.

Neither was replaced with a substitute claim. `כל סכום מתועד` on its own would have been the only survivable third of the footer, and a one-clause footer under no rows is furniture, not information. **A false claim is not owed a replacement.**

### 3. The self-sustaining claim: recorded with a proposed fix, deliberately not edited

`המודל הכלכלי מתקיים מעצמו מהיום הראשון` (`economics/components/FAQ.tsx:43`) and `הפלטפורמה מתקיימת מהיום הראשון` (`economics/components/FlywheelDiagram.tsx:96`) are both live. 03-05 asked for a decision. The decision is: **record and recommend, do not edit here.**

- Both strings are inside `apps/web/src/app/[locale]/economics/`, and this plan's own `<verification>` item 6 requires `git diff --stat` on that directory to be empty. Editing them would have failed the plan that authorised the edit.
- The claim is a **different class** from the `70/30` split. That one was contradicted by code — a ledger existed and said otherwise. This one is unproven rather than contradicted: with ₪50 creation fees as the sole revenue line and no revenue yet collected (the treasury board still renders `ComingSoonBoard`), *"self-sustaining from day one"* is a forward-looking statement about the business, not a misstatement of the money model PAY-08 governs.
- Silently rewording a claim about viability, in a file whose neighbouring sentences are gated on COIN-01, is exactly the pre-emption 03-05 built its `COIN-04 boundary` assertion to prevent.

`deferred-items.md` now carries both file:line references and a concrete replacement for each — *"אנחנו לא תלויים במשקיעים חיצוניים, ודמי היצירה הם מקור ההכנסה היחיד שלנו"* and *"מקור הכנסה אחד וברור: דמי יצירת הצבעה"* — so it is a one-line landing for whoever next owns `/economics`. Both remove a claim rather than add one, so neither needs the legal gate.

### 4. The sweep matches narrowly, on purpose

A false positive in a repo-wide guard blocks unrelated work, so every matcher was checked against the current tree before it was written:

- A bare `70%` regex would have hit `GlassCard.tsx:48`, `CinematicIntro.tsx:652` and `LegalContent.tsx:48` — all CSS-in-JS.
- A bare `* 0.7` / `* 0.3` would have hit `NoiseSignalVisual.tsx:95,100` and `ShaderBackground.tsx:71` — animation and shader code.
- A bare `מנוי` substring would have hit `notifications/expo.ts:265`, because `מנוי` is inside **`הזדמנויות`**.
- A bare `total * 0.x` would have hit `verification/status/route.ts:86` and `verification/schedule.ts:277,396` — check-in completion ratios.

So the split rules are an explicit list of shipped Hebrew phrases (`70% לקרן`, `70% זורם`, `30% לפלטפורמה`, `30% מממן`, `30% תפעול`, `30% מעמלות`, `1% על כל עסקה`) plus three currency-scoped multiplication patterns (`formatCurrency(… * 0.x)`, `ILS * 0.x`, `Agorot * 0.x`), and `מנוי` is matched only as a standalone Hebrew word via `(?<![֐-׿])…(?![֐-׿])`.

Two more details the walk needed:

- **Whitespace normalisation.** `PricingContent.tsx:64-65` splits `אין דמי חבר` across a JSX line break. The negation rule *"every `דמי חבר` is preceded by `אין `"* fails on the raw source and passes on the normalised source — verified both ways before writing it.
- **All test files skipped, not just `__tests__/`.** Seven colocated `*.test.ts` files live under `src/lib`, `src/server` and `src/lib/supabase`. A guard's own `not.toContain('₪3')` is live code, not a comment, so `code()` would not have saved it.

## Verification

| Check | Result |
|---|---|
| `pnpm --filter @sync/web typecheck` | exit 0 |
| `pnpm --filter @sync/web test` (full suite) | **76 files, 986 tests, all passing, 2.27s** (baseline 74/938) |
| `pnpm --filter @sync/shared typecheck` | exit 0 |
| `pnpm --filter @sync/api-client test` | 10 files, 131 tests passing |
| `pnpm --filter @sync/api-client typecheck` | exit 0 |
| `pnpm --filter @sync/mobile typecheck` | exit 0 |
| `pnpm --filter @sync/web test -- …/money-model-sweep.test.ts` | **9 passed**, walk 12ms, file 207ms |
| `grep -cE "\* 0\.7\|\* 0\.3" TreasuryDashboard.tsx` | `0` |
| `grep -cE "70%\|30%" TreasuryDashboard.tsx` | `0` |
| `grep -c "AllocationLedger" TreasuryDashboard.tsx` | `2` — identical to HEAD |
| `grep -c "localContributions" TreasuryDashboard.tsx` | `7` |
| `grep -c "התפלגות הכנסות" TreasuryDashboard.tsx` | `1` — the section survives |
| `grep -c "BAG" PricingContent.tsx` | `1` |
| `grep -c "CREATE_VOTE_COST" PricingContent.tsx` | `3` |
| `grep -cE "70%\|30%\|₪3\|₪6" PricingContent.tsx` | `0` |
| `grep -c "אין מנוי" PricingContent.tsx` | `2` (TRUST_ITEMS + standfirst) |
| `grep -c "חתום בבלוקצ׳יין" PricingContent.tsx` | `1` — the deferred chain line untouched |
| `grep -c "חינם" PricingContent.tsx` | `2` |
| `git diff HEAD -- pricing/page.tsx` | empty — metadata untouched |
| `grep -rnE "\* 0\.7\|\* 0\.3" ".../treasury/"` | no matches |
| sweep file: `readdirSync` / `existsSync` / `types.ts` / `אין ` | `2` / `5` / `4` / `4` |
| sweep file: `grep -cE "\.only\(\|--watch"` | `0` |

### The deliberate break, as the plan required

`export const probe = '₪3';` was written to `apps/web/src/lib/__sweep-probe.ts`, the sweep run, and the file removed — all inside a single shell invocation, so the probe existed for under a second in a worktree four executors share. `git status` confirmed no residue. Observed output:

```
FAIL  src/__tests__/services/money-model-sweep.test.ts > no retired price survives anywhere
      > quotes no retired participation or membership fee, in web or mobile source
AssertionError: expected [ { …(2) } ] to deeply equal []

- Expected
+ Received

- Array []
+ Array [
+   Object {
+     "file": "apps/web/src/lib/__sweep-probe.ts",
+     "phrase": "₪3 (retired participation fee)",
+   },
+ ]
```

The one-line summary is terse (vitest 1.6.1 elides object contents there), but the diff immediately below names the file and the matched phrase, which is the requirement. Both trees were probed by construction: the same `sweep()` runs over web and mobile surfaces in one array.

### PAY-08 residue check

`grep -rn "₪3\|₪6" apps/web/src apps/mobile/app` returns 16 lines. **Zero are shipped copy:**

- 13 are inside the four guard tests (`participation-cost-legacy`, `money-model-copy`, and this plan's own `money-model-sweep`, which must contain `'₪3'` and `'₪6'` as matcher literals). All live under `__tests__/` and are excluded from the walk.
- 1 is `apps/mobile/app/vote/[id].tsx:159`, a block comment describing the retirement — stripped by `code()`, which is precisely why the stripper exists.

## Deviations from Plan

### 1. [Deliberate] Took the *acceptable* branch rather than the *preferred* one in Task 1

Documented in full under Decisions Made #1. The plan explicitly offered both and asked which was taken. The preferred branch would have printed three real figures under a total line they do not sum to.

### 2. [Scope] Task 1 edited a CSS module not listed in `files_modified`

`TreasuryDashboard.module.css` is absent from the plan's frontmatter, but the Task 1 action text mandates it for the branch taken (*"remove the `.allocReceipt` rule from the CSS module"*). Removing four lines of dead CSS. No forbidden-diff criterion covers it — the guarded files are `TreasuryHero.tsx`, `treasury/page.tsx`, `PricingContent.module.css` and `pricing/page.tsx`, all untouched.

### 3. [Process] Tasks 1 and 2 were not executed as TDD despite `tdd="true"`

Same resolution 03-04 recorded. A RED test first would have created `money-model-sweep.test.ts`, which Task 3 of this plan owns, and would have tripped `03-CONTEXT.md`'s verification-gate rule (vitest exits 1 with *"No test files found"*). Both tasks were gated on their own `<verify>` blocks — annotated in the plan itself as *"Self-contained: the sweep is Task 3 of this plan"* — and `03-VALIDATION.md:86` designates T3 as the behavioural proof.

### 4. [Minor] Two acceptance criteria are unsatisfiable as literally written; the intent was met

- **`git diff --stat TreasuryHero.tsx treasury/page.tsx` is empty** (T1). It was not empty *at baseline*: `TreasuryHero.tsx` already carried four lines of the repo-wide em-dash → hyphen WIP before this plan started. Met in substance — neither file was edited, neither appears in any of this plan's three commits, and `TreasuryHero.tsx`'s diff vs HEAD is byte-identical before and after.
- **`git diff PricingContent.module.css`/`pricing/page.tsx` is empty** (T2). `pricing/page.tsx` genuinely is empty. `PricingContent.module.css` carries one line of the same pre-existing WIP. Neither was edited or committed.

### 5. [Attribution] Both file-edit commits swept pre-existing em-dash normalisation

The third executor in a row to hit this. `git commit -m … -- <pathspec>` isolates against the shared **index** but commits the working-tree contents of the named paths, and a repo-wide `—` → `-` normalisation was already sitting uncommitted in three of my four files:

- `4c8b820` — `TreasuryDashboard.tsx` (8 comment lines), `TreasuryDashboard.module.css` (1 comment line)
- `fec7943` — `PricingContent.tsx` (4 comment lines)

Comment-only, no behavioural change, and hunk-level staging is unavailable non-interactively. Not reverted: undoing it would mean modifying a sibling's in-flight work.

### 6. [Out of scope] The suite was red mid-execution, from a sibling's RED window

Between Task 1 and Task 2, `pnpm --filter @sync/web test` reported 8 failures, all in `src/__tests__/api/payments.test.ts`'s `POST /api/payments/webhook` describe (`expected 500 to be 404`, etc.). Plan **03-07** had just landed `76c8a29` (two-factor webhook auth) without its T3 test rewrite — the exact RED window `03-VALIDATION.md` assigns to 03-07-T3. Not fixed, not investigated further than confirming the failing set never intersected this plan's files. It cleared on its own before Task 3's commit; the suite is green at hand-off.

### 7. [Cross-executor] The `deferred-items.md` addition landed in a sibling's commit

`deferred-items.md` is shared by the whole phase and was already tracked and dirty. Between writing the *"From plan 03-09"* section and committing it, plan 03-07's executor committed and swept the file: the content is in **`6cb7105`** (*"docs(03-07): complete webhook secret + two-factor authenticity plan"*), verified intact — `git show HEAD:…/deferred-items.md | grep -c "From plan 03-09"` returns `1` and there is no unstaged diff left.

Not corrected. Rewriting shared history under three executors' in-flight work to fix a commit message is strictly worse than a mis-attributed line. Identical in kind to 03-05's Deviation 1, and it reinforces that recommendation: in a shared worktree, `git commit -m … -- <pathspec>` must be the default, and even then it does not protect a file a sibling commits between your write and your commit.

---

**Total deviations:** 7 — 1 deliberate branch choice, 1 sanctioned scope widening, 1 process, 1 minor criteria note, 2 attribution, 1 out-of-scope sibling failure. **No auto-fixes were required and no task's premise was false.**

## Findings for the owner — recorded in `deferred-items.md`, not fixed

The full write-up with file:line and proposed replacements is in `deferred-items.md` under *"From plan 03-09"*. The two that matter:

1. **`TreasuryHero.tsx` still claims an annual independent accounting audit, twice** — `:63` is an entire pillar titled `ביקורת עצמאית` reading *"הקרן עוברת ביקורת חשבונאית עצמאית מדי שנה: גורם חיצוני מאמת שכל שקל במקומו"*, and `:103` repeats it in the standfirst. **This is a stronger claim than the footer this plan removed** — it names a cadence and an external verifier — and it sits on the same page, one component away. This plan's own acceptance criteria forbid touching that file, so the boundary was honoured and the claim outlives the phase. It needs an owner.
2. **`/economics` claims the platform is self-sustaining from day one, in two strings** — see Decisions Made #3.

Also recorded: `Ticker.tsx:12`'s hardcoded `1,247 קולות`, the unmounted membership-era `FundTransparency/`, and confirmation that the `₪6` docstring 03-04 flagged is already fixed.

## Issues Encountered

Shared-worktree concurrency, as every wave-2 sibling has reported: a transient red suite from another plan's RED window, four files carrying pre-existing uncommitted WIP, and one commit that needed `git add` on an explicit path first because `git commit -- <path>` cannot commit an untracked file. All handled without touching another executor's work.

## User Setup Required

None — copy removal, one copy addition, one new test.

## Next Phase Readiness

- **PAY-08's three clauses are now stated and guarded end to end:** participation is free, creation costs ₪50, and the civic pool is funded by the token. The last of the three had never been stated on the pricing page at all.
- **PAY-08 is proven by one test rather than five arguments.** `money-model-sweep.test.ts` walks 484 source files across both apps in 12ms and names the offending file on failure. A page added next month is covered without anyone extending a list.
- **Per coordinator instruction, this plan did NOT run** `state advance-plan`, `state update-progress`, `roadmap update-plan-progress`, or `requirements mark-complete`. Four executors share this worktree and PAY-08 also depends on plan 03-07. `requirements-completed` is deliberately empty in this SUMMARY's frontmatter; the orchestrator closes PAY-08 at wave end.
- **Not closed by this phase:** the treasury hero's audit claim and the `/economics` self-sustaining claim, both above.

## Self-Check: PASSED

- `apps/web/src/app/[locale]/treasury/components/TreasuryDashboard.tsx` — FOUND
- `apps/web/src/app/[locale]/treasury/components/TreasuryDashboard.module.css` — FOUND
- `apps/web/src/app/[locale]/pricing/components/PricingContent.tsx` — FOUND
- `apps/web/src/__tests__/services/money-model-sweep.test.ts` — FOUND
- `.planning/phases/03-payment-rails-hardening/deferred-items.md` — FOUND
- Commits `4c8b820`, `fec7943`, `13fd21a` — all resolve in `git log`

---
*Phase: 03-payment-rails-hardening*
*Completed: 2026-08-04*
