# Spec — issue #22 rls-hotfixes v1

## Current state

The immediate issue #22 work order identifies three missing database protections: unrestricted `webhook_events` access, public holder-linked `vote_nfts` reads, and whole-row owner updates on `users`. Database security changes must be delivered as a new corrective migration after `20260811000004_pilot_program.sql`; historical migrations must remain unchanged. User identity inside RLS is supplied by the verified JWT through `public.user_id()`, not `auth.uid()`. The user-scoped data port is `createUserScopedClient(userId)`, while existing backend NFT, webhook, and profile operations use `supabaseAdmin`, which bypasses RLS. Because no live denial harness exists in CI, this slice adds a repeatable scratch-database SQL assurance probe alongside the migration.

## Goal

Land one forward-only database hotfix that prevents anonymous or authenticated clients from mutating the webhook replay ledger, prevents direct client reads of holder-linked NFT records, and restricts self-service `users` updates to non-security profile fields. Preserve existing service-role backend behavior and prove both denied client operations and permitted service-role/profile operations with a deterministic SQL probe.

## In scope

- claim: supabase/migrations/20260816000001_issue_22_rls_hotfixes.sql
- claim: supabase/tests/issue_22_rls_hotfixes.sql

## Out of scope

No edits to historical migrations or application code. No public NFT projection, gallery view, or new API contract; direct client access to `vote_nfts` becomes deny-by-default, while existing service-role-backed APIs remain the publication boundary. No changes to payment fulfilment, ballot eligibility/idempotency, OAuth state or PKCE, Bags swap quote validation, webhook URL secrets, blockchain services, or the broader service-role migration. No attempt to establish production migration state or modify `20260807000001_identity_score_unification.sql`.

## Contracts

Migration `20260816000001_issue_22_rls_hotfixes.sql` is corrective, forward-only, and safe to apply after `20260811000004_pilot_program.sql`.

For `webhook_events`:

- Drop the existing `"Service role full access to webhook_events"` policy and recreate it as `FOR ALL TO service_role USING (true) WITH CHECK (true)`.
- Anonymous and authenticated roles receive no direct `SELECT`, `INSERT`, `UPDATE`, or `DELETE` path.
- Revoke execution of `cleanup_old_webhook_events()` from `PUBLIC`, `anon`, and `authenticated`; retain execution for `service_role`.
- Preserve the replay ledger schema, uniqueness constraint, retention function, and service-role CRUD behavior.

For `vote_nfts`:

- Drop `"Vote NFTs are publicly readable"`.
- Retain or recreate full access explicitly for `service_role`.
- Anonymous and authenticated clients cannot directly select holder-linked rows, including `user_id` and `wallet_address`.
- Do not introduce a replacement public view until the required public NFT projection is separately decided.
- Preserve table shape, minting constraints, and service-role minting/read behavior.

For `users`:

- Keep row ownership based on `public.user_id()`; do not introduce `auth.uid()`.
- Revoke table-wide `UPDATE` from `anon` and `authenticated`.
- Grant `authenticated` column-level update permission only for `first_name`, `last_name`, and `avatar_url`.
- Do not grant direct client updates to identity, authentication, residency, verification, score, contact, DID, OAuth, timestamp, or key-bearing columns, including `email`, `phone`, `municipality_id`, `identity_score`, `verification_status`, `did`, `did_public_key`, `did_encrypted_private_key`, `google_id`, `created_at`, and `updated_at`.
- The existing owner-row RLS predicate remains an additional requirement: an authenticated user may update the allowed profile columns only on the row whose `id` equals `public.user_id()`.
- Preserve unrestricted backend maintenance through `supabaseAdmin`/`service_role`.

The SQL assurance probe must be transactionally isolated or explicitly documented for scratch-database use. It must emit deterministic `PASS:`/`FAIL:` lines and cover anonymous, authenticated-owner, authenticated-non-owner, and service-role cases.

## Acceptance gates

- G-1: The migration is uniquely ordered after the repository’s current latest migration, and no historical migration is modified. → evidence: `test "$(basename "$(find supabase/migrations -maxdepth 1 -type f -name '*.sql' | sort | tail -1)")" = "20260816000001_issue_22_rls_hotfixes.sql" && git diff --name-only -- supabase/migrations | awk '$0 != "supabase/migrations/20260816000001_issue_22_rls_hotfixes.sql" { bad=1 } END { exit bad }'`

- G-2: After a scratch database reset, anonymous and authenticated roles cannot select, insert, update, or delete `webhook_events`, cannot execute its cleanup function, and `service_role` can create, read, update, and delete a probe event. → evidence: `supabase db reset && psql "$SCRATCH_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/issue_22_rls_hotfixes.sql`

- G-3: The same SQL probe demonstrates that anonymous and authenticated roles cannot directly read a seeded `vote_nfts` holder row, while `service_role` can read it. → evidence: `supabase db reset && psql "$SCRATCH_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/issue_22_rls_hotfixes.sql`

- G-4: The same SQL probe demonstrates that an authenticated owner can change only `first_name`, `last_name`, and `avatar_url`; cannot change `email`, `phone`, `municipality_id`, `identity_score`, `verification_status`, DID/OAuth fields, or timestamps; and cannot update another user’s row. → evidence: `supabase db reset && psql "$SCRATCH_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/issue_22_rls_hotfixes.sql`

- G-5: The SQL assurance probe completes with no `FAIL:` records and reports its declared expected number of `PASS:` records. → evidence: `supabase db reset && psql "$SCRATCH_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/issue_22_rls_hotfixes.sql 2>&1 | tee /tmp/issue-22-rls.log && ! grep -q 'FAIL:' /tmp/issue-22-rls.log && test "$(grep -c 'PASS:' /tmp/issue-22-rls.log)" -eq "$(sed -n 's/^-- EXPECTED_PASS_COUNT: //p' supabase/tests/issue_22_rls_hotfixes.sql)"`

- G-6: Repository tests, type checking, and linting remain green after the database-only change. → evidence: `pnpm test && pnpm typecheck && pnpm lint`

## Protected paths

- `supabase/migrations/` — protected deployment history. This PR may add only the claimed forward migration and must not edit, delete, or renumber existing migrations.
- `.github/workflows/` — protected CI configuration; no changes authorized.
- `apps/web/src/app/api/payments/` — protected payment and fulfilment boundary; already-done idempotency behavior must remain untouched.

## Risk & rollback

An incorrect grant or policy could expose webhook replay records, reveal NFT holder linkage, block legitimate profile edits, or interrupt backend webhook/NFT processing. The SQL probe reduces this risk by exercising both denial and required service-role success paths against a scratch database.

Rollback must be a new forward migration, never deletion or editing of the applied hotfix. It should restore only the minimum required privileges or policies after confirming the affected application path. Re-enabling public whole-row `vote_nfts` reads or unrestricted client access to `webhook_events` is not an acceptable rollback; if public NFT data is required, add a separately reviewed projection that excludes holder linkage.