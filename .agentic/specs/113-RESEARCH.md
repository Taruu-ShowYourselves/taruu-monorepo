# Research — issue #113

## Already-done check

- MISSING — Every published agenda item traces to approved user proposals. Approved proposals become ordinary `votes`; there is no public-agenda entity or proposal-to-agenda join. Evidence: `apps/web/src/server/app/space-admin/decide-proposal.ts`, `supabase/migrations/20260802000010_space_governance.sql`.
- MISSING — Equivalent proposals cannot double-count a verified participant. The tree enforces one ballot per user per individual vote, but has no cross-proposal equivalence groups or distinct-participant aggregation across votes. Evidence: `supabase/migrations/20240101000000_initial_schema.sql:231`, `supabase/migrations/20260806000003_votes_live_topic_unique.sql`.
- MISSING — Versioned, reviewable category assignment with a reasoned human override. No agenda taxonomy, taxonomy version, assignment, override, or override-reason model exists. The unrelated authority and Knesset position taxonomies do not satisfy this requirement. Evidence: `supabase/migrations/20260810000002_authorities_network.sql`, `apps/web/src/services/knesset/odata.ts`.
- MISSING — Auditable authorized agenda publication. Proposal approval is capability-gated and audited, but no separate agenda-publication transition or authorization exists. Evidence: `apps/web/src/server/app/space-admin/authorize.ts`, `apps/web/src/server/app/space-admin/decide-proposal.ts`, `apps/web/src/server/infra/supabase/space-audit.repo.ts`.
- MISSING — Public UI distinguishes Taruu agenda status from official Knesset action. The current `/[locale]/knesset` surface mirrors official Knesset day-order items into Taruu ballots; it is not a user-proposal public agenda. Evidence: `apps/web/src/app/[locale]/knesset/page.tsx`, `apps/web/src/services/knesset/index.ts`, `docs/KNESSET.md`.
- MISSING — Ballot-secrecy and jurisdiction-authorization tests for agenda promotion. Existing privacy and capability tests cover voting and space administration, but no agenda pipeline or corresponding tests exist. Evidence: `apps/web/src/__tests__/api/space-admin-object-authz.test.ts`, `apps/web/src/__tests__/services/participation-primitives.test.ts`, `supabase/migrations/20240101000001_rls_policies.sql`.

Verdict: **proceed**. The acceptance criteria are not already satisfied.

## Current-state map

- **User-submitted proposals**
  - Contract: `packages/shared/src/contracts/vote.ts`.
  - Creation use case: `apps/web/src/server/app/votes/create-vote.ts`.
  - Every submission currently starts as `in_review` through `submissionStatus()`: `apps/web/src/server/domain/votes/vote.ts`.
  - Municipal and Knesset-directed submissions share the `votes` table. `CreateVoteRequestSchema.scope` accepts `municipal | knesset`; the scope is converted to the existing municipality identifier rather than a separate proposal type: `packages/shared/src/contracts/vote.ts`, commit `ca06ae1`.

- **Existing approval workflow**
  - Review vocabulary: `draft`, `in_review`, `changes_requested`, `rejected`; approval lands in `pending` or `active`: `apps/web/src/server/domain/space/review.ts`, `packages/shared/src/contracts/spaceAdmin.ts`.
  - Review queue and detail UI: `apps/web/src/app/[locale]/space-admin/[spaceId]/proposals/`.
  - Decision API: `apps/web/src/app/api/space-admin/[spaceId]/proposals/[voteId]/decide/route.ts`.
  - Use case: `apps/web/src/server/app/space-admin/decide-proposal.ts`.
  - Conditional status update: `apps/web/src/server/infra/supabase/space-decision.repo.ts`.
  - Public reads use the explicit `PUBLIC_VOTE_STATUSES` allow-list, which excludes all review states: `apps/web/src/server/domain/votes/vote.ts`.

- **Provenance already retained**
  - `votes.creator_id` retains the submitting user: `supabase/migrations/20240101000000_initial_schema.sql`.
  - `user_votes` retains ballot-to-user and ballot-to-vote provenance internally: same migration.
  - Proposal decisions are written to the append-only `space_audit_log`, including actor, reason, prior state and new state: `supabase/migrations/20260802000010_space_governance.sql`.
  - No agenda-specific provenance table or public-safe originating-proposal projection exists.

- **Deduplication**
  - Ingest dedup uses exact `(municipality, title)` matching: `docs/INGEST.md`, `apps/web/src/lib/supabase/db.ts`.
  - Database backstop `ux_votes_live_topic` prevents another live ballot with the same normalized database keys, but deliberately does not merge ballots or semantically equivalent wording: `supabase/migrations/20260806000003_votes_live_topic_unique.sql`.
  - Official Knesset imports deduplicate by upstream `ItemID`: `supabase/migrations/20260727000001_knesset_items.sql`.
  - There is no semantic-deduplication service, benchmark fixture, equivalence-group table, or human merge review.

- **Participation and privacy**
  - `UNIQUE(user_id, vote_id)` prevents a participant voting twice on one proposal: `supabase/migrations/20240101000000_initial_schema.sql`.
  - `recordUserVoteOnce` treats retry conflicts idempotently: `apps/web/src/lib/supabase/db.ts`.
  - Ballot eligibility is centralized in `votingGate`, requiring the score floor and verified residency: `packages/shared/src/utils/identityScore.ts`.
  - Authenticated users can select only their own `user_votes` rows under RLS: `supabase/migrations/20240101000001_rls_policies.sql`.
  - Public vote DTOs expose aggregate counts, not participant identities or option selections: `apps/web/src/server/domain/votes/vote.ts`.
  - No distinct-user aggregation across an equivalence group exists.

- **Existing Knesset feature**
  - `knesset_items` represents official plenum day-order items pulled from Knesset OData and links each upstream item to a Taruu vote: `supabase/migrations/20260727000001_knesset_items.sql`.
  - Sync service and cron: `apps/web/src/services/knesset/index.ts`, `apps/web/src/app/api/cron/knesset-agenda/route.ts`.
  - Public surface: `apps/web/src/app/[locale]/knesset/page.tsx`.
  - This data flow runs in the opposite direction from issue #113: official Knesset item → Taruu ballot, rather than approved user proposals → Taruu public agenda.

- **Missing issue-owned modules**
  - No `agenda_items`, agenda lifecycle, taxonomy, category assignment, eligibility threshold, equivalence group, agenda approval, referral, acknowledgement, or closure schema was found.
  - No agenda review queue, public categorized agenda route, shared contracts, repositories, or verification fixtures were found.

## Integration points

- **Authorization**
  - `authorize(session, rawSpaceId, capability)` is the sole minter of branded `SpaceScope`: `apps/web/src/server/app/space-admin/authorize.ts`.
  - Repositories receive the branded scope and apply `municipality_id = scope.municipalityCode` themselves.
  - Existing capabilities include `proposal.read`, `proposal.approve`, `proposal.reject`, `content.moderate`, and `audit.read`: `apps/web/src/server/domain/space/capability.ts`.
  - There is no agenda-review or agenda-publish capability. Adding publication under `proposal.approve` would conflate proposal publication with the issue’s separate downstream human approval.

- **Application/domain/repository layering**
  - Thin route → application use case → pure domain decision → scoped Supabase repository is the established pattern.
  - Copy the structure of:
    - `apps/web/src/app/api/space-admin/[spaceId]/proposals/[voteId]/decide/route.ts`
    - `apps/web/src/server/app/space-admin/decide-proposal.ts`
    - `apps/web/src/server/domain/space/review.ts`
    - `apps/web/src/server/infra/supabase/space-decision.repo.ts`
  - Mutations append audit records synchronously rather than as fire-and-forget side effects: `apps/web/src/server/infra/supabase/space-audit.repo.ts`.

- **Audit seam**
  - `insertAuditRow()` is the current append-only audit writer.
  - Its database `object_type` constraint currently admits only `vote`, `grant`, `space`, `member`, `notification_campaign`, `content`, and `escalation`. Agenda objects cannot be recorded without a migration or a separate audit table: `supabase/migrations/20260802000010_space_governance.sql`.
  - `uq_space_proposal_single_approval` is specifically limited to one `proposal.approved` event per vote; it does not protect agenda publication.

- **Proposal eligibility seam**
  - Approval evidence is currently the combination of a public vote status and an immutable `proposal.approved` audit row.
  - Reading status alone is insufficient provenance because historical rows predating review were deliberately left in public statuses without approval backfill: `supabase/migrations/20260802000012_vote_review_gating.sql`.
  - Agenda candidate selection therefore needs an explicit definition of whether only rows with `proposal.approved` audit evidence qualify.

- **Participation seam**
  - Source ballots live in `user_votes(user_id, vote_id, option_id, created_at)`.
  - Cross-proposal support must count `DISTINCT user_id` across all votes assigned to one equivalence group.
  - Public contracts must project counts and time windows without returning `user_id` or `option_id`.
  - Eligibility can reuse `votingGate` concepts, but historical `user_votes` do not contain a snapshot of verification, residency, or moderation state. Current user state and ballot-time state are not interchangeable.

- **Geography**
  - Current scoped repositories depend on `SpaceScope.municipalityCode`.
  - `authorize()` refuses to mint a scope for spaces whose `municipality_code` is null, including non-municipal types introduced for issue #74: `apps/web/src/server/app/space-admin/authorize.ts`.
  - A nationwide Knesset agenda cannot simply reuse the existing municipal scope predicate without defining a national administrative space and scoping key.

- **Public UI**
  - `/[locale]/knesset` is already occupied by official Knesset day-order mirroring.
  - Reusing it requires an explicit visual and data separation between official-source day-order content and Taruu-originated public-agenda content.
  - Existing shared presentation data is in `apps/web/src/components/press/sections/knessetAgendaData.ts`; existing server page is `apps/web/src/app/[locale]/knesset/page.tsx`.

- **Contracts and generated DB types**
  - Shared wire contracts belong in `packages/shared/src/contracts/` and are re-exported through `packages/shared/src/contracts/index.ts`.
  - Supabase row types are maintained in `apps/web/src/lib/supabase/types.ts`.
  - Public API DTOs should be allow-listed as existing proposal and vote responses are.

- **Migration numbering**
  - The newest checked-in migration is `supabase/migrations/20260811000004_pilot_program.sql`.
  - A new migration must sort after it; with the working date, the next collision-free prefix would be in the `20260817…` namespace.
  - `supabase/migrations/` is a protected path under `docs/PR-AUTOPILOT.md`.

- **Testing seams**
  - Pure lifecycle and threshold rules: `apps/web/src/server/domain/**/**/*.test.ts`.
  - API authorization/privacy tests: `apps/web/src/__tests__/api/`.
  - Database invariants: `supabase/tests/`.
  - Full review UI and seeded state: `apps/web/tests/e2e/space-admin.spec.ts` and `apps/web/tests/e2e/fixtures/space-admin-seed.sql`.

## Prior art

Nearest merged PR: **PR #93, `feat(space-admin): space governance substrate and administrator operations dashboard`**, commit `9d6bc53`.

Copy from it:

- explicit capability vocabulary and branded authorization scopes;
- thin HTTP routes over application use cases;
- pure transition functions separated from persistence;
- conditional updates carrying scope and prior-state predicates;
- required human reasons;
- append-only audit records with actor, prior state and new state;
- public/review status separation by allow-list;
- hand-written repository column selections and Zod response stripping;
- capability-matrix, object-authorization, audit, API and seeded E2E tests.

Adjacent prior art:

- Commit `ca06ae1`, `feat(votes): citizens can raise Knesset proposals`, established the `scope: municipal | knesset` submission seam.
- The official agenda mirror in `apps/web/src/services/knesset/` provides upstream provenance and idempotent import patterns, but its `knesset_items` semantics must not be reused for Taruu-originated agenda items.

## Constraint register

- **Protected path:** the issue necessarily requires at least one new file under `supabase/migrations/`; the approved spec must name exact migration files according to `docs/PR-AUTOPILOT.md`.
- **Deployment state is not provable from the working tree.** `docs/WORK-ORDER.md` says space migrations `20260802000010`–`20260802000014` still need applying and proof. Historical phase records say they were exercised against a throwaway local database, not production. Production application status must be checked before relying on their tables or constraints.
- **Broken seed finding:** phase evidence records that `supabase/seed.sql` violates `users_municipality_fk`; a normal local reset may fail before new agenda SQL tests run. Evidence: `.planning/STATE.md`, `.planning/phases/05-space-governance-substrate-and-space-admin-operations-dashboard/05-DB-EVIDENCE.md`.
- **Service-role boundary:** server repositories use `supabaseAdmin`, which bypasses RLS. Object authorization must remain in branded scopes and explicit SQL predicates; RLS alone does not protect new agenda writes. Evidence: `apps/web/src/server/app/space-admin/authorize.ts`, `supabase/migrations/20260802000010_space_governance.sql`.
- **National-scope blocker:** `SpaceScope` requires a non-null municipality code and rejects non-municipal spaces. Issue #113’s Knesset-wide review queue needs an explicitly authorized national scope rather than a forged or nullable municipal scope.
- **Historical approval ambiguity:** existing public-status votes were not backfilled with approval audit records. Treating all `active`, `pending`, or `ended` rows as approved would admit legacy and ingested topics that did not pass the user-proposal review workflow.
- **Dedup mismatch:** existing title dedup is exact and limited to live votes. It neither identifies material equivalence nor prevents one user being counted once on each differently worded proposal.
- **Verification-state timing:** ballots store no verification, geography, or identity-score snapshot. Retrospective threshold evaluation using current `users` state may produce different eligibility from ballot-time state.
- **Audit schema constraint:** `space_audit_log.object_type` cannot currently represent agenda items.
- **Existing route semantics:** `/knesset` and `knesset_items` already mean official Knesset-originated material. Mixing Taruu-originated public-agenda items into those structures risks making the prohibited official-adoption implication.
- **Open security program:** `.planning/STATE.md` and `docs/WORK-ORDER.md` retain broader service-role/RLS findings under issue #22. Any new service-role agenda repository must follow the planned explicit-scoping pattern and receive denial tests.
- **Working tree:** clean at research time; no issue #113 implementation is present.

## Open questions

1. What is the approved taxonomy’s initial category list, stable identifiers, versioning rule, and documented fallback for ambiguous or multi-category topics?
2. May one agenda item have multiple categories, or must it have one primary category plus secondary labels?
3. Who is authorized to classify, override classification, review candidates, and publish—municipal space admins, a national-space role, platform admins, or distinct agenda capabilities?
4. Does “passed the existing approval workflow” require an immutable `proposal.approved` audit event, or are legacy public-status proposals eligible?
5. Which ballot option constitutes “support” for proposals whose options are not the standard support/oppose/abstain set?
6. Are verified participants evaluated using current identity and residency state, or must eligibility be frozen at ballot time?
7. What are the initial configurable thresholds, where are configurations scoped, and who may change them?
8. What geography is relevant to a Knesset-facing item: nationwide only, municipality quotas, regional distribution, or a configurable jurisdiction rule?
9. What recency window applies, and is it measured from proposal submission, vote opening, ballot casting, vote closure, or agenda evaluation?
10. Is semantic equivalence decided automatically, suggested automatically and confirmed by a human, or entirely by human review?
11. When equivalent proposals contain conflicting option wording or time windows, which data becomes the agenda summary and support window?
12. Should originating proposal titles and aggregate vote results be public, or only internal provenance with a public count and summary?
13. Does “originating proposals/votes” require public links to every source vote, including ended votes, or a redacted provenance summary?
14. Should agenda publication use the existing `space_audit_log` with an expanded object vocabulary or a dedicated national agenda audit log?
15. Is `/[locale]/knesset` the intended public destination, or should Taruu’s public agenda have a separate route to avoid collision with official Knesset day-order content?
16. Which lifecycle transitions are legal, who can perform each transition, and which states or reasons are public?
17. What externally verified event permits `referred` or `acknowledged`, given that government access and official responses belong to issue #77?
18. What exact disclaimer wording and placement have human approval for distinguishing Taruu agenda status from official Knesset action?