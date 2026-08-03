# Deferred items — Phase 05

Out-of-scope findings logged during execution. Not fixed by the plan that found them.

## From 05-02

**1. `SPACE-04` traceability row and its checkbox disagree in REQUIREMENTS.md**

- **Found during:** 05-02 state updates
- **Observed:** the checklist entry at `.planning/REQUIREMENTS.md:49` is unchecked `[ ]`, but the traceability table at `:117` still reads `| SPACE-04 | Phase 5 | Complete |`. The "Note on tick timing" at `:56-61` says SPACE-04 was auto-ticked after 05-01 alone and "has been reset" — it looks like the reset updated the checkbox but not the table row.
- **Why not fixed here:** `REQUIREMENTS.md` is not in 05-02's `files_modified`, and the discrepancy predates this plan. Silently flipping a requirement row to `Pending` is a project-status edit, not a code fix.
- **Owner:** whoever next runs a requirements pass, or 05-16 when it assembles the evidence document.

**2. `requirements mark-complete` deliberately NOT run for 05-02**

- 05-02 declares `requirements: [SPACE-02, SPACE-04, SPACE-05]`, and the standard executor step would tick all three.
- The tick was withheld. All three are multi-plan requirements (the note names SPACE-04 as plans 01, 02, 05, 07, 15, 16), and the note records that exactly these premature auto-ticks were reset once already after 05-01. Re-ticking would reintroduce them.
- 05-02 delivers the *pure domain core* of SPACE-02 and SPACE-05 (the capability vocabulary; the review transitions and the self-review rule) and the *typed reason contract* for SPACE-04. None of the three is enforced end-to-end until the use-case and route plans land.
- **Authoritative check remains:** `05-VERIFICATION.md` plus 05-16's evidence document.

**3. Two gsd-tools state commands do not match this project's STATE.md/ROADMAP.md format**

- `state advance-plan` fails with `Cannot parse Current Plan or Total Plans in Phase from STATE.md`. The tool reads fields named `Current Plan:` and `Total Plans in Phase:` (`bin/lib/state.cjs:215-216`); this project's STATE.md writes a single line, `Plan: 3 of 16`.
- `roadmap update-plan-progress 05` returns `{"updated": true, "summary_count": 2}` but leaves the progress row untouched — a false success, which is worse than the honest failure above.
- Both were worked around by editing the two files directly (as 05-01 also did). Worth fixing in the tooling or in the document format, because a silently-wrong roadmap is easy to trust.

**4. `pnpm --filter @sync/web lint` not run**

## From 05-03

**5. `apps/mobile` typecheck broke mid-wave-2 on a duplicate `@types/react` — BLOCKS CI**

- **Found during:** 05-03 final verification.
- **Observed:** `pnpm --filter @sync/mobile typecheck` now emits **130 errors, every single one `TS2786`** ("X cannot be used as a JSX component … Type 'bigint' is not assignable to type 'ReactNode'"), spread across ~19 files that no phase-5 plan has touched (`app/vote/[id].tsx`, `app/settings/*`, `app/payment/*`, `app/verification/*`, `app/_layout.tsx`, …).
- **Cause:** two copies of the React types are now installed — `node_modules/.pnpm/@types+react@18.3.27` (what `apps/mobile/node_modules/@types/react` symlinks to) and `node_modules/.pnpm/@types+react@19.2.7` (hoisted into `node_modules/.pnpm/node_modules/@types/react`). React 19's `ReactNode` admits `bigint`; React 18's does not, so the two `ReactNode` identities are mutually unassignable and every JSX element from a library typed against the other copy fails.
- **When:** `apps/mobile` typechecked **clean at 2026-08-02T16:15Z**, immediately before 05-03's first edit, and again **clean at the 05-03 Task 1 gate with this plan's mobile change already applied** (`MOBILE_EXIT=0`). It went red later in the wave, after `apps/web/package.json` + `pnpm-lock.yaml` were modified and re-installed. Those two files are **05-04's** declared territory.
- **Why not fixed here:** out of scope on two counts. It is not caused by 05-03's changes (see the proof below), and remedying it means editing `apps/web/package.json` / `pnpm-lock.yaml` or re-running `pnpm install` against a working tree with two other plans' uncommitted work in it — a much larger blast radius than the bug.
- **Proof 05-03 is not the cause:** this plan widened the shared `VoteStatus` union from 4 members to 10 and rewrote the one exhaustive consumer, `apps/mobile/app/(tabs)/votes.tsx:24`. A union-widening break would surface as `TS2353` (excess property) or `TS2739`/`TS2741` (missing keys) on that map. **Zero errors of those kinds exist anywhere in the app**, and the seven errors reported on `votes.tsx` are all `TS2786` on `SafeAreaView`, `Animated.View` and `Ionicons` at lines 108–182 — nothing on lines 20–37 where `statusColors` is declared and read.
- **Suggested fix (for whoever owns it):** pin a single `@types/react` across the workspace, e.g. a `pnpm.overrides` entry in the root `package.json`, then reinstall on a quiet tree.
- **Owner:** 05-04 (whose install introduced it) or 05-16 (which owns the phase's one full-suite, whole-repo verification run).

- The plan specifies targeted verifies only, because 05-01 shared the working tree during wave 1. `tsc --noEmit` is green for both `@sync/web` and `@sync/shared`.
- Separately, `npx prettier --check` fails repo-wide including on files no plan touched — there is no prettier config in the repo, so the default profile does not match the committed style. Adopting (or not) a prettier config is a repo-level decision, not a phase-5 one.

## From 05-06

**6. The overview's `membersInSpace` and `activeVotes` figures are still `null`, and the `// wired in 05-06` comments on them are now stale**

- **Found during:** 05-06 Task 2.
- **Observed:** `apps/web/src/server/app/space-admin/get-space-overview.ts:115-116` marks both figures `// wired in 05-06`. 05-06 ships the member count (`countSpaceMembers`) that the first of them needs, but the plan's `files_modified` does not list `get-space-overview.ts` and no task asks for the wiring.
- **Why not fixed here:** three siblings (05-05, 05-07, 05-08) were live in this working tree, and `get-space-overview.ts` is 05-04's file. Editing a file outside the plan's declared territory during a shared-index wave is how the phase's earlier mixed-authorship commits happened. The figures render as absent rather than wrong in the meantime, which is the design's intended `null` (an unavailable figure, never a fabricated zero).
- **What it needs:** `getSpaceOverview` should call `authorize(…, 'member.read')` → `countSpaceMembers(scope)` folded through `optional()`, exactly as `proposalWidgets` already does for `proposal.read`. `activeVotes` needs a count that no plan has written yet.
- **Owner:** 05-12 (the overview surface, which is the first plan that will notice the empty figures) or 05-16.

**7. `optional()` was NOT extracted to a shared module by 05-06, and that is deliberate**

- 05-04's summary asks the first plan that *reuses* the `FORBIDDEN`-folding helper to move it out of `get-space-overview.ts` rather than copy it.
- 05-06 does not reuse it and did not copy it. Every surface in this plan is gated on a single capability, so a missing capability is a 403 for the whole endpoint rather than an absent widget — `GET /members` without `member.read` must be refused, not served with an empty list, and Task 2's behaviour bullet requires exactly that.
- Extracting a helper for callers that do not exist yet is the speculation 05-04 explicitly declined. **05-07 (metrics) is the real first reuse** — it renders a multi-widget surface under Rule A — and should do the extraction.
