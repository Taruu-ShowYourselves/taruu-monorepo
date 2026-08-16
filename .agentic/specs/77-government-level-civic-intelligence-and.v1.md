# Spec — issue #77 government-intelligence-methodology v1

> **Split:** Issue #77 is not PR-sized. Jurisdiction RBAC, privacy-safe comparisons, referrals, responses, commitments, exports, and representative lifecycle each require separate policy and implementation slices. This spec covers only the first half-day slice: structured methodology and limitation disclosures for the existing national aggregate view.

## Current state

The public national overview already renders aggregate civic statistics at `apps/web/src/app/[locale]/government/page.tsx` through `governmentStats()` in `apps/web/src/server/read/government.ts`.  
Its fixed-shape data originates from the `government_civic_stats()` RPC and must never expose underlying `user_votes.user_id`.  
`GovernmentCivicStatsSchema` in `packages/shared/src/contracts/government.ts` currently contains values and scores but no structured methodology, sample-size, uncertainty, geography, source-limitation, or representativeness metadata.  
`ScoreMeter` and localized government copy provide prose methodology, but the metadata is not contractually coupled to each insight.  
This slice plugs into the public-government read seam and explicit response-projection pattern identified by RESEARCH.md; it does not create authenticated government operations access.

## Goal

Make every score displayed in the existing national civic-index section carry and visibly render a validated disclosure containing its methodology, sample size, uncertainty characterization, geography, source limitations, and an explicit warning that Taruu participation is not statistically representative. The change must preserve existing score calculations and expose no new underlying data.

## In scope

- claim: packages/shared/src/contracts/government.ts
- claim: packages/shared/src/contracts/__tests__/government.test.ts
- claim: apps/web/src/server/read/government.ts
- claim: apps/web/src/components/press/government/ScoreMeter.tsx
- claim: apps/web/src/components/press/government/copy.ts
- claim: apps/web/src/components/press/government/Government.module.css
- claim: apps/web/src/app/[locale]/government/page.tsx
- claim: apps/web/src/__tests__/services/government-methodology.test.ts
- claim: .agentic/evidence/issue-77/government-national-overview.png

## Out of scope

No `/government-admin` route; government organization verification; representative roles or removal; jurisdiction or purpose authorization; municipality comparison; filters; drill-downs; privacy-threshold changes; repeated-query defenses; referrals; official responses; response versioning; commitments; exports; audit history; database or RPC changes; identity evidence; raw ballots; resident profiles; secret ballots; autonomous policy decisions; court filing; external privacy/security review.

Follow-up slices should separately define and implement:

1. Government organization, jurisdiction, purpose, and representative-lifecycle policy.
2. Branded government authorization scope, RBAC, and revocation history.
3. Privacy-thresholded cross-jurisdiction aggregates and comparison UI.
4. Referral, versioned official-response, and commitment workflows.
5. Governed exports, operational audit views, and external privacy/security review.

## Contracts

Add a closed, validated disclosure schema to `packages/shared/src/contracts/government.ts` and attach one disclosure to each displayed national score:

```ts
type GovernmentInsightDisclosure = {
  methodology: string;
  sampleSize: number;
  uncertainty: 'descriptive-only';
  geography: {
    level: 'national';
    countryCode: 'IL';
  };
  sourceLimitations: string[];
  statisticallyRepresentative: false;
};
```

`GovernmentCivicStats` must contain disclosures for exactly these score keys:

```ts
type GovernmentScoreDisclosures = {
  representationScore: GovernmentInsightDisclosure;
  engagementScore: GovernmentInsightDisclosure;
  cooperationScore: GovernmentInsightDisclosure;
  trustScore: GovernmentInsightDisclosure;
  overallScore: GovernmentInsightDisclosure;
};
```

Invariants:

- `statisticallyRepresentative` is the literal `false`, not a caller-selectable boolean.
- `sampleSize` is a non-negative integer derived from existing aggregate counts; no new database columns, tables, queries, or identifiers are introduced.
- Each disclosure uses national Israeli geography only.
- Empty `methodology` and empty `sourceLimitations` arrays fail schema validation.
- Null scores still carry disclosures and display why the score is unmeasured.
- `governmentStats()` constructs disclosures through an explicit projection; raw RPC rows are never spread into the response.
- Existing score formulas, score values, RPC shapes, roster behavior, and matched-vote behavior remain unchanged.
- `ScoreMeter` requires a disclosure prop and visibly renders all disclosure fields.
- Localized labels and the non-representativeness warning are supplied through the existing `GOV_COPY` seam for every supported locale.
- No raw ballot, user identifier, identity-evidence field, or municipality-level value is added to the shared contract or rendered markup.

No DB migration is included in this slice.

## Acceptance gates

- G-1: The shared contract accepts all five complete disclosures and rejects a missing disclosure, negative sample size, empty limitation list, non-national geography, or `statisticallyRepresentative: true`. → evidence: `pnpm --filter @sync/shared test -- government.test.ts`

- G-2: `governmentStats()` returns disclosures for exactly `representationScore`, `engagementScore`, `cooperationScore`, `trustScore`, and `overallScore`, derives their sample sizes from existing aggregate fields, and returns no user identifiers or raw ballot records. → evidence: `pnpm --filter web test -- government-methodology.test.ts`

- G-3: Every `ScoreMeter` invocation on the national government page supplies its corresponding disclosure; TypeScript rejects omission because the prop is required. → evidence: `pnpm typecheck`

- G-4: The rendered national overview visibly shows methodology, numeric sample size, descriptive-only uncertainty, national geography, at least one source limitation, and the non-representativeness warning for every civic-index meter. → evidence: `.agentic/evidence/issue-77/government-national-overview.png`

- G-5: The slice introduces no database migration, privileged government route, payments API change, or workflow change. → evidence: `git diff --name-only --diff-filter=ACMRT origin/main...HEAD`

- G-6: Existing government behavior and repository-wide static checks remain green. → evidence: `pnpm test && pnpm typecheck && pnpm lint`

## Protected paths

None.

Explicitly protected and excluded:

- `supabase/migrations/` — no schema or RPC change is required for this disclosure-only slice.
- `.github/workflows/` — no CI workflow change is required.
- `apps/web/src/app/api/payments/` — payments are unrelated to this slice.

## Risk & rollback

The principal risk is presenting a disclosure whose sample-size mapping does not match the existing score denominator, creating false confidence despite the warning. Contract tests must lock each score to its existing aggregate denominator, and the UI must label uncertainty as descriptive-only.

Rollback is a normal revert of this PR: remove the disclosure contract, projection, and rendering while leaving the existing RPC, database, scores, public roster, and matched-vote views untouched. If the disclosures render incorrectly after deployment, revert the slice; no data migration or destructive cleanup is required.