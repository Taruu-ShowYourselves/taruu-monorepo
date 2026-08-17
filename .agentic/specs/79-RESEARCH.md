# Research — issue #79

## Already-done check

- Successful ₪50 monthly payment without approval does not grant manager access: **MISSING.** Manager subscriptions and manager-payment types do not exist. Current payment contracts only support `vote_participation` and `vote_creation` (`packages/shared/src/contracts/payment.ts`, `packages/shared/src/types/payment.ts`).
- Approved applicant receives scoped access only after confirmed billing activation: **MISSING.** `billingRequirementSatisfied()` currently returns `true` unconditionally, so an active manager grant would authorize without billing (`apps/web/src/server/app/authz/require-role.ts`). The pure policy supports `billing_inactive`, but production does not supply real billing state (`apps/web/src/server/domain/authz/policy.ts`).
- Duplicate renewals do not duplicate invoices, charges, or role transitions: **MISSING.** No renewal model or handler exists. Generic webhook replay protection exists but is specific to one-time payments (`apps/web/src/app/api/payments/webhook/route.ts`, `supabase/migrations/20250115000002_webhook_events.sql`).
- Cancellation and failed-payment policy predictably affect access and notify users: **MISSING.** No subscription state machine, grace policy, cancellation endpoint, renewal scheduler, or manager-billing notifications exist.

**Verdict: proceed.** The tree contains part of the approval/RBAC foundation, but none of the monthly-billing lifecycle. It does not satisfy the issue.

## Current-state map

- Role schema:
  - `role_grants` models `super_admin`, `space_admin`, and space-scoped `community_manager`.
  - Grant lifecycle is only `active | suspended | revoked`.
  - `community_manager_applications` models `submitted | approved | rejected | withdrawn`.
  - `role_grant_events` is append-only and records review/grant actions.
  - Evidence: `supabase/migrations/20260802000002_role_grants_and_applications.sql`.

- Shared role contracts already describe application submission, review, and grant actions:
  - `packages/shared/src/contracts/role.ts`.

- Role repository already exposes:
  - `findLiveGrant`, `listActiveGrants`, `insertGrant`, guarded `setGrantStatus`.
  - Application insert, lookup, queue listing, and guarded decision.
  - Append-only audit insertion/read.
  - Evidence: `apps/web/src/server/infra/supabase/role.repo.ts`.

- The application/review HTTP and UI surfaces are not present:
  - No `/api/manager-applications`.
  - No `/api/admin/manager-applications`.
  - No `/api/admin/role-grants/[id]`.
  - No `/[locale]/settings/community-manager`.
  - No `/[locale]/admin/manager-applications`.
  - The contracts and repository therefore currently have no complete user-facing workflow.

- Authorization is deliberately prepared for billing:
  - `evaluateAuthorization()` requires both a usable grant and `billingActive`.
  - `requireRole()` is the single role seam, but its billing adapter is still a hard-coded `okAsync(true)`.
  - Evidence: `apps/web/src/server/domain/authz/policy.ts`, `apps/web/src/server/app/authz/require-role.ts`.

- A separate space-governance capability system also exists:
  - Capability grants and suspension use `space_capability_grants`, not `role_grants`.
  - The super-admin suspension flow is in `apps/web/src/server/app/space-admin/manage-grants.ts`.
  - Its route is `apps/web/src/app/api/space-admin/[spaceId]/grants/route.ts`.
  - This is adjacent prior art, not the community-manager role implementation.

- Existing payments are one-time hosted-form payments:
  - Green Invoice `/payments/form`, document type `320`.
  - Internal `payments` rows use `pending | completed | failed | refunded`.
  - Current purposes are vote participation and vote creation.
  - Evidence: `apps/web/src/services/payments/greenInvoice.ts`, `apps/web/src/app/api/payments/create/route.ts`.

- Existing webhook processing provides partial reusable mechanics:
  - Shared-secret verification.
  - `webhook_events.event_id` uniqueness.
  - Atomic `pending → completed` claim before fulfillment.
  - Provider/internal payment correlation.
  - Evidence: `apps/web/src/app/api/payments/webhook/route.ts`, `supabase/migrations/20250115000002_webhook_events.sql`.

- Off-session token charging exists only as an unverified provider adapter/spike:
  - `chargeToken()` is in `apps/web/src/services/greenInvoice/index.ts`.
  - Live sandbox results remain entirely pending in `apps/web/docs/SPIKE-RESULT.md`.
  - There is no production importer implementing manager renewals.

- Notification primitives exist, but no manager lifecycle notifier:
  - Email service: `apps/web/src/services/email/index.ts`.
  - Expo push: `apps/web/src/services/notifications/expo.ts`.
  - Best-effort notification pattern: `apps/web/src/server/infra/notify/vote-created.ts`.

## Integration points

- Authorization port:
  - Replace `billingRequirementSatisfied()` in `apps/web/src/server/app/authz/require-role.ts` with a subscription repository lookup.
  - Preserve `requireRole()` as the enforcement point and feed the existing `billingActive` policy fact.

- Role/application repository:
  - `apps/web/src/server/infra/supabase/role.repo.ts`.
  - Approval, suspension, reinstatement, and audit must use its guarded-transition and append-only-event patterns.

- Space identity:
  - Role scope is `municipalities.code`, stored as `role_grants.space_id`.
  - It is not the UUID `spaces.id` used by the newer space-governance subsystem.
  - Evidence: `supabase/migrations/20260802000002_role_grants_and_applications.sql`.

- Payment provider:
  - Auth, tokenization, and off-session charging live in `apps/web/src/services/greenInvoice/index.ts`.
  - One-time hosted forms live in `apps/web/src/services/payments/greenInvoice.ts`.
  - Provider behavior must not be inferred from the hosted-form implementation.

- Idempotency:
  - Provider event deduplication: `webhook_events.event_id`.
  - Payment creation: `payments.idempotency_key`.
  - Conditional claim pattern: `markPaymentCompleted()` as used by `apps/web/src/app/api/payments/webhook/route.ts`.
  - Deterministic server-generated key precedent: `apps/web/src/server/infra/payments/creation-fee.ts`.

- Repository layering:
  - Domain policy: `apps/web/src/server/domain/`.
  - Use cases/ports: `apps/web/src/server/app/`.
  - Supabase/provider adapters: `apps/web/src/server/infra/`.
  - Thin Next.js routes: `apps/web/src/app/api/`.
  - Shared Zod wire contracts: `packages/shared/src/contracts/`.

- Audit:
  - Community-manager role history belongs in `role_grant_events`.
  - Subscription/charge history needs its own append-only ledger unless the existing event vocabulary and subject constraints are deliberately expanded.

- Notifications:
  - In-app/push persistence patterns exist under `apps/web/src/server/infra/supabase/space-notify.repo.ts`.
  - Expo delivery is best-effort and should not determine whether a billing transition commits.

- Scheduling:
  - Worker scheduled dispatch is in `apps/web/worker.ts`.
  - `apps/web/wrangler.jsonc` says the account rejected the multi-cron configuration; only limited schedules are currently registered.

- Migration numbering:
  - Migrations use sortable UTC timestamp names.
  - The latest current migration is `supabase/migrations/20260811000004_pilot_program.sql`.
  - No Phase 6 manager-billing migration exists; a new filename must sort after existing migrations and avoid timestamp collision.

- Generated database types:
  - Any schema addition must be reflected in `apps/web/src/lib/supabase/types.ts`.

## Prior art

Nearest merged PR: **#95, `bc227bd` — “RLS transport, authz enforcement, re-scoped money model, press homepage.”**

Copy from it:

- `role_grants`, manager-application, and append-only audit schema conventions.
- Result-typed repository functions.
- `requireRole()` plus pure `evaluateAuthorization()` composition.
- SECURITY DEFINER helpers for role-aware RLS without recursive policy evaluation.
- User-scoped Supabase transport.

For the admin dashboard/API shape, the closest merged feature is **#93, `9d6bc53` — “space governance substrate and administrator operations dashboard.”** Reuse its thin-route/application/repository layering, guarded mutations, mandatory reasons, audit chaining, RTL admin components, and test organization.

For deterministic payment reuse, copy the server-generated key and insert-race recovery pattern from `apps/web/src/server/infra/payments/creation-fee.ts`, while recognizing that it currently records only a pending obligation and does not capture money.

## Constraint register

- Provider gate is open:
  - Every live token-charge observation is still “pending live run” in `apps/web/docs/SPIKE-RESULT.md`.
  - Charge ID, document ID, webhook shape, 3DS/SCA behavior, declines, and settlement timing are unverified.
  - This blocks a safe recurring-charge implementation.

- No provider subscription object is established in the tree. Current planning describes Taruu owning scheduling, retry, state, and reconciliation around one-shot token charges; this remains unverified against Morning.

- Cron deployment is constrained:
  - `apps/web/wrangler.jsonc` records an account-level rejection of the multi-schedule configuration.
  - A renewal scheduler cannot assume a new Cloudflare cron slot is deployable.

- Migration application cannot be verified from this read-only working tree. Phase documentation retains manual migration/live-database gates; repository presence is not evidence that production has applied `20260802000002_role_grants_and_applications.sql`.

- Phase 5 is incomplete at the application layer:
  - Schema, contracts, repository, and authorization core exist.
  - Applicant/reviewer routes and screens listed above do not.

- Current authorization fails the issue’s billing boundary:
  - `billingRequirementSatisfied()` always returns true.

- Current status vocabularies do not satisfy the issue:
  - Grant: `active | suspended | revoked`.
  - Application: `submitted | approved | rejected | withdrawn`.
  - Payment: `pending | completed | failed | refunded`.
  - There is no subscription state containing `past_due`, `grace`, `cancelled`, or `expired`.

- Current generic payment type checks reject a manager subscription purpose.

- Open security findings in the payment area are recorded in `SECURITY-AUDIT.md`, including:
  - HIGH: treasury deposit idempotency.
  - MEDIUM: entitlement/token-mint idempotency.
  - MEDIUM: Green Invoice secret in webhook query strings.
  - These findings concern the legacy flow; renewal work must not duplicate those patterns.

- The webhook event migration’s RLS policy uses `USING (true)` without a role restriction despite its “service role only” comment (`supabase/migrations/20250115000002_webhook_events.sql`). Do not treat that policy as a proven private boundary.

- No raw-card storage exists today; preserve provider-hosted tokenization. Do not add PAN/CVV fields to internal tables.

- Existing planning proposes `+1/+3/+7` retries and a 14-day grace period, but these are planning text, not implemented or issue-approved behavior.

- No protected paths were declared by the applicable `AGENTS.md`. Repository files remain read-only for this research task.

## Open questions

1. Is the failed-payment policy the planned `+1/+3/+7` retry ladder with 14 days of grace, or does the human want different timing?

2. Does cancellation retain access until the paid-through date, or suspend access immediately?

3. Should `rejected` describe application state, subscription state, or both? The existing application schema already owns that term.

4. Are billing suspension and `role_grants.status = suspended` intentionally separate administrative levers? If so, which one is authoritative when reinstating access?

5. May authorized space admins approve and reject applications while only super admins control billing suspension, or should space admins also manage billing actions inside their scope?

6. Should manager billing scope continue using `municipalities.code`, or migrate to the newer UUID `spaces.id` model?

7. Which notification channels are required for each transition: in-app, Expo push, email, or a mandatory subset?

8. What renewal trigger is authorized if the Cloudflare account still refuses additional cron schedules?

9. Which Morning sandbox/account contract proves token creation, off-session MIT charging, document creation, webhook correlation, and settlement reconciliation?

10. What should happen when approval is revoked while a paid subscription remains active: cancel future renewal, retain billing but deny access, or initiate a refund?

11. What reconciliation cadence and operator surface are required, and who is authorized to resolve mismatches?

12. Is visual evidence expected only after a live sandbox lifecycle, or may sanitized mocked provider records be used for the initial UI evidence?