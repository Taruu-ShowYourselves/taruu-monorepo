# Research — issue #74

## Already-done check

- **Users can discover, join, leave, and switch among authorized spaces — MISSING.** No `/spaces`, `/spaces/[slug]`, organization-profile, or space-switcher routes exist in either `apps/web/src/app/` or `apps/mobile/app/`. Current user affiliation is one mutable `users.municipality_id`, exposed through [web municipality settings](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/apps/web/src/app/[locale]/settings/municipality/page.tsx) and [mobile municipality settings](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/apps/mobile/app/settings/municipality.tsx). The governance migration explicitly says membership remains derived from that single field: [20260802000010_space_governance.sql](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/supabase/migrations/20260802000010_space_governance.sql).

- **Votes and notifications are filtered by explicit membership/geography rules — MISSING.** Existing space-admin queries filter municipal data through `SpaceScope.municipalityCode`, including notification audiences in [space-notify.repo.ts](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/apps/web/src/server/infra/supabase/space-notify.repo.ts). This is not a multi-space membership/geography model: [authorize.ts](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/apps/web/src/server/app/space-admin/authorize.ts) deliberately rejects every space whose `municipality_code` is null, including organization, urban-area, and nationwide-civic spaces.

- **Every space shows its type, owner/admin identity, and verification status — MISSING.** The database has `type`, `owner_user_id`, `verification_state`, and `geography`, but the admin summary projection returns neither owner nor verification state, and no public space-detail route exists. Evidence: [space governance migration](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/supabase/migrations/20260802000010_space_governance.sql) and [space.repo.ts](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/apps/web/src/server/infra/supabase/space.repo.ts).

- **Notification opt-out is honored and no cross-space private event is delivered — MISSING overall, partially implemented for admin announcements.** `resolveAudience()` honors only an undocumented `spaceAnnouncements: false` JSON key, scopes municipal candidates through the branded `SpaceScope`, and delivery records are unique per campaign/user/channel. However, shared and web/mobile preference UIs expose only `newVotes`, `voteEnding`, `voteResults`, and `marketing`; the audience module states existing vote fan-out ignores these settings. There is no general event privacy/publicity model. Evidence: [audience.ts](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/apps/web/src/server/app/space-admin/audience.ts), [user notification types](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/packages/shared/src/types/user.ts), [web settings](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/apps/web/src/app/[locale]/settings/notifications/page.tsx), and [notification migration](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/supabase/migrations/20260802000014_space_notifications.sql).

**Verdict: proceed.** The tree has reusable governance and notification infrastructure, but does not satisfy issue #74.

## Current-state map

- [20260802000010_space_governance.sql](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/supabase/migrations/20260802000010_space_governance.sql) defines UUID-backed `spaces` with the allowlist `municipality`, `national`, `organization`, `urban_area`, and `nationwide_civic`. It also defines per-space capability grants, member suspensions, append-only audit records, and escalations.
- Membership is not represented by a membership table. Resident membership is derived from `users.municipality_id = spaces.municipality_code`; administrative “membership” means possessing at least one capability grant.
- [capability.ts](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/apps/web/src/server/domain/space/capability.ts) defines eleven explicit capabilities and role presets. Presets expand into capability rows; role names themselves do not confer authority.
- [authorize.ts](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/apps/web/src/server/app/space-admin/authorize.ts) is the sole minter of branded `SpaceScope`. Authorization is re-read from the database on every operation and defaults to opaque `FORBIDDEN`.
- [space.repo.ts](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/apps/web/src/server/infra/supabase/space.repo.ts) is the core scoped repository. Its vote/member queries use the municipality join key, not the UUID space ID.
- `apps/web/src/server/app/space-admin/` contains the use-case layer for proposals, membership suspension, grants, content moderation, metrics, notifications, and audit.
- `apps/web/src/app/api/space-admin/[spaceId]/` contains the corresponding API adapters; `apps/web/src/app/[locale]/space-admin/[spaceId]/` contains the Hebrew/RTL administrative UI.
- [20260802000014_space_notifications.sql](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/supabase/migrations/20260802000014_space_notifications.sql) defines campaigns, per-recipient delivery evidence, and in-app inbox rows. Supported governed channels are `in_app` and `push`.
- [audience.ts](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/apps/web/src/server/app/space-admin/audience.ts) is the single preview/send audience resolver. It hashes the authorized recipient set and applies the `spaceAnnouncements` opt-out.
- [push.repo.ts](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/apps/web/src/server/infra/supabase/push.repo.ts), [Expo notification service](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/apps/web/src/services/notifications/expo.ts), and [push-token API](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/apps/web/src/app/api/user/push-token/route.ts) provide the existing push seam.
- Notification settings remain a nullable JSON object rather than typed rows. They have four booleans only; there are no per-space preferences, digest cadence, quiet hours, global unsubscribe, email-channel preferences, or timezone fields.
- Existing test coverage includes capability matrices, cross-space object authorization, member/grant lifecycle, notification audience/dispatch, suspension, audit immutability, and push tokens under `apps/web/src/__tests__/api/`. There are no end-user multi-space lifecycle or `/spaces` E2E tests.

## Integration points

- **Authorization port:** branded `SpaceScope` and `SpaceMembership` in [authorize.ts](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/apps/web/src/server/app/space-admin/authorize.ts). The scope currently requires a non-null municipal join key; #74 needs an explicit replacement or extension for non-municipal content.
- **Capability vocabulary:** [capability.ts](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/apps/web/src/server/domain/space/capability.ts). Role presets are UI/write conveniences only; authorization reads capability rows.
- **Repository layer:** `apps/web/src/server/infra/supabase/*.repo.ts`, especially `space.repo.ts`, `space-member.repo.ts`, `space-notify.repo.ts`, `space-audit.repo.ts`, and `push.repo.ts`. Repositories accept branded scopes instead of raw caller-controlled space IDs.
- **Application layer:** `apps/web/src/server/app/space-admin/`; HTTP routes should remain thin adapters using shared Zod contracts and the existing `neverthrow`/`AppError` pattern.
- **Contracts:** `packages/shared/src/contracts/`. Existing admin contracts live in [spaceAdmin.ts](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/packages/shared/src/contracts/spaceAdmin.ts); legacy RBAC contracts in [role.ts](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/packages/shared/src/contracts/role.ts) still identify spaces by municipality code.
- **Auth:** custom server session in [session.ts](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/apps/web/src/services/auth/session.ts). Server data access uses the Supabase service role with `BYPASSRLS`, so application-layer scoping is load-bearing. The custom JWT requires `public.user_id()` rather than Supabase’s built-in session helper in RLS policies.
- **Notifications:** preview and send must share `resolveAudience()`; campaign recipient and content hashes prevent stale sends. Delivery evidence is persisted before/beside best-effort push, with in-app as the delivery of record.
- **Database types:** changes require corresponding updates to generated/manual definitions in [types.ts](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/apps/web/src/lib/supabase/types.ts).
- **Migration numbering:** latest checked-in migration is `20260811000004_pilot_program.sql`; the next migration must use a later unique timestamp. Existing space migrations are `20260802000010` through `20260802000014`.
- **Public routes:** existing municipality presentation is `/[locale]/municipality/[slug]`; requested `/spaces` and `/spaces/[slug]` routes do not exist.
- **Mobile:** Expo Router screens belong in `apps/mobile/app/`; notification registration and tap handling already live in [notifications.ts](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/apps/mobile/src/lib/notifications.ts) and [root layout](/home/sahar-admin/taruu-monorepo/.agentic/worktrees/74/apps/mobile/app/_layout.tsx).

## Prior art

Nearest merged PR: commit `9d6bc53`, **“feat(space-admin): space governance substrate and administrator operations dashboard (#93)”**.

Copy from it:

- Additive migrations instead of rewriting `users`, `votes`, or treasury tables.
- Branded authorization scopes minted by one application module.
- Explicit per-action capabilities with default deny.
- Scope predicates applied inside repository queries.
- Identical opaque authorization failures to prevent space enumeration.
- Append-only audit evidence and `ON DELETE RESTRICT`.
- Shared preview/send audience resolution, persisted fingerprints, database-backed quotas, idempotent delivery rows, and focused authorization tests.
- Thin API routes over application use cases and Supabase repositories.

Do not copy its municipality-only assumption: the PR explicitly deferred non-municipal scoping to issue #74.

## Constraint register

- Deployment migration state cannot be verified from this read-only working tree. All checked-in migrations through `20260811000004_pilot_program.sql` must be compared with the target Supabase migration ledger before planning rollout.
- `spaces.type` already admits issue #74 types, but those rows cannot obtain a usable `SpaceScope` while `municipality_code` is null.
- The unique partial index on `spaces.municipality_code` permits only one space per municipality. Any design requiring multiple organization/community spaces in the same municipality must not reuse this column as their sole scope key.
- `users.municipality_id`, `votes.municipality_id`, and treasury municipality fields were intentionally left untouched. Replacing or overloading them would cut across established public, voting, verification, pilot, and payment paths.
- Two authority systems coexist: legacy `role_grants.space_id TEXT` in `20260802000002_role_grants_and_applications.sql`, and UUID `space_capability_grants.space_id` in the governance migration. Their responsibilities must not be conflated.
- `users.is_platform_admin` is documented as a bootstrap marker only. It confers no space capability or general data access.
- RLS is not the primary protection for server operations because the service-role client bypasses it. Losing the branded-scope/repository boundary would expose cross-space data.
- Existing governed notifications support only in-app and Expo push. Email service code exists elsewhere, but email is not a governed space-delivery channel.
- Current preference defaults treat missing `spaceAnnouncements` as opted in. The visible settings pages cannot modify that key.
- Existing vote-result and verification notification paths are separate from governed space campaigns; the audience module records that existing vote fan-out ignores notification settings.
- Open recorded finding: a failure after campaign claim but before recipient/audit writes can leave a campaign marked `sent`, consume quota, and have no deliveries. This is documented in `.planning/phases/05-space-governance-substrate-and-space-admin-operations-dashboard/05-09-SUMMARY.md`.
- The prior phase’s manual verification evidence exists, but `.planning/REQUIREMENTS.md` contains stale pending traceability entries despite completed Phase 5 plans. Treat the executable tree and tests as authoritative.
- No protected source paths are declared in the supplied `AGENTS.md`. This research task itself is read-only, so no `RESEARCH.md` file was written.

## Open questions

1. What are the authoritative membership rules for each space type: open join, invitation, owner approval, verified geography, organization roster, or combinations?
2. Can one user hold several geographic memberships simultaneously, or exactly one residence membership plus multiple civic/organization memberships?
3. What stable geography representation should replace the municipality join key for urban and nationwide spaces, given that PostGIS is absent?
4. Which content is public across spaces, and which entities require membership to discover, read, vote on, or receive notifications about?
5. Is an organization a specialized `spaces` row, or does it require a separate organization entity/profile owning one or more spaces?
6. Should `owner_user_id` remain the owner model, or must ownership support organizations and multiple named administrators?
7. What verification authority and workflow transitions are allowed for spaces and organizations?
8. What role inheritance is intended, if any? Should roles remain presets expanded into capabilities, or become persisted inheritable assignments?
9. How should the legacy municipality-code `role_grants` model be migrated or retired relative to UUID `space_capability_grants`?
10. Are missing notification preferences opt-in or opt-out for each event and channel?
11. What digest cadences, quiet-hour timezone semantics, and global versus per-space unsubscribe behavior are required?
12. Must email delivery ship in v1, or only be modeled as “email-ready” while in-app and push remain the enabled channels?
13. Should existing vote-result and verification fan-outs be brought under the same preference and delivery-log system?
14. Which `/spaces` and organization-profile experiences must exist on mobile as native screens versus web-only routes?
15. Does “leave” remove historical membership records, soft-close them, or preserve an auditable lifecycle?
16. What is the intended rollback switch: global spaces feature flag, per-space activation state, per-type allowlist, per-channel disablement, or all four?