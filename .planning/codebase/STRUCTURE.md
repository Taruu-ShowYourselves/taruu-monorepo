# Codebase Structure

**Analysis Date:** 2026-06-28

## Directory Layout

```
/                                       # Monorepo root (pnpm workspaces + Turborepo)
├── apps/
│   ├── web/                            # Next.js 17 App Router — Cloudflare Workers via OpenNext
│   │   ├── src/
│   │   │   ├── app/                    # Next.js App Router pages + API routes
│   │   │   │   ├── layout.tsx          # Root layout (pass-through for i18n)
│   │   │   │   ├── [locale]/           # Locale-scoped UI pages (he only currently)
│   │   │   │   │   ├── layout.tsx      # Locale layout: HTML, fonts, providers
│   │   │   │   │   ├── page.tsx        # Home/landing
│   │   │   │   │   ├── store/          # Merch store pages
│   │   │   │   │   ├── votes/          # Vote listing/detail pages
│   │   │   │   │   ├── treasury/       # Treasury dashboard pages
│   │   │   │   │   └── ...             # Other public pages
│   │   │   │   └── api/                # API route handlers (route.ts files)
│   │   │   │       ├── auth/           # Auth: callback, session, DID
│   │   │   │       ├── payments/       # Paddle: create, status, verify, webhook, refund
│   │   │   │       ├── merch/          # Green Invoice: checkout, orders, webhook
│   │   │   │       ├── votes/          # Vote CRUD, participation, resolution, location
│   │   │   │       ├── user/           # Profile, stats, NFTs, push token, phone OTP
│   │   │   │       ├── treasury/       # Municipality treasury + transactions
│   │   │   │       ├── bags/           # Bags.fm quote, swap, trending
│   │   │   │       ├── social/         # OAuth connect/callback for Facebook/Instagram
│   │   │   │       ├── verification/   # Identity verification schedule + check-in
│   │   │   │       ├── cron/           # Scheduled tasks: mint NFTs, resolve votes, notifications
│   │   │   │       ├── newsletter/     # Newsletter subscribe
│   │   │   │       └── stats/          # Network stats
│   │   │   ├── services/               # External API clients (never import supabase/db)
│   │   │   │   ├── auth/               # auth0.ts, session.ts, google.ts, facebook.ts, instagram.ts
│   │   │   │   ├── payments/           # paddle.ts
│   │   │   │   ├── greenInvoice/       # index.ts (payment form creation + token cache)
│   │   │   │   ├── treasury/           # bagSeeding.ts (ILS→SOL, Issue Coin launch)
│   │   │   │   ├── bags/               # Bags.fm API client (index.ts, bagSeeding.ts)
│   │   │   │   ├── email/              # Resend transactional email
│   │   │   │   ├── nft/                # NFT minting
│   │   │   │   ├── notifications/expo/ # Expo push notifications
│   │   │   │   ├── qubik/              # SYNC token minting
│   │   │   │   ├── sms/otp/            # OTP via Workers KV
│   │   │   │   └── verification/municipality/  # Identity verification logic
│   │   │   ├── lib/                    # Shared utilities (no external API calls)
│   │   │   │   ├── supabase/
│   │   │   │   │   ├── db.ts           # ALL database operations (service-role, ~2050 lines)
│   │   │   │   │   ├── server.ts       # supabaseAdmin client (SUPABASE_SERVICE_ROLE_KEY)
│   │   │   │   │   ├── client.ts       # supabase anon client (browser-safe)
│   │   │   │   │   ├── types.ts        # Database type definitions (manually maintained)
│   │   │   │   │   └── index.ts        # Re-exports for client-side consumers
│   │   │   │   ├── merch/
│   │   │   │   │   ├── catalog.ts      # Static product catalogue (server-side price source of truth)
│   │   │   │   │   └── index.ts
│   │   │   │   ├── env.ts              # Zod-validated env schema (server + client)
│   │   │   │   ├── logger.ts           # Structured logger + pre-built child loggers
│   │   │   │   ├── rate-limit.ts       # Rate limiting helpers
│   │   │   │   ├── secureCompare.ts    # Timing-safe comparison utility
│   │   │   │   ├── escapeHtml.ts       # HTML escaping
│   │   │   │   ├── oauth-state.ts      # CSRF state for OAuth flows
│   │   │   │   ├── verification.ts     # Verification schedule helpers
│   │   │   │   └── i18n/               # Internationalization utilities
│   │   │   ├── components/             # React UI components
│   │   │   │   ├── ui/                 # Base design system components
│   │   │   │   ├── layout/             # Nav, footer, shell
│   │   │   │   ├── sections/           # Page sections (press, hero, etc.)
│   │   │   │   ├── animations/         # Framer Motion wrappers
│   │   │   │   └── press/              # Press-themed sections
│   │   │   ├── hooks/                  # Custom React hooks
│   │   │   ├── providers/              # Context providers (AuthProvider, etc.)
│   │   │   └── styles/                 # Global CSS, design tokens
│   │   ├── __tests__/                  # Test suites
│   │   │   ├── api/                    # Unit tests for each API route
│   │   │   ├── services/               # Unit tests for services
│   │   │   ├── integration/            # Integration tests
│   │   │   └── e2e/                    # End-to-end tests
│   │   ├── next.config.ts              # Next.js config (ReactStrictMode, image domains, headers)
│   │   ├── wrangler.jsonc              # Cloudflare Workers deploy config
│   │   ├── worker.ts                   # CF Worker entry (OpenNext handler + scheduled triggers)
│   │   ├── open-next.config.ts         # OpenNext Cloudflare adapter config
│   │   └── vitest.config.ts            # Test runner config
│   └── mobile/                         # Expo React Native app
│       ├── app/                        # Expo Router screens
│       │   ├── (auth)/                 # Auth flow
│       │   ├── (tabs)/                 # Main tabs
│       │   ├── vote/                   # Vote detail
│       │   └── settings/               # Settings
│       └── src/
│           ├── hooks/
│           ├── lib/
│           └── stores/
├── packages/
│   ├── shared/                         # @sync/shared — types, constants, utils
│   │   └── src/
│   │       ├── types/                  # Shared TypeScript types
│   │       │   ├── bags.ts             # Bags.fm types
│   │       │   ├── merch.ts            # MerchOrder, Product, CheckoutRequest/Response, CartItem, ShippingAddress
│   │       │   ├── nft.ts
│   │       │   ├── payment.ts          # PaymentWebhookEvent, PaddleEventType
│   │       │   ├── phone.ts
│   │       │   ├── signup.ts
│   │       │   ├── user.ts
│   │       │   └── vote.ts
│   │       ├── constants/              # VOTE_COST, CREATE_VOTE_COST, MUNICIPALITIES, merch constants
│   │       ├── utils/                  # formatCurrency, formatDate, generateEncryptedDID
│   │       └── index.ts                # Barrel export
│   ├── api-client/                     # @sync/api-client — mobile API client
│   └── design-tokens/                  # @sync/design-tokens — shared design tokens
└── supabase/
    ├── config.toml                     # Supabase local dev config
    └── migrations/                     # SQL migrations — applied in filename order
        ├── 20240101000000_initial_schema.sql
        ├── 20240101000001_rls_policies.sql
        ├── 20240101000002_functions.sql
        ├── 20250115000001_push_tokens_and_wallet.sql
        ├── 20250115000002_webhook_events.sql
        ├── 20250116000001_treasury_and_issue_coins.sql
        ├── 20250118000001_vote_nfts.sql
        ├── 20250119000001_phone_verifications.sql
        ├── 20250120000001_paddle_payment_provider.sql
        ├── 20260615000001_user_city.sql
        ├── 20260615000002_user_notification_settings.sql
        ├── 20260615000003_merch_orders.sql
        ├── 20260616000001_merch_tracking.sql
        ├── 20260616000002_treasury_idempotency.sql
        └── 20260622000001_merch_orders_rls.sql
```

## Directory Purposes

**`apps/web/src/app/api/`:**
- Purpose: Next.js Route Handlers — one `route.ts` per endpoint
- Pattern: Each file exports named functions (`GET`, `POST`, etc.). Thin: validate input, call service/DB helper, return `NextResponse.json()`
- Key files: `payments/webhook/route.ts` (Paddle fulfilment), `merch/webhook/route.ts` (Green Invoice), `merch/checkout/route.ts`, `auth/callback/route.ts`

**`apps/web/src/services/`:**
- Purpose: External API client modules. No Supabase imports allowed here.
- Key files: `services/auth/session.ts` (JWT sign/verify/cookies via `jose`), `services/auth/auth0.ts` (OIDC code exchange + userinfo), `services/payments/paddle.ts` (Paddle Billing client + HMAC verification), `services/greenInvoice/index.ts` (Green Invoice hosted payment form), `services/treasury/bagSeeding.ts` (ILS→SOL treasury seeding logic)

**`apps/web/src/lib/supabase/`:**
- Purpose: All Supabase interaction for the web app
- `db.ts` — every database query lives here. Import from `@/lib/supabase/db`. Functions grouped by table with JSDoc.
- `server.ts` — `supabaseAdmin` (service role). Import only from API routes or services.
- `client.ts` — `supabase` anon client. Import only from client components/hooks.
- `types.ts` — `Database` interface (manually maintained; regenerate via `npx supabase gen types typescript`). Also exports `Tables<T>`, `InsertTables<T>`, `UpdateTables<T>` helpers.

**`apps/web/src/lib/`:**
- Purpose: Pure utilities with no external calls. Safe to import anywhere server-side.
- `env.ts` — `getServerEnv()` and `getClientEnv()` return Zod-validated env objects; call at module init in services
- `logger.ts` — `logger`, `webhookLogger`, `cronLogger`, `authLogger`, `paymentLogger`, `verificationLogger`
- `merch/catalog.ts` — `MERCH_CATALOG: Product[]` and `resolveVariant(slug, variantId)` used by checkout route for server-side repricing

**`supabase/migrations/`:**
- Purpose: Ordered SQL migrations applied by Supabase CLI. Source of truth for schema.
- Each migration is idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`).
- Contains: `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE`, `CREATE POLICY`, `CREATE OR REPLACE FUNCTION`, `GRANT EXECUTE`. RLS policies live inside the same migration as the table they protect.

**`packages/shared/src/types/`:**
- Purpose: TypeScript types shared between `apps/web` and `apps/mobile`
- Key files: `merch.ts` (all merch store types), `payment.ts` (webhook event shapes, Paddle types)

## Key File Locations

**Entry Points:**
- `apps/web/src/app/layout.tsx` — root Next.js layout (pass-through)
- `apps/web/src/app/[locale]/layout.tsx` — HTML/body, locale, fonts, providers
- `apps/web/worker.ts` — Cloudflare Worker entry (OpenNext handler + cron scheduled handler)

**Configuration:**
- `apps/web/next.config.ts` — Next.js config (image domains, security headers, `optimizePackageImports`)
- `apps/web/wrangler.jsonc` — Cloudflare Workers: name=`taruu-web`, KV namespace=`OTP_KV`, cron triggers, custom domain routes
- `apps/web/src/lib/env.ts` — Zod env schema (server + client split)

**Core Logic:**
- `apps/web/src/lib/supabase/db.ts` — ALL DB operations
- `apps/web/src/lib/supabase/server.ts` — `supabaseAdmin` (service-role)
- `apps/web/src/services/auth/session.ts` — JWT session management (cookies, `requireAuth`)
- `apps/web/src/services/payments/paddle.ts` — Paddle client + HMAC webhook verification
- `apps/web/src/services/greenInvoice/index.ts` — Green Invoice payment form creation
- `apps/web/src/lib/merch/catalog.ts` — Static merch catalogue

**Webhooks:**
- `apps/web/src/app/api/payments/webhook/route.ts` — Paddle (`POST`) with event dedup + atomic fulfilment
- `apps/web/src/app/api/merch/webhook/route.ts` — Green Invoice (`POST`) with token auth + idempotent paid flip

**Migrations:**
- `supabase/migrations/20260615000003_merch_orders.sql` — `merch_orders` table
- `supabase/migrations/20260616000001_merch_tracking.sql` — tracking columns
- `supabase/migrations/20260616000002_treasury_idempotency.sql` — `uq_treasury_tx_payment` unique index
- `supabase/migrations/20260622000001_merch_orders_rls.sql` — RLS enable (no public policies)
- `supabase/migrations/20250116000001_treasury_and_issue_coins.sql` — treasury tables + `record_treasury_deposit` SQL function

**Testing:**
- `apps/web/src/__tests__/api/` — one file per API route
- `apps/web/src/__tests__/services/` — service unit tests
- `apps/web/src/__tests__/integration/` — integration tests
- `apps/web/src/__tests__/e2e/` — Playwright tests

## Naming Conventions

**Files:**
- API routes: always `route.ts` inside a directory matching the URL segment
- Services: `camelCase.ts` matching the provider name (`paddle.ts`, `auth0.ts`, `bagSeeding.ts`)
- DB-touching lib utilities: `camelCase.ts` (`db.ts`, `server.ts`, `client.ts`)
- Tests: `<resource>.test.ts` (e.g., `merch-webhook.test.ts`, `payments.test.ts`)

**Functions in `db.ts`:**
- Read single: `get{Entity}By{Field}` — e.g., `getMerchOrderById`, `getUserByGoogleId`
- Read many: `get{Entities}By{Field}` or `getActive{Entities}` — e.g., `getActiveVotes`, `getTreasuryTransactions`
- Create: `create{Entity}` — e.g., `createMerchOrder`, `createPayment`
- Update: `update{Entity}` or `mark{Entity}{State}` — e.g., `markMerchOrderPaid`, `markPaymentCompleted`
- Upsert: `upsert{Entity}` — e.g., `upsertSocialProof`, `upsertPushToken`

**Migrations:**
- Format: `YYYYMMDDNNNNNN_snake_case_description.sql` where `NNNNNN` is a 6-digit sequence (usually `000001`, `000002`)
- Same-day migrations increment the sequence: `20260615000001`, `20260615000002`, `20260615000003`
- Description uses snake_case: `merch_orders`, `treasury_idempotency`, `user_city`

**Environment Variables:**
- Public (browser-safe): `NEXT_PUBLIC_` prefix (e.g., `NEXT_PUBLIC_AUTH0_DOMAIN`, `NEXT_PUBLIC_SUPABASE_URL`)
- Server-only: no prefix (e.g., `SUPABASE_SERVICE_ROLE_KEY`, `PADDLE_WEBHOOK_SECRET`, `GREENINVOICE_API_SECRET`)
- Workers bindings: uppercase, referenced via `env.BINDING_NAME` in `worker.ts` (e.g., `OTP_KV`)

## Where to Add New Code

**New Payment Service (e.g., GI payment integration):**
- Client: `apps/web/src/services/<providerName>/index.ts` — external API calls only, no Supabase
- DB operations: add named exports to `apps/web/src/lib/supabase/db.ts` (follow existing grouping pattern, add section comment `// === <Domain> Functions ===`)
- DB types: update `apps/web/src/lib/supabase/types.ts` with new table Row/Insert/Update shapes
- Schema: `supabase/migrations/YYYYMMDDNNNNNN_<description>.sql` — include `CREATE TABLE IF NOT EXISTS`, indexes, RLS enable + service-role policy, and SQL functions if needed
- API routes: `apps/web/src/app/api/<resource>/<verb>/route.ts` for the webhook/callback; `apps/web/src/app/api/<resource>/checkout/route.ts` for initiation
- Shared types: `packages/shared/src/types/<domain>.ts` for types shared with mobile app; export from `packages/shared/src/index.ts`

**New API Route:**
- Implementation: `apps/web/src/app/api/<group>/route.ts` (or `<group>/<action>/route.ts`)
- Pattern: import `getSessionFromRequest` or `requireAuth` at top, then call `db.ts` functions and/or services
- Test: `apps/web/src/__tests__/api/<group>-<action>.test.ts`

**New DB Table:**
- Migration: `supabase/migrations/YYYYMMDD000001_<table_name>.sql` — include table, indexes, RLS enable, service-role full-access policy, optional user-read policy
- Types: extend `apps/web/src/lib/supabase/types.ts` with Row/Insert/Update shapes and add to `Database.public.Tables`
- Operations: add section to `apps/web/src/lib/supabase/db.ts` with CRUD functions

**New Merch Product:**
- Add to `apps/web/src/lib/merch/catalog.ts` — the `MERCH_CATALOG` array. Variant prices are authoritative; clients cannot override.
- Add images to `apps/web/public/images/merch/`

**Shared Types (web + mobile):**
- Add to `packages/shared/src/types/<domain>.ts`
- Export from `packages/shared/src/types/index.ts` and `packages/shared/src/index.ts`
- Import as `import type { Foo } from '@sync/shared'`

## Special Directories

**`.planning/codebase/`:**
- Purpose: GSD agent analysis documents
- Generated: Yes (by GSD map-codebase agents)
- Committed: No

**`apps/web/.open-next/`:**
- Purpose: OpenNext build output for Cloudflare Workers deployment
- Generated: Yes (`pnpm build` + OpenNext adapter)
- Committed: No

**`supabase/.temp/`:**
- Purpose: Supabase CLI local state
- Generated: Yes
- Committed: No

**`apps/web/src/__tests__/`:**
- Purpose: All test files for the web app — API route unit tests, service tests, integration tests, e2e tests
- Generated: No (authored)
- Committed: Yes

---

*Structure analysis: 2026-06-28*
