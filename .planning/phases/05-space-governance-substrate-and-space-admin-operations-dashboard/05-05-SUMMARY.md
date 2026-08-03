---
phase: 05-space-governance-substrate-and-space-admin-operations-dashboard
plan: 05
subsystem: api
tags: [neverthrow, supabase, zod, vitest, concurrency, authorization, audit, typescript]

# Dependency graph
requires:
  - phase: 05-02
    provides: isDecidableFrom, resolveDecisionTarget, reviewerMayDecide, auditActionFor, capabilityFor, DecideProposalRequestSchema, ProposalDetailSchema
  - phase: 05-03
    provides: the reconciled vote_status vocabulary the transition writes into
  - phase: 05-04
    provides: branded SpaceScope + authorize(), insertAuditRow, toProposalSummary, the shared space fixtures
provides:
  - space-decision.repo.ts — findProposalInScope (scoped single read) and transitionProposal (conditional UPDATE, typed 409)
  - DECISION_CONFLICT_HE — the one definition of the 409 sentence, shared by repository and use-case
  - decideProposal() — the six-step decision chain, with the 05-10 charge seam marked between steps 4 and 5
  - getProposalDetail() — what `?proposal={id}` deep links resolve against
  - POST /api/space-admin/[spaceId]/proposals/[voteId]/decide
  - GET  /api/space-admin/[spaceId]/proposals/[voteId]
  - 29 tests across space-admin-decide.test.ts and space-admin-audit.test.ts
affects: [05-06, 05-09, 05-10, 05-12, 05-16]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional UPDATE carrying both the space predicate and the prior state, with zero rows folded to a typed 409 inside the repository"
    - "A named seam comment placed by line position, with the ordering itself an acceptance criterion"
    - "Mock-with-importOriginal so a shared Hebrew constant under test stays the shipped one rather than a copy"
    - "Module-shape assertions run against vi.importActual, never the mocked namespace"

key-files:
  created:
    - apps/web/src/server/infra/supabase/space-decision.repo.ts
    - apps/web/src/server/app/space-admin/decide-proposal.ts
    - apps/web/src/app/api/space-admin/[spaceId]/proposals/[voteId]/decide/route.ts
    - apps/web/src/app/api/space-admin/[spaceId]/proposals/[voteId]/route.ts
    - apps/web/src/__tests__/api/space-admin-decide.test.ts
    - apps/web/src/__tests__/api/space-admin-audit.test.ts
  modified: []

key-decisions:
  - "The 409 sentence is one exported constant (DECISION_CONFLICT_HE) shared by the repository and the use-case, not a literal repeated in both"
  - "The decision responds with the updated ProposalDetail, the same shape the GET detail route returns, so the client replaces the row from the response"
  - "getProposalDetail lives in decide-proposal.ts rather than a new module, because the plan's files_modified is the contention contract in a shared worktree"
  - "A malformed voteId is a 403 at the route edge, never a 400 and never a Postgres uuid error"
  - "findProposalInScope embeds the submitter, because ProposalDetailSchema requires submitterDisplayName"

patterns-established:
  - "Pattern: the 409 originates in the repository, so no caller can forget to produce it"
  - "Pattern: the audit write is the last link of the same Result chain — an unauditable decision is a failed decision"

requirements-completed: []

# Metrics
duration: 14min
completed: 2026-08-03
---

# Phase 5 Plan 05: Proposal decisions, concurrency and the audit row Summary

**Approve/reject/return-for-changes as a fixed six-guard chain whose authoritative step is a single conditional `UPDATE` carrying both the space predicate and the prior state — the loser of a race gets a typed 409 and writes no audit row, and the ₪50 seam for 05-10 sits between the target resolution and the publish.**

## Performance

- **Duration:** 14 min (07:32:39Z → 07:46:34Z)
- **Tasks:** 3 (two of them TDD)
- **Files:** 6 created, 0 modified

## Accomplishments

- **Concurrency is structural, not advisory.** `transitionProposal` writes `.eq('id')`, `.eq('municipality_id')` and `.eq('status', prior)` into one statement; zero rows becomes `conflict(...)` inside the repository, so a second publication has no code path. A comment records why `pg_advisory_xact_lock` is the wrong tool here (pooled connections from Workers make session-scoped lock semantics undependable) and names `uq_space_proposal_single_approval` as the database backstop underneath.
- **Self-review is refused server-side and provably before any write.** The test asserts `transitionProposal` was never called, so the refusal cannot be an artefact of the UI having hidden the button.
- **The audit write is inside the chain, not after it.** `insertAuditRow(...)` is line 127 and the terminal `.map(` is line 136, so a failed audit write fails the request — verified by a case that mocks the insert to a DB error and expects 500.
- **The 05-10 seam is placed and pinned.** The marker is line 118; the `transitionProposal(` call is line 123. 05-10's acceptance criterion compares exactly these two line numbers.
- **29 tests, none of them a full-suite run.** 05-06, 05-07 and 05-08 were committing into this same worktree throughout.

## Task Commits

1. **Task 1: Conditional decision repository** — `f4974d6` (feat)
2. **Task 2 RED: decision route tests** — `144a106` (test)
3. **Task 2 GREEN: the decide chain and two routes** — `4b1a6ef` (feat)
4. **Task 3: audit-row and mutation-vocabulary tests** — `c02fe50` (test)

All four commits were made with the path-scoped form and audited with `git show --stat`; each contains only this plan's files. Sibling commits `c9b570c` (05-06), `dad4868` (05-08) and `589f5df` (05-07) landed between mine and are unaffected.

## Where plan 05-10 inserts the creation-fee charge

**`apps/web/src/server/app/space-admin/decide-proposal.ts`, line 118** — the comment

```
// 05-10 inserts the creation-fee charge here, ahead of the transition, so an
// approval either charges and publishes or does neither. Do not reorder.
```

sits between guard step 4 (`resolveDecisionTarget` computes `next`, line 116) and guard step 5 (`transitionProposal`, line 123). The charge belongs on the `approve` branch only; `next` is already in scope and `row` carries `creator_id`, which is the party the obligation is recorded against.

Two things 05-10 must not do. **Do not move the marker after the transition** — that yields publish-then-charge, which contradicts the approve dialog's promise that a failed charge leaves `אף סכום לא נגבה`. And **do not make the charge failure a 500**: `AppError` already has `PAYMENT_INVALID` → 402, which is the shape the dialog's `role="alert"` copy is written against.

## Files Created

- `apps/web/src/server/infra/supabase/space-decision.repo.ts` — `findProposalInScope`, `transitionProposal`, `DECISION_CONFLICT_HE`, `ProposalDetailRow`. Two functions only: 05-06's moderation writer is a separate module so the two plans never contend on one file.
- `apps/web/src/server/app/space-admin/decide-proposal.ts` — `decideProposal`, `getProposalDetail`, the private `toProposalDetail` mapper and `SELF_SUBMITTED_HE`.
- `.../proposals/[voteId]/decide/route.ts` — POST, 40 lines, parses `DecideProposalRequestSchema`.
- `.../proposals/[voteId]/route.ts` — GET, 30 lines, the detail panel and deep-link target.
- `apps/web/src/__tests__/api/space-admin-decide.test.ts` — 19 `it` blocks, 21 cases.
- `apps/web/src/__tests__/api/space-admin-audit.test.ts` — 8 cases.

## Decisions Made

- **`DECISION_CONFLICT_HE` is one exported constant, not a literal in two files.** The repository raises it when the conditional update loses the race; the use-case raises it when the row it just read is already decided. Those are the same user-facing condition and one sentence rendered two ways would be a defect nobody notices until a screenshot review. Task 2's acceptance criterion asks that the sentence "appear in the source"; it appears once, at `space-decision.repo.ts:29`, and `space-admin-decide.test.ts` additionally asserts the constant equals the UI-spec string verbatim — a stronger guarantee than a grep, because a grep cannot notice a changed character.
- **The decision returns the updated `ProposalDetail`.** The plan does not specify a success body. Returning the same shape the GET detail route returns lets the client swap the row without a refetch, and it means one response allow-list covers both endpoints.
- **`getProposalDetail` lives in `decide-proposal.ts`.** A `get-proposal-detail.ts` would have been the tidier home, but in a worktree with three sibling executors the plan's `files_modified` list is the contention contract, and adding an unlisted module is exactly how the phase's earlier mixed-authorship commit happened. The module docblock states it covers "one proposal: the decision, and the detail panel the decision is made against".
- **A malformed `voteId` is a 403 at the route edge.** `parse(ProposalSummarySchema.shape.id, voteId)` mapped to `forbidden()`. Without it a non-uuid reaches Postgres as a uuid literal and returns 500, and a 400/403 split on id shape would contradict 05-04's uniform-denial rule. Both routes do it identically.
- **`toProposalSummary` is reused rather than a second display-name helper written.** `ProposalDetailRow extends ProposalRow`, so the queue's mapper accepts it structurally and the `תושב/ת` fallback exists once.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] `findProposalInScope` must embed the submitter**

- **Found during:** Task 1
- **Issue:** The plan's column list has no join to `users`, but the GET detail route it feeds must produce a `ProposalDetail`, and `ProposalDetailSchema` extends `ProposalSummarySchema`, which requires `submitterDisplayName`. The plan's literal list would have made the detail panel unable to name the submitter. This is the same gap 05-04 hit on `listProposals`.
- **Fix:** Added `users(first_name, last_name)` to the select and projected `submitter_first_name` / `submitter_last_name`, mirroring `listProposals` exactly. `ProposalDetailRow` is therefore `ProposalRow` plus `start_date` and `end_date`.
- **Verification:** The GET detail test asserts the mapped body; `pnpm --filter @sync/web typecheck` accepts `ProposalDetailRow` where `toProposalSummary` expects `ProposalRow`.
- **Committed in:** `f4974d6`

**2. [Rule 2 - Missing functionality] No validation of `voteId` anywhere in the plan**

- **Found during:** Task 2
- **Issue:** `authorize()` validates `spaceId`, but nothing validated `voteId`. A non-uuid would have reached `.eq('id', voteId)` and returned a 500 from Postgres — an unhandled failure mode on an authorization surface, and inconsistent with the phase rule that every unresolvable id is the same opaque 403.
- **Fix:** Both routes parse it through `ProposalSummarySchema.shape.id` and map failure to `forbidden()`.
- **Verification:** Covered indirectly by the cross-space case; both routes typecheck and the shape is the contract's own.
- **Committed in:** `4b1a6ef`

### Deliberate departures

- **`transitionProposal` returns `Vote`, not a new `VoteRow` alias.** `Vote = Tables<'votes'>` already exists in `types.ts`; adding a second name for the same row type is how two names drift.
- **The mutation-vocabulary assertion uses `vi.importActual`, not a plain namespace import.** The plan's snippet does `import * as auditRepo from '@/server/infra/supabase/space-audit.repo'`, but this file mocks that module in order to inspect the row handed to `insertAuditRow`. `Object.keys` over the mocked namespace would describe the mock, so the assertion would pass regardless of what the repository exports — it would be a test that cannot fail. The real module is loaded for that one assertion, with a comment saying why.
- **The decide test file covers the GET detail route too** (two cases). Task 3 does not enumerate them, but the route ships in this plan and an unresolvable id answering 403 rather than 404 is one of its stated properties.

---

**Total deviations:** 2 auto-fixed (both Rule 2), 3 deliberate departures.
**Impact:** No change to the decision design. Both auto-fixes are corrections the plan's own success criteria required — the detail route cannot satisfy its contract without the embed, and "unresolvable ids answer 403" cannot hold if a malformed one answers 500.

## Issues Encountered

- **`pnpm --filter @sync/web typecheck` is currently red on two files that are not mine.** `src/__tests__/api/space-admin-metrics.test.ts` (05-07) and `src/__tests__/api/space-admin-audit-read.test.ts` (05-08) each reference a route module their GREEN step has not written yet. Both are siblings mid-TDD in this shared worktree; the error list contains no file from this plan, and typecheck was green at Task 1 and again after Task 2's GREEN commit. Not logged to `deferred-items.md` — it is a transient wave-3 state, not a defect.
- **Nothing here has touched a live Postgres.** `findProposalInScope`'s `users(first_name, last_name)` embed is reviewed, not executed, and joins the four unexecuted embeds 05-04 listed for 05-16's checklist. The empirical claim behind `transitionProposal` — winner gets `UPDATE 1`, loser `UPDATE 0` — comes from 05-RESEARCH.md's probe, not from a run in this plan.
- **`space_audit_log.prior_state` and `new_state` are written as `{ status: … }` objects.** The column is `Json | null` and accepts them at compile time; no runtime insert has been performed.

## Verification Results

- `pnpm --filter @sync/web typecheck` — exit 0 for every file in this plan (see Issues for the two sibling files)
- `pnpm --filter @sync/web exec vitest run src/__tests__/api/space-admin-decide.test.ts src/__tests__/api/space-admin-audit.test.ts` — **29 tests, 2 files, all passing**
- `grep -c "\.eq('status', prior)"` in `space-decision.repo.ts` → 1; `maybeSingle` present; no star select
- `grep -c "spaceId: string"` in `space-decision.repo.ts` → `0`
- `grep -c "notFound("` in `decide-proposal.ts` → `0`
- Seam marker at line 118 < `transitionProposal(` at line 123
- `insertAuditRow` at line 127 < terminal `.map(` at line 136
- `grep -rn "conflict("` in `space-decision.repo.ts` → one hit, so the 409 originates in the repository
- `uq_space_proposal_single_approval` named in a repository comment

Deliberately **not** run: the full suite, `next build`, `prettier --check`. Wave 3 has three other plans live in this tree; the phase's one full-suite run is 05-16's, alone in wave 6.

## User Setup Required

None.

## Next Phase Readiness

- **05-10** has its seam, its line number and its two prohibitions, recorded above.
- **05-12** (the proposals surface) can build against both endpoints. The decision responds with a full `ProposalDetail` carrying the new status, so the row and the chip update without a refetch, and `?proposal={id}` resolves through the GET route with a 403 for anything outside the space — the `ההצעה לא נמצאה במרחב הזה.` panel is the client's rendering of that 403, not of a 404.
- **05-06** owns `space-member.repo.ts`; `space-decision.repo.ts` deliberately contains no `setContentModeration`, so the two modules do not collide.
- **05-16** should add `findProposalInScope`'s submitter embed to the list of PostgREST relationships that have never been executed.

---
*Phase: 05-space-governance-substrate-and-space-admin-operations-dashboard*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 6 claimed files exist on disk. All 4 claimed commits (`f4974d6`, `144a106`, `4b1a6ef`, `c02fe50`) resolve in `git log`. Every line number cited above was re-read from the file after the last commit: seam 118, `transitionProposal(` 123, `insertAuditRow(` 127, terminal `.map(` 136, `DECISION_CONFLICT_HE` declared at 28 with the sentence on 29.

The claims deliberately **not** verified are the PostgREST submitter embed and the conditional `UPDATE` against a live Postgres — see Issues Encountered. Nothing above asserts they were executed.
