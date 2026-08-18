# Research — issue #78

## Already-done check

- NGO completes review and launches an organization space with scoped administrators: **MISSING**. Generic `organization` spaces and scoped capability grants exist, but there is no NGO application/review flow or organization-space creation path. Non-municipal spaces are currently rejected when minting an operational `SpaceScope` because they lack `municipality_code` ([supabase/migrations/20260802000010_space_governance.sql](supabase/migrations/20260802000010_space_governance.sql), [authorize.ts](apps/web/src/server/app/space-admin/authorize.ts)).
- Decision record identifies eligibility, quorum, rule version, result, and audit trail: **MISSING**. Existing votes have dates, status, options, and counts, while `space_audit_log` provides append-only operational history. No governance-rule versions, quorum configuration, eligibility snapshot, recusal, minutes, or immutable organization decision record exists ([supabase/migrations/20240101000000_initial_schema.sql](supabase/migrations/20240101000000_initial_schema.sql), [space-audit.repo.ts](apps/web/src/server/infra/supabase/space-audit.repo.ts)).
- Governance-template changes do not alter completed decisions retroactively: **MISSING**. No governance-template or template-version storage exists.
- Rejected or suspended organizations lose privileged access without deleting public history: **MISSING** as an organization lifecycle. Capability/member suspension already takes effect on the next request and retains audit history, but `spaces.verification_state` supports only `unverified`, `pending`, and `verified`; it has no rejected/suspended state. There is also no NGO public history surface ([20260802000010_space_governance.sql](supabase/migrations/20260802000010_space_governance.sql), [space.repo.ts](apps/web/src/server/infra/supabase/space.repo.ts)).

**Verdict: proceed.** The tree contains useful generic administration and audit infrastructure, but it does not satisfy any acceptance criterion end to end.

## Current-state map

- **Generic spaces:** `public.spaces` already admits `type = 'organization'`, with slug, Hebrew name, owner, geography, and a generic verification state. Municipality spaces are seeded automatically; organization spaces are not ([20260802000010_space_governance.sql](supabase/migrations/20260802000010_space_governance.sql)).
- **Administrative authorization:** Eleven explicit per-action capabilities live in `space_capability_grants`. Role presets are UI provenance only and do not confer authority. Active grants are resolved on every request, so suspension is immediate ([spaceAdmin.ts](packages/shared/src/contracts/spaceAdmin.ts), [capability.ts](apps/web/src/server/domain/space/capability.ts), [space.repo.ts](apps/web/src/server/infra/supabase/space.repo.ts)).
- **Second role system:** `role_grants` supports platform `super_admin`, scoped `space_admin`, and `community_manager`. `community_manager_applications` provides a submitted/approved/rejected/withdrawn review pattern with evidence URLs, and `role_grant_events` is append-only. It is currently municipality-code scoped, not UUID `spaces.id` scoped ([20260802000002_role_grants_and_applications.sql](supabase/migrations/20260802000002_role_grants_and_applications.sql), [role.ts](packages/shared/src/contracts/role.ts)).
- **Space-admin application layer:** Use cases under `apps/web/src/server/app/space-admin/` authorize first and pass branded `SpaceScope`/`SpaceMembership` values to repositories. Existing operations cover proposal review, content moderation, members, grants, metrics, notifications, escalation, and audit.
- **Repository layer:** Space persistence is split across `space.repo.ts`, `space-member.repo.ts`, `space-decision.repo.ts`, `space-audit.repo.ts`, `space-metrics.repo.ts`, and `space-notify.repo.ts` under `apps/web/src/server/infra/supabase/`.
- **HTTP and UI:** Existing routes live under `/api/space-admin/[spaceId]` and `/[locale]/space-admin/[spaceId]`. The dashboard has overview, proposals, members, statistics, dispatch, and audit pages. There are no `/organizations/*` routes, NGO profile, template editor, deliberation page, decision-record page, or NGO export endpoint.
- **Existing onboarding:** `/[locale]/onboarding` is individual-user municipality selection and rating, not organization onboarding ([page.tsx](apps/web/src/app/[locale]/onboarding/page.tsx)).
- **Votes:** `votes` are municipality-keyed and contain title, description, lifecycle dates, participant count, and status. Options store mutable counts. Existing review migrations add draft/review states, but there is no organization/space UUID, governance binding, eligibility snapshot, quorum, conflicts, minutes, attachments, or outcome-record model ([20240101000000_initial_schema.sql](supabase/migrations/20240101000000_initial_schema.sql), [20260802000011_vote_status_review_values.sql](supabase/migrations/20260802000011_vote_status_review_values.sql), [20260802000012_vote_review_gating.sql](supabase/migrations/20260802000012_vote_review_gating.sql)).
- **Audit preservation:** `space_audit_log` rejects update, delete, and truncate operations. Its foreign keys use `ON DELETE RESTRICT`; the repository exports insert and paginated read operations only. `role_grant_events` supplies a separate append-only review history.
- **Suspension:** Grant and member suspensions retain their original rows. Suspended administrators can render a restricted shell and escalate but receive no active capabilities. This is a reusable pattern for the required history-preserving loss of access.
- **Feature rollback:** `apps/web/src/lib/features/space-admin.ts` disables the current administration surface without removing governance or audit rows. No separate “advanced NGO governance” fallback flag exists.
- **Public labeling:** The shared space chrome recognizes the generic Hebrew label for `organization`, but there is no NGO-specific verified badge or disclaimer separating organization decisions from municipal authority decisions ([chrome.ts](apps/web/src/components/space-admin/chrome.ts)).

## Integration points

- **Authorization seam:** `authorize(session, rawSpaceId, capability)` is the sole `SpaceScope` minter. Repositories should continue accepting branded scope objects rather than caller-provided space IDs ([authorize.ts](apps/web/src/server/app/space-admin/authorize.ts)).
- **Non-municipal blocker:** `SpaceScope.municipalityCode` is non-nullable, and `authorize()` deliberately refuses organization spaces because existing vote/proposal repositories filter `votes.municipality_id`. NGO governance needs an explicit organization scoping key before existing operations can work for `spaces.type = 'organization'`.
- **Shell-only seam:** `resolveMembership()` accepts organization spaces because `SpaceMembership.municipalityCode` is nullable, but it authorizes only dashboard-shell rendering, not scoped data operations.
- **Super-admin review seam:** `requireRole(userId, 'super_admin', null)`, `requireReviewAuthority()`, and `requireAdminScope()` are the existing review authorization helpers in `apps/web/src/server/app/authz/require-role.ts`.
- **Review repository seam:** `apps/web/src/server/infra/supabase/role.repo.ts` contains application queues, active-grant lookup, and review persistence shaped most closely like NGO verification.
- **Application contract seam:** `packages/shared/src/contracts/role.ts` supplies application and review schemas. NGO contracts should remain distinct enough that NGO verification cannot be confused with municipality/authority claims.
- **Capability seam:** Extend the allow-lists consistently in all three locations if governance introduces new powers: `packages/shared/src/contracts/spaceAdmin.ts`, `apps/web/src/server/domain/space/capability.ts`, and the database CHECK on `space_capability_grants.capability`.
- **Audit seam:** Organization actions can use `insertAuditRow()` and `listAuditRows()` where they fit the current object vocabulary. New decision/template/application object types require coordinated changes to the database CHECK, generated Supabase types, contracts, filters, and audit UI.
- **Immutable-history seam:** Copy the trigger, privilege revocation, `ON DELETE RESTRICT`, and insert/read-only repository pattern from `space_audit_log`. A completed decision must snapshot or reference an immutable governance-rule-version row; it must not resolve through a mutable template head.
- **Suspension seam:** `findActiveGrant()` filters `suspended_at IS NULL` on every request. `findGrantsForUser()` intentionally includes suspended rows for the restricted shell. The member/grant suspension use cases write corresponding audit events.
- **HTTP seam:** Existing route handlers parse Zod contracts and delegate to application use cases under `/api/space-admin/[spaceId]`. Organization routes can reuse that layering but cannot reuse municipality-bound repositories unchanged.
- **Authentication:** Web handlers use the established authenticated session from `apps/web/src/services/auth/session.ts`. Server persistence still uses the Supabase service-role client, so application-layer authorization is mandatory.
- **Migration numbering:** The latest migration in the tree is `20260811000004_pilot_program.sql`. A migration created for the current worktree date would begin at `20260817000001`, subject to collision checking immediately before planning. Migrations are append-only; existing migrations must not be edited.
- **Generated database types:** Schema changes require synchronized updates to `apps/web/src/lib/supabase/types.ts`.
- **Export seam:** No general export port or helper exists for governance records. Export format, authorization, and attachment delivery need a new explicit contract.
- **Attachment seam:** No NGO/governance attachment store or repository was found.

## Prior art

The nearest merged PR is **#93**, commit `9d6bc53`, `feat(space-admin): space governance substrate and administrator operations dashboard`.

Copy from it:

- Branded authorization scopes minted in one application-layer module.
- Explicit capabilities with default denial.
- Use-case/repository separation under `server/app/space-admin` and `server/infra/supabase`.
- Zod request/response allow-lists in the shared package.
- Append-only audit enforcement in both database and repository vocabulary.
- Immediate suspension without cached authority.
- Confirmation dialogs requiring a reason.
- Feature-flag rollback that preserves stored history.
- API, unit, database-harness, Playwright, accessibility, and screenshot evidence patterns.
- RTL organization of the `/[locale]/space-admin/[spaceId]` dashboard.

For application review specifically, also copy the shape of `community_manager_applications`, `role_grants`, `role_grant_events`, `requireReviewAuthority()`, and `role.repo.ts`, while resolving their municipality-code dependency rather than inheriting it.

## Constraint register

- **Known unapplied migrations:** [docs/WORK-ORDER.md](docs/WORK-ORDER.md) explicitly says space migrations `20260802000010` through `20260802000014` still need to be applied and proven, including running `supabase/tests/audit_append_only.sql`. NGO work would depend on that substrate.
- **Protected paths:** Any implementation will almost certainly touch `supabase/migrations/`, which [docs/PR-AUTOPILOT.md](docs/PR-AUTOPILOT.md) marks as protected and requiring file-specific spec approval.
- **Current branch state:** `HEAD` equals `origin/main`; there are no issue-specific commits or tracked/untracked working-tree changes.
- **Non-municipal authorization blocker:** Organization spaces can render only a membership shell. Operational scope creation refuses them until a non-municipal data-scoping model is introduced.
- **Dual authorization models:** `role_grants` uses municipality text IDs and semantic roles; `space_capability_grants` uses space UUIDs and explicit capabilities. The tree does not establish which model owns NGO administrator authority.
- **Membership blocker:** Existing municipality membership derives from `users.municipality_id = spaces.municipality_code`. No organization-membership or invitation table exists.
- **Lifecycle blocker:** `spaces.verification_state` lacks rejected and suspended values and does not distinguish NGO verification from government/municipal verification.
- **Vote-schema blocker:** Current votes are municipality-bound and mutable-count based. They do not preserve the inputs needed to reproduce quorum or eligibility decisions.
- **Audit vocabulary:** `space_audit_log.object_type` is CHECK-constrained and does not include organization applications, governance templates, template versions, deliberations, attachments, or decision records.
- **Deletion semantics:** Current user-linked space audit rows use `ON DELETE RESTRICT`; role review events deliberately omit foreign keys. A single retention policy has not been selected for NGO applicants, members, attachments, or public decisions.
- **Feature rollback:** The current space-admin feature switch is too broad to represent “advanced NGO governance disabled, basic non-binding polls remain available.”
- **Open security findings:** [SECURITY-AUDIT.md](SECURITY-AUDIT.md) records broader unresolved service-role/RLS inconsistencies. No finding specifically names NGO governance, but all new service-role repositories must preserve explicit application authorization and must not rely on RLS alone.
- **External documentation:** No new external integration is required by the issue as written. If attachment storage is implemented through Supabase Storage, current Supabase documentation must be pulled through Context7 before implementation.

## Open questions

1. Does NGO review generalize `community_manager_applications`, or require a separate `ngo_applications` model with organization-level evidence and lifecycle?
2. Which authority model owns NGO administrators: semantic `role_grants`, explicit `space_capability_grants`, or a documented composition of both?
3. What is the canonical scoping model for organization data now that `municipality_code` cannot identify members, proposals, or decisions?
4. What makes an organization a member, and who may invite, accept, remove, suspend, or reinstate members?
5. Which evidence fields must a super-admin review, and what distinguishes an NGO badge from municipality, government, and generic organization labels?
6. Are `rejected` and `suspended` organization states additions to `spaces.verification_state`, or should verification applications and operational status be separate state machines?
7. On rejection or suspension, which public organization profile and decision-history fields remain visible?
8. Must existing platform `votes` be extended for governed organization decisions, or should governed decisions be a separate aggregate with an optional basic-poll relationship?
9. What exact eligibility rule vocabulary is configurable, and must a completed decision store an evaluated eligible-member snapshot?
10. How is quorum calculated: eligible members at opening, at deadline, at submission time, or another defined snapshot?
11. What constitutes a conflict and recusal, who records it, and does a recused member remain in the quorum denominator?
12. Are deliberations public, member-only, or configurable per decision, and what accessibility standard applies to comments, minutes, and attachments?
13. Who may amend minutes, and what immutable revision/audit behavior is required after publication?
14. Which export formats are required—CSV, JSON, PDF, or a signed bundle—and which fields or attachments may appear in public exports?
15. What precise disclaimer and visual label must every organization-run vote and outcome carry so it cannot be mistaken for an authority decision?
16. What confirmation and preview are required before publishing a rule version or opening a governed decision?
17. When advanced governance is disabled, what existing “basic non-binding poll” path is authoritative, and how is that status represented publicly?
18. Is `20260817000001` reserved for this issue, or is another concurrent migration lane expected to claim that number?

Read-only constraint prevented writing `RESEARCH.md`; the content above is ready to save as that file.