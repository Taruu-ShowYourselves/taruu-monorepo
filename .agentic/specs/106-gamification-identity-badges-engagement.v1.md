# Spec — issue #106 identity-proof-model-foundation v1

## Current state

The production identity score is database-owned by `supabase/migrations/20260807000001_identity_score_unification.sql`, with `packages/shared/src/utils/identityScore.ts` acting as its display mirror.  
The current mirror assigns Google 40, GPS 20, phone 10, approved ID 40, and social providers 10, capped at 140; it does not represent the proposed 20/20/40 model.  
Proof recomputation and social-provider uniqueness already exist, but primary authentication cannot currently be distinguished from an additionally linked provider.  
Voting eligibility depends on the existing 40-point floor plus separate residency verification through `packages/shared/src/utils/identityScore.ts::votingGate`; this slice must not alter that integration point.  
Because database migration, authentication assurance, UI, engagement ledgers, and store redemption cannot safely fit in one half-day PR, split the issue and land a pure, versioned identity-proof model contract first.

## Goal

Introduce an exported, side-effect-free shared domain model for the proposed identity badges. It will calculate a capped identity score, tier, completed proof categories, and available next steps from explicitly authoritative inputs and a versioned configuration. This is a shadow-only foundation: it must not write persisted scores, alter existing profile/session responses, or participate in voting eligibility until a separately approved migration and rollout PR integrates it.

## In scope

- claim: packages/shared/src/utils/identityProofModel.ts
- claim: packages/shared/src/utils/index.ts
- claim: packages/shared/src/utils/__tests__/identityProofModel.test.ts

## Out of scope

The complete issue is too large for one conservative PR and must be split. This slice excludes:

- Replacing or modifying the existing `calculateIdentityScore`, its constants, or `votingGate`.
- Database schema, triggers, backfills, rollback SQL, generated database types, or production score writes.
- Reading Supabase sessions, AAL, MFA factors, linked identities, OAuth callbacks, or ID-verification records.
- Deciding whether custom phone OTP qualifies; this model accepts only an upstream assertion named for successfully verified AAL2.
- Treating GPS as a v2 scoring proof. Existing residency and voting behavior remain unchanged.
- Preserving migrated users’ voting access; that requires a later migration design with an explicit grandfathering mechanism.
- Profile/session integration, identity-badge UI, localization, accessibility screenshots, or web/mobile changes.
- Engagement XP, achievements, credits, notifications, ledgers, caps, reversals, administration, or analytics.
- Merchandise eligibility, credit reservation, checkout, refund, cancellation, or redemption.
- Feature-flag infrastructure.

Recommended follow-up splits:

1. Server proof-authority adapter for primary authentication, AAL2, approved ID results, and linked-provider classification.
2. Protected database migration with shadow calculation, access-preserving backfill, rollback SQL, and generated types.
3. Web/mobile identity badge and explanation surfaces behind an identity-badge flag.
4. Atomic engagement ledger and first choice-agnostic voting reward.
5. Credit history and notifications.
6. Store reservation/redemption lifecycle.
7. Administration, abuse monitoring, and rollout observability.

## Contracts

Add a new exported module without changing the legacy scoring API.

The module defines:

```ts
type IdentityBadgeTier = 'none' | 'member' | 'verified' | 'trusted';

interface IdentityProofModelConfig {
  readonly version: string;
  readonly maximumScore: number;
  readonly weights: {
    readonly primaryOAuth: number;
    readonly mfaAal2: number;
    readonly approvedIdDocument: number;
    readonly additionalProvider: number;
  };
  readonly tiers: {
    readonly member: number;
    readonly verified: number;
    readonly trusted: number;
  };
}

interface AuthoritativeIdentityProofs {
  readonly primaryOAuthVerified: boolean;
  readonly mfaAal2Verified: boolean;
  readonly idDocumentServerApproved: boolean;
  readonly approvedAdditionalProviders: readonly string[];
}

interface IdentityProofResult {
  readonly modelVersion: string;
  readonly score: number;
  readonly tier: IdentityBadgeTier;
  readonly completedProofs: readonly {
    readonly kind:
      | 'primary_oauth'
      | 'mfa_aal2'
      | 'approved_id_document'
      | 'additional_provider';
    readonly points: number;
  }[];
  readonly nextSteps: readonly {
    readonly kind:
      | 'primary_oauth'
      | 'mfa_aal2'
      | 'approved_id_document'
      | 'additional_provider';
    readonly pointsAvailable: number;
  }[];
}
```

Export a frozen launch configuration with:

- Version: `identity-v2-proposed`
- Primary OAuth: 20
- Successfully verified MFA/AAL2: 20
- Current server-approved ID document: 40
- Each distinct approved additional provider: 10
- Score cap: 100
- Member threshold: 20
- Verified threshold: 40
- Trusted threshold: 80

Export one pure calculation function accepting `AuthoritativeIdentityProofs` and an optional `IdentityProofModelConfig`, defaulting to the launch configuration.

Invariants:

- Scores are non-negative integers and never exceed the configured cap.
- Tier boundaries are inclusive: Member 20–39, Verified 40–79, Trusted 80–100 under the launch configuration; scores below 20 return `none`.
- Repeated entries for the same additional-provider key contribute once.
- Provider keys are used only for in-memory deduplication and are absent from the returned result.
- Primary OAuth is counted independently from additional providers. A caller must not include the primary provider in `approvedAdditionalProviders`.
- `mfaAal2Verified: false` grants zero points; enrollment state is not part of this contract.
- `idDocumentServerApproved: false` grants zero points; client OCR completion is not part of this contract.
- A linked provider is worth only its configured additional-provider points and is never represented as proof of a unique person.
- The result contains no phone number, provider identifier, OAuth token, document contents, or ballot data.
- Configuration validation rejects non-integer or negative weights, a non-positive cap, empty version identifiers, and tier thresholds that are not strictly increasing or exceed the cap.
- The legacy `calculateIdentityScore`, `IDENTITY_SCORE_MAX`, `MINIMUM_IDENTITY_SCORE_FOR_VOTING`, and `votingGate` exports and behavior remain unchanged.
- This module performs no persistence, network access, authentication inspection, logging, analytics, or feature-flag evaluation.

## Acceptance gates

- G-1: The launch configuration exactly encodes 20/20/40/10, cap 100, and tier thresholds 20/40/80. → evidence: `pnpm --filter @sync/shared test -- identityProofModel.test.ts`
- G-2: Table-driven boundary tests return `none` at 0 and 19, `member` at 20 and 39, `verified` at 40 and 79, and `trusted` at 80 and 100. → evidence: `pnpm --filter @sync/shared test -- identityProofModel.test.ts`
- G-3: Primary OAuth, verified AAL2, server-approved ID, and three distinct additional providers calculate 20, 20, 40, and 30 raw points respectively, while the returned score is capped at 100. → evidence: `pnpm --filter @sync/shared test -- identityProofModel.test.ts`
- G-4: Duplicate additional-provider keys produce one completed proof and one 10-point contribution; the returned object contains none of the supplied provider keys. → evidence: `pnpm --filter @sync/shared test -- identityProofModel.test.ts`
- G-5: False MFA and ID-approval assertions award zero points, proving that enrollment or client-side submission alone has no representable award state. → evidence: `pnpm --filter @sync/shared test -- identityProofModel.test.ts`
- G-6: Invalid configurations are rejected for negative/fractional weights, invalid caps, empty versions, non-increasing thresholds, and thresholds above the cap. → evidence: `pnpm --filter @sync/shared test -- identityProofModel.test.ts`
- G-7: Existing shared identity-score and voting-gate tests continue to pass unchanged. → evidence: `pnpm --filter @sync/shared test`
- G-8: The new public exports compile without changing existing consumers. → evidence: `pnpm --filter @sync/shared typecheck`
- G-9: Only the three claimed files differ and the patch contains no whitespace errors. → evidence: `git diff --name-only && git diff --check`

## Protected paths

- `supabase/migrations/` — protected and explicitly excluded; persistence, backfill, voting-access preservation, and rollback require a separately approved migration spec.
- `.github/workflows/` — protected and explicitly excluded; this slice uses existing validation commands.
- `apps/web/src/app/api/payments/` — protected and explicitly excluded; identity modeling must not affect payment behavior.

## Risk & rollback

The primary risk is that a future caller mistakes this shadow calculator for the production authority or passes unverified client assertions. Naming the input fields after their required authority, documenting the module as shadow-only, and leaving all existing scoring and voting exports untouched limits that risk. Provider strings are deduplicated but never returned, reducing accidental identifier exposure.

Rollback is a normal code revert of the new module, its barrel export, and its tests. No persisted score, ballot eligibility, authentication state, order, or external system is changed, so rollback requires no data repair or compensating transaction.