# Research — issue #106

## Already-done check

1. **MISSING** — OAuth grants Google 40 points, not a configurable 20-point Member badge, and no award/explanation record exists. Evidence: `packages/shared/src/utils/identityScore.ts`, `supabase/migrations/20260807000001_identity_score_unification.sql`, `apps/web/src/app/api/social/proofs/route.ts`.
2. **MISSING** — Phone verification contributes 10 points through custom SMS verification, not authenticated-session AAL/MFA assurance. Approved ID contributes 40, but the operator approval flow that would authorize it is absent. Evidence: `packages/shared/src/utils/identityScore.ts`, `apps/web/src/app/api/user/phone/verify/route.ts`, `apps/web/src/server/app/identity/submit-document.ts`.
3. **MISSING** — Database uniqueness prevents duplicate points per social provider, but the configurable proof model and explicit link/unlink/relink acceptance coverage are absent. Evidence: `supabase/migrations/20240101000000_initial_schema.sql`, `supabase/migrations/20260807000001_identity_score_unification.sql`, `supabase/tests/identity_score_triggers.sql`.
4. **MISSING** — The existing migration protects the current 40-point voting floor during its backfill, but there is no migration or tested mapping to the proposed 20/20/40 model. Evidence: `supabase/migrations/20260807000001_identity_score_unification.sql`, `apps/web/src/__tests__/characterization/identity-score-unification.test.ts`.
5. **MISSING** — Identity score/tier exists; engagement level, achievements, and credits do not. Evidence: `packages/shared/src/types/user.ts`, `apps/mobile/app/(tabs)/profile.tsx`, `apps/web/src/app/[locale]/settings/social-connections/page.tsx`.
6. **MISSING** — Ballot insertion is idempotent, but no engagement event, credit transaction, balance change, or reward notification is created. Evidence: `apps/web/src/app/api/votes/[id]/participate/route.ts`, `apps/web/src/lib/supabase/db.ts`.
7. **MISSING** — No voting reward exists. Ballots retain `option_id`, so a future reward seam must consume participation identity without copying the choice. Evidence: `supabase/migrations/20240101000000_initial_schema.sql`, `apps/web/src/app/api/votes/[id]/participate/route.ts`.
8. **MISSING** — Vote requests are rate-limited, but reward caps, campaign caps, and cooldowns do not exist. Evidence: `apps/web/src/app/api/votes/[id]/participate/route.ts`, `apps/web/src/lib/rate-limit.ts`.
9. **MISSING** — No XP/credit ledger, auditable reversal, or non-negative credit-balance invariant exists.
10. **MISSING** — Neither web nor mobile exposes credit balance or transaction history. Mobile instead presents legacy TARO token copy. Evidence: `apps/mobile/app/(tabs)/profile.tsx`, `apps/web/src/app/api/user/tokens/transactions/route.ts`.
11. **MISSING** — Merchandise checkout has an idempotent `pending → paid` transition, but no credit reservation, redemption, release, or restoration lifecycle. Evidence: `apps/web/src/app/api/merch/checkout/route.ts`, `apps/web/src/app/api/merch/webhook/route.ts`, `apps/web/src/lib/supabase/db.ts`.
12. **MISSING** — The server validates catalog prices, quantities, and stock but has no credit eligibility or stacking rules. Most API errors are English-only. Evidence: `apps/web/src/app/api/merch/checkout/route.ts`, `apps/web/src/lib/merch/catalog.ts`.
13. **MISSING** — Hebrew/English infrastructure exists, but relevant identity screens contain hard-coded Hebrew and no gamification accessibility coverage exists. Evidence: `apps/web/src/lib/i18n/config.ts`, `apps/web/src/lib/i18n/dictionaries.ts`, `apps/web/src/app/[locale]/settings/social-connections/page.tsx`, `apps/mobile/app/(tabs)/profile.tsx`.
14. **MISSING** — No independent identity-badge, engagement-reward, and redemption flags exist. The nearest switch pattern is the payment environment switch. Evidence: `apps/web/src/server/infra/payments/creation-fee.ts`.
15. **MISSING** — No issuance, duplicate-rejection, reversal, redemption, or gamification-abuse dashboards/alerts exist.

**Verdict: proceed.** None of the acceptance criteria is fully satisfied. The tree supplies useful identity, ballot-idempotency, notification, audit, and merchandise foundations, but not the requested gamification system.

## Current-state map

### Identity model

- `packages/shared/src/utils/identityScore.ts` mirrors scoring for clients: Google 40, GPS 20, phone 10, approved identity document 40, Facebook 10, Instagram 10; maximum 140.
- `supabase/migrations/20260807000001_identity_score_unification.sql` is the canonical writer. `calculate_identity_score(users)` derives `users.identity_score`, with triggers covering proof and evidence mutations.
- `packages/shared/src/types/user.ts` and `packages/shared/src/contracts/social.ts` expose the six-part breakdown and `basic | verified | trusted` bands.
- `apps/web/src/app/api/social/proofs/route.ts` reads the stored score and constructs the displayed breakdown.
- `apps/web/src/services/user/profile.ts` maps database identity state into the profile/session shape.
- Existing status surfaces are `apps/web/src/app/[locale]/settings/social-connections/page.tsx`, `apps/mobile/app/(tabs)/profile.tsx`, and `apps/mobile/app/settings/social-connections.tsx`.

### Proof authority

- `social_proofs` has `UNIQUE(user_id, provider)`. Triggers recompute on insert, update, delete, and movement between users.
- Phone authority is `users.phone_verified`, written by custom SMS verification. It is not Supabase AAL/MFA.
- Identity scanning sends extracted fields only; images remain on-device and the ID number is stored as a keyed HMAC plus its last two digits. Evidence: `packages/shared/src/contracts/identityDocument.ts`, `apps/web/src/server/app/identity/submit-document.ts`, `supabase/migrations/20260728000004_identity_documents.sql`.
- Client OCR/face signals only queue review. The missing “PR-10” operator workflow is intended to control `users.identity_verified_at`.

### Voting/engagement source

- `apps/web/src/app/api/votes/[id]/participate/route.ts` is the ballot chokepoint. It authenticates, rate-limits, applies pilot and identity/residency gates, then invokes `recordUserVoteOnce`.
- `apps/web/src/lib/supabase/db.ts::recordUserVoteOnce` relies on `UNIQUE(user_id, vote_id)` and reports whether a ballot was newly created.
- Rewards must branch only from `created: true` and use a deterministic participation key without copying `option_id`.
- No reward/achievement domain module, contract, table, repository, route, or notification producer exists.

### Store

- Store contracts: `packages/shared/src/types/merch.ts`.
- ILS constants: `packages/shared/src/constants/index.ts`.
- Server-owned product/price seam: `apps/web/src/lib/merch/catalog.ts::resolveVariant`.
- Checkout: `apps/web/src/app/api/merch/checkout/route.ts`.
- Persistence helpers: `apps/web/src/lib/supabase/db.ts::{createMerchOrder,getMerchOrderById,updateMerchOrder,markMerchOrderPaid}`.
- Replay-safe payment transition: `apps/web/src/app/api/merch/webhook/route.ts`.
- Web UI: `apps/web/src/app/[locale]/store/`. No mobile merchandise-store surface was found.

### Notifications, audit, localization

- Persistent notifications use `user_notifications`; insertion lives in `apps/web/src/server/infra/supabase/space-notify.repo.ts`, backed by `supabase/migrations/20260802000014_space_notifications.sql`.
- Push delivery lives under `apps/web/src/services/notifications/`.
- The closest least-privilege audit architecture is the space-admin stack across `packages/shared/src/contracts/spaceAdmin.ts`, `apps/web/src/server/app/space-admin/`, `apps/web/src/server/infra/supabase/space-audit.repo.ts`, and `apps/web/src/app/[locale]/space-admin/`.
- Web translations use `apps/web/src/lib/i18n/dictionaries/he.json` and `en.json`; direction is defined in `apps/web/src/lib/i18n/config.ts`.
- Web uses colocated CSS Modules. Relevant mobile surfaces use NativeWind and hard-coded Hebrew.

## Integration points

- **Scoring:** Version or replace `calculate_identity_score(users)` and its triggers in a migration; keep `packages/shared/src/utils/identityScore.ts` synchronized as a display mirror.
- **Proof idempotency:** Preserve `social_proofs` uniqueness and trigger recomputation. A distinct proof representation is needed if primary authentication must differ from additionally linked providers.
- **Auth:** Existing route authentication is `apps/web/src/services/auth/session.ts::getSessionFromRequest`. No current code reads Supabase AAL or MFA factors.
- **Profile/session:** Extend `apps/web/src/services/user/profile.ts`, `packages/shared/src/contracts/auth.ts`, web auth context/store, and mobile auth store after persistence contracts are defined.
- **Vote reward:** The exact hook is the `created: true` branch following `recordUserVoteOnce` in `apps/web/src/app/api/votes/[id]/participate/route.ts`.
- **Architecture:** Newer modules use pure domain logic in `apps/web/src/server/domain/`, Result-returning use cases in `apps/web/src/server/app/`, and `ResultAsync` repositories in `apps/web/src/server/infra/supabase/`.
- **Atomic ledger operations:** Deduplication, caps, issuance, achievements, notification/outbox creation, reservation, and reversal require a transactional database function/RPC. Separate Supabase client calls are insufficient.
- **Store:** Extend catalog resolution and checkout before hosted payment creation. Reservation IDs belong on `merch_orders` or a dedicated reservation table.
- **Refund/cancellation:** Current order statuses include `cancelled` and `failed`, but no complete cancellation/refund transition policy exists.
- **Admin:** The space-admin pattern is reusable, but scope must first be decided: platform-wide versus space-scoped.
- **Generated database types:** Schema changes require coordinated edits to `apps/web/src/lib/supabase/types.ts`.
- **Migration numbering:** Latest repository migration is `20260811000004_pilot_program.sql`; a new migration must sort after it and use a unique timestamp.
- **Migration application:** `20260807000001_identity_score_unification.sql` records production-ledger drift and requires applying named migrations individually with before/after verification.
- **Feature flags:** Nearest pattern is the environment-driven switch in `apps/web/src/server/infra/payments/creation-fee.ts`; no generalized flag service exists.

## Prior art

Nearest merged PR: **#110**, commit `bc7defe`, `fix(identity): unify DB-owned identity scoring for Issue #71`.

Reuse its:

- Database-owned derivation with an application display mirror.
- Triggers for every proof/evidence mutation.
- Characterization tests guarding migration contents and prohibiting application writers.
- Atomic backfill with a hard stop against reduced voting eligibility.
- Explicit rollback SQL and deployment order.
- Coordinated shared-contract, profile, web, mobile, and test changes.
- Scratch-database trigger probe in `supabase/tests/identity_score_triggers.sql`.

For redemption concurrency, the nearest guarded-transition precedent is `apps/web/src/lib/supabase/db.ts::markMerchOrderPaid` plus `apps/web/src/app/api/merch/webhook/route.ts`; multi-table credit operations still need one database transaction/RPC.

## Constraint register

- `supabase/migrations/` is protected under `docs/PR-AUTOPILOT.md`; approval must explicitly name every proposed migration file.
- Production has intentionally unapplied repository migrations. The precise unapplied set is not recorded in this tree.
- Voting currently requires `identity_score >= 40` and separately verified residency through `packages/shared/src/utils/identityScore.ts::votingGate` and `apps/web/src/services/verification/eligibility.ts`.
- `calculate_identity_score(users)` depends on the `users` row type. Dropping referenced `users` columns requires dropping or redefining the function in the same migration.
- The authoritative ID approval/revocation workflow does not exist; current submissions cannot grant document points.
- There is no Supabase AAL/factor inspection. Existing phone OTP is a separate custom system.
- `supabase/tests/identity_score_triggers.sql` is a manual scratch-database probe and is not part of `pnpm test`.
- `SECURITY-AUDIT.md` has relevant open findings around Google OAuth state/PKCE, phone-verification abuse controls, merchandise webhook-secret transport, and inconsistent RLS identity helpers.
- Merchandise lacks an abandoned-checkout release worker, complete refund/cancellation restoration path, inventory reservation, credit stacking policy, and mobile store.
- Existing identity pages bypass dictionaries, so localization requires refactoring rather than dictionary additions alone.
- Mobile currently claims each vote earns three TARO tokens redeemable for benefits. This conflicts conceptually with the proposed non-monetary credit system.
- The working tree already contains an untracked `.agentic/specs/` directory; no files were changed during this read-only pass.
- Before implementation, `AGENTS.md` requires current Context7 documentation for Supabase AAL, linked identities, and transactional/RPC behavior.

## Open questions

1. Does “phone/2FA +20” mean custom SMS verification, Supabase Auth AAL2, or two separately configured proofs?
2. Which providers qualify as primary authentication, and may a non-Google provider earn the baseline?
3. Should GPS remain an identity proof, remain only a residency gate, or become grandfathered access metadata?
4. What persisted field or eligibility rule protects users whose visible score falls from Google 40 to OAuth 20?
5. Should all users be recalculated under the new version, or should historical proof-model versions remain auditable?
6. Who may approve and revoke ID verification while the planned operator workflow is absent?
7. What exactly constitutes a campaign period, completed vote, approved proposal, and moderation-accepted report?
8. What launch rule versions, thresholds, caps, cooldowns, and XP level bands are approved?
9. Are credits permanent at launch? If expiring, what spending-order rule applies?
10. What are the approved stacking, geography, minimum-order, tax, inventory, abandonment, cancellation, and refund rules?
11. Must mobile support store discovery/redemption, or only core status and balance?
12. Should achievement notifications use the persistent inbox, push, immediate response payloads, or all three?
13. Is gamification administration platform-wide or scoped through spaces/capabilities?
14. Are rollout switches environment-based, database-configured, or layered?
15. Which repository migrations are currently unapplied in production?
16. Should legacy TARO reward copy/APIs be removed, relabeled, or retained beside credits?