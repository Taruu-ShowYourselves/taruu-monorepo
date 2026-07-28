# Technology Stack

**Analysis Date:** 2026-06-28

## Languages

**Primary:**
- TypeScript 5.7 — all source code (web, mobile, shared packages)

**Secondary:**
- CSS Modules — web component scoped styles
- SQL — Supabase migration files under `supabase/migrations/`

## Runtime

**Environment:**
- Cloudflare Workers via `@opennextjs/cloudflare` ^1.0.0 (OpenNext adapter)
- Compatibility date: `2025-03-25`
- Compatibility flag: `nodejs_compat` — required for Node-built modules (supabase-js, jose, resend, expo-server-sdk)
- `next dev` uses `initOpenNextCloudflareForDev()` shim (bottom of `apps/web/next.config.ts`) for local Cloudflare binding access

**Package Manager:**
- pnpm 9.0.0
- Lockfile: `pnpm-lock.yaml` — present and committed

## Frameworks

**Core:**
- Next.js ^15.5.18 — web application, App Router, locale-based routing (`/[locale]/`)
- Expo SDK 52 + Expo Router v4 — mobile app (`apps/mobile/`)
- React 19 — shared renderer for web

**Animation:**
- Framer Motion ^11.11.0 — page and component transitions
- `@studio-freight/lenis` ^1.0.42 — smooth scroll

**Styling:**
- CSS Modules — scoped styles per component (web only)
- NativeWind — Tailwind-style classes for React Native (mobile only)

**State:**
- Zustand ^5.0.0 — global auth and UI state on web (`apps/web/src/stores/`)

**Testing:**
- Vitest ^1.0.0 — unit/integration test runner (`apps/web/`)
- Playwright ^1.40.0 — E2E (configured; `apps/web/src/__tests__/e2e/`)

## Key Dependencies

**Auth / Identity:**
- `jose` ^5.2.0 — JWT creation and verification for custom session tokens
- `@supabase/supabase-js` ^2.39.0 — Postgres client (not using Supabase Auth)

**Payments:**
- `resend` ^4.0.0 — transactional email SDK
- No Node Paddle SDK — Paddle is called via raw fetch in `apps/web/src/services/payments/paddle.ts`

**Blockchain / NFT:**
- `@metaplex-foundation/mpl-bubblegum` ^5.0.2 — Solana compressed-NFT minting
- `@metaplex-foundation/umi` ^1.5.1 + `umi-bundle-defaults` ^1.5.1 — Metaplex UMI framework

**Rate Limiting:**
- `@upstash/ratelimit` ^2.0.8 + `@upstash/redis` ^1.36.1 — persistent rate limiting

**Infrastructure:**
- `expo-server-sdk` ^3.9.0 — Expo push notification dispatch from server
- `zod` ^3.23.0 — runtime env validation (`apps/web/src/lib/env.ts`)
- `qrcode.react` ^4.2.0 — QR code rendering (certificates, etc.)
- `uuid` ^9.0.0 — order/record ID generation

**Monorepo tooling:**
- Turborepo ^2.3.0 — task pipeline and caching
- TypeScript 5.7 — shared at root, per-package tsconfig extends root

**Legacy / residue:**
- `twilio` ^5.11.2 — still in root `package.json`; Twilio Verify was replaced by the custom Workers KV OTP system. Unused in any import.

## Configuration

**Environment:**
- Local dev: `.dev.vars` (gitignored) in `apps/web/` — read by `wrangler dev` and `next dev` via the OpenNext shim
- Example: `apps/web/.dev.vars.example`
- Root-level `.env.example` mirrors all variables with documentation
- Validation: Zod schema at `apps/web/src/lib/env.ts` — `getServerEnv()` and `getClientEnv()` throw on missing required vars with per-field messages; results are cached after first parse

**Non-secret public vars** live in `wrangler.jsonc` `vars` block (safe to commit):
```json
"vars": {
  "GREENINVOICE_ENV": "production",
  "PADDLE_ENV": "production",
  "QUBIK_NETWORK": "mainnet"
}
```

**Production secrets** are set with `wrangler secret put <NAME>` — never committed.

**Build:**
- Turbo pipeline: `turbo.json` — `build` depends on `^build` (packages first), outputs `.next/**` and `dist/**`
- Web production build: `opennextjs-cloudflare build` (wraps `next build`)
- Deploy: `opennextjs-cloudflare deploy` — pushes to Cloudflare Workers named `taruu-web`
- Config: `apps/web/wrangler.jsonc`

**Cloudflare Bindings:**
- `ASSETS` — static files from `.open-next/assets/` (OpenNext output)
- `OTP_KV` — Workers KV namespace for phone OTP code hashes (`id: 6f3f1d0e88df41d18773165a406b86b6`)

**Custom Worker Entry:**
- `apps/web/worker.ts` — re-exports OpenNext fetch handler; adds scheduled handler for cron routes (`/api/cron/verification-notifications`, `/api/cron/resolve-votes`, `/api/cron/mint-nfts`)

## Platform Requirements

**Development:**
- Node >= 20.0.0 (engines field in root `package.json`)
- pnpm 9.x (`packageManager` field)
- Wrangler 4.x for local Workers preview and secret management

**Production:**
- Cloudflare Workers (serverless, isolate-per-request)
- Custom domains: `taruu.co.il`, `www.taruu.co.il`, `api.taruu.co.il` — all routed to the same `taruu-web` worker
- Cron triggers: three schedules (`*/15 * * * *`, `0 * * * *`, `*/10 * * * *`) — currently must be configured in the Cloudflare dashboard (account-level cron gate blocked wrangler.jsonc triggers)

---

*Stack analysis: 2026-06-28*
