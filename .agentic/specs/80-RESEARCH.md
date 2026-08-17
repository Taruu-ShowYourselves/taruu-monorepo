# Research — issue #80

## Already-done check

- Developer registration, ₪50/1,000-request plan purchase, scoped-key creation, endpoint call, and usage display: **MISSING**. There is no developer portal route, developer-account schema, API-key store, developer plan, usage ledger, or usage dashboard. Evidence: `apps/web/src/app/[locale]/`, `apps/web/src/app/api/`, `supabase/migrations/`.
- Reproducible quota/billing calculations and documented duplicate-request policy: **MISSING**. Existing notification quotas are unrelated campaign quotas, not billable API metering. Evidence: `apps/web/src/server/app/space-admin/send-notification.ts`, `apps/web/src/server/infra/supabase/space-notify.repo.ts`, `supabase/migrations/20260802000014_space_notifications.sql`.
- Revoked or over-quota keys rejected without protected data: **MISSING**. No developer keys, scopes, revocation state, or API quota authorization exists.
- No prohibited resident, identity, ballot, or payment data exposed through the product: **MISSING**. No dataset allowlist or privacy-publication gate exists, and adjacent public/API surfaces already have recorded data-minimization findings. Evidence: `SECURITY-AUDIT.md` findings 6 and 16; `apps/web/src/app/api/treasury/[municipality]/transactions/route.ts`; `apps/web/src/app/api/votes/[id]/issue-coin/holders/route.ts`.

**Verdict: proceed.** The working tree does not satisfy any end-to-end acceptance criterion.

## Current-state map

- Portal/UI: localized Next.js App Router pages live under `apps/web/src/app/[locale]/`. There is no `developers` route or separate developer application.
- API transport: route handlers live under `apps/web/src/app/api/`. They normally authenticate with `getSessionFromRequest()` and call application-layer functions or legacy DB helpers. Evidence: `apps/web/src/services/auth/session.ts`, `apps/web/src/app/api/auth/session/route.ts`.
- Authentication: `getSessionFromRequest()` accepts an `Authorization: Bearer` session token and cookie-based sessions. These are resident/user sessions, not developer API keys. Evidence: `apps/web/src/services/auth/session.ts`.
- Contracts: shared Zod schemas belong in `packages/shared/src/contracts/` and are exported through its index. The preferred client validates responses and returns `ResultAsync`. Evidence: `packages/shared/src/contracts/index.ts`, `packages/api-client/src/create-api.ts`.
- API client: public package exports domain modules from `packages/api-client/src/index.ts`; `createApi()` is the newer contract-validated pattern. No externally versioned developer-data client exists.
- Application architecture: newer privileged features use `apps/web/src/server/app/` for use cases, `apps/web/src/server/domain/` for policy, ports under `server/app/**/ports/`, and implementations under `apps/web/src/server/infra/`.
- Database: Supabase migrations are additive timestamped files in `supabase/migrations/`. The latest tracked filename is `20260811000004_pilot_program.sql`; no developer-account, organization, key, plan, usage, invoice, dataset, or publication-review tables exist.
- Privileged database access: `supabaseAdmin` uses the service role and bypasses RLS. Object authorization must therefore be enforced before repositories are called. Evidence: `apps/web/src/lib/supabase/server.ts`.
- Existing payments: the real ledger is `payments`, with amounts in agorot, provider fields, and a unique `idempotency_key`. Green Invoice hosted forms and webhook processing are vote/merch-oriented. Evidence: `supabase/migrations/20240101000000_initial_schema.sql`, `apps/web/src/services/payments/greenInvoice.ts`, `apps/web/src/app/api/payments/`.
- Rate limiting: `createRateLimiter()` uses Upstash Redis in configured environments and an in-memory fallback otherwise. It is suitable for abuse/burst control, not reproducible billable metering. Evidence: `apps/web/src/lib/rate-limit.ts`.
- Audit: the strongest current pattern is an append-only database audit log with repository methods limited to insert/read. Evidence: `supabase/migrations/20260802000010_space_governance.sql`, `apps/web/src/server/infra/supabase/space-audit.repo.ts`, `supabase/tests/audit_append_only.sql`.
- Kill switches: features use small server-side helpers, e.g. `SPACE_ADMIN_ENABLED=false`, which deny routes without deleting history. Evidence: `apps/web/src/lib/features/space-admin.ts`.
- Documentation: operational documentation lives under `apps/web/docs/`; product/legal pages live under localized routes such as `terms`, `pricing`, and `refund`. There is no API licensing, attribution, retention, acceptable-use, versioning, or deprecation documentation.

## Integration points

- **Authentication seam:** `getSessionFromRequest(request)` in `apps/web/src/services/auth/session.ts`. Developer-key authentication needs a separate credential resolver; resident sessions must not be treated as API keys.
- **Authorization seam:** copy the branded-scope pattern from `apps/web/src/server/app/space-admin/authorize.ts`. Only a resolver should mint a developer/dataset scope; repositories should accept that branded scope instead of raw key IDs, organization IDs, or dataset names.
- **Contracts seam:** versioned request/response schemas belong in `packages/shared/src/contracts/`, exported by `packages/shared/src/contracts/index.ts`; client bindings belong in `packages/api-client/src/create-api.ts` or a dedicated exported module.
- **Repository seam:** application use cases belong under `apps/web/src/server/app/developer-api/`; database adapters should live under `apps/web/src/server/infra/supabase/`. Payment-provider code remains infrastructure rather than route logic.
- **API seam:** existing internal routes use `/api/*`. The issue requires stable versioning, but the tree has no established `/api/v1` convention.
- **Key storage seam:** no reusable API-key implementation exists. The schema will need hash-only storage, a non-secret prefix/identifier for lookup, scopes, creation metadata, rotation lineage, revocation, and last-used/anomaly fields. Secret display must occur only in the creation response.
- **Metering seam:** `createRateLimiter()` is only a burst/abuse gate. Billable usage needs durable database evidence and an atomic idempotency policy; it must not use the in-memory fallback as the ledger.
- **Quota seam:** the closest DB-backed precedent counts authoritative rows and enforces `used >= limit` before writing. Evidence: `apps/web/src/server/app/space-admin/send-notification.ts`, `apps/web/src/server/infra/supabase/space-notify.repo.ts`.
- **Audit seam:** use the insert/read-only repository and trigger-plus-REVOKE pattern from `space_audit_log`; RLS alone is insufficient because service-role queries bypass it.
- **Billing seam:** `payments` is the existing internal payment ledger and Green Invoice is the configured provider. Its current `PaymentPurpose` and checkout flows are vote-specific, so a developer plan cannot be inserted without extending the domain and webhook dispatch explicitly. Evidence: `apps/web/src/server/infra/supabase/payment.repo.ts`, `apps/web/src/app/api/payments/create/route.ts`, `apps/web/src/app/api/payments/webhook/route.ts`.
- **Idempotency seam:** `payments.idempotency_key` and `webhook_events.event_id` are existing correlation mechanisms. The developer metering ledger needs its own documented duplicate-request identity and atomic uniqueness constraint. Evidence: `supabase/migrations/20250115000002_webhook_events.sql`.
- **Kill-switch seam:** add a dedicated helper shaped like `isSpaceAdminEnabled()`, with API authorization checking it before dataset access.
- **Migration numbering:** the next migration must sort after `20260811000004_pilot_program.sql`. The exact timestamp/sequence should be chosen at implementation time after re-reading the directory to avoid collisions.
- **Privacy seam:** no publication-review or dataset-allowlist module exists. This is a new mandatory gate, not an extension of the current public route list.

## Prior art

Nearest merged PR: **#93**, commit `9d6bc53`, `feat(space-admin): space governance substrate and administrator operations dashboard`.

Copy its overall shape:

- feature kill switch;
- branded authorization scope minted by one resolver;
- explicit capability strings;
- application/domain/repository separation;
- service-role-aware object authorization;
- additive RLS-first migrations;
- append-only audit enforced by trigger and revoked mutation privileges;
- durable DB-backed quota rather than process memory;
- shared Zod contracts;
- route, contract, authorization, quota, concurrency, audit, and E2E tests;
- localized dashboard pages and screenshot evidence.

Relevant evidence includes:

- `apps/web/src/server/app/space-admin/authorize.ts`
- `apps/web/src/server/domain/space/capability.ts`
- `apps/web/src/server/infra/supabase/space-audit.repo.ts`
- `apps/web/src/server/infra/supabase/space-notify.repo.ts`
- `supabase/migrations/20260802000010_space_governance.sql`
- `supabase/migrations/20260802000014_space_notifications.sql`
- `apps/web/src/__tests__/api/space-admin-*.test.ts`
- `apps/web/tests/e2e/space-admin.spec.ts`

Do not copy its campaign quota literally: it counts sends per calendar month and has no billing semantics, per-request idempotency, or monetary reconciliation.

## Constraint register

- Read-only research: no `RESEARCH.md` file was written to the working tree.
- Protected paths declared by `.agentic/config.json`:

  - `supabase/migrations/`
  - `.github/workflows/`
  - `apps/web/src/app/api/payments/`

  This issue necessarily appears to require the migration path. Reusing the current billing flow would also touch the protected payments path. A separate subdomain deployment may require the protected workflow path, depending on the hosting decision.

- Migration application state cannot be established against production from this read-only tree. Local evidence says migrations through `20260802000014_space_notifications.sql` were applied in the Phase 5 validation database, not necessarily production. Evidence: `.planning/phases/05-space-governance-substrate-and-space-admin-operations-dashboard/05-DB-EVIDENCE.md`. Later tracked migrations through `20260811000004` have no production-state proof found here.
- Existing migration files are treated as immutable; corrections must be new additive migrations. Evidence: `.planning/phases/01-clean-foundation/01-02-PLAN.md`.
- Service-role repositories bypass RLS. Every developer-data repository therefore requires explicit object/dataset authorization before access.
- Upstash’s in-memory fallback is explicitly unsuitable for production and cannot provide a financial ledger. Evidence: `apps/web/src/lib/rate-limit.ts`.
- Current payment checkout is purpose-specific, and the default idempotency behavior has an open finding: a time-based fallback key defeats retry deduplication. Evidence: `SECURITY-AUDIT.md` finding 21 and `apps/web/src/app/api/payments/create/route.ts`.
- The structured logger has no recursive secret redaction, which is directly relevant to API keys. Evidence: `SECURITY-AUDIT.md` finding 22 and `apps/web/src/lib/logger.ts`.
- Adjacent data-exposure findings must be resolved or explicitly excluded before approving datasets:

  - municipality treasury transactions expose user identifiers to authenticated users (`SECURITY-AUDIT.md` finding 6);
  - issue-coin holders expose full wallet addresses and exact invested amounts publicly (`SECURITY-AUDIT.md` finding 16);
  - public vote listing is unbounded and lacks route rate limiting (`SECURITY-AUDIT.md` finding 15).

- No dataset classification, allowlist, privacy-review record, licensing registry, retention policy, attribution contract, version/deprecation registry, or emergency developer-API kill switch exists.
- No DNS/hosting configuration for `developers.taruu.co.il` was found in the working tree.
- No developer sandbox or automated documentation-example runner exists.
- The requested verification surface is substantially broader than current API-client tests: contract, scope, quota, durable metering, concurrency, billing reconciliation, privacy, abuse, and rotation tests are all new.

## Open questions

1. Is `developers.taruu.co.il` a second deployed Next.js application, a hostname routed to the existing `apps/web` application, or localized routes within the existing deployment?
2. Which exact datasets and fields are approved for v1, and who has authority to record the required privacy approval?
3. Must developer identities reuse existing Taruu user accounts, or are developer accounts a separate authentication realm?
4. What is the organization model: one developer per organization, multiple members with roles, or individual accounts only for v1?
5. Does “₪50 per 1,000 requests” mean prepaid blocks, postpaid monthly invoicing, or a recurring subscription containing 1,000 requests?
6. Is quota a hard block at 1,000 requests, or may usage continue into another automatically billed block?
7. Which responses are billable: successes only, all authenticated requests, cache hits, 4xx responses, 5xx responses, retries, and rate-limited requests?
8. What uniquely identifies a duplicate request, how long is its deduplication window, and should a duplicate return the original response without additional billing?
9. Which API scopes are required for the initial datasets, and are scopes assigned per key, organization, endpoint, field set, or combination?
10. What rotation policy is required: overlapping old/new keys for a grace period, or immediate revocation of the old key?
11. Which anomaly signals must cause throttling or automatic revocation, and what operator override/recovery process is required?
12. Must Green Invoice remain the billing and invoicing provider for this product, and which Israeli tax document is required for prepaid blocks versus postpaid usage?
13. What licensing and attribution text applies to each source dataset, including upstream government-data terms?
14. What retention periods apply separately to raw request logs, billable usage evidence, audit history, invoices, and revoked-key metadata?
15. What deprecation notice period and version-support window are required?
16. Should the global kill switch disable only protected dataset reads, or also registration, key management, documentation examples, and billing?
17. Which tracked Supabase migrations are confirmed applied in production after `20260802000014`, particularly the `20260810*` and `20260811*` series?
