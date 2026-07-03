# Integrations & Secrets Runbook

Status of every third-party credential the Worker needs. Source of truth for
secret values is `apps/web/.dev.vars` (gitignored); push to Cloudflare with
`./scripts/sync-secrets.sh`. Cloudflare CLI is already authenticated
(`wrangler whoami` → sahar.h.barak@gmail.com, account `0800f795…`).

Legend: **REQ** = needed for basic live site · **PAY** = needed for paid flows ·
**OPT** = degrades gracefully if unset.

## Generated locally — DONE
These need no third party; generated into `.dev.vars`:
`JWT_SECRET`, `CRON_SECRET`, `GREENINVOICE_WEBHOOK_SECRET`,
`PRINTFUL_WEBHOOK_SECRET`, `BAGS_WEBHOOK_SECRET`.

## Needs real keys from a provider dashboard

| Secret(s) | Tier | Provider / where | Blocker / note |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | **REQ** | Supabase → Project → Settings → API | Pick/create the prod project. Run `supabase/migrations/*`. NEXT_PUBLIC ones are **build-time**. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | **REQ** | Google Cloud Console → APIs & Credentials → OAuth client | Add `https://taruu.co.il/api/auth/callback` redirect. Also paste into Supabase Auth → Providers → Google. |
| `GREENINVOICE_API_KEY_ID`, `GREENINVOICE_API_SECRET`, `GREENINVOICE_PLUGIN_ID` | **PAY** | morning/Green Invoice → Settings → API | Israeli **Merchant of Record** for vote fees (₪3 participation / ₪50 creation, matching `VOTE_COST` / `CREATE_VOTE_COST`) **and** the merch store. `/payments/form` opens a hosted payment page (type 320) that issues a receipt/invoice; success hits `/api/payments/webhook`. Vote fees + merch checkout mock-fall-back without these creds. `GREENINVOICE_ENV` flip sandbox→production in wrangler.jsonc. |
| `SMS_API_URL`, `SMS_API_KEY`, `SMS_FROM` | OPT* | any SMS REST gateway | *Unset → OTP mock-degrades (soft-pass). REQ for real phone verification. |
| `PRINTFUL_API_KEY` + catalog `podVariantId`s | OPT | Printful dashboard | Unset → paid merch orders stay `paid` (no fulfilment handoff). |
| `BAGS_API_KEY`, `BAGS_MASTER_WALLET_ADDRESS`, `BAGS_MASTER_WALLET_PRIVATE_KEY` | OPT | dev.bags.fm | **Private key = real funds + the cNFT minter keypair. Handle out-of-band.** |
| `SOLANA_RPC_URL`, `SOLANA_MERKLE_TREE`, `PINATA_JWT` | OPT | Helius + Pinata; merkle tree created via Bubblegum | Unset → NFT certs stay pending (no spend). Needs a created merkle tree + mainnet smoke test. |
| `RESEND_API_KEY` | REQ-ish | resend.com | Transactional email; verify the sending domain. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | OPT | console.upstash.com | Prod rate-limit persistence; degrades to in-memory without. |
| `BEEHIIV_API_KEY`, `BEEHIIV_PUBLICATION_ID` | OPT | beehiiv.com | Newsletter signup. |
| `FACEBOOK_APP_ID/SECRET`, `INSTAGRAM_APP_ID/SECRET` | OPT | developers.facebook.com | Extra identity-score providers. |
| `EXPO_ACCESS_TOKEN` | OPT | expo.dev | Push — web-only build, not needed now. |
| `QUBIK_API_KEY` | DEAD | — | Stack moved to Solana; qubik dropped. Leave empty. |

## Deploy sequence (after REQ/PAY secrets filled)
1. `./scripts/sync-secrets.sh` — push secrets to Worker.
2. Ensure NEXT_PUBLIC_* present at build, then `pnpm cf:build`.
3. `node_modules/.bin/wrangler deploy --dry-run` to validate the bundle.
4. `pnpm deploy` (ships to production — outward-facing, gated on owner OK).
5. Attach `taruu.co.il` / `www` / `api` custom domains in the CF dashboard
   (auto-creates proxied DNS). Zone must be Active.
6. Add the 3 cron triggers in the dashboard (account-level cron gate — see
   wrangler.jsonc note).
7. Visually verify auth-gated surfaces with a real session.

## What can / can't be browser-automated (auto-browser)
auto-browser is human-in-the-loop, does **not** solve CAPTCHA, and is explicitly
not for unauthorized account automation. Logins guarded by 2FA, plus production
payment/tax onboarding (Green Invoice live) and the **Solana private
key**, are owner-only / supervised steps — not safe to mint unattended.
