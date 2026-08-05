---
phase: 05-space-governance-substrate-and-space-admin-operations-dashboard
plan: 02
subsystem: api
tags: [zod, vitest, typescript, authorization, capabilities, feature-flag, contracts]

# Dependency graph
requires: []
provides:
  - "Closed capability vocabulary of exactly eleven actions with Hebrew UI labels (CAPABILITIES, Capability, CAPABILITY_LABELS_HE)"
  - "Five role presets expanded at grant time (ROLE_PRESETS, expandPreset, ROLE_PRESET_LABELS_HE, isCapability)"
  - "Pure proposal-review transition rules (REVIEW_VOTE_STATUSES, isDecidableFrom, resolveDecisionTarget, reviewerMayDecide, auditActionFor, capabilityFor, REVIEW_STATUS_LABELS_HE)"
  - "AppError QUOTA_EXCEEDED variant with a 429 mapping and a quotaExceeded() constructor"
  - "isSpaceAdminEnabled() one-variable rollout gate"
  - "packages/shared/src/contracts/spaceAdmin.ts — the phase's complete request/response contract surface"
affects: [05-03, 05-04, 05-05, 05-06, 05-07, 05-08, 05-09, 05-16, issue-68, issue-74]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure domain modules under server/domain/space/ with no IO, no framework, no @/lib imports"
    - "One shared contract file per phase, so parallel plans never contend on packages/shared"
    - "Closed const-tuple vocabularies with `as const satisfies` so presets cannot name an orphan string"

key-files:
  created:
    - apps/web/src/server/domain/space/capability.ts
    - apps/web/src/server/domain/space/capability.test.ts
    - apps/web/src/server/domain/space/review.ts
    - apps/web/src/server/domain/space/review.test.ts
    - apps/web/src/lib/features/space-admin.ts
    - packages/shared/src/contracts/spaceAdmin.ts
  modified:
    - apps/web/src/server/http/errors.ts
    - packages/shared/src/contracts/index.ts
    - apps/web/.dev.vars.example
    - .env.example

key-decisions:
  - "Capability vocabulary is exactly eleven actions, mapped 1:1 onto the UI capability manifest and asserted by test in spec order"
  - "No twelfth `space.read` capability — reaching the dashboard shell is membership via resolveMembership(), not a capability"
  - "proposal.reject carries request-changes as well as reject; only proposal.approve publishes"
  - "Role presets are grant-time bundles; granted_via_role is provenance for the UI and never authority"
  - "in_review is the only decidable prior state; `pending` stays 'scheduled, not started' and is pinned out of scope by test"
  - "QUOTA_EXCEEDED's 429 body carries no scope, count or limit — localized text lives in the UI keyed off `code`"
  - "Escalations write no space audit action; the absence is documented at EscalationRequestSchema"
  - "SpaceSummary.type is a plain string, not an enum, so the contract does not fork the DDL's type list that #74 will extend"

patterns-established:
  - "Label maps are asserted Latin-free, so an English placeholder cannot ship in a Hebrew-only product"
  - "Response allow-lists are authored separately from row types, so a new private column can never join a response"
  - "Cursor pagination with no total on append-only logs"

requirements-completed: [SPACE-02, SPACE-04, SPACE-05]

# Metrics
duration: 12min
completed: 2026-08-02
---

# Phase 5 Plan 02: Governance Domain Core and Shared Contracts Summary

**Eleven-action capability vocabulary and pure proposal-review transition rules, plus a typed 429 quota error, a one-variable kill switch, and the phase's entire zod contract surface in one uncontended file.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-02T15:53:04Z
- **Completed:** 2026-08-02T16:05:22Z
- **Tasks:** 3 (two of them TDD)
- **Files modified:** 10 (6 created, 4 modified)

## Accomplishments

- The capability vocabulary is closed at eleven actions and pinned to the UI manifest by a test that compares `CAPABILITIES.map(c => CAPABILITY_LABELS_HE[c])` against the eleven spec strings **in spec order** — adding, removing, renaming, or reordering a capability without touching the UI spec is now a test failure rather than a review comment.
- Review transitions are pure and total over the decision set, reuse the existing `initialStatus()` publication rule rather than restating it, and refuse a reviewer their own submission.
- `AppError` can express a quota rejection, and because `toHttp` is an exhaustive switch, `tsc` proved the 429 mapping landed.
- Every request and response shape the phase needs now exists in `packages/shared/src/contracts/spaceAdmin.ts`, so plans 03–09 import from it and none of them reopens a shared file.

## Task Commits

1. **Task 1: Capability vocabulary and role presets** — `c3e0675` (test, RED) → `bef071c` (feat, GREEN). 24 tests.
2. **Task 2: Review transitions and the self-review rule** — `db4bb36` (test, RED) → `5da516e` (feat, GREEN). 28 tests.
3. **Task 3: QUOTA_EXCEEDED, rollout flag, shared contracts** — `d05e022` (feat).

No refactor commits were needed; both GREEN implementations were already at their final shape.

## Files Created/Modified

- `apps/web/src/server/domain/space/capability.ts` — the eleven capabilities, their Hebrew manifest labels, five role presets, `expandPreset`, `isCapability`. Carries the two mandated absence comments.
- `apps/web/src/server/domain/space/capability.test.ts` — 24 assertions: the count, the 1:1 spec-order label mapping, no extra label keys, no Latin in any label, presets naming only known capabilities, and a guard against a `space.read` capability reappearing.
- `apps/web/src/server/domain/space/review.ts` — review status vocabulary, `isDecidableFrom`, `resolveDecisionTarget`, `reviewerMayDecide`, `auditActionFor`, `capabilityFor`, `REVIEW_STATUS_LABELS_HE`.
- `apps/web/src/server/domain/space/review.test.ts` — 28 assertions including `isDecidableFrom('pending') === false` and a table-driven totality check over `DECISIONS`.
- `apps/web/src/server/http/errors.ts` — one union member, one constructor, one switch case. 8 insertions, 0 deletions.
- `apps/web/src/lib/features/space-admin.ts` — `isSpaceAdminEnabled()`, default on.
- `apps/web/.dev.vars.example`, `.env.example` — `SPACE_ADMIN_ENABLED`, commented optional.
- `packages/shared/src/contracts/spaceAdmin.ts` — the full contract surface (exports listed below).
- `packages/shared/src/contracts/index.ts` — barrel re-export.

## Exported names from `spaceAdmin.ts`

Later plans should import these rather than re-declare them. Every schema has a matching `z.infer` type of the same name minus the `Schema` suffix.

**Primitives:** `ReasonSchema` (trimmed, 10–500) · `CapabilitySchema` · `RolePresetSchema`

**Proposals and content:** `DecisionSchema` · `DecideProposalRequestSchema` · `ContentActionSchema` · `ModerateContentRequestSchema` · `ProposalStatusSchema` · `ProposalSummarySchema` · `ProposalDetailSchema` · `ProposalListResponseSchema`

**Grants and membership:** `GrantCapabilityRequestSchema` · `RevokeCapabilityRequestSchema` · `SuspendMemberRequestSchema` · `ReinstateMemberRequestSchema` · `SuspendGrantRequestSchema` · `SpaceMemberSchema` · `SpaceMemberListResponseSchema`

**Notifications:** `AudienceFilterSchema` · `PreviewAudienceRequestSchema` · `AudiencePreviewResponseSchema` · `SendNotificationRequestSchema` · `SendNotificationResponseSchema` · `SpaceNotificationQuotaSchema`

**Escalation:** `EscalationRequestSchema` · `EscalationResponseSchema`

**Metrics:** `SpaceMetricSchema` · `SpaceMetricsResponseSchema`

**Audit:** `AuditRowSchema` · `AuditPageSchema`

**Shell:** `SpaceSummarySchema`

## Decisions Made

- **Capability order is load-bearing, not just capability count.** The plan required an 11-member vocabulary mapping 1:1 onto the manifest; the test additionally pins the *order*, because the manifest renders one row per array member and a reorder would silently reshuffle the UI.
- **`SpaceSummary.type` is `z.string()`, not an enum.** 05-01 owns the DDL that defines the concrete space types and #74 will add more. Duplicating the enum in the contract would fork it on the first new type, which is the exact contention this file exists to avoid.
- **`ProposalStatusSchema` *is* an enum** (`draft | in_review | changes_requested | rejected | pending | active | ended`) — unlike space type, this list is fully determined by this phase's own review vocabulary plus the three publication states `resolveDecisionTarget` can return, so typing it costs nothing and catches a typo.
- **Three response shapes were added beyond the plan's enumerated list** — `SendNotificationResponseSchema`, `SpaceNotificationQuotaSchema`, `EscalationResponseSchema`, plus the two list wrappers `ProposalListResponseSchema` and `SpaceMemberListResponseSchema`. Each is backed by a specific UI-spec row (the sent Receipt's four rows, the `QuotaBlock` reset date, the escalation success announcement, `{n} חברים במרחב`). Omitting them would have forced a later plan to reopen this file, defeating success criterion 4.
- **`SpaceNotificationQuotaSchema` is separate from the preview response** rather than adding a reset date to it. The plan specified the preview response's fields exactly, and `QuotaBlock` renders in composer state 0 where no campaign exists yet — so the reset date needs a home that does not require a preview.

## Deviations from Plan

No code deviations. One verification-command conflict, recorded rather than silently resolved:

**1. [Documented] The `space.read` verification grep matches three lines, all of them the guard**

- **Found during:** Task 1 final verification
- **Issue:** The plan's `<verification>` block states `grep -rn "space.read" apps/web/src/server/domain/space/` returns nothing. It returns three lines. This is unavoidable: Task 1's own `<acceptance_criteria>` requires "A comment in the file explains why there is no twelfth `space.read` capability", and the test guarding against its return must name the string to assert it absent.
- **Resolution:** Kept both the mandated comment and the guard test. The substantive check passes — `space.read` is not a member of `CAPABILITIES`, verified by `grep -n "'space.read'," capability.ts` returning nothing. The three matches are `capability.ts:17` (the absence note) and `capability.test.ts:39-40` (the guard). This is the same shape as the phase's `escalation.raised` convention: a reference that exists only to document or enforce an absence is not a violation of it.
- **Verification:** `expect(CAPABILITIES).not.toContain('space.read')` passes; `CAPABILITIES` has length 11.

**2. [Out of scope, not fixed] `prettier --check` fails repo-wide**

- **Found during:** Task 3
- **Issue:** `npx prettier --check` flags all eight files this plan touched — but it equally flags untouched pre-existing files (`council.ts`, `decision.ts`, `council-public-pages.ts`). There is no prettier config in the repo, so the check is running against defaults the codebase does not follow.
- **Resolution:** Not fixed. Running `--write` would reformat files against a convention the repo has not adopted, and pre-existing formatting in unrelated files is outside this task's scope. New files follow the surrounding house style (2-space, single quotes, ~90 col). `tsc --noEmit` is green for both packages.

---

**Total deviations:** 0 code changes. 2 documented notes (1 verification-command conflict resolved in favour of the task acceptance criteria, 1 pre-existing out-of-scope finding).
**Impact on plan:** None. All five success criteria met.

## Issues Encountered

- **Execution was interrupted mid-Task-3 by an API stall.** Parts A and B (the error variant, the flag, both env files) had been applied but not committed. On resume the working tree was re-read rather than re-derived, the applied parts were confirmed correct and left alone, and only Parts C and D were written. Task 3 landed as a single commit as planned.
- **Barrel collision check.** `spaceAdmin.ts` exports `Capability`, `RolePreset`, and `Decision`, which are generic enough to collide in `contracts/index.ts`. Checked explicitly across all barrel members — no duplicate exported names — and `pnpm --filter @sync/shared typecheck` is green.

## Verification Results

- `pnpm --filter @sync/web typecheck` — green (proves the exhaustive `toHttp` switch got its case)
- `pnpm --filter @sync/shared typecheck` — green
- `pnpm --filter @sync/web exec vitest run src/server/domain/space/capability.test.ts src/server/domain/space/review.test.ts` — 52 tests, 2 files, all passing
- All eleven `CAPABILITY_LABELS_HE` values confirmed present verbatim in `05-UI-SPEC.md`
- `SpaceMemberSchema` block contains zero matches for `email|phone|idNumber|dateOfBirth` (case-insensitive)
- `AuditPageSchema` has `nextCursor` and zero occurrences of `total`
- `SPACE_ADMIN_ENABLED` confirmed in both env files by two separate `grep -q` calls
- `errors.ts` diff is 8 insertions, 0 deletions — well under the 15-line ceiling

Deliberately **not** run: the full test suite. 05-01 executes in this same wave against the same working tree; the phase's one full-suite run is 05-16's, alone in wave 6.

### Wave-1 cross-plan consistency (checked after 05-01 landed)

05-01 independently encoded the same vocabulary in the DDL. Verified they agree, since a mismatch would make every grant insert fail at runtime with a green typecheck:

- `space_capability_grants`' CHECK list in `supabase/migrations/20260802000010_space_governance.sql:89-92` is the same eleven identifiers **in the same order** as `CAPABILITIES`.
- The four labels added by `20260802000011_vote_status_review_values.sql` (`draft`, `in_review`, `changes_requested`, `rejected`) are exactly `REVIEW_VOTE_STATUSES`.
- `auditActionFor('approve')` returns `'proposal.approved'`, which is the literal the DDL's `uq_space_proposal_single_approval` partial unique index keys on (`:157`). That index is what makes concurrent double-approval structurally impossible, so this string is load-bearing and must not be renamed.

## Requirements Tick — Deliberately Withheld

`requirements mark-complete SPACE-02 SPACE-04 SPACE-05` was **not** run, and `REQUIREMENTS.md` is unmodified by this plan.

`REQUIREMENTS.md:56-61` carries an explicit "Note on tick timing": a tick means "some covering plan landed", not "the requirement is satisfied", and it records that SPACE-04 and SPACE-09 "were auto-ticked after plan 05-01 alone and have been reset". All three requirements this plan declares are multi-plan — SPACE-04 alone is covered by plans 01, 02, 05, 07, 15 and 16. Running the standard tick step here would have reintroduced exactly the premature ticks that were just undone.

What 05-02 actually contributes to each: the capability vocabulary and preset expansion for SPACE-02, the typed 10–500 `ReasonSchema` for SPACE-04, and the review-state transitions plus the self-review refusal for SPACE-05. None is enforced end-to-end until the use-case and route plans land. The authoritative check stays `05-VERIFICATION.md` plus 05-16's evidence document.

See `deferred-items.md` in this directory, which also logs a pre-existing inconsistency: SPACE-04's checkbox is reset but its traceability-table row still reads `Complete`.

## User Setup Required

None. `SPACE_ADMIN_ENABLED` is optional and defaults to on; no deployment needs to set it unless rolling the dashboard back.

## Next Phase Readiness

- Plans 03–09 can import the capability vocabulary, the review rules, and every contract shape. None of them should need to edit `packages/shared/src/contracts/spaceAdmin.ts` or `apps/web/src/server/http/errors.ts`.
- `resolveMembership()` is named in `capability.ts`'s absence comment but belongs to plan 05-04 — the comment is a forward reference, not a dangling import.
- The `quotaExceeded()` constructor has no caller yet; the notification composer plan is its first consumer. This is expected, not dead code.

---
*Phase: 05-space-governance-substrate-and-space-admin-operations-dashboard*
*Completed: 2026-08-02*

## Self-Check: PASSED

All 10 claimed files exist on disk. All 5 claimed commits exist in git history.
