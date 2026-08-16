# Spec — issue #78 ngo-application-substrate v1

> **Split required.** Issue #78 is not one PR-sized change. Deliver it as separate slices: (1) NGO application persistence contracts, (2) super-admin review APIs, (3) organization creation and scoped administrators, (4) versioned governance templates, (5) deliberation and governed voting, (6) immutable public outcomes and exports, and (7) suspension/reinstatement and advanced-governance rollback. This spec covers slice 1 only.

## Current state

Generic `spaces` support `type = 'organization'`, but no NGO application or organization-creation path exists ([supabase/migrations/20260802000010_space_governance.sql](supabase/migrations/20260802000010_space_governance.sql)).  
The closest review model is `community_manager_applications`, but it is municipality-scoped and must not represent NGO verification ([apps/web/src/server/infra/supabase/role.repo.ts](apps/web/src/server/infra/supabase/role.repo.ts)).  
Future review APIs must use the existing `requireRole(userId, 'super_admin', null)` authorization seam ([apps/web/src/server/app/authz/require-role.ts](apps/web/src/server/app/authz/require-role.ts)).  
Existing role/application contracts provide the Zod and review-reason patterns, but NGO contracts must remain distinct from municipality or authority claims ([packages/shared/src/contracts/role.ts](packages/shared/src/contracts/role.ts)).  
Schema changes require an append-only migration and synchronized generated database types; the next researched migration slot is `20260817000001`, subject to collision checking immediately before implementation ([apps/web/src/lib/supabase/types.ts](apps/web/src/lib/supabase/types.ts)).

## Goal

Introduce the durable, NGO-specific application and review-history substrate needed by later onboarding APIs. An authenticated user can be represented as an NGO applicant, evidence and proposed organization identity have explicit validated contracts, and every application status decision can be retained in append-only history. This slice deliberately grants no badge, role, capability, or organization space and exposes no HTTP or UI surface.

## In scope

- claim: supabase/migrations/20260817000001_ngo_applications.sql
- claim: supabase/tests/ngo_application_review.sql
- claim: apps/web/src/lib/supabase/types.ts
- claim: packages/shared/src/contracts/ngo.ts
- claim: packages/shared/src/contracts/index.ts
- claim: packages/shared/src/contracts/__tests__/ngo.test.ts

## Out of scope

No API routes, repositories, use cases, pages, screenshots, organization-space creation, invitations, membership, role or capability grants, verified badge, changes to `spaces.verification_state`, suspension/reinstatement, governance templates, decisions, deliberation, votes, quorum, eligibility, conflicts, recusals, minutes, attachments, exports, audit UI, or feature flags.

This slice does not generalize `community_manager_applications` and does not modify `role_grants`, `space_capability_grants`, `space_audit_log`, existing votes, or existing migrations. Approval records reviewer intent only; it must not confer authority or imply legal, municipal, governmental, or operational verification.

Follow-on slice 2 must implement super-admin-only review through `requireRole(userId, 'super_admin', null)` and the service-role repository pattern. Follow-on slice 3 must separately resolve organization UUID scoping, membership, organization creation, and explicit capability grants before any approved applicant gains privileged access.

## Contracts

Migration `20260817000001_ngo_applications.sql` adds:

- `ngo_applications` with:
  - UUID primary key.
  - Applicant user reference.
  - Proposed organization name and slug.
  - Applicant motivation.
  - Evidence URLs stored as a JSON array.
  - Status restricted to `submitted`, `approved`, `rejected`, or `withdrawn`.
  - Nullable reviewer, review timestamp, and review reason.
  - Created and updated timestamps.
- A database constraint permitting reviewer, review timestamp, and review reason only as a complete set on `approved` or `rejected` rows, and requiring all three for those terminal review states.
- A partial uniqueness constraint allowing at most one `submitted` application per applicant.
- `ngo_application_events` with application ID, actor ID, event type, reason, timestamp, and a JSON snapshot sufficient to preserve the reviewed application state.
- Event types restricted to `submitted`, `approved`, `rejected`, and `withdrawn`.
- `ON DELETE RESTRICT` from events to applications so review history cannot be orphaned.
- Database enforcement rejecting `UPDATE`, `DELETE`, and `TRUNCATE` against `ngo_application_events`.
- No trigger or policy that creates a `spaces` row, changes a badge, or grants a role/capability.

`packages/shared/src/contracts/ngo.ts` exports distinct Zod contracts for:

- NGO application status and event vocabulary.
- Proposed NGO identity: trimmed organization name and lowercase URL-safe slug.
- Submission input: proposed identity, motivation, and a bounded list of valid HTTPS evidence URLs.
- Applicant-safe application view.
- Super-admin review input: `approve | reject` plus the existing minimum review-reason semantics.
- Review result view with reviewer metadata.
- No field or enum may use municipality, government, authority, legally incorporated, or operationally verified terminology.

`packages/shared/src/contracts/index.ts` re-exports the NGO contracts.

`apps/web/src/lib/supabase/types.ts` exactly reflects both new tables, including row, insert, update, nullable, status, and event fields.

Invariants:

- NGO verification data remains distinct from municipality and authority verification.
- An application approval alone authorizes nothing.
- There can be no more than one submitted application for one applicant.
- Approved and rejected applications always identify reviewer, review time, and reason.
- Pending and withdrawn applications cannot masquerade as reviewed.
- Application events are append-only and retained independently of later access changes.
- Existing migrations remain unchanged.

## Acceptance gates

- G-1: NGO contract tests prove valid submission/review payloads parse; malformed slugs, non-HTTPS evidence, oversized evidence lists, short review reasons, and authority/municipality-shaped payloads fail parsing. → evidence: `pnpm --filter @sync/shared test -- src/contracts/__tests__/ngo.test.ts`
- G-2: Shared exports and synchronized Supabase table types compile without TypeScript errors. → evidence: `pnpm typecheck`
- G-3: A clean local database applies all migrations, including `20260817000001_ngo_applications.sql`. → evidence: `supabase db reset`
- G-4: The SQL harness proves the single-submitted-application constraint, reviewed-field consistency constraints, allowed status/event vocabulary, and `ON DELETE RESTRICT`. → evidence: `supabase test db supabase/tests/ngo_application_review.sql`
- G-5: The SQL harness proves `UPDATE`, `DELETE`, and `TRUNCATE` of `ngo_application_events` are rejected while inserts and ordered reads succeed. → evidence: `supabase test db supabase/tests/ngo_application_review.sql`
- G-6: The migration contains no inserts into `spaces`, `role_grants`, or `space_capability_grants` and does not alter their definitions. → evidence: `rg -n "INSERT INTO (public\\.)?(spaces|role_grants|space_capability_grants)|ALTER TABLE (public\\.)?(spaces|role_grants|space_capability_grants)" supabase/migrations/20260817000001_ngo_applications.sql` returns no matches
- G-7: No existing migration is modified. → evidence: `git diff --exit-code -- supabase/migrations ':(exclude)supabase/migrations/20260817000001_ngo_applications.sql'`

## Protected paths

- `supabase/migrations/` — protected and explicitly approved only for the claimed append-only migration `20260817000001_ngo_applications.sql`; collision-check the filename immediately before implementation.
- `.github/workflows/` — protected and not claimed; no changes permitted.
- `apps/web/src/app/api/payments/` — protected and not claimed; no changes permitted.

## Risk & rollback

The primary risks are accidentally treating application approval as operational authorization, conflating NGO verification with municipal authority, permitting contradictory review metadata, or creating deletable review history. The contracts, database constraints, append-only event enforcement, and explicit absence of grants or space creation contain those risks.

Before deployment, rollback is deletion of the newly added migration and associated claimed contract/type/test files. After deployment, migrations remain append-only: rollback must use a new migration that disables new writes and removes the two unused tables only after confirming that no application history must be retained. Reverting application code in later slices must never delete NGO applications or event history.