# Spec — issue #76 authority-verification-foundation v1

## Current state

Issue #76 is too large for one conservative PR and must be split. This first slice establishes the organization-claim and verification boundary only.

Authority participation does not exist today; public council profiles are sourced civic records and must remain available independently through `public_council_metrics()` → `apps/web/src/lib/supabase/db.ts` → `apps/web/src/server/app/council/get-public-profile.ts` → the public council API/page.

The new claim must use `municipalities.council_id` / matching `spaces.id` as its stable authority identity, retaining `municipalities.code` only for existing geographic predicates.

Super-admin decisions must reuse `requireReviewAuthority()` and the existing Result-typed repository/application separation demonstrated by `apps/web/src/server/infra/supabase/role.repo.ts`; repositories use `supabaseAdmin`, so authorization must occur before every repository call.

Claim events must follow the database-enforced append-only pattern of `role_grant_events`, including history that survives staff changes. Evidence URLs remain private and must never enter the anonymous public council RPC.

This migration-bearing slice depends on issue #101’s review-authority and first-super-admin bootstrap being complete, and must be applied individually because the production migration ledger has intentional drift.

## Goal

Add a manually reviewed municipality-organization claim lifecycle. An authenticated user can submit evidence for one municipality; only a super-admin review authority can approve, reject, suspend, or restore the claim; and the public council profile reports official participation only while a claim is approved. This slice provides the trustworthy verification substrate without introducing authority representatives, dashboard access, moderation powers, responses, commitments, satisfaction, or exports.

## In scope

- claim: supabase/migrations/20260817000001_authority_organization_claims.sql
- claim: supabase/tests/authority_organization_claims.sql
- claim: packages/shared/src/contracts/authorityClaim.ts
- claim: packages/shared/src/contracts/index.ts
- claim: apps/web/src/lib/supabase/types.ts
- claim: apps/web/src/server/infra/supabase/authority-claim.repo.ts
- claim: apps/web/src/server/app/authority-claims/submit-claim.ts
- claim: apps/web/src/server/app/authority-claims/decide-claim.ts
- claim: apps/web/src/app/api/authority/claims/route.ts
- claim: apps/web/src/app/api/authority/claims/[claimId]/decision/route.ts
- claim: apps/web/src/server/domain/council/public-profile.ts
- claim: apps/web/src/server/app/council/get-public-profile.ts
- claim: apps/web/src/server/app/authority-claims/authority-claims.test.ts
- claim: apps/web/src/server/app/council/get-public-profile.test.ts

## Out of scope

- `/[locale]/authority/onboarding` UI and unprefixed redirect behavior.
- `/[locale]/municipality-admin`, vote/result inboxes, dashboard metrics, and exports.
- Representative invitations, acceptance, offboarding, and authority role grants.
- Official responses and append-only response versions.
- Commitments, deadlines, escalation workflow, and satisfaction history.
- Government-level authorities, legal filing, and automatic verification.
- Changes to existing public council availability or sourced municipal facts.
- Access to resident identities or unsuppressed resident data.
- Any proposal moderation, content moderation, grant management, or platform-escalation capability.
- Fixes for treasury transaction exposure, vote-location integrity, seed failures, or migration-ledger ambiguity.
- Subsequent planned slices:
  1. representative invitations and municipality-scoped authority authorization;
  2. privacy-suppressed dashboard aggregates and vote inbox;
  3. official response versioning;
  4. commitments, deadlines, and durable satisfaction events;
  5. exports, full audit UI, and representative offboarding.

## Contracts

Migration `20260817000001_authority_organization_claims.sql` adds:

- `authority_organization_claims` with:
  - immutable `id`;
  - `council_id` referencing the stable municipality/council identity;
  - immutable `submitted_by`;
  - submitted organization name;
  - validated evidence URL array;
  - lifecycle state: `pending | approved | rejected | suspended`;
  - submission timestamp;
  - current decision metadata for efficient reads.
- A database constraint allowing at most one `approved` claim per `council_id`.
- A database constraint preventing a claim from changing its `council_id` or submitter.
- `authority_organization_claim_events` with event types:
  - `submitted`;
  - `approved`;
  - `rejected`;
  - `suspended`;
  - `restored`.
- Event rows record claim, actor identifier, timestamp, prior state, resulting state, and optional reviewer reason.
- Database-enforced append-only event history: update and delete fail for application roles.
- No anonymous or authenticated direct access to claim evidence or decision events.
- A restricted lookup that exposes only `council_id` plus current approved participation status for composition into public council profiles. It must not expose evidence, claimant identity, reviewer identity, or reasons.

Shared contracts define:

```ts
type AuthorityClaimStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "suspended";

type SubmitAuthorityClaimInput = {
  councilId: string;
  organizationName: string;
  evidenceUrls: string[];
};

type AuthorityClaimDecisionInput =
  | { action: "approve"; reason?: string }
  | { action: "reject"; reason: string }
  | { action: "suspend"; reason: string }
  | { action: "restore"; reason: string };
```

`POST /api/authority/claims`:

- Requires an authenticated session.
- Accepts `SubmitAuthorityClaimInput`.
- Rejects missing evidence and malformed/non-HTTPS evidence URLs.
- Resolves the target through stable `council_id`.
- Creates a `pending` claim and matching `submitted` event atomically.
- Returns `201` with claim ID, council ID, status, and submission timestamp.
- Never returns retained evidence after submission.
- Uses uniform `404` behavior where distinguishing missing from inaccessible resources could disclose scope.

`POST /api/authority/claims/:claimId/decision`:

- Calls `requireReviewAuthority()` before repository access.
- Accepts `AuthorityClaimDecisionInput`.
- Enforces transitions:
  - `pending → approved`;
  - `pending → rejected`;
  - `approved → suspended`;
  - `suspended → approved` via `restore`.
- Rejects every other transition with `409`.
- Updates current state and inserts the corresponding append-only event atomically.
- Returns claim ID, resulting status, and decision timestamp.
- Does not delete claims or event history.

Public council profile contract:

- Adds `officialParticipation: { verified: boolean }`.
- `verified` is true only when a current claim for the profile’s `council_id` is `approved`.
- `pending`, `rejected`, and `suspended` claims all produce `verified: false`.
- Public council profiles remain available and otherwise unchanged when no claim exists.
- No organization-provided name replaces canonical sourced council identity in this slice.
- Evidence and reviewer metadata never appear in public profile output.

Repository/application invariant:

- The repository is Result-typed and contains persistence only.
- Submit authorization and `requireReviewAuthority()` enforcement remain in the application layer.
- No route may call the service-role repository before its applicable session or review-authority check.
- Approval creates verification status only; it grants no platform role or moderation capability.

## Acceptance gates

- G-1: A fresh database accepts the new migration with seeding disabled, and the authority-claim SQL test passes → evidence: `supabase test db supabase/tests/authority_organization_claims.sql`
- G-2: Database tests prove claim-event rows reject `UPDATE` and `DELETE`, while lifecycle events remain readable after the actor account is removed → evidence: `supabase test db supabase/tests/authority_organization_claims.sql`
- G-3: Database tests prove two simultaneous approved claims cannot exist for one `council_id` → evidence: `supabase test db supabase/tests/authority_organization_claims.sql`
- G-4: Application tests prove anonymous claim submission returns `401`, a non-reviewer decision returns the existing opaque authorization failure, and `requireReviewAuthority()` runs before repository access → evidence: `pnpm --filter web test -- authority-claims.test.ts`
- G-5: Application tests cover every permitted transition and prove invalid transitions return `409` without adding an event → evidence: `pnpm --filter web test -- authority-claims.test.ts`
- G-6: Public-profile tests prove absent, pending, rejected, and suspended claims yield `officialParticipation.verified === false`, while approved yields `true` → evidence: `pnpm --filter web test -- get-public-profile.test.ts`
- G-7: Public-profile serialization tests prove evidence URLs, claimant IDs, reviewer IDs, and review reasons are absent from anonymous output → evidence: `pnpm --filter web test -- get-public-profile.test.ts`
- G-8: Shared contracts, database types, routes, and profile mapper typecheck without widening existing role or moderation contracts → evidence: `pnpm typecheck`
- G-9: All repository tests and existing project tests pass → evidence: `pnpm test`
- G-10: The claimed files satisfy repository lint rules → evidence: `pnpm lint`
- G-11: The production web build completes with the extended public-profile contract → evidence: `pnpm build`

## Protected paths

- `supabase/migrations/` — protected-path approval required for `20260817000001_authority_organization_claims.sql`; it establishes claim state, uniqueness, restricted visibility, and append-only audit enforcement. Apply this migration individually and verify the target migration ledger before deployment.
- `.github/workflows/` — protected and explicitly not claimed; no workflow changes are authorized.
- `apps/web/src/app/api/payments/` — protected and explicitly not claimed; no payment changes are authorized.

## Risk & rollback

The principal risks are falsely presenting an organization as official, leaking retained evidence through a service-role query, and losing audit history during suspension or staff deletion. Database uniqueness, explicit lifecycle transitions, application-layer review authorization, append-only events, and a deliberately minimal public projection contain those risks.

Rollback is operational before destructive: suspend the affected claim, which immediately makes `officialParticipation.verified` false while retaining its complete history. If the feature must be disabled globally, stop serving claim-submission and decision routes and force the public profile mapper to return `verified: false`; public council pages continue using their existing sourced data. Do not delete claims or events. Database rollback requires a separately approved migration and must not be performed by reversing or editing an already-applied production migration.