# External Integrations

**Analysis Date:** 2026-06-28

---

## Authentication & Identity

### Auth0 — Primary Login (IN PROGRESS)

**Status:** In progress — newly added, not yet merged to main.

Auth0 Universal Login (OIDC Authorization Code flow) replaces the previous direct Google OAuth as the primary identity provider. Auth0 federates the underlying social IdP (Google), so the user still signs in with Google but the app receives an Auth0 `sub` (e.g. `google-oauth2|123...`) as the external identity key.

- Service: `apps/web/src/services/auth/auth0.ts` (new, uncommitted working-tree file)
- Callback handler: `apps/web/src/app/api/auth/callback/route.ts` (updated to use Auth0)
- Client-side sign-in: `apps/web/src/providers/AuthProvider.tsx` — `signInWithGoogle()` now redirects to `https://${AUTH0_DOMAIN}/authorize`
- The Auth0 `sub` is stored in the existing `users.google_id` column — column name is unchanged to avoid migrating every consumer
- Identity score: 40 points (Google-via-Auth0)
- CSRF state: shared with the legacy Google service helpers (`generateOAuthState`, `storeOAuthState` from `apps/web/src/services/auth/google.ts`)

**Env vars:**
```
AUTH0_DOMAIN=               # e.g. your-tenant.eu.auth0.com (no trailing slash)
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
NEXT_PUBLIC_AUTH0_DOMAIN=   # same value, exposed to browser for /authorize URL
NEXT_PUBLIC_AUTH0_CLIENT_ID=
```

---

### Google OAuth — Legacy Direct Integration (BEING REMOVED)

**Status:** Replaced by Auth0. Service file `apps/web/src/services/auth/google.ts` still present (its CSRF helpers are imported by `auth0.ts`). Direct Google env vars are commented out in `.dev.vars.example`.

- Service: `apps/web/src/services/auth/google.ts`
- Env vars (all now commented/removed): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

---

### Custom JWT Sessions

**Status:** Working — core session layer used by all API routes.

Custom JWT-based sessions implemented with `jose` (no Supabase Auth, no NextAuth). Sessions are set as HTTP-only cookies.

- Service: `apps/web/src/services/auth/session.ts`
- Cookie names: `sync-session` (access), `sync-refresh` (refresh)
- Expiry: `JWT_EXPIRY` env (default 7d)
- Token shape: `{ userId, googleId (now Auth0 sub), did, email }`

**Env vars:**
```
JWT_SECRET=    # min 32 chars
JWT_EXPIRY=7d
```

---

### Facebook OAuth — Social Proof (WORKING)

**Status:** Working. Adds 20 identity score points.

- Service: `apps/web/src/services/auth/facebook.ts`
- Routes: `apps/web/src/app/api/social/connect/facebook/route.ts`, `apps/web/src/app/api/social/callback/facebook/route.ts`
- Scope: `email,public_profile`
- Graph API v18.0

**Env vars:**
```
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
EXPO_PUBLIC_FACEBOOK_APP_ID=   # mobile
```

---

### Instagram OAuth — Social Proof (WORKING)

**Status:** Working. Adds 20 identity score points.

- Service: `apps/web/src/services/auth/instagram.ts`
- Routes: `apps/web/src/app/api/social/connect/instagram/route.ts`, `apps/web/src/app/api/social/callback/instagram/route.ts`

**Env vars:**
```
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
EXPO_PUBLIC_INSTAGRAM_APP_ID=   # mobile
```

---

## Data Storage

### Supabase — Primary Database (WORKING)

**Status:** Working. Core data layer. All tables, RLS policies, and functions managed via migration files in `supabase/migrations/`.

Two client instances:
- Browser client (anon key, RLS enforced): `apps/web/src/lib/supabase/client.ts` — used in client components
- Server admin client (service role key, bypasses RLS): `apps/web/src/lib/supabase/server.ts` — used in all API routes

Session management is custom (not Supabase Auth). Supabase is purely the Postgres layer.

**Key migrations:**
- `20240101000000_initial_schema.sql` — base tables
- `20240101000001_rls_policies.sql` — RLS (modified in working tree)
- `20250115000001_push_tokens_and_wallet.sql` — push token + wallet columns
- `20250120000001_paddle_payment_provider.sql` — payment records
- `20260615000003_merch_orders.sql` — merch order table
- `20260622000001_merch_orders_rls.sql` — merch RLS (uncommitted)

**Env vars:**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

### Cloudflare Workers KV — Phone OTP Storage (WORKING)

**Status:** Working in production. In-memory fallback for `next dev` without binding.

Phone OTP codes (SHA-256 hashed, never plaintext) are stored in Workers KV with native TTL (10 minutes). This replaced the previous Twilio Verify managed product.

- Store: `apps/web/src/services/sms/store.ts`
- OTP logic: `apps/web/src/services/sms/otp.ts`
- KV binding name: `OTP_KV`
- KV namespace id: `6f3f1d0e88df41d18773165a406b86b6` (set in `apps/web/wrangler.jsonc`)
- Fallback: per-isolate in-memory Map — dev/test only, not viable across isolates in prod

No env vars needed; binding resolved at runtime via `getCloudflareContext().env.OTP_KV`.

---

## Payments

### Paddle — Digital Vote Fees (WORKING)

**Status:** Working. Merchant of Record for vote participation (₪3) and vote creation (₪200).

- Service: `apps/web/src/services/payments/paddle.ts`
- Routes: `apps/web/src/app/api/payments/create/route.ts`, `apps/web/src/app/api/payments/[id]/status/route.ts`, `apps/web/src/app/api/payments/refund/route.ts`, `apps/web/src/app/api/payments/webhook/route.ts`
- Creates Paddle Transactions via REST API; returns hosted checkout URL
- Webhook verification: HMAC-SHA256 on `ts:rawBody` (`Paddle-Signature` header), 5-minute clock-skew guard
- Webhook events handled: `transaction.completed`, `transaction.paid`, `transaction.payment_failed`, `adjustment.created`
- Refunds: issued via Paddle Adjustments API (`/adjustments`, `action: refund`, `type: full`)
- Sandbox vs production controlled by `PADDLE_ENV` (set in `wrangler.jsonc` vars for production)

**Env vars:**
```
PADDLE_API_KEY=
PADDLE_WEBHOOK_SECRET=
PADDLE_PRICE_VOTE_PARTICIPATION=    # pri_...
PADDLE_PRICE_VOTE_CREATION=         # pri_...
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=    # optional, for overlay checkout
PADDLE_ENV=sandbox|production       # non-secret, in wrangler.jsonc vars
```

**Webhook endpoint:** `POST /api/payments/webhook`

---

### Green Invoice (morning) — Merch Store Payment (WORKING)

**Status:** Working. Israeli Merchant of Record for physical merch orders. Collects ILS, auto-issues tax receipt/invoice.

- Service: `apps/web/src/services/greenInvoice/index.ts`
- Checkout route: `apps/web/src/app/api/merch/checkout/route.ts`
- Webhook: `apps/web/src/app/api/merch/webhook/route.ts`
- Auth: exchanges `GREENINVOICE_API_KEY_ID` + `GREENINVOICE_API_SECRET` for a short-lived JWT (`/account/token`); cached in-memory
- Payment form: type 320 (payment request that auto-issues receipt on success)
- Webhook auth: shared secret in `?token=<GREENINVOICE_WEBHOOK_SECRET>` on the notify URL (also accepted via `x-greeninvoice-token` header); fails CLOSED in production if unset
- Order payload carries `custom: order.id` so the webhook can look up the order
- Dev mode: when `isGreenInvoiceConfigured()` returns false, checkout returns a mock thank-you URL

**Env vars:**
```
GREENINVOICE_API_KEY_ID=
GREENINVOICE_API_SECRET=
GREENINVOICE_PLUGIN_ID=            # optional payment terminal id
GREENINVOICE_WEBHOOK_SECRET=       # must be set in production
GREENINVOICE_ENV=sandbox|production  # non-secret, in wrangler.jsonc vars
```

**Webhook endpoint:** `POST /api/merch/webhook`

---

### Printful — Print-on-Demand Fulfillment (REMOVED)

**Status:** Removed in the current working tree.

Previously handled POD fulfillment handoff for paid merch orders. Both the service and the fulfillment webhook route have been deleted. Merch orders now settle permanently at `paid` status with no downstream handoff.

- Deleted service: `apps/web/src/services/fulfillment/printful.ts`
- Deleted route: `apps/web/src/app/api/merch/fulfillment-webhook/route.ts`
- Deleted test: `apps/web/src/__tests__/api/merch-fulfillment-webhook.test.ts`, `apps/web/src/__tests__/services/printful.test.ts`
- Env vars `PRINTFUL_API_KEY`, `PRINTFUL_WEBHOOK_SECRET` remain in `.env.example` as documentation; safe to remove

---

## Blockchain & Web3

### Bags.fm — SocialFi / Issue Coins (WORKING)

**Status:** Working. Used to launch per-vote community tokens (Issue Coins) on resolution and to enable token trading.

- Service: `apps/web/src/services/bags/index.ts`
- Routes: `apps/web/src/app/api/bags/quote/route.ts`, `apps/web/src/app/api/bags/swap/route.ts`, `apps/web/src/app/api/bags/trending/route.ts`
- Treasury seeding: `apps/web/src/services/treasury/bagSeeding.ts`
- API base: `https://public-api-v2.bags.fm/api/v1` (x-api-key auth)
- Fee split per resolved vote: 10% platform, 10% creator, 80% municipality treasury
- Wallet keypair (`BAGS_MASTER_WALLET_PRIVATE_KEY`) is also reused as the Solana cNFT minter keypair
- Webhook verification: HMAC-SHA256 with `timingSafeEqual`

**Env vars:**
```
BAGS_API_KEY=
BAGS_WEBHOOK_SECRET=
BAGS_MASTER_WALLET_ADDRESS=          # Solana public key
BAGS_MASTER_WALLET_PRIVATE_KEY=      # base58 or JSON byte array
```

---

### Solana + Metaplex Bubblegum — Compressed NFT Certificates (WORKING)

**Status:** Working when all three env vars are present. Soft-skips (records stay `pending`) when any are absent.

Mints commemorative certificates as compressed NFTs (cNFTs) into a Bubblegum merkle tree. RPC is Helius (also used for DAS reads).

- Service: `apps/web/src/services/nft/solana.ts`
- Metadata pinning: `apps/web/src/services/nft/pinata.ts` → IPFS via Pinata
- Cron trigger: `POST /api/cron/mint-nfts`
- Minter keypair: reuses `BAGS_MASTER_WALLET_PRIVATE_KEY` (base58 or JSON array)

**Env vars:**
```
SOLANA_RPC_URL=      # Helius mainnet, e.g. https://mainnet.helius-rpc.com/?api-key=...
SOLANA_MERKLE_TREE=  # Bubblegum tree address
PINATA_JWT=          # Pinata API JWT for IPFS pinning
# minter keypair = BAGS_MASTER_WALLET_PRIVATE_KEY (shared)
```

---

### Qubik — Legacy Vote Blockchain (PRESENT, BEING PHASED OUT)

**Status:** Present but likely being replaced by Solana per stack decisions (memory: "chain=Solana (drop qubik)"). Optional in dev (`QUBIK_API_KEY` schema field is `.optional()`).

- Service: `apps/web/src/services/qubik/index.ts`
- Used for vote recording and SYNC token minting (legacy path)
- Env: `QUBIK_API_KEY` (optional), `QUBIK_NETWORK=mainnet` (set in wrangler.jsonc vars)

---

## Email & Notifications

### Resend — Transactional Email (WORKING)

**Status:** Working. `isConfigured()` guard — degrades silently if `RESEND_API_KEY` is absent.

- Service: `apps/web/src/services/email/index.ts`
- SDK: `resend` ^4.0.0
- From address: `noreply@taruu.co.il`
- Templates: welcome, vote notification, vote created, vote results, payment receipt, refund request notification
- Refund notifications sent to `support@taruu.co.il` with `replyTo` set to requester email

**Env vars:**
```
RESEND_API_KEY=
```

---

### SMS OTP — Phone Verification (WORKING / MOCK-DEGRADES)

**Status:** Working with any SMS REST API pointed to via `SMS_API_URL`. Unset = mock-degrade (routes return 503, client soft-passes). Twilio Verify was removed and replaced by this in-app OTP system.

- OTP logic: `apps/web/src/services/sms/otp.ts`
- Transport: `apps/web/src/services/sms/sender.ts` — provider-agnostic HTTP `{ to, from, text }` body
- Routes: `apps/web/src/app/api/user/phone/send-code/route.ts`, `apps/web/src/app/api/user/phone/verify/route.ts`
- Code: 6-digit, SHA-256 hashed in KV, 10-minute TTL, max 5 attempts

**Env vars:**
```
SMS_API_URL=     # any SMS REST API endpoint
SMS_API_KEY=     # bearer token
SMS_FROM=        # sender ID (optional)
```

---

### Expo Push Notifications — Mobile Push (WORKING)

**Status:** Working. `EXPO_ACCESS_TOKEN` is optional (raises rate limits and enables enhanced security when set).

- Service: `apps/web/src/services/notifications/expo.ts`
- SDK: `expo-server-sdk` ^3.9.0
- Notifications: verification check-in reminders, vote results, new vote alerts
- Chunked batch send (Expo max 100/batch)
- Push tokens stored in Supabase

**Env vars:**
```
EXPO_ACCESS_TOKEN=   # optional
```

---

## Analytics & Marketing

### Google Analytics 4 (WORKING)

**Status:** Working. Hardcoded measurement ID.

- Measurement ID: `G-FPXS9HK4QS` (in `apps/web/src/app/[locale]/layout.tsx`)
- Auto-event component: `apps/web/src/components/AnalyticsEvents.tsx`
- Tracks: page_view (manual on route change), bot_check, cta_click, support_click, outbound_click, nav_click, scroll_depth, section_view

---

### Beehiiv — Newsletter (WORKING)

**Status:** Working. Rate-limited endpoint.

- Route: `apps/web/src/app/api/newsletter/subscribe/route.ts`
- API v2 subscriptions endpoint
- UTM params auto-set: `utm_source=website_homepage`, `utm_medium=website`

**Env vars:**
```
BEEHIIV_API_KEY=
BEEHIIV_PUBLICATION_ID=
```

---

## Rate Limiting

### Upstash Redis — Rate Limiting (WORKING / IN-MEMORY FALLBACK)

**Status:** Working in production with Upstash; falls back to in-memory Map in dev (not viable across isolates in prod).

- Library: `apps/web/src/lib/rate-limit.ts`
- SDKs: `@upstash/ratelimit` ^2.0.8, `@upstash/redis` ^1.36.1
- Applied to: newsletter subscriptions, vote participation, phone OTP sends, and other sensitive endpoints

**Env vars:**
```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

---

## Cron & Scheduled Jobs

Three internal cron routes, invoked by the Cloudflare Workers scheduled handler in `apps/web/worker.ts` via authenticated HTTP POST (Bearer `CRON_SECRET`):

- `POST /api/cron/verification-notifications` — every 15 min
- `POST /api/cron/resolve-votes` — every hour
- `POST /api/cron/mint-nfts` — every 10 min

**Env vars:**
```
CRON_SECRET=    # guards /api/cron/* endpoints
```

Note: cron triggers are currently configured in the Cloudflare dashboard, not in `wrangler.jsonc` (account-level cron gate blocked wrangler deploy of triggers).

---

## Webhooks Summary

| Endpoint | Provider | Auth Method | Status |
|---|---|---|---|
| `POST /api/payments/webhook` | Paddle | `Paddle-Signature` HMAC-SHA256 | Working |
| `POST /api/merch/webhook` | Green Invoice | `?token=` query param or `x-greeninvoice-token` header | Working |

---

*Integration audit: 2026-06-28*
