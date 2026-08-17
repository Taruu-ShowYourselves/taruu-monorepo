# Spec — issue #80 developer-api-publication-gate v1

## Current state

- No developer portal, account schema, API-key store, usage ledger, or developer billing plan exists under the localized App Router, API routes, or Supabase migrations.
- Developer credentials require a resolver separate from resident authentication in `apps/web/src/services/auth/session.ts`; resident sessions must never authorize developer API access.
- Developer API policy belongs under `apps/web/src/server/app/developer-api/`, with Supabase adapters under `apps/web/src/server/infra/supabase/`.
- Dataset authorization should copy the branded-scope pattern in `apps/web/src/server/app/space-admin/authorize.ts`, because service-role repositories bypass RLS.
- No dataset allowlist, privacy-publication record, or developer API kill switch exists; the kill switch should follow `apps/web/src/lib/features/space-admin.ts`, while immutable schema changes require a new additive migration after `20260811000004_pilot_program.sql`.

## Goal

Split: issue #80 is substantially larger than one half-day PR and must be delivered as multiple independently reviewed slices. This first slice creates the fail-closed publication-control substrate required before any developer endpoint is exposed: an additive dataset/version registry, recorded privacy approval, an emergency kill switch, and a single resolver that can mint a branded published-dataset scope only for an enabled, explicitly approved dataset version. It does not expose data or implement accounts, keys, billing, metering, or portal UI.

Proposed subsequent slices:

1. Developer organizations, accounts, and scoped hash-only API keys.
2. First approved versioned dataset endpoint and API client contracts.
3. Durable idempotent metering, quota enforcement, and usage audit.
4. ₪50/1,000-request checkout, payment reconciliation, and invoices.
5. Localized portal pages, documentation, policy pages, usage dashboard, and hostname deployment.
6. Rotation, anomaly controls, support tooling, sandbox examples, and end-to-end evidence.

## In scope

- claim: supabase/migrations/20260817000001_developer_api_publication_gate.sql
- claim: supabase/tests/developer_api_publication_gate.sql
- claim: apps/web/src/lib/features/developer-api.ts
- claim: apps/web/src/server/domain/developer-api/published-dataset-scope.ts
- claim: apps/web/src/server/app/developer-api/ports/dataset-publication.repo.ts
- claim: apps/web/src/server/app/developer-api/authorize-published-dataset.ts
- claim: apps/web/src/server/infra/supabase/developer-dataset-publication.repo.ts
- claim: apps/web/src/server/app/developer-api/__tests__/authorize-published-dataset.test.ts

## Out of scope

No public developer-data route, developer subdomain, portal UI, registration, organization membership, API-key creation or authentication, scopes assigned to keys, key rotation/revocation, request metering, deduplication, quota enforcement, rate limiting, payment checkout, invoices, usage dashboard, documentation examples, changelog, licensing-page copy, client bindings, dataset payload schemas, or dataset records populated as approved.

No existing treasury, vote, issue-coin, resident, identity, ballot, wallet, social, or payment data becomes publishable. This PR must not infer approval from an existing public route or seed any approved dataset.

No changes may be made outside the claimed files.

## Contracts

The migration must be additive and must create:

- `developer_api_datasets`, keyed by an immutable UUID, with a unique normalized `dataset_key`.
- `developer_api_dataset_versions`, keyed by an immutable UUID, with a foreign key to the dataset, a non-empty stable `version`, status constrained to `draft`, `approved`, `suspended`, or `retired`, and uniqueness on `(dataset_id, version)`.
- `developer_api_publication_reviews`, containing the dataset-version ID, decision constrained to `approved` or `rejected`, reviewer UUID, decision timestamp, non-empty privacy rationale, licensing terms, attribution requirements, retention policy, acceptable-use policy, and source-data classification.
- An append-only publication-review history. Database triggers must reject `UPDATE` and `DELETE`, and mutation privileges for those operations must be revoked following the `space_audit_log` trigger-plus-REVOKE precedent.
- RLS enabled on every new table. Ordinary authenticated and anonymous roles receive no direct read or write policy. Service-role access does not replace application authorization.

A dataset version is publishable only when all of these are true:

1. `DEVELOPER_API_ENABLED` is exactly `true`.
2. The dataset and requested version both exist.
3. The version status is `approved`.
4. Its latest publication-review decision, ordered deterministically by decision timestamp and immutable ID, is `approved`.
5. All required policy fields on that approval are non-empty.

`isDeveloperApiEnabled()` must default to disabled when the environment variable is missing, empty, malformed, or any value other than `true`.

`authorizePublishedDataset(datasetKey, version, repository)` is the only function permitted to mint `PublishedDatasetScope`. Raw dataset keys, version strings, record IDs, or repository results must not be type-asserted into that scope elsewhere.

The resolver contract must return a discriminated result with only these externally usable outcomes:

- `{ ok: true, scope: PublishedDatasetScope }`
- `{ ok: false, reason: "disabled" | "not_publishable" }`

Missing, rejected, suspended, retired, or incompletely reviewed datasets must collapse to `not_publishable` so callers cannot enumerate publication state. Repository and database errors must fail closed and must not mint a scope.

The Supabase repository may use `supabaseAdmin`, but it must expose only the publication lookup required by the resolver. It must not expose unrestricted table access or return dataset payload data.

The migration filename is reserved by this spec based on the latest migration recorded in RESEARCH.md. Immediately before implementation, the engineer must re-read `supabase/migrations/`; any collision makes the spec stale and requires human-approved claim revision rather than silently choosing another filename.

## Acceptance gates

- G-1: With `DEVELOPER_API_ENABLED` unset, empty, `false`, `TRUE`, or malformed, authorization returns `disabled` and the repository is not queried; with the value exactly `true`, evaluation proceeds. → evidence: `pnpm --filter web test -- authorize-published-dataset.test.ts`
- G-2: The resolver mints `PublishedDatasetScope` only for an existing version whose status is `approved`, whose latest deterministic review is `approved`, and whose privacy, licensing, attribution, retention, acceptable-use, and classification fields are all populated. → evidence: `pnpm --filter web test -- authorize-published-dataset.test.ts`
- G-3: Missing, draft, rejected, suspended, retired, or incompletely reviewed versions return `not_publishable`; repository failures reject or return a failure result without producing a scope. → evidence: `pnpm --filter web test -- authorize-published-dataset.test.ts`
- G-4: The database enforces dataset/version uniqueness, allowed status and decision values, required approval fields, foreign keys, and deterministic latest-review selection. → evidence: `supabase test db`
- G-5: Publication-review rows are append-only: database attempts to update or delete a review fail, including through roles subject to revoked mutation privileges. → evidence: `supabase test db`
- G-6: Anonymous and authenticated database roles cannot directly read or mutate the new registry or review tables. → evidence: `supabase test db`
- G-7: No dataset is seeded as approved, and the migration introduces no resident, identity, ballot, wallet, social, treasury-transaction, or payment-data view or column. → evidence: `test -z "$(rg -n -i 'insert[[:space:]]+into[[:space:]]+developer_api_(datasets|dataset_versions|publication_reviews)|resident|identity_evidence|secret_ballot|wallet_address|payments' supabase/migrations/20260817000001_developer_api_publication_gate.sql)"`
- G-8: The claimed TypeScript changes typecheck and do not break the web test suite. → evidence: `pnpm --filter web typecheck && pnpm --filter web test`

## Protected paths

- `supabase/migrations/` — modified by the claimed additive migration because durable dataset allowlisting and privacy approval do not exist. Existing migrations remain immutable; applying the migration to production is not part of this PR.
- `.github/workflows/` — protected and explicitly unchanged. DNS, hostname routing, and deployment automation are deferred.
- `apps/web/src/app/api/payments/` — protected and explicitly unchanged. Developer-plan checkout and webhook dispatch are deferred to a separately approved billing slice.

## Risk & rollback

The primary risk is accidentally treating an unreviewed dataset as publishable while using a service-role client that bypasses RLS. The resolver therefore defaults disabled, collapses all non-approved states, requires a complete latest approval, and is the sole scope-minting boundary. Append-only reviews preserve who approved what policy and prevent silent approval-history rewrites.

Operational rollback is immediate: set `DEVELOPER_API_ENABLED` to any value other than exact `true`. No endpoint consumes the scope in this slice, so rollback cannot interrupt an existing developer API. The additive tables and their history should remain in place; do not edit or remove the migration after application. Any later correction must use a new additive migration.