# Spec — issue #70 survey-completion ballot gate v1

## Current state

The issue is too large for one half-day PR and must be split. This first slice establishes only the server-side persistence and authoritative ballot gate; research orchestration, authoring/review UI, survey-taking UI, analytics, and mobile work require follow-up PRs.  
The authoritative integration point is `POST /api/votes/[id]/participate`, where the gate must run before `recordUserVoteOnce`.  
Ballot writes must preserve the existing `recordUserVoteOnce` unique-key/SQLSTATE `23505` idempotency behavior in `apps/web/src/lib/supabase/db.ts`.  
New persistence follows the Result-typed repository pattern under `server/infra/supabase`, while the participate route remains the existing thin HTTP shell.  
The schema has no survey versions or completion proofs; new records must preserve approved versions and remain separate from `user_votes` so survey data contains no ballot `option_id`.

## Goal

Add the smallest enforceable backend foundation: append-only survey-version and voter-completion records, an optional active approved survey association for a vote, and an authoritative pre-ballot check. A vote with an active approved survey version rejects an authenticated voter unless that voter has completed that exact version. Votes without an active survey remain unchanged in this transitional slice. Existing lawful ballots and ballot idempotency are preserved.

## In scope

- claim: supabase/migrations/20260816000001_vote_context_survey_gate.sql
- claim: apps/web/src/lib/supabase/types.ts
- claim: apps/web/src/server/infra/supabase/vote-survey.repo.ts
- claim: apps/web/src/server/app/votes/require-survey-completion.ts
- claim: apps/web/src/app/api/votes/[id]/participate/route.ts
- claim: apps/web/src/__tests__/api/vote-participation.test.ts
- claim: apps/web/src/__tests__/services/survey-completion-gate.test.ts

## Out of scope

- Research-agent orchestration, model/runtime selection, prompt-injection handling, citation retrieval, citation validation, and neutral-language checks.
- Survey authoring, editing, scoring, answer keys, retries, cooldowns, retention enforcement, and completion-writing APIs.
- Human approval endpoints, reviewer capability changes, audit UI, and reviewer editor UI.
- `/votes/[id]/context`, ballot UI gating, mobile UI, screenshots, and accessibility rendering.
- Survey answers and analytics; this slice stores completion proofs only and creates no answer-to-ballot join.
- Backfilling surveys onto existing votes or requiring surveys for every vote. A missing active survey is explicitly fail-open during this transitional slice.
- Material-change detection, automatic version creation, pause/fallback operations, and reapproval workflows.
- Changes to ballot weight or the existing `user_votes` schema.
- Resolution of issue #101 or unrelated Supabase security findings.
- Autonomous publication of agent output.

Proposed follow-up split:

1. Research package, citations, append-only survey drafts, approval transitions, authorization, and immutable audit.
2. Survey response/completion API with scoring, retries, retention, and anti-abuse rules.
3. Web context route, accessible survey flow, source review, answer correction, and ballot handoff.
4. Privacy-preserving aggregate analytics and version-change/pause behavior.
5. Mobile parity and end-to-end visual evidence.

## Contracts

Migration `20260816000001_vote_context_survey_gate.sql` adds:

- `vote_survey_versions`
  - `id uuid primary key`
  - `vote_id uuid not null references votes(id)`
  - `version integer not null`
  - `status text not null` constrained to `draft`, `approved`, or `paused`
  - `approved_at timestamptz null`
  - `created_at timestamptz not null default now()`
  - unique constraint on `(vote_id, version)`
  - approved rows are immutable through database update/delete protection; later changes require a new version row.

- `vote_active_survey_versions`
  - `vote_id uuid primary key references votes(id)`
  - `survey_version_id uuid not null unique references vote_survey_versions(id)`
  - database constraint/trigger verifies that the referenced version belongs to the same vote and has `status = 'approved'`.
  - deleting or pausing a version must not delete completion rows or existing `user_votes`.

- `vote_survey_completions`
  - `survey_version_id uuid not null references vote_survey_versions(id)`
  - `user_id uuid not null references auth.users(id)`
  - `completed_at timestamptz not null default now()`
  - primary key `(survey_version_id, user_id)`
  - no `vote_id`, `option_id`, answer payload, or ballot receipt column.

Repository contract:

- `getActiveApprovedSurveyVersion(voteId)` returns an explicit Result containing either the active approved version ID or `null`.
- `hasCompletedSurveyVersion(userId, surveyVersionId)` returns an explicit Result containing a boolean.
- Repository/database failures are fail-closed when an active-survey lookup or completion check cannot be established.

Application contract:

- `requireSurveyCompletion({ userId, voteId })` returns:
  - success when no active survey is attached;
  - success when completion exists for the exact active version;
  - `SURVEY_COMPLETION_REQUIRED` when completion is absent;
  - an internal failure for repository errors.

Ballot API contract:

- `POST /api/votes/[id]/participate` keeps the existing `{ optionId }` request body.
- After authentication and existing eligibility validation, but before `recordUserVoteOnce`, it calls the survey-completion use case.
- Missing completion returns HTTP `403` with stable error code `SURVEY_COMPLETION_REQUIRED`.
- No ballot row is written on rejection.
- Existing response behavior for valid, duplicate, invalid-option, ineligible, and rate-limited requests remains unchanged.
- `recordUserVoteOnce`, `UNIQUE(user_id, vote_id)`, and SQLSTATE `23505` idempotent-success handling remain unchanged.

Security and privacy invariants:

- Completion rows identify that a user completed a survey version but contain neither answers nor ballot choice.
- No new foreign key or view directly links `vote_survey_completions` to `user_votes`.
- Client roles cannot insert, update, or delete approved versions, active-version associations, or completion proofs in this slice.
- Existing ballot rows are never invalidated or rewritten when an active survey version changes.

## Acceptance gates

- G-1: The migration creates the three tables, required keys, status constraint, same-vote approved-version enforcement, and RLS/write restrictions described above. → evidence: `pnpm exec supabase db lint` and `rg -n "vote_survey_versions|vote_active_survey_versions|vote_survey_completions" supabase/migrations/20260816000001_vote_context_survey_gate.sql`

- G-2: A voter without completion for a vote’s active approved survey receives HTTP `403` and `SURVEY_COMPLETION_REQUIRED`, and `recordUserVoteOnce` is not called. → evidence: `pnpm --filter web test -- vote-participation.test.ts`

- G-3: A voter who completed the exact active approved survey version reaches the existing ballot-write path. → evidence: `pnpm --filter web test -- vote-participation.test.ts`

- G-4: Completion of an older or different survey version does not unlock the ballot for the currently active version. → evidence: `pnpm --filter web test -- survey-completion-gate.test.ts`

- G-5: A vote with no active survey preserves the pre-existing participation behavior. → evidence: `pnpm --filter web test -- vote-participation.test.ts`

- G-6: Repository errors fail closed and do not write a ballot. → evidence: `pnpm --filter web test -- survey-completion-gate.test.ts vote-participation.test.ts`

- G-7: Duplicate ballot submission retains the existing idempotent-success behavior after the survey check. → evidence: `pnpm --filter web test -- vote-participation.test.ts`

- G-8: The generated TypeScript database definitions include all new tables and compile with the repository/use-case code. → evidence: `pnpm typecheck`

- G-9: No completion schema or new application code stores or selects `option_id` or joins completion rows to `user_votes`. → evidence: `! rg -n "option_id|user_votes" apps/web/src/server/infra/supabase/vote-survey.repo.ts apps/web/src/server/app/votes/require-survey-completion.ts supabase/migrations/20260816000001_vote_context_survey_gate.sql`

- G-10: The changed backend slice passes lint and its focused tests. → evidence: `pnpm lint && pnpm --filter web test -- vote-participation.test.ts survey-completion-gate.test.ts`

## Protected paths

- `supabase/migrations/` — protected and in scope. The exact authorized file is `supabase/migrations/20260816000001_vote_context_survey_gate.sql`, required to establish versioned surveys, active-version selection, completion proofs, and database privacy constraints.
- `.github/workflows/` — protected and explicitly not claimed; no changes permitted.
- `apps/web/src/app/api/payments/` — protected and explicitly not claimed; no changes permitted.

## Risk & rollback

The principal risk is accidentally blocking votes that have no usable approved survey or accepting completion for the wrong version. The transitional no-active-survey behavior limits rollout risk, while exact version matching prevents stale completion from unlocking a changed survey. Fail-closed repository handling may temporarily reject ballots during database failures, which is preferable to bypassing a mandatory configured gate.

Rollback the application commit first to remove gate enforcement while preserving existing ballots. The new tables may remain dormant. If schema rollback is separately approved, remove only the three new tables after confirming no active association or completion data must be retained; never modify or delete `user_votes`. Pausing or replacing an active version must preserve all prior version and completion records, and no rollback may invalidate ballots already recorded.