# Research — issue #77

## Already-done check

- Government users cannot access raw ballots, identity evidence, or out-of-jurisdiction restricted data: **MISSING.** There is no government-representative role, jurisdiction scope, `/government-admin` route, or corresponding API namespace. Existing space-admin contracts exclude identity-document fields, but only for municipality-scoped administrators: `packages/shared/src/contracts/spaceAdmin.ts`, `apps/web/src/server/app/space-admin/authorize.ts`.
- Every aggregate insight displays methodology and coverage limitations: **MISSING.** The public government score meters display methodology (`apps/web/src/app/[locale]/government/page.tsx`, `apps/web/src/components/press/government/ScoreMeter.tsx`), but their contract has no uncertainty, coverage-limitation, geography, or methodology metadata: `packages/shared/src/contracts/government.ts`.
- Official responses are publicly attributable and auditable where policy marks them public: **MISSING.** No official-response, response-version, referral, or commitment implementation exists.
- Representative removal immediately revokes access while retaining history: **MISSING.** Existing grant suspension/revocation is immediate and audited for other admin roles, but `RoleNameSchema` has no government/authority representative role: `packages/shared/src/contracts/role.ts`, `apps/web/src/server/app/authz/require-role.ts`, `apps/web/src/server/infra/supabase/role.repo.ts`.

**Verdict: proceed.** The acceptance criteria are not already satisfied.

## Current-state map

- Public government/Knesset intelligence already exists at:
  - `apps/web/src/app/[locale]/government/page.tsx`
  - `apps/web/src/app/[locale]/government/[slug]/page.tsx`
  - `apps/web/src/server/read/government.ts`
  - `apps/web/src/server/infra/supabase/government.repo.ts`
  - `packages/shared/src/contracts/government.ts`
  - `supabase/migrations/20260811000001_government_roster.sql`

  This is a public roster, roll-call comparison, civic-score, and citizen-review feature—not an authenticated government operations dashboard. `government_civic_stats()` calculates national counts and scores, while the UI supplies prose methodology. It does not implement jurisdiction authorization, privacy-thresholded comparisons, referrals, official responses, commitments, exports, or representative lifecycle management.

- Municipality administration already uses a layered pattern:
  - HTTP routes: `apps/web/src/app/api/space-admin/[spaceId]/`
  - Use cases: `apps/web/src/server/app/space-admin/`
  - Branded authorization scope: `apps/web/src/server/app/space-admin/authorize.ts`
  - Repositories: `apps/web/src/server/infra/supabase/space*.repo.ts`
  - Shared allow-listed contracts: `packages/shared/src/contracts/spaceAdmin.ts`
  - UI: `apps/web/src/app/[locale]/space-admin/[spaceId]/`
  - Schema: `supabase/migrations/20260802000010_space_governance.sql` through `20260802000014_space_notifications.sql`

- Existing space metrics are aggregate-only and suppress cohorts of 1–4 in SQL:
  - `supabase/migrations/20260802000013_space_admin_metrics.sql`
  - `apps/web/src/server/infra/supabase/space-metrics.repo.ts`
  - `apps/web/src/server/app/space-admin/get-metrics.ts`
  - `apps/web/src/__tests__/api/space-admin-metrics.test.ts`

  The response has only value/status/generated-at fields. It has no methodology, uncertainty, geography, source-limitations, comparison, or date-filter contract.

- Existing append-only operational history lives in:
  - `space_audit_log`, created by `supabase/migrations/20260802000010_space_governance.sql`
  - `apps/web/src/server/infra/supabase/space-audit.repo.ts`
  - `apps/web/src/server/app/space-admin/list-audit.ts`
  - `supabase/tests/audit_append_only.sql`

  The repository intentionally exports insertion and reading only. Database triggers and privilege revocation reject update, delete, and truncate.

- The older RBAC line provides lifecycle-preserving role grants:
  - `packages/shared/src/contracts/role.ts`
  - `apps/web/src/server/domain/authz/policy.ts`
  - `apps/web/src/server/app/authz/require-role.ts`
  - `apps/web/src/server/infra/supabase/role.repo.ts`
  - `supabase/migrations/20260802000002_role_grants_and_applications.sql`

  Roles are currently limited to `super_admin`, `space_admin`, and `community_manager`. Revocation changes status and retains the grant and append-only `role_grant_events`.

- Public cross-authority topology and office-holder data exists, but confers no access:
  - `apps/web/src/server/read/authority-network.ts`
  - `supabase/migrations/20260810000002_authorities_network.sql`
  - `packages/shared/src/contracts/authority.ts`

- `.planning/phases/08-authority-dashboard/` contains an unexecuted, draft plan for issue #76’s municipality authority dashboard. Its validation matrix marks the authority implementation pending, and `.planning/REQUIREMENTS.md` still marks `AUTH-01` through `AUTH-06` pending. These planning files are not working implementation. That phase explicitly treats a national government dashboard as out of scope.

## Integration points

- **Authentication:** API routes obtain `Session` through `getSessionFromRequest()` and pass `session.userId` into application authorization. Example: `apps/web/src/app/api/space-admin/[spaceId]/metrics/route.ts`.

- **RBAC port:** `requireRole(userId, role, spaceId)` in `apps/web/src/server/app/authz/require-role.ts` is the existing role-grant enforcement point. Extending this model requires synchronized changes to:
  - `RoleNameSchema` and related sources/audit subjects in `packages/shared/src/contracts/role.ts`
  - database CHECK constraints in a new migration
  - generated types in `apps/web/src/lib/supabase/types.ts`
  - `ADMIN_TIER_ROLES` in `apps/web/src/server/domain/authz/policy.ts`

- **Object-scoped authorization:** `authorize()` is the only minter of branded `SpaceScope`; scoped repositories accept that scope instead of caller-provided IDs. This is the strongest existing pattern for jurisdiction-bound reads: `apps/web/src/server/app/space-admin/authorize.ts`.

- **Important scope limitation:** `SpaceScope` requires a non-null `municipality_code`. It deliberately denies national, organization, and nationwide civic spaces even though those types are legal in the schema. Government-wide access therefore cannot reuse `SpaceScope` unchanged.

- **Repository boundary:** service-role repositories use `ResultAsync<_, AppError>` and explicit response projections. Relevant models are:
  - `apps/web/src/server/infra/supabase/role.repo.ts`
  - `apps/web/src/server/infra/supabase/space.repo.ts`
  - `apps/web/src/server/infra/supabase/space-metrics.repo.ts`
  - `apps/web/src/server/infra/supabase/space-audit.repo.ts`

- **Privacy helper seam:** the shipped privacy rule is SQL-owned in `space_admin_metrics()`, with a second fail-closed mapping in `get-metrics.ts`. There is no general-purpose cohort helper yet. Draft Phase 8 plans propose one with a threshold of 10, but it does not exist.

- **Audit seam:** `insertAuditRow()`/`listAuditRows()` and `space_audit_log` can inform the pattern. Government responses and commitments need additional object types and likely separate version tables because the current audit schema requires one municipality `space_id` and one non-null actor.

- **Public government read seam:** national data currently enters through fixed-shape RPCs in `supabase/migrations/20260811000001_government_roster.sql`, then `apps/web/src/server/read/government.ts`. Any reused public aggregate must not expose the underlying `user_votes.user_id`.

- **HTTP seam:** authenticated APIs use thin route handlers—session, schema parsing, use case, `respond()`—under `apps/web/src/app/api/space-admin/`. Government endpoints should follow that shape under a distinct namespace.

- **Feature switch:** the current administrative dashboard is disabled through `apps/web/src/lib/features/space-admin.ts`. Issue #77’s rollback requirement calls for a separate government-dashboard switch so suspending it does not disable municipality administration.

- **Migration numbering:** the current local migration head is `20260811000004_pilot_program.sql`. A new migration must sort after that head and be rechecked for collisions immediately before implementation.

## Prior art

The nearest merged PR is **#93**, commit `9d6bc53`, `feat(space-admin): space governance substrate and administrator operations dashboard`.

Copy its overall shape:

- branded server-minted authorization scope;
- capability-gated use cases;
- repositories that cannot accept raw caller scope;
- fixed aggregate RPC return types;
- SQL-side suppression with a second fail-closed application mapping;
- append-only audit tables and mutation-rejecting triggers;
- thin API routes;
- shared response allow-lists;
- authorization, privacy-threshold, audit, route, and E2E tests;
- a dedicated kill switch and screenshot evidence.

Do not copy its municipality-only scoping assumption: `SpaceScope` refuses spaces without `municipality_code`.

Secondary prior art is commit `60dd8e6`, `feat(government): name who sits in the Knesset, and how each one voted`. It supplies the public government presentation, methodology-copy, national RPC, roster, and roll-call seams, but no privileged-government workflow.

## Constraint register

- **Protected path:** implementation necessarily requires `supabase/migrations/`, which is protected by `.agentic/config.json`. Human approval must explicitly name that path.
- No need is currently evident for the other protected paths, `.github/workflows/` or `apps/web/src/app/api/payments/`.
- **Migration deployment status is unknown.** The working tree proves which migration files exist, not which have been applied to the live Supabase project. Network access is unavailable, so `supabase migration list` cannot establish remote state.
- All current space-admin repositories use `supabaseAdmin`, which bypasses RLS. Application authorization is therefore the active production boundary; RLS is defense in depth. This is documented in `apps/web/src/server/app/space-admin/authorize.ts` and `apps/web/src/server/infra/supabase/role.repo.ts`.
- The existing branded scope guarantees object scoping but not capability correctness: repositories do not inspect `scope.capability`. Correct capability selection is enforced at use-case call sites and by the capability-matrix tests.
- National and non-municipal spaces cannot currently receive a usable `SpaceScope`; `authorize()` denies them because `municipality_code` is null.
- Existing privacy floors are inconsistent with the unexecuted authority plan: shipped space-admin metrics use **5**, while draft Phase 8 documents propose **10**. Issue #77 specifies no number.
- The public `government_civic_stats()` publishes national platform-user and participant counts without a privacy threshold. Its UI explains formulas but does not carry structured source, geography, uncertainty, or coverage metadata.
- No external privacy/security review artifact exists for issue #77’s claimed area.
- No tests currently cover government jurisdiction isolation, government response/referral workflows, governed exports, or government-representative offboarding.
- Existing `.planning/phases/08-authority-dashboard/` plans target municipality authority issue #76 and are marked draft/pending. They must not be treated as implemented or automatically applied to this broader issue.

## Open questions

1. What jurisdiction hierarchy must be represented—national ministries, districts, municipalities, statutory authorities, or arbitrary multi-municipality regions—and may one representative hold several jurisdictions?
2. What closed vocabulary of access purposes is required, and which datasets is each purpose permitted to read or export?
3. Is the privacy floor 5, 10, configurable by dataset, or set by an external privacy review? How should repeated-query and differencing attacks across filters be constrained?
4. Which aggregates are eligible for cross-municipality comparison, and what exact methodology, coverage, uncertainty, geography, source, and “not statistically representative” fields must accompany each?
5. What creates a referral, who owns it, and what are its allowed states and jurisdiction-transfer rules?
6. What are the official-response publication policies—public by default, explicitly opted public, embargoed, or internal—and which attribution fields must remain public after representative removal?
7. What are the commitment states and revision rules, and should the product avoid legally loaded wording such as “obligation” or “deadline”?
8. What evidence verifies a government organization and representative without storing identity documents, and who is authorized to approve or revoke that verification?
9. Which export formats, datasets, retention markings, and audit events are required? Must exported reports embed methodology and suppression metadata?
10. Should issue #77 build on the unexecuted municipality-authority design in `.planning/phases/08-authority-dashboard/`, supersede it, or remain a separate national-government authorization model?