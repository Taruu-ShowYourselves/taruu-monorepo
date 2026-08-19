# Spec — issue #113 public-agenda-taxonomy v1

## Current state

Approved user proposals become ordinary `votes`; no public-agenda entity, provenance join, or taxonomy exists (`apps/web/src/server/app/space-admin/decide-proposal.ts`, `supabase/migrations/20260802000010_space_governance.sql`). Shared wire contracts belong in `packages/shared/src/contracts/` and are re-exported through `packages/shared/src/contracts/index.ts`. Existing authority and Knesset taxonomies are unrelated and must not be reused (`supabase/migrations/20260810000002_authorities_network.sql`, `apps/web/src/services/knesset/odata.ts`). The eventual workflow must follow thin route → use case → pure domain decision → scoped repository, but national authorization and audit persistence remain unresolved. The whole issue is too large for one half-day PR, so this slice establishes only the versioned taxonomy contract required by later persistence, review, and publication slices.

## Goal

Introduce a stable, versioned shared taxonomy and category-assignment contract for Taruu-originated public-agenda items. The contract will establish one primary category, an explicit fallback for ambiguous topics, and reviewable human overrides with mandatory reasons. It will not classify proposals, persist assignments, expose a new API, or publish agenda items.

## In scope

- claim: packages/shared/src/contracts/publicAgenda.ts
- claim: packages/shared/src/contracts/index.ts
- claim: packages/shared/src/contracts/__tests__/publicAgenda.test.ts
- claim: docs/PUBLIC-AGENDA-TAXONOMY.md

## Out of scope

This issue must be split. This PR does not add or change database schema, migrations, generated Supabase types, proposal eligibility, semantic deduplication, participant aggregation, threshold evaluation, national authorization, capabilities, audit storage, lifecycle transitions, review UI, public UI, API routes, or Knesset integrations.

Subsequent separately approved slices should cover:

1. National administrative scope and distinct agenda capabilities.
2. Agenda, taxonomy-assignment, equivalence-group, provenance, and audit persistence.
3. Candidate eligibility, distinct-participant aggregation, and privacy-preserving threshold evaluation.
4. Scoped review and publication transitions with authorization and denial tests.
5. Public categorized agenda API and UI, separated from official Knesset day-order content.
6. Referral, acknowledgement, closure, and rejection lifecycle handling after issue #77 boundaries are settled.

Proposal submission/payment, external topic discovery, government dashboards or official responses, lobbying, and campaigns remain excluded as assigned to the related issues.

## Contracts

Add `publicAgenda.ts`, exported from the shared contracts barrel, with these public definitions:

- `PUBLIC_AGENDA_TAXONOMY_VERSION = 1`.
- `PublicAgendaCategoryIdSchema`, a closed enum containing:
  - `economy_and_employment`
  - `education`
  - `health`
  - `housing_and_planning`
  - `welfare_and_social_services`
  - `environment_and_climate`
  - `transport_and_infrastructure`
  - `public_safety`
  - `justice_and_governance`
  - `foreign_affairs_and_security`
  - `civil_rights_and_equality`
  - `religion_and_state`
  - `other`
- `PUBLIC_AGENDA_TAXONOMY_V1`, an immutable ordered fixture whose entries each contain a stable ID plus Hebrew and English labels.
- `PublicAgendaCategoryAssignmentSchema`:
  - `taxonomyVersion`: literal `1`
  - `primaryCategoryId`: a valid v1 category ID
  - `assignmentKind`: `initial | human_override`
  - `assignedBy`: UUID
  - `assignedAt`: ISO datetime
  - `reason`: trimmed string of 10–500 characters when `assignmentKind` is `human_override`; omitted for `initial`
- Inferred TypeScript types for category IDs and assignments.

Invariants:

- Every v1 category ID appears exactly once in the v1 fixture.
- IDs are stable machine identifiers; labels may be revised only by creating a later taxonomy version.
- An item has exactly one primary category in this slice.
- A genuinely ambiguous or evenly multi-category topic uses `other`; implementers must not infer multiple primary categories.
- A human may replace an initial assignment, but the replacement must be represented as `human_override` with actor, timestamp, and reason.
- The schema contains no proposal title, ballot choice, participant identifier, political inference, lifecycle status, or claim of official Knesset adoption.
- This contract is not itself a public API response. Later public DTOs must allow-list fields and must not expose `assignedBy`.
- No existing vote, proposal, authority, or official `knesset_items` contract changes semantics.

`docs/PUBLIC-AGENDA-TAXONOMY.md` must document the v1 IDs and bilingual labels, the one-primary-category rule, the `other` fallback, examples for ambiguous and multi-category topics, the reasoned override rule, and the rule that taxonomy changes require a new numeric version rather than repurposing an ID.

No database migration is part of this slice.

## Acceptance gates

- G-1: The v1 fixture contains exactly the 13 specified IDs, without duplicates, and every entry has non-empty Hebrew and English labels. → evidence: `pnpm --filter @taruu/shared test -- publicAgenda.test.ts`
- G-2: Assignment validation accepts a valid initial assignment and rejects unknown taxonomy versions, unknown category IDs, invalid UUIDs, and invalid timestamps. → evidence: `pnpm --filter @taruu/shared test -- publicAgenda.test.ts`
- G-3: A human override is rejected when its reason is missing, blank, shorter than 10 characters, or longer than 500 characters; a valid reason is trimmed and accepted. → evidence: `pnpm --filter @taruu/shared test -- publicAgenda.test.ts`
- G-4: An initial assignment is rejected when an override reason is supplied, preventing ambiguous audit semantics. → evidence: `pnpm --filter @taruu/shared test -- publicAgenda.test.ts`
- G-5: The contract and inferred types are importable from `packages/shared/src/contracts/index.ts` and the shared package typechecks. → evidence: `pnpm --filter @taruu/shared typecheck`
- G-6: The taxonomy document contains all 13 stable IDs and explicitly documents `version 1`, one primary category, the `other` fallback, and mandatory reasoned human overrides. → evidence: `rg -n "version 1|one primary|other|human override|reason" docs/PUBLIC-AGENDA-TAXONOMY.md && for id in economy_and_employment education health housing_and_planning welfare_and_social_services environment_and_climate transport_and_infrastructure public_safety justice_and_governance foreign_affairs_and_security civil_rights_and_equality religion_and_state other; do rg -q "$id" docs/PUBLIC-AGENDA-TAXONOMY.md || exit 1; done`
- G-7: The complete shared-package regression suite passes. → evidence: `pnpm --filter @taruu/shared test`

## Protected paths

- `supabase/migrations/` — protected; no files may be added or modified in this slice. Persistence requires a later spec after national scope, eligibility, audit, and historical-approval decisions are approved.
- `.github/workflows/` — protected; no files may be added or modified.
- `apps/web/src/app/api/payments/` — protected; no files may be added or modified because submission payment belongs to issue #69.

## Risk & rollback

The principal risk is freezing category identifiers before product review. Human approval of this spec explicitly approves the 13 v1 identifiers, one-primary-category model, and `other` fallback. Because this slice has no persistence or consumers, rollback is limited to reverting the four claimed files. If a later taxonomy is required after v1 is consumed, retain v1 identifiers and introduce v2 rather than renaming or reinterpreting them.