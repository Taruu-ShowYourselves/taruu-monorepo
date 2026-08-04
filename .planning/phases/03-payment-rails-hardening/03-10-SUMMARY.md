---
phase: 03-payment-rails-hardening
plan: 10
subsystem: docs
tags: [legal, compliance, securities, custody, bags.fm, solana, token, israeli-law]

# Dependency graph
requires:
  - phase: 03-payment-rails-hardening
    provides: "plan 03-04/03-05 corrected the money copy and left the COIN-04-owned investment wording deliberately untouched behind a boundary comment, so the inventory records the gated claims rather than a half-rewritten version of them"
provides:
  - "apps/web/docs/COIN-LEGAL-CHECKLIST.md — the COIN-01 dossier an Israeli lawyer answers in writing: securities status, custody structure, permissible claims, tax/reporting"
  - "apps/web/docs/COIN-CLAIM-INVENTORY.md — 57 live token claims, each with file:line, the exact Hebrew string, a category, and a backability judgement, with empty Verdict/Replacement columns for counsel"
  - "Eight verified engineering facts (F1–F8) establishing what the code can and cannot back today"
  - "A recorded takedown asymmetry: removing a claim is not gated on the lawyer; only keeping or rewording one is"
affects: [03-11, 03-12, 03-13, phase-4-go-live]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "External-human-track checklist (the GI-LEGAL-CHECKLIST.md precedent) reused for a second, stricter gate"
    - "Claim inventory as a ruled table with executor-owned fact columns and counsel-owned verdict columns"

key-files:
  created:
    - apps/web/docs/COIN-LEGAL-CHECKLIST.md
    - apps/web/docs/COIN-CLAIM-INVENTORY.md
  modified: []

key-decisions:
  - "Added a Backable today? column beyond the plan's column set, because the owner asked for whether Taruu can back each claim; it carries engineering facts only, never a legal conclusion"
  - "Split FAQ.tsx:13 into two rows — the share analogy and the more-buyers-means-more-value statement are separately rulable claims in one string literal"
  - "Cited a line range and quoted the rendered sentence where JSX wraps prose across lines, with a grep-fragment note so a moved line is recoverable"
  - "Did not inventory the TreasuryDashboard 70/30 receipt: plan 03-09 removed it in the working tree mid-execution, so it no longer ships"
  - "Recorded English-locale twins separately as not-live, since middleware.ts:34-38 redirects every non-Hebrew prefix to /he"

patterns-established:
  - "Verdict columns left mechanically empty and stated as such above the table, so no reader mistakes the inventory for the ruling"
  - "Every file:line citation machine-verified against the working tree before the document was written"

requirements-completed: []

# Metrics
duration: 47min
completed: 2026-08-04
---

# Phase 03 Plan 10: COIN-01 Legal Dossier + Live Claim Inventory Summary

**The COIN-01 gate is now a two-document package a lawyer can answer in a sitting: a 33-question checklist covering securities status, custody, permissible claims and tax, plus a 57-row inventory of every token claim shipping on taruu.co.il today, each quoted verbatim in Hebrew with a file:line and an empty verdict column.**

## Performance

- **Duration:** 47 min
- **Started:** 2026-08-04T17:12:00Z
- **Completed:** 2026-08-04T17:59:00Z
- **Tasks:** 2
- **Files modified:** 2 created, 0 source files touched

## Accomplishments

- **`COIN-LEGAL-CHECKLIST.md`** — 33 `- [ ]` questions across four sections (`מעמד לפי דיני ניירות ערך`, `מבנה החזקת הכספים (custody)`, `מה מותר ומה אסור לומר לקונים`, `חובות מס ודיווח`) plus Sign-off. Every question is written for counsel rather than for a developer, and each states the facts it depends on so the reader never needs the codebase. Names `03-11`/`03-12`/`03-13` as blocked until the sign-off box is ticked.
- **`COIN-CLAIM-INVENTORY.md`** — **57 claims**, swept from source and each `file:line` machine-verified against the tree before writing. Sorted by risk: six securities analogies first, then seven implied returns, five implied civic outcomes, ten use-of-funds, six custody, ten trading mechanics, four certificate/NFT, nine transparency.
- **Backability grounded in eight verified facts**, not opinion. The most consequential: **no code path can create a BAG today.** `seedVoteBag` needs accrued `deposit` rows; `recordTreasuryDeposit` has had zero production callers since plan 03-02 removed it from the payments webhook, so accrual is `0` for every vote. Its only caller is vote resolution, and `wrangler.jsonc` schedules exactly one cron, which `worker.ts:39-42` maps to the Knesset agenda — `resolve-votes` and `mint-nfts` are not scheduled at all.
- **The implemented flow runs opposite to the copy.** Nine rows tell readers that outside buyers fill the civic pool; `bagSeeding.ts:51,70` converts pool fiat into SOL to *seed* the bag. Money flows treasury → token.
- **Liveness verified against production, not assumed.** `/he/coin`, `/he/coin/[id]`, `/he/economics`, `/he/explore`, `/he/treasury`, `/he/terms`, `/he/faq`, `/he/privacy` all return 200 unauthenticated; `POST /api/bags/{quote,swap}` return 401 (deployed, session-gated); `GET /api/bags/trending` is public and currently returns **500**.
- **The takedown asymmetry is on the record** in both documents: removing a claim needs no lawyer's permission, only keeping or rewording one does. Stated as fact with no recommendation attached.

## Task Commits

1. **Task 1: COIN-01 legal sign-off checklist** — `676d1e4` (docs)
2. **Task 2: Live-claim inventory** — `be630e2` (docs)

## Files Created/Modified

- `apps/web/docs/COIN-LEGAL-CHECKLIST.md` — the question a lawyer answers; four `## ` topic sections, 33 checkboxes, Sign-off with lawyer/firm/date lines. Mirrors `GI-LEGAL-CHECKLIST.md` in shape and PENDING discipline.
- `apps/web/docs/COIN-CLAIM-INVENTORY.md` — 57-row claim table, an English-locale-twin note, a `## Trading surfaces` table of eleven shipped endpoints and pages with their gates, `## Open engineering questions the answer will decide` mapping COIN-02/03/04 to `03-11`/`03-12`/`03-13`, and a Sign-off.

**No source file was changed by this plan.**

## Decisions Made

- **Added a `Backable today?` column** beyond the plan's specified columns. The owner's brief required recording whether Taruu can back each claim; the plan's column set had no home for it. It carries engineering facts referencing F1–F8 and never a legal conclusion, so the lawyer's columns stay untouched.
- **Split `FAQ.tsx:13` into two rows** (rows 1 and 2). One string literal carries two independently rulable claims — the share analogy and "more buyers means more value" — and a lawyer should be able to allow one and prohibit the other.
- **Cited line ranges for JSX-wrapped prose** and quoted the rendered sentence, with a note to grep a distinctive fragment if lines move. Line-exact citation of a sentence split across five JSX lines would have been precise and useless.
- **Excluded the `TreasuryDashboard` 70/30 receipt.** It was present when the sweep began and gone by the time the table was written — plan 03-09 removed it in the shared working tree mid-execution. Inventorying a claim that no longer ships would have been wrong; a note records why no such row appears.
- **Recorded, rather than inventoried, the English-locale twins.** `middleware.ts:34-38` redirects every non-Hebrew prefix to `/he`, so those five strings ship in the bundle but are unreachable. They are listed under a separate heading so a future locale rollout cannot resurrect an unruled claim.
- **Included the conservative statements** (`faqData.ts:67`, `terms/page.tsx:99`, `:105`, `HowItWorks.tsx:228`, `FAQ.tsx:18`) as the plan required. A confirmation that the safe wording is safe is what gives plan `03-13` an approved vocabulary to rewrite toward.

## Deviations from Plan

**None** — the plan executed as written. Two judgement calls inside the plan's own latitude are recorded under Decisions Made (the extra `Backable today?` column, required by the owner's brief; and the exclusion of the `TreasuryDashboard` row that plan 03-09 deleted mid-execution).

One acceptance criterion could not be evaluated as literally stated: **`git status --porcelain apps/web/src` is not empty**, because three other executors share this worktree and 03-07/03-09 have source changes in flight. What can be asserted is stronger and narrower: this executor created exactly two files, both under `apps/web/docs/`, and modified no other file. Both commits staged explicit paths only.

## Issues Encountered

- **Concurrent edits to the surfaces being inventoried.** Plan 03-09 was rewriting `TreasuryDashboard.tsx` while the sweep ran; a `70% לקרן הרשות` row read from the file early in the sweep no longer existed by the time the table was written. Resolved by machine-verifying all 57 `(file, line, substring)` triples immediately before writing the document, and by adding a stated derivation commit (`676d1e4`) plus a grep-fragment recovery note so a moved line is recoverable rather than silently wrong.
- **`/api/bags/trending` returns 500 in production.** Discovered while confirming liveness. Not this plan's to fix — recorded as fact F6 and in the trading-surfaces table so counsel and the owner both see that a public token endpoint is deployed and failing.

## Verification

- Task 1 automated verify: **PASS** (all five greps). 6 `## ` sections (≥5 required), 33 checkboxes (≥12 required), `ניירות ערך` / `נאמנות` + `custody` / `הגנת הצרכן` / `COIN-CLAIM-INVENTORY` / `PENDING` all present, blocked plans named 6 times.
- Task 2 automated verify: **PASS** (all four greps). 57 data rows (≥8 required), 79 `file:line` citations (≥8 required), `בדיוק כמו במניה` present, all three `/api/bags/*` routes in `## Trading surfaces`, 9 mentions of COIN-02/03/04 (≥3 required).
- Table structure audited by `awk`: every one of the 57 rows has the full column count, and the **Verdict and Replacement-wording columns are empty in all 57**.
- Backability tally verified programmatically: **33 `no`, 19 `partly`, 5 `yes`** — the in-document figure was corrected from a hand count before commit.
- No credential value in either document: the long-token scan returns only file paths and identifier names. Wallet secrets appear as **names** only (`BAGS_MASTER_WALLET_PRIVATE_KEY`, `BAGS_MASTER_WALLET_ADDRESS`).
- Regression baseline held: `pnpm --filter @sync/web typecheck` exits 0; `pnpm --filter @sync/web test` → **76 files, 986 tests, all passing** (up from the 74/938 baseline as 03-07 and 03-08 landed; nothing regressed).

## User Setup Required

None from this repository. **COIN-01 is an external human track and stays open.** The two documents are the input to it:

1. Hand `apps/web/docs/COIN-LEGAL-CHECKLIST.md` and `apps/web/docs/COIN-CLAIM-INVENTORY.md` to Israeli counsel.
2. File the written response and transcribe the verdicts into the inventory's `Verdict` / `Replacement wording` columns **before** plan `03-13` runs — that plan reads the table as its source of truth.
3. Only then tick the Sign-off boxes, set COIN-01 to Complete, and unblock `03-11`, `03-12`, `03-13`.

Separately and not gated on counsel: the inventory is also the list to work from if the owner chooses to take down or reword any of the 33 unbackable claims before sign-off.

## Next Phase Readiness

- **COIN-01 remains open by design.** Its checkbox is deliberately unticked; `REQUIREMENTS.md` was not modified and no requirement was marked complete.
- `03-11` (COIN-02), `03-12` (COIN-03) and `03-13` (COIN-04) stay blocked, and now each has a named dependency on a specific part of the answer rather than on "the sign-off" in the abstract.
- **ROADMAP Phase 3 success criterion #6 still does not hold**, and this plan does not make it hold — it makes the gap measurable. The owner now has 33 specific unbackable claims with file:line citations and can decide what to remove before Phase 4 go-live.
- Two findings land outside this plan's scope and should be triaged: `GET /api/bags/trending` returns 500 in production, and the `resolve-votes` / `mint-nfts` crons are unscheduled, so no vote resolves and no certificate mints.

## Self-Check: PASSED

- `apps/web/docs/COIN-LEGAL-CHECKLIST.md` — FOUND
- `apps/web/docs/COIN-CLAIM-INVENTORY.md` — FOUND
- `.planning/phases/03-payment-rails-hardening/03-10-SUMMARY.md` — FOUND
- Commit `676d1e4` — FOUND
- Commit `be630e2` — FOUND

---
*Phase: 03-payment-rails-hardening*
*Completed: 2026-08-04*
