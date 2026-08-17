# Research — issue #76

## Already-done check

- Unverified organization cannot appear as the official municipality — **MISSING.** There is no authority-organization claim, verification state, approval workflow, or verified badge model. Existing public council profiles expose sourced municipal facts but do not represent participating organizations: `supabase/migrations/20260730000001_public_council_profiles.sql`, `apps/web/src/server/domain/council/public-profile.ts`, `apps/web/src/app/[locale]/councils/[identifier]/page.tsx`.
- Representatives see only their municipality and permitted aggregate data — **MISSING.** `RoleNameSchema` has only `super_admin`, `space_admin`, and `community_manager`; no authority representative role or authority routes exist: `packages/shared/src/contracts/role.ts`, `apps/web/src/server/app/authz/require-role.ts`.
- Residents can distinguish Taruu-generated content from official responses — **MISSING.** No official-response schema, API, UI, author attribution, or version history exists.
- Commitment and satisfaction histories remain auditable after staff changes — **MISSING.** No commitment model exists. Municipality satisfaction is overwritten on the user row rather than recorded historically: `apps/web/src/app/api/user/profile/route.ts`, `supabase/migrations/20260727000002_municipality_rating.sql`. Office-holder reviews are mutable one-per-resident records, not the requested municipality satisfaction history: `supabase/migrations/20260810000002_authorities_network.sql`.

**Verdict: proceed.** None of the four acceptance criteria is fully implemented.

## Current-state map

- Canonical authorities:
  - `municipalities.code` is the legacy geographic key used by users, votes, and treasury.
  - `municipalities.council_id` is the stable UUID public/administrative identity.
  - Authority kinds include municipality, local council, regional council, settlement, and national: `supabase/migrations/20260728000001_municipalities.sql`, `supabase/migrations/20260730000001_public_council_profiles.sql`, `supabase/migrations/20260810000002_authorities_network.sql`, `packages/shared/src/contracts/authority.ts`.
- Public council pages:
  - Aggregate-only RPC → database helper → application mapper → public API/page:
    `public_council_metrics()` in `20260730000001_public_council_profiles.sql`
    → `apps/web/src/lib/supabase/db.ts`
    → `apps/web/src/server/app/council/get-public-profile.ts`
    → `apps/web/src/app/api/councils/[identifier]/route.ts`
    → `apps/web/src/app/[locale]/councils/[identifier]/`.
  - These pages are already independent of authority participation and should remain so.
- Existing municipal profile:
  - `/[locale]/municipality/[slug]` and `/api/municipalities/[municipality]` expose votes and aggregate civic figures: `apps/web/src/app/[locale]/municipality/[slug]/`, `apps/web/src/app/api/municipalities/[municipality]/route.ts`, `apps/web/src/server/app/municipality/get-profile.ts`.
- Satisfaction:
  - Onboarding stores one current `users.municipality_rating` and `municipality_rated_at`.
  - `municipality_civic_stats()` averages current ratings into a score; it does not preserve rating history or enforce cohort suppression: `supabase/migrations/20260727000002_municipality_rating.sql`, `supabase/migrations/20260810000001_municipality_civic_stats.sql`.
- Authority network:
  - Office holders, sourced authority relationships, and anonymous public review aggregates already exist: `supabase/migrations/20260810000002_authorities_network.sql`, `apps/web/src/server/read/authority-network.ts`, `packages/shared/src/contracts/authority.ts`.
  - These are public facts/resident reviews, not verified-organization onboarding or official responses.
- RBAC:
  - Lifecycle grants and applications live in `role_grants`, `community_manager_applications`, and append-only `role_grant_events`: `supabase/migrations/20260802000002_role_grants_and_applications.sql`.
  - Current role and audit unions do not include authority claims, authority admins, representatives, or invitations: `packages/shared/src/contracts/role.ts`, `apps/web/src/lib/supabase/types.ts`.
- Space administration:
  - `/[locale]/space-admin/[spaceId]` is a completed moderation/operations dashboard with capabilities, proposal decisions, member controls, notifications, metrics, and audit UI.
  - It grants moderation powers and therefore cannot itself be the authority dashboard: `apps/web/src/app/[locale]/space-admin/[spaceId]/`, `packages/shared/src/contracts/spaceAdmin.ts`, `apps/web/src/server/domain/space/capability.ts`.
- Missing outright:
  - No `/authority/onboarding`.
  - No `/municipality-admin`.
  - No authority API namespace.
  - No organization claim, representative invitation, official-response, response-version, commitment, deadline, escalation-workflow, export, or historical municipality-satisfaction model.

## Integration points

- Auth/session:
  - API routes obtain the authenticated user through the existing session layer.
  - Privileged role enforcement funnels through `requireRole()` and review authority through `requireReviewAuthority()`: `apps/web/src/server/app/authz/require-role.ts`.
- Role extensions:
  - Extend the existing `role_grants.role`, `source`, and `role_grant_events.subject_type` CHECK constraints and matching Zod/database types.
  - Do not create a parallel authority role or audit system: `supabase/migrations/20260802000002_role_grants_and_applications.sql`, `packages/shared/src/contracts/role.ts`.
- Repository layer:
  - Existing Result-typed repository pattern is `apps/web/src/server/infra/supabase/role.repo.ts`.
  - Repositories use `supabaseAdmin`; authorization must happen in the application layer before repository access.
  - Scoped administrative queries should follow the branded-scope pattern in `apps/web/src/server/app/space-admin/authorize.ts` and `apps/web/src/server/infra/supabase/space.repo.ts`, while defining a weaker authority-specific scope that carries no moderation capabilities.
- Approval:
  - Super-admin review is already modeled by `requireReviewAuthority()` and guarded application decisions in `role.repo.ts`.
  - Evidence URLs and append-only review events already have adjacent shapes in `community_manager_applications` and `role_grant_events`.
- Municipality identity:
  - Use `municipalities.council_id`/the matching `spaces.id` as stable identity; retain `municipalities.code` for existing vote/user predicates.
  - `.planning/STATE.md` records that `spaces.id` reuses `municipalities.council_id`.
- Aggregate privacy:
  - The stronger existing seam is SQL-side suppression in `public.space_admin_metrics()`: buckets 1–4 are removed before leaving PostgreSQL: `supabase/migrations/20260802000013_space_admin_metrics.sql`.
  - `publishCouncilCohort()` supplies the shared floor of five but currently applies it only when callers explicitly mark a metric sensitive: `apps/web/src/server/domain/council/public-profile.ts`.
  - `municipality_civic_stats()` currently lacks this suppression and is unsafe to reuse directly for sensitive authority analytics.
- Append-only history:
  - `role_grant_events` uses a database trigger plus revoked mutation privileges and deliberately has no subject/actor FKs, allowing history to survive staff deletion: `20260802000002_role_grants_and_applications.sql`, `supabase/tests/audit_append_only.sql`.
  - `space_audit_log` provides the corresponding operational audit pattern: `supabase/migrations/20260802000010_space_governance.sql`, `apps/web/src/server/infra/supabase/space-audit.repo.ts`.
- Official responses:
  - No existing seam satisfies append-only versioning. A new response/version data boundary is required; mutable vote descriptions, reviews, or audit JSON are not substitutes.
- Routes:
  - Web convention requires locale-prefixed pages under `apps/web/src/app/[locale]/`.
  - API routes remain locale-free under `apps/web/src/app/api/`.
- Migration numbering:
  - Highest current migration is `20260811000004_pilot_program.sql`.
  - A new migration needs a later unique timestamp/version. `20260806000001_version_slot_retired.sql` documents that version collisions break Supabase migration reconciliation.
- Protected path:
  - Any implementation necessarily touches `supabase/migrations/`, which requires explicit protected-path approval under `docs/PR-AUTOPILOT.md`.

## Prior art

Nearest merged PR: **#93**, commit `9d6bc53`, `feat(space-admin): space governance substrate and administrator operations dashboard`.

Copy from it:

- database-enforced append-only audit;
- explicit lifecycle states rather than deletion;
- branded server-derived scope;
- opaque, uniform cross-scope authorization failures;
- Result-typed application/repository separation;
- SQL-side cohort suppression;
- capability-gated server routes;
- RTL dashboard shell, audit pagination, fixtures, and visual evidence workflow.

Do not copy its moderation capability model into authority roles. The municipality dashboard must be a separate authority surface without proposal moderation, content moderation, grant management, or platform escalation authority.

For the public/non-participant boundary, the other relevant merged shape is the council public-profile work in `20260730000001_public_council_profiles.sql` and `apps/web/src/server/domain/council/public-profile.ts`: fixed aggregate RPC response, provenance, stable council identity, and no private rows.

## Constraint register

- Read-only seat: no files were changed; this is the proposed `RESEARCH.md` content.
- Hard dependency: `docs/WORK-ORDER.md` says issue #76 depends on finishing #101’s RBAC application/review surfaces and first-super-admin bootstrap.
- Migration ledger ambiguity:
  - `.planning/STATE.md` says migrations `20260802000010`–`00014` were applied successfully to a scratch database.
  - `docs/WORK-ORDER.md` still says “Apply + prove space migrations 0010–0014.”
  - The production migration ledger was not available from this working tree.
- Production migration discipline: `supabase/migrations/20260807000001_identity_score_unification.sql` states that production has intentional migration drift and migration-bearing PRs must be applied individually.
- Broken local seed: `.planning/STATE.md` records that `supabase/seed.sql` violates `users_municipality_fk`; use seeding disabled plus `apps/web/tests/e2e/fixtures/space-admin-seed.sql` until repaired.
- Service-role boundary: authority repositories following current convention will bypass RLS. A forgotten application authorization check would become a cross-municipality leak. This is directly relevant to the issue’s primary privacy risk: `apps/web/src/lib/supabase/server.ts`, `apps/web/src/server/infra/supabase/role.repo.ts`.
- Open security finding in the claimed privacy area: authenticated municipality treasury history exposes other users’ transaction identifiers because a service-role query bypasses RLS: `SECURITY-AUDIT.md` finding 6, `apps/web/src/app/api/treasury/[municipality]/transactions/route.ts`.
- Open location-integrity finding: vote participation trusts client GPS rather than enforcing municipal location at the write chokepoint: `SECURITY-AUDIT.md` finding 2, `apps/web/src/app/api/votes/[id]/participate/route.ts`.
- Current aggregate satisfaction is not historical and `municipality_civic_stats()` has no minimum-cohort suppression.
- Current office-holder review records permit updates and user deletion cascades; they cannot satisfy enduring commitment/satisfaction auditability.
- Existing public council aggregate RPC is executable by anonymous users. Authority-only aggregates require a separate restricted database/application boundary.
- Existing feature kill switch `SPACE_ADMIN_ENABLED` controls the moderation dashboard only: `apps/web/src/lib/features/space-admin.ts`. It is not an authority-access rollback switch.
- The working tree was clean at research time.

## Open questions

1. Should the canonical requested URLs be locale-prefixed (`/[locale]/authority/onboarding`, `/[locale]/municipality-admin`) to follow the current App Router, or must literal unprefixed redirects also exist for the screenshot contract?
2. Is an authority claim made against every local authority kind, or only records whose kind is `municipality`?
3. What evidence fields are mandatory beyond URLs, and who may inspect retained evidence after a decision?
4. Can one user represent multiple authorities, or must active authority membership be limited to one municipality?
5. Does invitation acceptance require an existing Taruu account, or may invitations precede account creation?
6. Which aggregates and exports are considered explicitly public, which are sensitive, and does the existing cohort floor of five apply uniformly?
7. What satisfaction event is being measured: the municipality generally, an official response, or an individual commitment?
8. May a resident revise satisfaction, and if so must each revision remain append-only rather than replacing the previous value?
9. What workflow states and default deadlines are required for responses and commitments?
10. Who may mark commitments complete, disputed, or overdue?
11. Which export formats and date ranges are required, and must every export request/download be audited?
12. Should suspension hide the verified badge immediately while retaining the organization’s historical official responses?
13. Which document is authoritative about migrations `20260802000010`–`00014`: the completed scratch evidence in `.planning/STATE.md` or the still-pending work-order entry?
14. Must Phase 7’s user-scoped Supabase migration land before this feature, or is application-only authorization over `supabaseAdmin` an explicitly accepted release risk?