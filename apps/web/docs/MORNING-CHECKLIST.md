# Morning checklist - finish integrations + deploy (minimal launch set)

Overnight I staged everything that needs no 2FA. The remaining steps each need
ONE interactive login (your second factor), then I automate the rest. Scope:
minimal launch = Supabase + Google OAuth + Resend (JWT/CRON already generated).
Est. ~10–15 min of your taps.

## Already done overnight (no action needed)
- Generated `JWT_SECRET`, `CRON_SECRET`, `GREENINVOICE_/PRINTFUL_/BAGS_WEBHOOK_SECRET`
  → `apps/web/.dev.vars` (gitignored).
- `apps/web/scripts/sync-secrets.sh` - pushes filled secrets to the Worker
  (Cloudflare CLI already authed as sahar.h.barak@gmail.com). Dry-run verified.
- `apps/web/docs/INTEGRATIONS.md` - full provider map (required/optional).
- supabase CLI installed (2.107.0). Docker up. auto-browser stack building
  (`/tmp/auto-browser`, noVNC takeover on http://127.0.0.1:6080).

## Step 1 - Supabase (no browser needed)
Cleanest path avoids browser entirely:
1. Dashboard → Account → Access Tokens → generate a Personal Access Token, paste it:
   `export SUPABASE_ACCESS_TOKEN=sbp_...`
2. Then I run (non-interactive): `supabase projects list` → pick/create the prod
   project → pull `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` into `.dev.vars` → `supabase db push` the
   migrations in `supabase/migrations/`.
3. In dashboard: Auth → Providers → Google → paste the client id/secret from Step 2.

## Step 2 - Google OAuth (console-only; needs the auto-browser takeover or you)
No clean CLI for creating an OAuth web client. Two options:
- (a) You create it: console.cloud.google.com → APIs & Services → Credentials →
  OAuth client ID (Web). Authorized redirect: `https://taruu.co.il/api/auth/callback`
  (+ `http://localhost:3777/...` for dev). Paste id/secret to me.
- (b) auto-browser takeover: open http://127.0.0.1:6080, sign into Google once
  (your 2FA), save the auth profile; I then drive the console to create the client.
Fills: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

## Step 3 - Resend
1. Sign in (auto-browser takeover or paste an API key). resend.com → API Keys.
2. Domain verify: Resend gives DNS records → I add them to the `taruu.co.il`
   zone via Cloudflare CLI (already authed). Fills: `RESEND_API_KEY`.

## Step 4 - push + build + deploy (I do this, you approved prod deploy)
1. `cd apps/web && ./scripts/sync-secrets.sh`
2. Ensure NEXT_PUBLIC_* are in build env, `pnpm cf:build`
3. `wrangler deploy --dry-run` → then `pnpm deploy`
4. Attach `taruu.co.il` / `www` / `api` custom domains (CF dashboard → Workers →
   taruu-web → Domains & Routes). Add the 3 cron triggers.
5. I visually verify auth-gated surfaces with a real session.

## Deferred (NOT in minimal launch - your call later)
Green Invoice production (Israeli MoR - vote fees + merch), Printful, Solana cNFT
mint + **private key** (real funds - handle out-of-band), Upstash, Beehiiv,
Facebook/Instagram OAuth, SMS gateway (OTP mock-degrades until then).
