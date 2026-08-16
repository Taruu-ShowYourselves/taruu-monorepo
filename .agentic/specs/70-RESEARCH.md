# Research — issue #70

## Already-done check

- Ballot endpoint rejects voters missing the approved survey version: **MISSING**. [`participate/route.ts`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/apps/web/src/app/api/votes/[id]/participate/route.ts) checks authentication, rate limits, vote state, option membership, pilot residency, and identity eligibility, then writes `user_votes`; it performs no survey-completion lookup.
- Voter can review cited sources and correct survey answers independently of ballot choice: **MISSING**. The vote page exposes limited Knesset document context, but no survey or answer-correction flow exists in [`page.tsx`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/apps/web/src/app/[locale]/votes/[id]/page.tsx). No `/votes/[id]/context` route exists.
- Agent output requires human approval before publication: **MISSING**. Proposal publication has human space-admin approval, but there is no research/survey artifact or approval state. See [`decide-proposal.ts`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/apps/web/src/server/app/space-admin/decide-proposal.ts).
- Survey analytics cannot be joined to an identifiable ballot choice: **MISSING**. No survey analytics storage exists. Current `user_votes` rows directly contain `user_id`, `vote_id`, and `option_id` in [`20240101000000_initial_schema.sql`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/supabase/migrations/20240101000000_initial_schema.sql), so any new survey storage must establish an explicit privacy boundary.

**Verdict: proceed.** None of the four acceptance criteria is fully satisfied.

## Current-state map

- Ballot API:
  - [`apps/web/src/app/api/votes/[id]/participate/route.ts`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/apps/web/src/app/api/votes/[id]/participate/route.ts) is the authoritative ballot chokepoint.
  - It validates `ParticipateRequestSchema`, resolves the session and user, applies pilot and voter eligibility, and calls `recordUserVoteOnce`.
  - [`apps/web/src/app/api/votes/[id]/participated/route.ts`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/apps/web/src/app/api/votes/[id]/participated/route.ts) is the existing participation-status seam.

- Ballot persistence:
  - [`apps/web/src/lib/supabase/db.ts`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/apps/web/src/lib/supabase/db.ts) contains `getUserVote`, `hasUserParticipated`, and `recordUserVoteOnce`.
  - `recordUserVoteOnce` relies on `UNIQUE(user_id, vote_id)` and treats SQLSTATE `23505` as an idempotent success.
  - [`apps/web/src/server/infra/supabase/vote.repo.ts`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/apps/web/src/server/infra/supabase/vote.repo.ts) is the newer Result-typed vote repository, but ballot writes still call legacy `db.ts` directly.

- Shared API contracts:
  - [`packages/shared/src/contracts/vote.ts`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/packages/shared/src/contracts/vote.ts) defines vote, participation, create-vote, and participate request/response schemas.
  - `ParticipateRequestSchema` currently accepts only `{ optionId }`.
  - No research package, citation, survey, answer, completion, version, or analytics contract exists.

- Web voter UI:
  - [`apps/web/src/app/[locale]/votes/[id]/page.tsx`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/apps/web/src/app/[locale]/votes/[id]/page.tsx) renders proposal context, Knesset document links where available, and the ballot beside the editorial column.
  - [`ParticipationFlow.tsx`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/apps/web/src/app/[locale]/votes/[id]/flow/ParticipationFlow.tsx) implements choice → confirmation → server receipt. It has no context-survey stage or completion gate.
  - Existing accessibility patterns include semantic sections, `aria-label`, status/alert messaging, reduced-motion handling, and real link/button elements.
  - No `[locale]/votes/[id]/context` directory exists.

- Mobile voter UI:
  - [`apps/mobile/app/vote/[id].tsx`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/apps/mobile/app/vote/[id].tsx) submits ballots directly.
  - No mobile context/survey or reviewer route exists.

- Existing source provenance:
  - [`20260723000001_vote_sources.sql`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/supabase/migrations/20260723000001_vote_sources.sql) stores one consolidated social source record per vote, including a primary URL, counts, and `fetched_at`. It is engagement provenance, not a cited research package.
  - [`20260729000002_knesset_rankings.sql`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/supabase/migrations/20260729000002_knesset_rankings.sql) stores off-platform ranker output, rationale, media references, and ranking time.
  - [`20260729000003_knesset_rankings_evidence.sql`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/supabase/migrations/20260729000003_knesset_rankings_evidence.sql) is the closest existing evidence-storage model.
  - The ranker is described as an off-platform agent; its orchestration source is not present in this working tree.

- Human review:
  - [`apps/web/src/app/[locale]/space-admin/[spaceId]/proposals/page.tsx`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/apps/web/src/app/[locale]/space-admin/[spaceId]/proposals/page.tsx) and [`ProposalDetailPanel.tsx`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/apps/web/src/components/space-admin/ProposalDetailPanel.tsx) are the existing reviewer surface.
  - [`decide-proposal.ts`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/apps/web/src/server/app/space-admin/decide-proposal.ts) implements capability checks, scoped reads, self-review prevention, conditional state transition, and immutable audit recording.
  - This workflow approves the proposal as a whole; it cannot separately approve research, citations, wording, scoring policy, survey version, or final ballot.

- Tests:
  - [`vote-participation.test.ts`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/apps/web/src/__tests__/api/vote-participation.test.ts) covers ballot recording, free participation, and duplicate submission.
  - [`participation-primitives.test.ts`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/apps/web/src/__tests__/services/participation-primitives.test.ts) covers eligibility and idempotency invariants.
  - [`space-admin-decide.test.ts`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/apps/web/src/__tests__/api/space-admin-decide.test.ts) covers proposal approval behavior.
  - No survey, source-integrity, version-change, privacy-separation, or prompt-injection fixture exists.

## Integration points

- **Authoritative gate:** insert the survey-completion decision in [`POST /api/votes/[id]/participate`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/apps/web/src/app/api/votes/[id]/participate/route.ts), before `recordUserVoteOnce`. UI gating alone would not satisfy the acceptance criterion.
- **Ballot idempotency invariant:** preserve `recordUserVoteOnce` and its `UNIQUE(user_id, vote_id)`/`23505` behavior in [`db.ts`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/apps/web/src/lib/supabase/db.ts).
- **Repository pattern:** new database access should follow Result-typed modules under `apps/web/src/server/infra/supabase/`, with application orchestration under `apps/web/src/server/app/`. Ballot persistence is a legacy exception still located in `db.ts`.
- **HTTP pattern:** new API routes should remain thin shells using session → shared Zod parse → application use-case → `respond`, matching the space-admin routes.
- **Auth:** voter routes use `getSessionFromRequest`; reviewer authorization uses `authorize(session, spaceId, capability)` from [`authorize.ts`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/apps/web/src/server/app/space-admin/authorize.ts).
- **Reviewer capabilities:** existing seams are `proposal.read`, `proposal.approve`, `proposal.reject`, and `content.moderate` in [`spaceAdmin.ts`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/packages/shared/src/contracts/spaceAdmin.ts). There is no research/survey-specific capability.
- **Approval concurrency:** copy the conditional transition and immutable audit approach from `decideProposal`; do not rely on UI state to prevent stale or duplicate approval.
- **Reviewer UI:** extend the existing proposals surface/detail panel unless the human explicitly chooses a separate reviewer route.
- **Voter UI:** the requested web seam is a new `[locale]/votes/[id]/context` route feeding into `ParticipationFlow`; mobile currently has only `app/vote/[id].tsx`.
- **Source display:** Knesset document/source rendering in the vote page and `DeskTopicRow`’s media-reference treatment are reusable display patterns, but neither implements citation validation.
- **Rate limiting:** `voteParticipationLimiter` currently allows three ballot requests per minute per user. No survey-answer, research-agent, citation-check, or reviewer retry limiter exists.
- **Migration numbering:** the latest migration in the tree is `20260811000004_pilot_program.sql`; new schema migrations need a later unique timestamp prefix. Any migration touches a protected path.
- **Generated database types:** schema changes require corresponding updates to [`apps/web/src/lib/supabase/types.ts`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/apps/web/src/lib/supabase/types.ts).
- **Version preservation:** current votes have no research or survey version identifiers. New version records must be append-only or otherwise retain the approved version associated with existing completions and ballots.
- **Privacy seam:** survey answers/completions must not be stored on `user_votes` or include `option_id`. Analytics need a boundary that cannot expose a row-level mapping from respondent identity to ballot choice.

## Prior art

The nearest merged PR is **PR #93**, commit `9d6bc53`, “space governance substrate and administrator operations dashboard.”

Copy from it:

- shared Zod contracts;
- thin API route shells;
- Result-typed application and repository layers;
- scoped RBAC authorization;
- self-review prevention;
- conditional transitions for concurrent decisions;
- immutable audit rows;
- proposal-list/detail reviewer UI;
- public visibility only after an explicit human decision.

For the ballot gate specifically, also follow **PR #110**, commit `bc7defe`, which established server-owned identity scoring and kept the authoritative eligibility decision at the participate endpoint rather than in client state.

The work-order explicitly says issue #70 should reuse Knesset-ranker infrastructure and depends on issue #101: [`docs/WORK-ORDER.md`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/docs/WORK-ORDER.md).

## Constraint register

- **Protected path:** required schema work will touch `supabase/migrations/`, protected by [`.agentic/config.json`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/.agentic/config.json). The eventual spec approval must name the exact migration files.
- `.github/workflows/` and `apps/web/src/app/api/payments/` are also protected, but no current-state evidence says issue #70 must touch them.
- Space migrations `20260802000010` through `20260802000014` are recorded as unapplied/unproven in [`.agentic/memory/supabase.md`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/.agentic/memory/supabase.md). The existing reviewer workflow depends on them.
- Migration `20260807000001_identity_score_unification.sql` must be applied as a targeted migration rather than through an indiscriminate bulk migration.
- Open Supabase security findings in the shared database area:
  - `webhook_events` has an overbroad `FOR ALL USING(true)` policy.
  - `vote_nfts` public SELECT leaks the user-to-wallet relationship.
  - These are tracked under issue #22; neither is survey-specific, but both mean the database/RLS baseline is not clean.
- [`docs/WORK-ORDER.md`](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/70/docs/WORK-ORDER.md) records issue #70 as depending on unfinished issue #101.
- Current `user_votes` deliberately identifies the voter’s option. Privacy separation therefore cannot be achieved merely by hiding fields in an analytics response; survey data needs an independently reviewed storage and access model.
- Existing `vote_sources` permits public reads and stores only consolidated engagement provenance. Reusing it directly for unpublished agent drafts would violate the human-approval criterion.
- Existing Knesset ranking reads degrade to empty data on failure because ranking is non-load-bearing. A mandatory survey cannot use the same fail-open behavior.
- No repository implementation exists for research orchestration, neutral-language checking, citation integrity, survey scoring, survey retries, retention enforcement, prompt-injection handling, or rollback/pause of a survey version.
- The worktree is clean; no local changes overlap the issue.

## Open questions

1. Does “each vote version” mean a new explicit version of the ballot itself, or only the approved research/survey version attached to an otherwise stable vote?
2. Must every vote, including already-published votes, acquire an approved survey before further ballots are accepted, or does gating begin only for newly published/versioned votes?
3. What constitutes valid completion: all questions answered, a passing answer key, a minimum informational score, or a reviewer-defined per-survey policy?
4. Are wrong answers retryable without limit, or what attempt count, cooldown, and lockout policy should apply?
5. May survey answers be retained per user for correction, or should only completion be identifiable while answers are anonymous/pseudonymous?
6. What are the exact retention periods for answers, attempts, completion proofs, citations, agent drafts, and analytics aggregates?
7. Which roles may approve each artifact: platform admin only, space admin, or a staged combination?
8. Must research, wording, answer key/scoring policy, survey, and final ballot receive separate approvals, or can one reviewed version approve the complete package atomically?
9. What change is “material” enough to create a new version and require reapproval?
10. When a version changes, do users who completed an earlier version need to complete the new version before voting if they have not yet cast a ballot?
11. Should a paused survey block new ballots completely or permit a manually authored fallback version immediately?
12. Is the new context/survey flow required on mobile in the same PR, given that the visual-evidence request names web-style `/votes/[id]/context` but scope includes the existing mobile ballot?
13. Should the reviewer editor extend the existing proposal detail panel or receive a separate space-admin route?
14. What agent/runtime and model are approved for research orchestration? The referenced Knesset ranker is off-platform and its source is absent from this tree.
15. What citation types and integrity rules are required—for example HTTPS validation, immutable snapshots, content hashes, publication dates, minimum independent sources, or broken-link rechecks?
16. What neutral-language rubric and human override/audit behavior are required?
17. Which analytics are permitted, and what minimum aggregation threshold is required to prevent reconstruction of an identifiable respondent’s ballot?
18. Does the issue #101 dependency block planning/implementation now, or may schema and voter-side work proceed while its remaining RBAC review-console work is unfinished?