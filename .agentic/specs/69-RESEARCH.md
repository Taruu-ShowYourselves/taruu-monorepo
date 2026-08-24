# Research — issue #69

## Already-done check

- Research brief or confirmed ₪50 payment required before submission: **MISSING.** `POST /api/votes` accepts title, description, options, and dates only; submission is explicitly free and immediately creates an `in_review` vote. Evidence: `packages/shared/src/contracts/vote.ts`, `apps/web/src/app/api/votes/route.ts`, `apps/web/src/server/app/votes/create-vote.ts`.
- Duplicate callbacks or retries do not duplicate charges, submissions, documents, or publication: **MISSING overall.**
  - Payment webhook replay protection: **DONE** through `webhook_events.event_id`, payload hashing, and atomic pending→completed claiming. Evidence: `apps/web/src/app/api/payments/webhook/route.ts`, `supabase/migrations/20250115000002_webhook_events.sql`.
  - Approval/payment-obligation retry protection: **DONE** through deterministic payment keys, `payments.idempotency_key UNIQUE`, conditional vote transition, and one-approval audit index. Evidence: `apps/web/src/server/infra/payments/creation-fee.ts`, `apps/web/src/server/infra/supabase/space-decision.repo.ts`, `supabase/migrations/20260802000010_space_governance.sql`.
  - Submission idempotency: **MISSING.** Each `POST /api/votes` inserts a new vote; vote and option inserts are separate operations without a transaction or request key. Evidence: `apps/web/src/server/app/votes/create-vote.ts`, `apps/web/src/server/infra/supabase/vote.repo.ts`.
  - Research documents/attachments: **MISSING**, so document deduplication is absent.
- Voting participation remains free with no payment gate: **DONE.** Participation accepts only `optionId`, persists through `recordUserVoteOnce`, and relies on `UNIQUE(user_id, vote_id)` for retry safety. Evidence: `apps/web/src/app/api/votes/[id]/participate/route.ts`, `packages/shared/src/contracts/vote.ts`, `packages/api-client/src/votes.ts`, `apps/mobile/app/vote/[id].tsx`.
- Authorized platform or space admin approval before publication: **DONE for space admins.** User-created votes enter `in_review`; only holders of `proposal.approve` can move them to public `pending` or `active`, with self-review prohibited. Evidence: `apps/web/src/server/app/votes/create-vote.ts`, `apps/web/src/server/app/space-admin/authorize.ts`, `apps/web/src/server/app/space-admin/decide-proposal.ts`, `apps/web/src/server/domain/space/review.ts`.

**Verdict: proceed.** The core research packet, draft workflow, paid-before-submission boundary, and real payment capture are absent.

## Current-state map

- Web creation UI: `apps/web/src/app/[locale]/votes/create/page.tsx`
  - Four-step client-only wizard: subject, options, duration, submission.
  - No draft persistence, research brief, citations, attachments, checkout, payment-return step, or retry key.
  - Posts directly to `/api/votes`, then displays `in_review`.
- Mobile creation UI: `apps/mobile/app/(tabs)/create.tsx`
  - Three-step form that still routes to `/payment/checkout`.
  - No research packet or durable draft.
  - This conflicts with the current web/server approval-time fee model.
- Vote submission API and use case:
  - `apps/web/src/app/api/votes/route.ts`
  - `apps/web/src/server/app/votes/create-vote.ts`
  - `packages/shared/src/contracts/vote.ts`
  - Requires an authenticated, fully verified resident; derives municipality from the profile; writes the vote as `in_review`.
  - The description field is ordinary proposal prose, not identified or validated as a research brief.
- Persistence:
  - `apps/web/src/server/infra/supabase/vote.repo.ts`
  - `supabase/migrations/20240101000000_initial_schema.sql`
  - `votes` has no research-packet, submission-key, payment-state, receipt, approval, or publication timestamp columns.
  - No proposal packet/document/attachment tables or relevant Supabase Storage policies exist.
- Review and publication:
  - `apps/web/src/server/domain/space/review.ts`
  - `apps/web/src/server/app/space-admin/decide-proposal.ts`
  - `apps/web/src/server/infra/supabase/space-decision.repo.ts`
  - `apps/web/src/app/[locale]/space-admin/[spaceId]/proposals/ProposalsClient.tsx`
  - Decisions are `approve`, `reject`, and `request_changes`.
  - Only `in_review` is decidable. Approval immediately changes the vote to public `active` or scheduled `pending`.
  - There is no creator resubmission path from `changes_requested`.
- Status model:
  - `packages/shared/src/contracts/vote.ts`
  - `packages/shared/src/types/vote.ts`
  - `supabase/migrations/20260802000011_vote_status_review_values.sql`
  - Existing labels are `draft`, `in_review`, `changes_requested`, `rejected`, `pending`, `active`, `ended`, `resolving`, `resolved`, and `failed`.
  - There are no distinct `payment_pending`, `paid`, `submitted`, `approved`, or `published` values. Current semantics collapse submitted into `in_review`, approved/scheduled into `pending`, and approved/published into `active`.
- Payment infrastructure:
  - `apps/web/src/app/api/payments/create/route.ts`
  - `apps/web/src/app/api/payments/webhook/route.ts`
  - `apps/web/src/services/payments/greenInvoice.ts`
  - `apps/web/src/services/greenInvoice/index.ts`
  - `apps/web/src/server/infra/supabase/payment.repo.ts`
  - Hosted Green Invoice creation-payment checkout, webhook authentication, receipts, payment states, and refund endpoint infrastructure exist.
  - The generic payment API still admits the legacy `vote_participation` type despite participation being free.
- Approval-time creation fee:
  - `apps/web/src/server/app/space-admin/ports/creation-fee.ts`
  - `apps/web/src/server/infra/payments/creation-fee.ts`
  - Approval currently creates only a pending ₪50 obligation. `CREATION_FEE_IMPLEMENTATION_CAPTURES` is `false`; no provider call, charge, or receipt occurs.
- Public visibility:
  - `apps/web/src/server/domain/votes/vote.ts`
  - `apps/web/src/server/app/votes/list-votes.ts`
  - Review states are excluded through an explicit public allow-list. `pending` is public because it means approved and scheduled.

## Integration points

- Creation contract seam: `CreateVoteRequestSchema` in `packages/shared/src/contracts/vote.ts`; mirrored through `packages/api-client/src/votes.ts`.
- Creation orchestration seam: `createVote()` and `CreateVoteCommand` in `apps/web/src/server/app/votes/create-vote.ts`.
- Vote repository seam: `insertVote()` and `insertVoteOptions()` in `apps/web/src/server/infra/supabase/vote.repo.ts`.
- Payment port: `CreationFeePort.charge()` in `apps/web/src/server/app/space-admin/ports/creation-fee.ts`.
- Current fee adapter: `createCreationFeePort()` in `apps/web/src/server/infra/payments/creation-fee.ts`.
- Morning token-charge helper: `chargeToken()` in `apps/web/src/services/greenInvoice/index.ts`.
- Hosted checkout helper: `paymentService.createVoteCreationPayment()` in `apps/web/src/services/payments/greenInvoice.ts`.
- Payment repository helpers: `assertPaymentUsable()` in `apps/web/src/server/infra/supabase/payment.repo.ts`; legacy DB helpers including `getPaymentByIdempotencyKey()` and `markPaymentCompleted()` live in `apps/web/src/lib/supabase/db.ts`.
- Webhook security/idempotency: shared-secret verification, event identity, payload hash, event ledger, and atomic payment claim in `apps/web/src/app/api/payments/webhook/route.ts`.
- Review transition seam: pure rules in `apps/web/src/server/domain/space/review.ts`; orchestration in `apps/web/src/server/app/space-admin/decide-proposal.ts`.
- Authorization seam: branded `SpaceScope` minted only by `authorize()` after resolving an active capability grant in `apps/web/src/server/app/space-admin/authorize.ts`.
- Scoped decision repository: `findProposalInScope()` and conditional `transitionProposal()` in `apps/web/src/server/infra/supabase/space-decision.repo.ts`.
- Audit seam: `insertAuditRow()` in `apps/web/src/server/infra/supabase/space-audit.repo.ts`; audit storage is append-only.
- Database backstops:
  - `payments.idempotency_key UNIQUE`: `supabase/migrations/20240101000000_initial_schema.sql`.
  - `webhook_events.event_id UNIQUE`: `supabase/migrations/20250115000002_webhook_events.sql`.
  - One approval audit per vote: `uq_space_proposal_single_approval` in `supabase/migrations/20260802000010_space_governance.sql`.
  - One public live topic: `supabase/migrations/20260806000003_votes_live_topic_unique.sql`.
- Migration numbering: the latest repository migration is `20260811000004_pilot_program.sql`. New migrations need a later unique timestamp; enum additions must be isolated from migrations that use their new values, following `20260802000011` then `20260802000012`.
- Generated schema types: `apps/web/src/lib/supabase/types.ts` is generated and should be regenerated after schema changes.
- Feature switches:
  - Payment capture: `NEXT_PUBLIC_PAYMENTS_ENABLED`, enforced by `apps/web/src/server/infra/payments/creation-fee.ts`.
  - Space administration: enforced by `apps/web/src/lib/features/space-admin.ts` through `authorize()`.

## Prior art

Nearest merged PR: **#93, commit `9d6bc53` — “space governance substrate and administrator operations dashboard.”**

Copy its structure for:

- thin API route → application use case → pure domain transition rules → scoped repository;
- branded `SpaceScope` authorization instead of raw caller-provided scope;
- conditional updates for concurrency;
- immutable audit events;
- paired enum/schema migrations;
- contract-first shared types;
- unit, API, and Playwright coverage plus visual evidence.

For payment-specific hardening, also follow:

- **#104, commit `e91834e`** for the payment kill switch;
- commit `e98cf45` for webhook/payment binding and idempotent checkout reuse;
- `supabase/migrations/20250115000002_webhook_events.sql` and `apps/web/src/app/api/payments/webhook/route.ts` for replay controls.

## Constraint register

- Production migration ledger drift is explicitly documented: several repository migrations are intentionally unapplied. Migrations must be applied individually and the ledger verified before and after; never apply all pending migrations. Evidence: `supabase/migrations/20260807000001_identity_score_unification.sql`. The working tree cannot identify the exact unapplied production set without production access.
- Payment capture is an open finding named **PAY-06**. Approval presently records an obligation only. Evidence: `apps/web/src/server/app/space-admin/ports/creation-fee.ts`, `apps/web/src/server/infra/payments/creation-fee.ts`.
- PAY-06 must reconcile a captured charge if the subsequent conditional publication loses a race or a concurrent rejection wins. This is already documented in `apps/web/src/server/app/space-admin/decide-proposal.ts`.
- Payment and vote creation are not transactional. A provider checkout can be created after a payment row is persisted, and vote option insertion can fail after the vote row exists.
- Webhook fulfillment has non-fatal downstream operations, including treasury accrual and receipt email, which require reconciliation after partial failure. Evidence: `apps/web/src/app/api/payments/webhook/route.ts`.
- The webhook uses a shared secret rather than a provider HMAC signature because the hosted-form integration exposes a notify URL. It fails closed in production. Evidence: `apps/web/src/services/payments/greenInvoice.ts`, `apps/web/src/app/api/payments/webhook/route.ts`.
- No attachment upload, sanitization, malware scanning, citation preservation, storage bucket, or attachment access-control policy exists in the claimed area.
- `space_audit_log` is structurally protected: update/delete/truncate are rejected and foreign keys use restrictive deletion. Any workflow additions must append events rather than mutate history. Evidence: `supabase/migrations/20260802000010_space_governance.sql`.
- `apps/web/src/lib/supabase/types.ts` is generated and should not be hand-maintained independently of migrations.
- No repository `CODEOWNERS` or additional protected-path declaration was found.
- Existing Green Invoice legal and production decisions remain unresolved in `apps/web/docs/GI-LEGAL-CHECKLIST.md` and `apps/web/docs/GI-PRIME-CHECKLIST.md`.
- The current web flow says submission is free and approval creates the fee, while mobile still opens creation checkout. The products are already behaviorally inconsistent.
- No files were changed; this research seat is read-only.

## Open questions

1. Does issue #69 supersede the merged issue #75 decision to charge only at approval, or should “confirmed payment before submission” be revised to approval-time capture?
2. Is the mandatory research brief structured text, an uploaded document, or either? What formats and size limits are allowed?
3. Which optional packet elements require first-class structured fields, and which may be generic attachments?
4. Must citations be normalized into individual source records, or is preserving citation text and URLs sufficient?
5. Which malware/content-scanning provider and quarantine policy are approved for attachments?
6. Should draft, payment, review, and publication be one enum, or separate orthogonal state machines? The existing `vote_status` model cannot represent all requested distinctions cleanly.
7. Can a creator edit and resubmit after `changes_requested`, and does the prior payment remain valid?
8. Does an expired, failed, cancelled, or delayed checkout retain the same draft and idempotency key, and for how long?
9. Should payment occur before the first `submitted` transition or only after an admin has indicated provisional approval?
10. What authority should platform administrators use? `users.is_platform_admin` explicitly grants no general space capability today.
11. Must approval and publication be separate human/system actions, or may approval continue to publish immediately as the current implementation does?
12. What configurable refund actions and permitted transitions should exist for paid-but-rejected or paid-but-unpublished submissions?
13. Is mobile included in this issue’s delivery scope, given its current flow differs from web?
14. Which exact production migrations are unapplied, and is the required schema baseline available in every deployment environment?