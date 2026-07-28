# Codebase Concerns

**Analysis Date:** 2026-06-28
**Context:** Pre-integration audit focused on Green Invoice card-on-file + per-vote treasury ledger integration.
**Sources:** SECURITY-AUDIT.md (36-agent SAST, 22 findings), HANDOVER.md, working-tree diff, live code review.

---

## 1. Uncommitted Working-Tree Change Assessment

The branch `growth/roadmap-agents-financials` has a significant multi-file working-tree change that is coherent and landable as a discrete commit. Summary of what changed and the verdict on each piece:

### Auth0 OIDC Migration (COHERENT — ready to land)

**Files changed:**
- `apps/web/src/services/auth/auth0.ts` — new OIDC service (added, untracked in prior state)
- `apps/web/src/app/api/auth/callback/route.ts` — callback rewired from raw Google to Auth0
- `apps/web/src/providers/AuthProvider.tsx` — `signInWithGoogle` now calls Auth0 `/authorize`
- `apps/web/src/__tests__/api/auth-callback.test.ts` — test mocks updated to Auth0 shape
- `apps/web/src/__tests__/integration/auth.test.ts` — integration test updated
- `apps/web/src/lib/env.ts` — Auth0 vars added to Zod schema

The migration is self-consistent: the OIDC `sub` (e.g. `google-oauth2|123...`) is stored on the existing `users.google_id` column and `session.googleId` field to preserve all downstream consumers. CSRF state is generated and stored in `sessionStorage` on the client (via shared helpers from `./google`). Tests cover the four key paths (missing code, missing secret, new user, existing user).

**One gap that must be noted before merging:** `auth0.ts` reads `NEXT_PUBLIC_AUTH0_DOMAIN` and `NEXT_PUBLIC_AUTH0_CLIENT_ID` from `process.env` directly at module scope (lines 49–50), bypassing the validated `getServerEnv()` in `apps/web/src/lib/env.ts`. The env schema now validates these vars, but the actual runtime reads happen outside the schema. If the env schema is ever the enforcement boundary, the service silently falls back to empty strings and `auth0Origin('')` produces `https://`. Not a blocker since the schema fail-fast covers startup, but the pattern is inconsistent — both the direct read and the schema reference should use the same source.

**Second gap:** `env.ts` now requires both `AUTH0_DOMAIN` (server, line 20) and `NEXT_PUBLIC_AUTH0_DOMAIN` (lines 23, 54). The service only reads `NEXT_PUBLIC_AUTH0_DOMAIN`. The `AUTH0_DOMAIN` var is validated at startup but never consumed by any code — either remove it from the schema or route the service through it to reduce confusion.

### Printful Deletion (COHERENT — ready to land)

**Files deleted:**
- `apps/web/src/services/fulfillment/printful.ts`
- `apps/web/src/app/api/merch/fulfillment-webhook/route.ts`
- `apps/web/src/__tests__/api/merch-fulfillment-webhook.test.ts`
- `apps/web/src/__tests__/services/printful.test.ts`

**Catalog + types cleaned:**
- `packages/shared/src/types/merch.ts` — `PodProvider` type, `podVariantId` field removed
- `apps/web/src/lib/merch/catalog.ts` — `podProvider` field removed from all products
- `packages/shared/src/types/merch.ts` — comment updated: orders settle at `paid`, no fulfilment handoff

The deletion is clean at the application layer. However three artifacts remain that are now dead weight:

1. **`apps/web/.dev.vars.example`** still lists `PRINTFUL_API_KEY` and `PRINTFUL_WEBHOOK_SECRET` (lines visible in file). These should be removed to avoid confusing the deploy runbook.

2. **`supabase/migrations/20260616000001_merch_tracking.sql`** added `tracking_number`, `tracking_url`, and `carrier` columns to `merch_orders` for Printful shipping notifications. Those columns are now orphaned. The `orders/[id]` route (`apps/web/src/app/api/merch/orders/[id]/route.ts` lines 27–29) still reads and returns them. Since no path writes them anymore, they will always be null — wasted schema surface. `getMerchOrderByPodOrderId()` in `apps/web/src/lib/supabase/db.ts:1985` also becomes dead code.

3. The `merch_orders` table has a `pod_order_id` column (migration `20260615000003_merch_orders.sql`) which was the Printful reference key. It is also now permanently null.

**Verdict on the overall uncommitted change:** Coherent and landable as one commit. The two nits above (dead `.dev.vars.example` entries, orphaned schema columns) should be cleaned in the same commit rather than deferred.

### RLS Migration Fix (COHERENT — critical fix)

- `supabase/migrations/20240101000001_rls_policies.sql` — changes `auth.user_id()` → `public.user_id()`
- `supabase/migrations/20250115000001_push_tokens_and_wallet.sql` — same fix on push_tokens policies

This directly addresses SECURITY-AUDIT finding #17: the original migrations defined policies using `auth.user_id()` (in the `auth` schema), but the project helper lives in `public.user_id()`. Policies using the wrong schema reference silently matched nothing. This fix makes the policies active for the first time. Correct and necessary.

---

## 2. Webhook Security

### [MEDIUM] Green Invoice webhook secret transported in URL query string

**Severity:** MEDIUM
**Files:** `apps/web/src/app/api/merch/checkout/route.ts:160`, `apps/web/src/app/api/merch/webhook/route.ts:36–44`

The `isAuthentic()` helper in `webhook/route.ts` accepts the secret via either `?token=<secret>` query param or the `x-greeninvoice-token` header. The checkout route registers the notify URL with the secret embedded: `${origin}/api/merch/webhook?token=${encodeURIComponent(webhookSecret)}`. Cloudflare Workers observability is enabled (`wrangler.jsonc`), so the request URL — including the `?token=` value — is captured in Workers logs. Query-string secrets also land in CDN/proxy access logs and in the Green Invoice dashboard's webhook configuration UI.

The constant-time comparison itself (`timingSafeEqual` with a length guard) is correctly implemented. The weakness is purely transport.

For the Green Invoice card-on-file integration being planned, if the payment notification webhook uses the same pattern, the live card-charging secret will be in logs.

**Fix:** Pass the secret exclusively via the `x-greeninvoice-token` header; remove `?token=` from the registered notify URL. If Green Invoice does not support custom headers on the notify URL, use a signed HMAC of the payload body instead of a static bearer token.

### [GOOD] Merch webhook idempotency and fail-closed behavior

The `markMerchOrderPaid()` function in `apps/web/src/lib/supabase/db.ts:2031` performs an atomic `WHERE status='pending'` update — the loser of a concurrent delivery matches zero rows and returns `noop`. The webhook returns `500` on a DB error (to force Green Invoice retry) and `200` on idempotent replays. This pattern is correct and should be the template for the card-on-file webhook.

---

## 3. Supabase RLS Coverage

### [HIGH] auth.uid() in treasury and phone verification migrations — policies match nothing

**Severity:** HIGH (latent — masked by service-role-only access today)
**Files:**
- `supabase/migrations/20250116000001_treasury_and_issue_coins.sql:191,203`
- `supabase/migrations/20250119000001_phone_verifications.sql:103`

These migrations use Supabase's built-in `auth.uid()`, which returns NULL under the project's custom JWT auth (the project sets `app.current_user_id` via `set_claim`, not a Supabase auth session). The helper is `public.user_id()`. As a result:

- The policy "Users can see their own treasury transactions" (`USING user_id = auth.uid()`) has never matched any row for a real user.
- The treasury table policy "Treasury balances are publicly readable" (`USING true`) and the issue coins policy (`USING true`) expose those tables to any anon-key request with no restriction.
- The partial fix in the uncommitted change (`rls_policies.sql` and `push_tokens_and_wallet.sql`) correctly addresses the original migrations, but the three remaining affected migrations are not part of the current diff. They need the same `auth.uid()` → `public.user_id()` fix.

**Tables affected:** `treasury_transactions` (per-user SELECT), `issue_coin_holdings` (per-user SELECT), `phone_verifications` (per-user SELECT/INSERT/UPDATE).

**Fix:** Add a new migration that corrects these three files (cannot modify already-applied migrations in production). Each per-user policy: replace `auth.uid()` with `public.user_id()`.

### [RESOLVED in uncommitted change] merch_orders RLS

The `20260622000001_merch_orders_rls.sql` migration (`ALTER TABLE public.merch_orders ENABLE ROW LEVEL SECURITY`) is present in the working tree and closes the SECURITY-AUDIT finding #14. With RLS enabled and no policies, the anon key is denied entirely (which is the correct posture since all access goes through the service role). Confirmed coherent.

### [MEDIUM] Treasury transactions endpoint bypasses RLS and exposes all users' data

**Severity:** MEDIUM
**File:** `apps/web/src/app/api/treasury/[municipality]/transactions/route.ts`

The route uses the service-role client (which bypasses RLS) and calls `getTreasuryTransactions()` with no `user_id` filter. The response includes `userId` for every transaction. Any authenticated user can enumerate the full municipal deposit ledger, linking user IDs to their exact civic spending. This is a confirmed SECURITY-AUDIT finding (#6) that was deferred.

**Fix:** Either scope the query to the caller's `user_id` for non-admin requests, or strip `userId` from the response and expose only anonymized aggregates publicly. The RLS policy cannot help here because the service-role client bypasses it by design.

---

## 4. Environment / Secret Handling

### [MEDIUM] env.ts schema is inconsistent with actual runtime reads — validation gives false confidence

**Severity:** MEDIUM
**File:** `apps/web/src/lib/env.ts`

The Zod schema validates `SUPABASE_SERVICE_KEY` (line 14), but the Supabase admin client reads `SUPABASE_SERVICE_ROLE_KEY` (confirmed in `apps/web/src/lib/supabase/server.ts:10`). The schema validates a variable that nothing reads; the variable that is actually read is not validated. This is noted as a false-positive in SECURITY-AUDIT.md, but the naming divergence is real and means the fail-fast startup check does not cover the actual secret.

Additionally, `validateEnv()` is defined in `env.ts` but is never called from any application entry point (no imports of `validateEnv` or `getServerEnv` appear outside `env.ts` itself). The env validation is effectively dead code.

**Fix:** Rename `SUPABASE_SERVICE_KEY` to `SUPABASE_SERVICE_ROLE_KEY` in the schema (and in `.env.example` / `.dev.vars.example`), and call `validateEnv()` from the application entry (e.g., `apps/web/src/app/layout.tsx` or a startup module) so the fail-fast actually runs.

### [LOW] Green Invoice vars not in env.ts schema but Paddle vars still required

**Severity:** LOW
**File:** `apps/web/src/lib/env.ts`

`GREENINVOICE_API_KEY_ID`, `GREENINVOICE_API_SECRET`, `GREENINVOICE_PLUGIN_ID`, and `GREENINVOICE_WEBHOOK_SECRET` are read at runtime by `apps/web/src/app/api/merch/checkout/route.ts` and `apps/web/src/app/api/merch/webhook/route.ts` via bare `process.env.*` reads (no schema validation). Meanwhile the schema still requires all four Paddle vars (`PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_PRICE_VOTE_PARTICIPATION`, `PADDLE_PRICE_VOTE_CREATION`) which are correct for the vote-payment flow and must stay.

For the Green Invoice card-on-file integration: add all required GI vars to the schema so missing creds cause a startup error rather than a runtime 500 in the checkout handler.

### [LOW] Redundant AUTH0_DOMAIN variable validated but never consumed

**Severity:** LOW
**File:** `apps/web/src/lib/env.ts:20`

The schema validates `AUTH0_DOMAIN` (non-public), but `apps/web/src/services/auth/auth0.ts` reads `NEXT_PUBLIC_AUTH0_DOMAIN` directly. The validated-but-unread `AUTH0_DOMAIN` var creates deploy confusion (an operator setting only `NEXT_PUBLIC_AUTH0_DOMAIN` will hit startup failure from the schema). Either remove `AUTH0_DOMAIN` from the schema or route `auth0.ts` through `getServerEnv().AUTH0_DOMAIN` for server-side calls.

---

## 5. Paddle Code — Removal Scope

Paddle is the correct payment rail for digital vote fees (₪3 participation, ₪50 creation) and must not be removed. The concern is ensuring no Paddle code surfaces in the merch/Green Invoice flow.

**Current state (clean):** No Paddle imports exist in `apps/web/src/app/api/merch/` after the Printful cleanup. The webhook at `apps/web/src/app/api/payments/webhook/route.ts` handles only vote-related payments. The Green Invoice merch checkout (`apps/web/src/app/api/merch/checkout/route.ts`) uses `GREENINVOICE_*` vars with no Paddle dependency.

**One schema artifact:** `apps/web/src/app/api/payments/create/route.ts:198` returns `paymentProvider: 'paddle'` in the pricing endpoint response — this correctly describes the vote-payment rail and should stay.

**What to watch for when adding card-on-file:** Green Invoice card-on-file payments for votes (if replacing Paddle for the ₪3/₪50 flow) would require changing `apps/web/src/app/api/payments/create/route.ts` and `apps/web/src/app/api/payments/webhook/route.ts`. If coexisting, the webhook will need to differentiate event sources (Paddle signature header vs GI token) and route accordingly — do not mix fulfilment logic in one handler without a clear dispatch.

---

## 6. Money / Treasury Ledger Integrity Gaps

### [HIGH — partially fixed] Double-credit on Paddle multi-event delivery

**Severity:** HIGH
**Files:** `apps/web/src/app/api/payments/webhook/route.ts:92–206`, `apps/web/src/lib/supabase/db.ts:539`

SECURITY-AUDIT finding #1. The partial fix already in the codebase:
- `apps/web/src/lib/supabase/db.ts` has `markPaymentCompleted()` with an atomic `WHERE status='pending'` guard (line 539 comment confirms this is the gating function).
- `supabase/migrations/20260616000002_treasury_idempotency.sql` adds `UNIQUE INDEX uq_treasury_tx_payment ON treasury_transactions(payment_id)`, so `record_treasury_deposit()` raises on a duplicate and rolls back the balance increment.

**Remaining gap:** The `createEntitlement()` call (webhook line 150) and `qubikService.mintTokens()` (line 161) are guarded only by the `markPaymentCompleted()` return value — if `markPaymentCompleted()` correctly returns null for the loser, these are not called. Review that `markPaymentCompleted()` truly returns null (not a truthy value) when the `WHERE status='pending'` clause matches zero rows. SECURITY-AUDIT finding #4 (double-mint) is resolved if and only if the `claimed` check at line 113 short-circuits before reaching the entitlement/mint block. Verify this path under concurrent load before going live with real money.

**For the Green Invoice card-on-file integration:** The `markMerchOrderPaid()` pattern (atomic status guard + distinct error/noop/updated results) is the correct model. Mirror it exactly for any new payment type: gate all treasury ledger writes on the single atomic DB transition, not on a prior status read.

### [HIGH] Treasury transactions endpoint leaks all users' spending data

See section 3. The fix is a `user_id` filter on the service-role query or stripping `userId` from the public response.

### [MEDIUM] Bags.fm swap trusts client-supplied quote verbatim

**Severity:** MEDIUM
**Files:** `apps/web/src/app/api/bags/swap/route.ts:35–71`, `apps/web/src/services/bags/index.ts:215–241`

The swap endpoint accepts the entire quote object from the request body and forwards it to Bags.fm. `inputAmount`, `outputAmount`, and `fee` are fully attacker-controlled. If Bags.fm trusts the relayed fee accounting, the platform fee share to the municipality treasury can be understated.

**Fix:** Re-fetch a fresh quote server-side from Bags.fm using the user's stated input params and execute that quote, ignoring the client-supplied numbers.

### [INFO] Payment idempotency key includes `Date.now()` — server-side dedup is ineffective unless client sends a stable key

**Severity:** INFO
**File:** `apps/web/src/app/api/payments/create/route.ts:77`

When `idempotencyKey` is absent from the request body, the server generates `${user.id}-${type}-${voteId||'create'}-${Date.now()}`. Every retry produces a new key; the dedup check at line 80 never matches. A double-tapping user accumulates multiple `pending` payments/Paddle transactions for one intent.

**Fix:** Derive the default key deterministically: `${user.id}-${type}-${voteId||'create'}-${optionId||''}`. This is especially important for the card-on-file flow where a network error may cause a retry.

---

## 7. Auth Migration Gaps

### [MEDIUM] OAuth callback performs no server-side state validation — login CSRF remains

**Severity:** MEDIUM
**Files:** `apps/web/src/app/api/auth/callback/route.ts`, `apps/web/src/services/auth/auth0.ts`

The Auth0 migration replaced the Google direct flow but did not add the missing server-side state binding. The `state` parameter is generated and stored in `sessionStorage` client-side, but the callback route (`POST /api/auth/callback`) reads only `code` from the request body and never validates `state`. A classic login-CSRF attack remains viable: an attacker completes Auth0 login for their own account, captures the `code`, and tricks a victim into POSTing it. The victim logs into the attacker's account.

The social-connect callbacks (`apps/web/src/app/api/social/callback/facebook/route.ts`) DO verify a signed JWT state — the same pattern should be applied here.

**Fix:** Generate a signed state token server-side at sign-in initiation (reuse `lib/oauth-state.createOAuthState`), store it in an HttpOnly cookie, include it in the Auth0 `/authorize` URL, and verify it in the callback before exchanging the code. Add PKCE (S256 `code_challenge` at init, `code_verifier` at exchange) for defence-in-depth.

### [MEDIUM] Google `google.ts` service is still imported by `auth0.ts` — creates a legacy dependency

**Severity:** LOW
**File:** `apps/web/src/services/auth/auth0.ts:19`

`auth0.ts` imports `generateOAuthState` and `storeOAuthState` from `./google` (the legacy service). The `google.ts` file contains the client-side Google-specific auth URL builder and is still present in the codebase. The dependency is harmless in practice, but it means `google.ts` cannot be removed without also updating `auth0.ts`. If the intent is to fully decommission the direct Google flow, both files need to be updated together.

---

## 8. Fragile Areas

### merch_orders tracking columns — orphaned after Printful deletion

**Files:** `supabase/migrations/20260616000001_merch_tracking.sql`, `apps/web/src/app/api/merch/orders/[id]/route.ts:27–29`, `apps/web/src/lib/supabase/db.ts:1985`

`tracking_number`, `tracking_url`, `carrier`, and `pod_order_id` are schema columns that will permanently be null. `getMerchOrderByPodOrderId()` is unreachable dead code. These create confusion about the intended order lifecycle and should be dropped in a migration if POD is definitively abandoned, or documented as reserved for a future provider.

### RLS function namespace inconsistency — `auth.user_id` vs `public.user_id`

**Files:** `supabase/migrations/20250116000001_treasury_and_issue_coins.sql`, `supabase/migrations/20250119000001_phone_verifications.sql`

Three migrations were applied in production with `auth.uid()` policies that silently never match. Once the forthcoming Green Invoice card-on-file flow writes treasury_transactions rows, these rows will be readable by any anon-key caller (via the `USING true` policies on `treasury`) but the per-user SELECT policy on `treasury_transactions` will deny legitimate owner reads. The fix requires a new corrective migration (cannot edit applied migrations).

### Cron endpoints use plain string equality for secret comparison

**Files:** `apps/web/src/app/api/cron/resolve-votes/route.ts:35`, `apps/web/src/app/api/cron/verification-notifications/route.ts:38`, `apps/web/src/app/api/cron/mint-nfts/route.ts:25`

These state-mutating routes (vote resolution, NFT minting) compare the `CRON_SECRET` with `!==` — not constant-time. The pattern is inconsistent with the merch and Paddle webhook routes, which use `timingSafeEqual`. Extract a shared `timingSafeStringEqual` helper and use it in all three.

### Bags.fm webhook verifier will throw on mismatched-length signatures

**File:** `apps/web/src/services/bags/index.ts:286–306`

`verifyWebhookSignature()` calls `crypto.timingSafeEqual()` without a length guard. Any signature whose byte length differs from the expected HMAC hex digest length throws a `RangeError` rather than returning `false`. This function is currently dead (no Bags webhook route exists), but if a route is added it will cause 500s on malformed requests. Apply the same length-guard pattern used in the merch webhook: `const a = Buffer.from(sig, 'hex'); const b = Buffer.from(expected, 'hex'); if (a.length !== b.length) return false; return timingSafeEqual(a, b);`

---

## 9. Test Coverage Gaps

### Auth flow: CSRF state validation not tested because it doesn't exist yet

The auth callback tests (`apps/web/src/__tests__/api/auth-callback.test.ts`) correctly cover the four paths (missing code, missing secret, new user, existing user). They do not test state validation because the server never validates state. Once the login-CSRF fix is implemented (see section 7), the tests must be extended to cover valid and invalid state values.

### Treasury webhook — no test for the new card-on-file scenario

There are no tests for the treasury ledger deposit path triggered by the GI webhook (`apps/web/src/app/api/merch/webhook/route.ts`). The merch webhook tests cover `markMerchOrderPaid` idempotency, but once card-on-file payments credit the treasury ledger directly, the treasury debit/credit path needs its own test suite covering concurrent delivery, replay, and amount validation.

### Unbounded vote queries — no pagination tests

The `getActiveVotes()` and `getVotesByMunicipality()` functions have no `.limit()` (SECURITY-AUDIT finding #15). There are no tests exercising the API with a large result set. As the platform scales, these will become a memory/cost vector. Tests should be added that mock large result sets and verify client-enforced caps.

---

## 10. Security Findings Status Summary

| Finding | Severity | Status |
|---------|----------|--------|
| Treasury double-credit on Paddle multi-event | HIGH | Partially fixed (atomic markPaymentCompleted + UNIQUE index). Verify entitlement/mint gating under concurrency. |
| GPS spoofing at vote time | HIGH | Fixed: server-side verifyCheckIn at participate. |
| OAuth login CSRF / no server-side state | MEDIUM | NOT FIXED — Auth0 migration preserved the gap. |
| Double-mint SYNC tokens on re-fire | MEDIUM | Depends on markPaymentCompleted atomic guard — verify. |
| Webhook secret in URL query string | MEDIUM | NOT FIXED — still embedded in Green Invoice notify URL. Critical before card-on-file launch. |
| Treasury transactions leaks all users' data | MEDIUM | NOT FIXED — service-role bypass, no user filter. |
| auth.uid() vs public.user_id() in 3 migrations | LOW | Partially fixed (2 of 5 migrations updated in uncommitted diff). 3 remain. |
| merch_orders has no RLS | LOW | FIXED — uncommitted migration enables RLS. |
| Cron routes non-constant-time secret compare | LOW | NOT FIXED. |
| HTML injection in refund email | LOW | NOT FIXED. |
| Stored XSS via vote title in transactional emails | LOW | NOT FIXED. |
| OTP brute-force via re-send reset | LOW | NOT FIXED. |
| Bags swap trusts client quote | LOW | NOT FIXED. |
| Resolution endpoint leaks raw error | LOW | NOT FIXED. |
| Payment idempotency key uses Date.now() | INFO | NOT FIXED. Important for card-on-file retries. |
| Logger does not redact secrets | INFO | NOT FIXED. |

---

*Concerns audit: 2026-06-28. Reference: SECURITY-AUDIT.md (2026-06-16), HANDOVER.md (2026-06-16).*
