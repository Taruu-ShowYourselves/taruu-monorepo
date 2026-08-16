# Spec — issue #74 space-identity-metadata v1

## Current state

The issue is too large for one half-day PR and must be split; this first slice establishes the typed, read-only identity metadata needed by later discovery and membership work. UUID-backed spaces and the allowed types already exist in `20260802000010_space_governance.sql`, but the projection in `apps/web/src/server/infra/supabase/space.repo.ts` omits ownership and verification metadata. Shared space-admin contracts belong in `packages/shared/src/contracts/spaceAdmin.ts`, while HTTP adapters must remain thin and follow the existing `neverthrow`/`AppError` pattern. Authorization must continue through the branded `SpaceScope` minted by `apps/web/src/server/app/space-admin/authorize.ts`, because server-side Supabase access uses `BYPASSRLS`. The existing administrative UI at `apps/web/src/app/[locale]/space-admin/[spaceId]/` is the safe integration point; public `/spaces` routes cannot be introduced until discovery and content-visibility rules are resolved.

## Goal

Extend the existing authorized space-admin summary with a stable, typed identity block containing the space UUID, type, geography, owner identity, and verification state, and render that block in the existing Hebrew/RTL administrative page. This slice must not introduce public discovery, membership semantics, new authority, or database changes. Later slices should separately address: membership lifecycle and authorization, public discovery/detail routes, organization profiles, notification preferences/delivery, and mobile experiences.

## In scope

- claim: packages/shared/src/contracts/spaceAdmin.ts
- claim: apps/web/src/server/infra/supabase/space.repo.ts
- claim: apps/web/src/app/[locale]/space-admin/[spaceId]/page.tsx
- claim: apps/web/src/__tests__/api/space-admin-summary.test.ts

## Out of scope

No database migration or generated database-type change. No `/spaces`, `/spaces/[slug]`, organization-profile, or mobile route. No discover, join, leave, invitation, approval, geographic-membership, or space-switching behavior. No changes to votes, vote eligibility, content visibility, notification audiences, notification preferences, delivery logs, email, push, or digest behavior.

Do not alter `SpaceScope`, capability grants, role presets, role inheritance, or the distinction between legacy municipality-code grants and UUID capability grants. Do not make non-municipal spaces administrable: `authorize.ts` continues rejecting spaces without `municipality_code`. Do not expose this metadata through an unauthenticated endpoint. Owner identity in this slice is the existing stable `owner_user_id`; resolving it to mutable profile fields is deferred.

Proposed follow-up split:

1. Auditable multi-space membership model and authorization scopes.
2. Public discovery/detail routes with explicit public/private content rules.
3. Organization profiles and ownership/verification workflow.
4. Per-space notification preferences, digest and quiet-hour semantics, unsubscribe, and delivery enforcement.
5. Mobile routes, space switching, and multi-space end-to-end coverage.

## Contracts

Extend the existing authorized space-summary response in `packages/shared/src/contracts/spaceAdmin.ts` with:

```ts
identity: {
  id: string; // UUID
  type:
    | "municipality"
    | "national"
    | "organization"
    | "urban_area"
    | "nationwide_civic";
  geography: unknown | null; // preserved database JSON; not interpreted in this slice
  ownerUserId: string | null; // UUID
  verificationState: string;
}
```

The exact `verificationState` schema must use the values already constrained by the checked-in governance migration; it must not invent additional workflow states. If the migration does not constrain a finite set, the shared contract may use a non-empty string until a verification-workflow slice defines the state machine.

`space.repo.ts` must select and map `spaces.id`, `type`, `geography`, `owner_user_id`, and `verification_state` as part of the existing summary query. It must continue accepting a branded `SpaceScope`, derive the queried space from that scope, and never accept a raw request-controlled space ID as the repository authorization boundary.

The existing API response shape may only be extended additively with `identity`; existing summary fields and error behavior remain unchanged. Unauthorized, cross-space, missing-space, and unsupported non-municipal requests must retain the same opaque failure semantics.

The existing admin page must render all five identity fields. Null owner and geography values must render an explicit localized “not specified” state rather than disappearing. Internal enum values must have deterministic Hebrew labels, while the stable UUID may be displayed verbatim.

No migration is created. `apps/web/src/lib/supabase/types.ts` remains unchanged because all selected columns already exist.

## Acceptance gates

- G-1: The shared summary contract accepts every existing space type and rejects an unknown type; it requires `id`, `type`, `geography`, `ownerUserId`, and `verificationState` inside `identity`. → evidence: `pnpm --filter web test -- space-admin-summary.test.ts`

- G-2: The authorized summary repository maps all five identity fields from the existing `spaces` row without accepting a raw caller-controlled space ID. → evidence: `pnpm --filter web test -- space-admin-summary.test.ts`

- G-3: A request authorized for space A cannot obtain space B’s identity metadata, and the response uses the existing opaque authorization failure. → evidence: `pnpm --filter web test -- space-admin-summary.test.ts`

- G-4: Existing authorized summary fields remain present and unchanged when the additive `identity` block is returned. → evidence: `pnpm --filter web test -- space-admin-summary.test.ts`

- G-5: The administrative page renders type, stable space ID, owner user ID, verification state, and geography, including explicit null-state labels. → evidence: `artifacts/issue-74/space-identity-admin-desktop.png`

- G-6: Shared contracts, repository mapping, and page consumption typecheck across the monorepo. → evidence: `pnpm typecheck`

- G-7: The changed files satisfy repository lint rules. → evidence: `pnpm lint`

## Protected paths

- `supabase/migrations/` — protected because this slice consumes the existing schema and must not define unresolved membership, geography, ownership, or verification semantics.
- `.github/workflows/` — protected because CI or deployment behavior is unrelated to the additive identity projection.
- `apps/web/src/app/api/payments/` — protected because payments and municipality treasury paths must remain isolated from space metadata work.

No file under a protected path may be modified.

## Risk & rollback

The primary risks are leaking one space’s metadata through an incorrectly scoped query, unintentionally broadening non-municipal authorization, or breaking existing consumers with a non-additive response change. The focused test must prove cross-space denial and backward-compatible response fields, while the repository must retain the branded-scope boundary documented in `RESEARCH.md`.

Rollback is a normal code revert of the four claimed files. There is no database rollback, data migration, or persisted-state cleanup. If the UI presentation is problematic, the identity panel can be removed independently while reverting the additive projection and contract in the same PR revert.