# Architecture

**Analysis Date:** 2026-06-28

## Pattern Overview

**Overall:** Layered server-side monolith — Next.js App Router on Cloudflare Workers (via OpenNext adapter). No BFF separation. API routes are thin HTTP handlers that either call service clients (external APIs) or DB helpers (Supabase) directly.

**Key Characteristics:**
- All server logic lives in `apps/web/src/` — no separate backend service
- API routes never call each other; they compose from services + DB helpers
- Client components never call Supabase directly — always go through API routes
- Two payment rails coexist: Paddle (vote fees) and Green Invoice (merch/ILS)
- Treasury is a pure ledger in Supabase; Bags.fm (Solana) integration is async at vote resolution
- Custom JWT session — no Clerk, no Supabase Auth session; Supabase is DB-only

## Layers

**API Routes:**
- Purpose: Parse HTTP request, authenticate, delegate, return response
- Location: `apps/web/src/app/api/`
- Pattern: Each subdirectory is a resource group (`auth/`, `payments/`, `merch/`, `votes/`, `user/`, `treasury/`, `bags/`, `social/`, `verification/`, `cron/`)
- Depends on: `@/services/*`, `@/lib/supabase/db`, `@/lib/logger`
- Used by: Browser, mobile app, external webhooks (Paddle, Green Invoice), cron (Cloudflare scheduled triggers)

**Services Layer:**
- Purpose: Thin clients wrapping external APIs — no business logic, no DB calls
- Location: `apps/web/src/services/`
- Subdirectories:
  - `auth/` — `auth0.ts` (OIDC code exchange + userinfo), `session.ts` (JWT sign/verify/cookies), `google.ts`/`facebook.ts`/`instagram.ts` (OAuth helpers)
  - `payments/` — `paddle.ts` (transaction creation, HMAC webhook verification, event parsing)
  - `greenInvoice/` → `index.ts` (hosted payment form creation, token caching, ILS payment rail)
  - `treasury/` — `bagSeeding.ts` (ILS→SOL conversion, Bags.fm Issue Coin launch at vote resolution)
  - `bags/` — Bags.fm API client (Solana/Issue Coin operations)
  - `qubik/` — SYNC token minting
  - `email/` — Resend transactional email
  - `nft/` — NFT minting via Qubik
  - `notifications/expo/` — Expo push notifications
  - `sms/otp/` — OTP via Workers KV (replaces Twilio)
  - `verification/municipality/` — identity verification logic

**DB Helpers:**
- Purpose: All Supabase operations, one function per query, typed via `Database` interface
- Location: `apps/web/src/lib/supabase/db.ts` (single file, ~2050 lines)
- Pattern: Named exports, each wraps `supabaseAdmin` calls with null/error coercion. Never throws for missing rows (returns null); throws for constraint failures.
- Result monads: `markMerchOrderPaid` returns `MarkPaidResult = 'updated' | 'noop' | 'error'`; `requestPaymentRefund` returns `RefundRequestResult` union string
- Depends on: `apps/web/src/lib/supabase/server.ts` (`supabaseAdmin`), `apps/web/src/lib/supabase/types.ts`

**Supabase Clients:**
- Server-only (bypasses RLS): `apps/web/src/lib/supabase/server.ts` — `supabaseAdmin` created with `SUPABASE_SERVICE_ROLE_KEY`. Import only inside `src/app/api/` or `src/services/`.
- Client-side (respects RLS): `apps/web/src/lib/supabase/client.ts` — `supabase` created with anon key. Used by browser-side hooks/providers.

**Shared Types:**
- Location: `packages/shared/src/types/`
- Used by both web API and mobile app via `@sync/shared` alias

## Data Flow

**Paddle Vote-Payment Webhook (primary fulfilment path):**

1. Paddle fires `POST /api/payments/webhook` with HMAC-signed payload
2. `paddleService.verifyWebhookSignature()` validates HMAC + timestamp freshness (5 min window)
3. `createWebhookEvent()` inserts a `pending` row in `webhook_events` — unique constraint on `event_id` blocks concurrent duplicate deliveries
4. `markPaymentCompleted()` does atomic `UPDATE payments SET status='completed' WHERE status='pending'` — only the winner of concurrent deliveries fulfils
5. `recordTreasuryDeposit()` calls the SQL RPC `record_treasury_deposit()` — atomically increments `treasury.balance_ils` and inserts a `treasury_transactions` deposit row tagged with `vote_id`; a unique index on `payment_id` prevents double-credit
6. `createEntitlement()` records the user's right to vote
7. `qubikService.mintTokens()` mints SYNC tokens (best-effort; failure logged, not fatal)
8. If `vote_participation`: `recordUserVote()` + `incrementVoteOption()` write the ballot atomically
9. `emailService.sendPaymentReceiptEmail()` sends Resend receipt (best-effort)
10. `updateWebhookEventStatus(eventId, 'processed')` closes the dedup record

**Green Invoice Merch Checkout + Webhook:**

1. `POST /api/merch/checkout` — requires session (auth cookie), re-prices cart against `lib/merch/catalog.ts` (server-side catalogue; client cannot set price), generates UUID order
2. `createMerchOrder()` persists to `merch_orders` with `status='pending'`
3. `createPaymentForm()` in `services/greenInvoice/index.ts` exchanges API key for short-lived JWT (cached in-module), posts to Green Invoice `/payments/form`, returns redirect URL with `custom=orderId`
4. Green Invoice fires `POST /api/merch/webhook?token=<secret>` after payment
5. `isAuthentic()` does timing-safe comparison of `?token` query param (or `x-greeninvoice-token` header) against `GREENINVOICE_WEBHOOK_SECRET`
6. `getMerchOrderById(orderId)` fetches by the `custom` field
7. `markMerchOrderPaid(orderId, paymentId)` atomically flips `pending → paid` — concurrent replays return `noop`, transient DB failures return `error` (non-200 triggers Green Invoice retry)

**Auth / Session Flow:**

1. Client calls `buildAuth0AuthUrl()` (`services/auth/auth0.ts`) → redirects to Auth0 Universal Login
2. Auth0 redirects back with `?code=`; mobile/web POSTs code to `POST /api/auth/callback`
3. `exchangeCodeForTokens(code, redirectUri, clientSecret)` — server-to-server call to Auth0 `/oauth/token`
4. `getAuth0UserInfo(accessToken)` fetches OIDC standard claims including `sub` (e.g. `google-oauth2|123`)
5. `getUserByGoogleId(sub)` looks up existing user in Supabase by `users.google_id` (column holds Auth0 subject, not a raw Google id)
6. New user: `generateEncryptedDID()` → `createUser()` → `upsertSocialProof()` (persists `provider='google'`)
7. Existing user: `updateUser()` updates `updated_at`
8. `createSessionToken()` signs a HS256 JWT via `jose` (`userId`, `googleId`=Auth0 sub, `did`, `email`). Expiry from `JWT_EXPIRY` env (default `7d`)
9. `createRefreshToken()` signs a 30-day JWT containing only `userId`
10. `setSessionCookies()` sets `sync-session` and `sync-refresh` as `httpOnly; secure; sameSite=lax` cookies
11. Subsequent requests: `getSessionFromRequest()` checks `Authorization: Bearer` header first, then `sync-session` cookie → `verifySessionToken()` → `Session` object

**Treasury / Bags Seeding (at vote resolution):**

1. Cron `POST /api/cron/resolve-votes` identifies ended votes
2. `bagSeedingService.seedVoteBag(voteId)` in `services/treasury/bagSeeding.ts` runs
3. `getAccruedIlsForVote(voteId)` sums `treasury_transactions` where `vote_id = voteId AND type = 'deposit' AND status = 'confirmed'`
4. Converts agorot → SOL using `TREASURY_ILS_PER_SOL` FX rate
5. Calls Bags.fm API to launch Issue Coin for the vote
6. `createIssueCoin()` persists mint address to `issue_coins`
7. `recordTreasuryTransaction()` writes `allocation` + `token_purchase` audit rows

## Key Abstractions

**`supabaseAdmin` (service-role client):**
- Location: `apps/web/src/lib/supabase/server.ts`
- Bypasses all RLS. Only used server-side. Every API route imports DB helpers from `db.ts` which use this internally.
- `withUserContext(userId)` sets `user_id` claim so RLS can still be selectively applied.

**`db.ts` DB Helper module:**
- Location: `apps/web/src/lib/supabase/db.ts`
- Pattern: one named export per operation. Grouped by table (USER OPERATIONS, PAYMENT OPERATIONS, MERCH ORDER OPERATIONS, etc.). No ORM — raw Supabase query builder.
- Atomic mutations use `.eq('status', 'pending')` guards in the same `.update()` call — e.g., `markPaymentCompleted`, `markMerchOrderPaid`.

**Result Monads:**
- `MarkPaidResult = { kind: 'updated'; row } | { kind: 'noop' } | { kind: 'error' }` — used by `markMerchOrderPaid`
- `RefundRequestResult = 'ok' | 'not_found' | 'not_refundable' | 'already_requested' | 'error'` — used by `requestPaymentRefund`
- Webhook routes pattern: check result kind, return appropriate HTTP status

**Logger (child pattern):**
- Location: `apps/web/src/lib/logger.ts`
- `logger.child({ component: 'webhook' })` returns a pre-tagged logger. Pre-exported: `webhookLogger`, `cronLogger`, `authLogger`, `paymentLogger`, `verificationLogger`
- Dev: pretty colored output. Prod: JSON to stdout (Cloudflare captures)

**Session:**
- Shape: `{ userId, googleId (Auth0 sub), did, email, expiresAt }`
- `requireAuth(request)` throws if no valid session — use in protected API routes
- `getSessionFromRequest(request)` returns null if unauthenticated — use in optional-auth routes (e.g., merch checkout)

## Entry Points

**Web API Routes:**
- Location: `apps/web/src/app/api/**/**/route.ts`
- Pattern: Named exports `GET`, `POST`, `PATCH`, `DELETE`. Each file handles exactly one route.

**Cron (Cloudflare Scheduled Triggers):**
- Location: `apps/web/src/app/api/cron/`
- Routes: `mint-nfts/route.ts`, `resolve-votes/route.ts`, `verification-notifications/route.ts`
- Entry via `worker.ts` scheduled handler (not HTTP — fired by Cloudflare `triggers.crons` in `wrangler.jsonc`)

**Next.js Root Layout:**
- `apps/web/src/app/layout.tsx` — minimal pass-through for i18n
- `apps/web/src/app/[locale]/layout.tsx` — actual HTML/body with locale (`he` only currently), fonts, providers

## Error Handling

**Strategy:** Route-level try/catch, structured logging, HTTP status mapping. Services throw; routes catch and translate to JSON error responses.

**Patterns:**
- Webhook routes: non-fatal failures (email, token mint) are caught individually and logged; the route still returns 200 so the provider doesn't retry
- Transient DB failures in merch webhook: return 500 to trigger Green Invoice retry
- Treasury deposit failure: non-fatal (logged, reconcilable from `payments` + `webhook_events` tables)
- Env validation at startup via Zod schema in `apps/web/src/lib/env.ts` — throws with descriptive message on missing vars

## Cross-Cutting Concerns

**Logging:** `apps/web/src/lib/logger.ts` — `createLogger()` factory, child loggers per component. JSON in production.

**Validation:** Zod schemas in `apps/web/src/lib/env.ts` for env vars. Manual validation in route bodies (inline type guards). `resolveVariant()` in `lib/merch/catalog.ts` for cart server-repricing.

**Authentication:** `requireAuth(request)` or `getSessionFromRequest(request)` at the top of each API route handler. Session is JWT in `sync-session` cookie or `Authorization: Bearer` header.

**Idempotency:** `webhook_events` table with unique `event_id` for Paddle; `status='pending'` guard in same UPDATE for merch; unique index `uq_treasury_tx_payment` on `treasury_transactions.payment_id` for treasury.

**RLS:** All tables have RLS enabled. `merch_orders` has RLS enabled with zero policies (denies anon key entirely). Other tables have service-role full-access policies + selective user-owned read policies. `supabaseAdmin` (service role) bypasses RLS in all API routes.

---

*Architecture analysis: 2026-06-28*
