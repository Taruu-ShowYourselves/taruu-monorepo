---
phase: 05-space-governance-substrate-and-space-admin-operations-dashboard
plan: 03
subsystem: api
tags: [authorization, visibility, postgrest, zod, vitest, typescript, contracts, react-native]

# Dependency graph
requires:
  - phase: 05-01
    provides: the widened vote_status database enum and its TypeScript row types
  - phase: 05-02
    provides: REVIEW_VOTE_STATUSES, the review vocabulary this allow-list is the complement of
provides:
  - PUBLIC_VOTE_STATUSES — the single allow-list governing public vote visibility
  - PublicVoteStatus, the type every status-filter parameter now carries
  - getVoteByIdUnfiltered — the named, documented internal escape hatch for authorized server-side reads
  - a widened ingest dedup window that can see proposals awaiting approval
  - a shared VoteStatus type and schema reconciled with all ten database labels
  - a regression test asserting the visibility predicates live in the SQL
affects: [05-05, 05-09, 05-10, 05-16, issue-68]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Allow-list, never deny-list: one constant serves as both the default filter and the validation set, so a status invented later is invisible by default"
    - "Normalise-then-validate at the route, so an unknown-vocabulary query parameter degrades to 'no filter' instead of returning a distinctive 400 that confirms the label exists"
    - "Public/internal read pairs: the filtered name is the plain one, the unfiltered name carries the warning"
    - "Partial<Record<Union, T>> plus an explicit fallback where a union is open-ended and the map is a presentation concern"

key-files:
  created:
    - apps/web/src/__tests__/services/vote-status-visibility.test.ts
  modified:
    - apps/web/src/server/domain/votes/vote.ts
    - apps/web/src/server/infra/supabase/vote.repo.ts
    - apps/web/src/server/app/votes/list-votes.ts
    - apps/web/src/app/api/votes/route.ts
    - apps/web/src/lib/supabase/db.ts
    - packages/shared/src/types/vote.ts
    - packages/shared/src/contracts/vote.ts
    - apps/mobile/app/(tabs)/votes.tsx

key-decisions:
  - "'failed' is deliberately excluded from PUBLIC_VOTE_STATUSES — a real, intended narrowing of today's public surface, not a regression"
  - "'pending' is deliberately included — it means 'scheduled, not yet open', and dropping it would change a live public surface for no security gain"
  - "getVoteById is the filtered name and getVoteByIdUnfiltered the internal one, so the safe call is the one you reach for by default"
  - "countVotesCreatedByUser excludes draft/rejected; getVotesCreatedByUser stays unfiltered so a submitter can still see their own work"
  - "The route keeps parse(Schema, input) rather than a throwing Schema.parse — the repo has zero throwing call sites and switching would turn a malformed ?municipality= from a 400 into a 500"

patterns-established:
  - "Visibility tests assert on recorded query-builder calls, never on returned rows, so a post-fetch filter cannot pass"

requirements-completed: []

# Metrics
duration: 25min
completed: 2026-08-03
---

# Phase 5 Plan 03: Public read-path visibility and status vocabulary Summary

**One allow-list now decides which vote statuses a public reader may see, six audited read paths enforce it in SQL, the ingest dedup window can finally see proposals waiting in review, and the shared `VoteStatus` vocabulary matches the database enum.**

## Performance

- **Duration:** ~25 min (wall clock spans an API stall and a recovery)
- **Started:** 2026-08-02T16:15:16Z
- **Completed:** 2026-08-03
- **Tasks:** 3
- **Files modified:** 9 (1 created, 8 modified)

## Accomplishments

- The four read paths that were about to start leaking now name their allowed statuses. Before this plan `getVotesByMunicipality` had no status predicate at all when called without one, which was harmless only for as long as no row could hold a review state — a property 05-05 is about to destroy.
- Visibility is one constant, `PUBLIC_VOTE_STATUSES`, doing both jobs: the default filter and the validation set for an explicitly supplied status. There is deliberately no second "publicly filterable" list, because two nearly-identical allow-lists is exactly how one of them drifts.
- `?status=in_review` on the public API returns **200 with the ordinary public list**, not a 400. A validation error there would have been an existence oracle: its distinctive shape would confirm to an unauthenticated caller that the label is real. Normalising before validating makes the review vocabulary unobservable from outside.
- The ingest dedup window now includes the review states, so `POST /api/ingest/topics` cannot create a second copy of a topic that is already sitting in the review queue, unpublished and invisible to a `pending`/`active`-only lookup.
- The shared `VoteStatus` type and `VoteStatusSchema` carry all ten database labels, and `'cancelled'` — which never existed in the database — is documented as a legacy API alias instead of being silently retained.
- A 20-case regression test pins the predicates into the SQL rather than into the returned rows.

## Task Commits

1. **Task 1: Allow-lists and the TypeScript status vocabulary** — `0781a91` (feat)
2. **Task 2: The six audited read paths in db.ts** — `5979545` (fix) — ⚠️ see "Deviations", this commit accidentally carries two other plans' files
3. **Task 3: Visibility regression test** — `8bfd17d` (test), 20 cases

## `getVoteById` per-caller verdict

The plan required an explicit public/internal verdict for every caller. `grep -rn 'getVoteById' apps/web/src` returns 48 lines; below is every one that is a real call site of the **db.ts** function.

| Caller | Surface | Verdict |
| --- | --- | --- |
| `app/api/votes/[id]/verify-location/route.ts:45` | Public — a resident GPS-verifying against a vote's municipality | **`getVoteById`** (filtered) |
| `app/api/votes/[id]/issue-coin/route.ts:19` | Public — reads a vote's issue coin | **`getVoteById`** (filtered) |
| `app/api/votes/[id]/issue-coin/holders/route.ts:29` | Public — lists issue-coin holders | **`getVoteById`** (filtered) |
| `services/nft/index.ts:87, 243, 254, 297, 446` | **Not this function.** `nft/index.ts:87` declares its own module-private `getVoteById` that queries `votes` directly; lines 243–446 call that local one | Left alone — out of `files_modified`, and it is an internal resolution path that legitimately needs unfiltered reads. Logged here so a later reader does not mistake it for a missed call site |
| `__tests__/api/issue-coin.test.ts`, `vote-participation.test.ts`, `vote-verify-location.test.ts` (39 lines) | Test doubles — `vi.fn()` mocks and `mockResolvedValue` calls | No change; they mock the db module, so the added predicate is invisible to them |

**Net: all three real callers are public and keep the filtered `getVoteById`.** `getVoteByIdUnfiltered` therefore has **no caller yet** — it exists so that 05-05's reviewer use-cases have an honest, named, documented way to read a proposal under review, rather than quietly removing the filter later. This is expected, not dead code, and mirrors 05-02's `quotaExceeded()` constructor landing before its first consumer.

Related audit outcomes, for completeness: `getVoteWithOptions` has two callers (`api/votes/[id]/route.ts:19` and `api/votes/[id]/participate/route.ts:60`), both public, both correctly filtered now — a review-state proposal is neither readable nor participable. `getVotesByMunicipality` has two callers (`vote.repo.ts:24`, typed `PublicVoteStatus`, and `get-dashboard.ts:61`, passing the literal `'active'`), so the type system now guarantees no caller can pass a review status.

## The two deliberate behaviour changes

Recorded prominently so neither is later "fixed" as a bug.

**`'failed'` is not on the allow-list.** It marks a vote whose NFT resolution failed. Because `getVotesByMunicipality` carried no status predicate before this plan, such a vote *was* visible in default municipality listings and now is not. That is a genuine narrowing of the live public surface. It follows from the locked allow-list membership and is intended.

**`'pending'` is on the allow-list.** In this codebase `pending` means "approved and scheduled, not yet open" — it has never meant "awaiting approval", a point 05-02 already pinned with a test. `/he/votes` shows scheduled votes today, and the security goal here is excluding the four *review* states, which the allow-list still does. Dropping `pending` alongside them would have been an unrelated behaviour change to a live surface. Both constraints are written as comments above the constant.

## Decisions Made

- **The safe name is the short name.** `getVoteById` is the filtered one; the unfiltered behaviour was renamed `getVoteByIdUnfiltered` and carries a docblock saying it may only be called after authorization. Had it kept the plain name with a new `getVoteByIdPublic` beside it, every existing caller would have silently stayed on the unsafe path.
- **`countVotesCreatedByUser` filters, `getVotesCreatedByUser` does not.** Both are creator-scoped, so neither is a cross-user leak. But the count feeds a "votes created" statistic where an unsubmitted draft or a rejected submission is not an achievement, while the listing is the submitter's own worklist and must show exactly those rows. Different jobs, different filters, both commented.
- **`getVotesByMunicipality`'s parameter type was widened in Task 1, not Task 2.** Task 1 retypes `vote.repo.ts` to `PublicVoteStatus` and Task 1's gate is a green `tsc`, so the db.ts signature had to widen in the same commit or the gate could not pass. Only the type moved in Task 1; the actual `.in(...)` predicate landed in Task 2 as specified.
- **The shared type and schema list the ten labels in the same order as each other** (publication states, then review states), with a cross-reference comment in each file stating that holding a status here does **not** make it publicly visible — visibility is the narrower server-side allow-list.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Widened `getVotesByMunicipality`'s parameter type inside Task 1**

- **Found during:** Task 1
- **Issue:** retyping `vote.repo.ts`'s filter to `PublicVoteStatus` made it pass a five-member union into a parameter typed `'pending' | 'active' | 'ended'`, failing `tsc` — which is Task 1's own verification gate.
- **Fix:** widened the signature to `status?: PublicVoteStatus` and added the type-only import. No query behaviour changed in Task 1; Task 2 added the predicate.
- **Files modified:** `apps/web/src/lib/supabase/db.ts` (3 lines)
- **Committed in:** `0781a91`

### Process deviations — read these

**2. [Incident] Task 2's commit `5979545` swept in two other plans' files**

- **What happened:** `git add apps/web/src/lib/supabase/db.ts` staged only my file, but a concurrently-running plan had independently staged its own files into the shared index in the same window. The subsequent `git commit` (no paths given) took the whole index: **10 files instead of 1**.
- **What is in it that is not mine:** `apps/web/package.json` and `pnpm-lock.yaml` (05-04's), and seven files under `apps/web/src/components/space-admin/` and `apps/web/src/app/[locale]/space-admin/` (05-11's).
- **Recovery attempted and abandoned:** `git reset --soft HEAD~1` to re-commit narrowly. The reset was itself undone by concurrent git activity — HEAD returned to the identical hash `5979545` and the working tree was rebuilt around it. **I did not retry.** Rewriting shared history underneath two actively-committing agents is how work actually gets destroyed, and the race had already demonstrated itself once.
- **Impact:** none on content. Every file in that commit is real, wanted work that belongs on this branch; only the attribution is wrong. Nothing was lost or overwritten — verified by re-grepping all nine of this plan's files afterwards.
- **What 05-04 and 05-11 will see:** those specific files already committed. Their own commits will contain only their later deltas, and their summaries may report a file list that does not match their commits. Reconciliation belongs to 05-16.
- **Mitigation adopted for the rest of the plan:** Task 3 used a path-scoped commit (`git commit -- <path>`), which commits only the named path regardless of what else sits in the index. It produced a clean single-file commit. **Later plans sharing this tree should use the path-scoped form, not `git add` + bare `git commit`.**

### Out of scope, logged not fixed

**3. `apps/mobile` typecheck is red on a duplicate `@types/react` — this blocks CI, and it is not this plan's break**

Logged in full at `deferred-items.md` item 5. In brief: `pnpm --filter @sync/mobile typecheck` emits **130 errors, all of them `TS2786`**, across ~19 files no phase-5 plan has touched, caused by `@types/react@18.3.27` and `@types/react@19.2.7` both being installed (React 19's `ReactNode` admits `bigint`; React 18's does not, so the two identities are mutually unassignable).

Evidence that 05-03's union widening is not the cause:

- Mobile typechecked **clean at 2026-08-02T16:15:16Z**, immediately before this plan's first edit.
- Mobile typechecked **clean again at the Task 1 gate (`MOBILE_EXIT=0`) with this plan's `votes.tsx` change already applied** — that is the criterion the plan asked for, and it was met.
- It went red later in wave 2, after `apps/web/package.json` + `pnpm-lock.yaml` (05-04's declared files) were modified and reinstalled.
- A union-widening break would surface as `TS2353` (excess `cancelled`) or `TS2739`/`TS2741` (six missing keys) on `statusColors`. **Zero errors of those codes exist anywhere in the app.** The seven errors reported on `votes.tsx` are all `TS2786` on `SafeAreaView`, `Animated.View` and `Ionicons` at lines 108–182; there is nothing on lines 20–37, where `statusColors` is declared and read.

Not fixed here because the remedy is a workspace-wide `pnpm.overrides` pin plus a reinstall, which means editing another live plan's owned files and re-resolving dependencies under two agents' uncommitted work. Owner: 05-04 or 05-16.

---

**Total deviations:** 1 auto-fixed (blocking), 1 process incident, 1 out-of-scope finding.
**Impact on plan:** no scope change. All five success criteria met in the code.

## Verification Results

- `pnpm --filter @sync/web typecheck` — **green**
- `pnpm --filter @sync/shared typecheck` — **green**
- `pnpm --filter @sync/mobile typecheck` — **green at the Task 1 gate with this plan's change applied**; red at final verification for the unrelated dependency reason above
- `pnpm --filter @sync/web exec vitest run src/__tests__/services/vote-status-visibility.test.ts src/__tests__/api/votes.test.ts src/__tests__/api/vote-detail.test.ts` — **43 tests, 3 files, all passing**
- `grep -c "export const PUBLIC_VOTE_STATUSES"` → `1`; the array is exactly `['pending','active','ended','resolving','resolved']`
- `grep -c "PUBLIC_FILTERABLE_VOTE_STATUSES"` → `0` — no second allow-list
- `grep -c "ListQuerySchema.parse("` → `0` — the throwing form never appeared
- `grep -c "normalizeStatusFilter(params.get('status'))"` → `1` — still normalising before validating
- `grep -c "'pending' | 'active' | 'ended'" vote.repo.ts` → `0` — the local narrow union is gone
- `PUBLIC_VOTE_STATUSES` appears 6× in `db.ts`, `REVIEW_VOTE_STATUSES` 2×, `getVoteByIdUnfiltered` present with an `authorized` comment
- `'cancelled'` in `packages/shared/src/types/vote.ts` — matches only inside comments, never in the union
- `VoteStatusSchema` consumers re-grepped before editing: exactly five hits, all inside `packages/shared/src/contracts/vote.ts` (lines 11, 12, 68, 120, 202). Nothing outside it, so no undeclared write was needed

Deliberately **not** run: the full test suite, `pnpm lint`, and any repo-wide install. Wave 2 holds 05-04 and 05-11 against this same working tree; the phase's one full-suite run is 05-16's, alone in wave 6.

## Note on Task 3 and TDD

Task 3 is marked `tdd="true"`, but the plan orders it **after** the implementation it guards, so there was no meaningful RED phase — the behaviour was already correct when the test was written, and it passed on first run. The test's value here is as a regression guard, which is what the plan's `<done>` states ("a failing filter on any of the six read paths breaks a named test rather than shipping a leak"). It landed as a single `test(05-03)` commit rather than a RED/GREEN pair.

## Requirements Tick — Deliberately Withheld

`requirements mark-complete SPACE-05` was **not** run, and `REQUIREMENTS.md` is unmodified by this plan, following the convention `REQUIREMENTS.md:56-61` records and 05-02 already applied. SPACE-05 is covered by five plans; ticking it here would reintroduce exactly the premature ticks that were reset after 05-01.

What 05-03 contributes to SPACE-05: the guarantee that a proposal under review is invisible on every public read path, which is the *precondition* for the review workflow rather than the workflow itself. The authoritative check stays `05-VERIFICATION.md` plus 05-16's evidence document.

## User Setup Required

None.

## Next Phase Readiness

- **05-05 (review workflow)** can now write review states safely — no public surface will show them. Its reviewer-side reads should call `getVoteByIdUnfiltered`, which is its first intended consumer.
- **05-10 (submission behind review)** owns moving `initialStatus`; this plan deliberately left it untouched.
- **05-16** inherits three things: the duplicate-`@types/react` break (deferred item 5), the commit-attribution reconciliation from incident 2, and 05-01's still-unapplied migrations.
- Anyone adding a `vote_status` label later gets the safe default automatically: it will be invisible publicly until they add it to `PUBLIC_VOTE_STATUSES` on purpose.

---
*Phase: 05-space-governance-substrate-and-space-admin-operations-dashboard*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 9 claimed source files plus this summary exist on disk. All 3 claimed commits (`0781a91`, `5979545`, `8bfd17d`) resolve in `git log`.

Two claims are deliberately qualified rather than asserted clean, and both are stated as such above rather than buried: `pnpm --filter @sync/mobile typecheck` does **not** exit 0 at final verification (duplicate `@types/react`, not caused by this plan — deferred item 5), and commit `5979545` carries seven files belonging to 05-11 plus two belonging to 05-04 (incident 2).
