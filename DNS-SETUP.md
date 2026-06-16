# DNS + Cloudflare Deploy — taruu.co.il

Status as of 2026-06-16. `taruu.co.il` registered at **box.co.il** (ISOC-IL,
.co.il — cannot be transferred to Cloudflare Registrar, only DNS-hosted).
Hosting target: **Cloudflare Workers** via the OpenNext adapter (not Vercel).

## 1. DNS move (registration stays at box.co.il)

Cloudflare hosts DNS via a nameserver swap — no transfer.

1. Add the site in Cloudflare (Free plan) → it assigns **two** nameservers
   (`*.ns.cloudflare.com`), shown on the zone Overview page. Account-unique.
2. At **box.co.il** nameserver screen: set Row 1 + Row 2 to those two
   Cloudflare nameservers, **delete `ns3`**, leave the IPv4/IPv6 columns blank
   (those are glue fields, not needed for external nameservers).
3. Wait for Cloudflare to verify (`.co.il` via ISOC — minutes to ~24–48h). Zone
   flips to **Active**; Cloudflare emails you.

The zone was empty before the move (fresh domain, no records published), so the
cutover carries zero downtime risk. **[ DONE — nameservers set 2026-06-16 ]**

## 2. App records — added automatically, NOT by hand

Once the Worker is deployed (§3), attach the custom domains in the dashboard:
Workers → `taruu-web` → Domains & Routes → Add custom domain, for:
`taruu.co.il`, `www.taruu.co.il`, `api.taruu.co.il`. Cloudflare creates the
(proxied) records itself. Do not pre-create apex/www/api A or CNAME records —
they collide with what Cloudflare adds. Zone must be Active first.

## 3. Deploy to Cloudflare Workers (OpenNext)

Scaffold is committed: `apps/web/wrangler.jsonc`, `open-next.config.ts`, the
`next.config.ts` dev shim, and `package.json` scripts.

```bash
pnpm install                     # pulls @opennextjs/cloudflare + wrangler
cd apps/web
cp .dev.vars.example .dev.vars   # fill local secrets, then:
pnpm dev                         # next dev with Workers bindings
pnpm preview                     # build + run the worker locally
pnpm deploy                      # build + deploy to Cloudflare
```

First deploy needs `wrangler login` (or `CLOUDFLARE_API_TOKEN`).

## 4. Secrets

Non-secret public vars are in `wrangler.jsonc` → `vars`. Everything else is a
secret — set per value:

```bash
cd apps/web
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put JWT_SECRET
# …one per name in .dev.vars.example (skip NEXT_PUBLIC_* build-time vars and
#   the three already in wrangler.jsonc vars)
```

`NEXT_PUBLIC_*` vars are inlined at build time — they must be present in the
build environment, not as runtime secrets.

## 5. Email (Resend) — the only records you add manually

In Cloudflare DNS, copy verbatim from Resend → Domains → `taruu.co.il`:
`MX` (on the `send` subdomain), SPF `TXT`, DKIM `TXT` (`resend._domainkey`),
and optional DMARC `TXT`. Not proxy-eligible → they stay DNS-only (grey).
Add only when transactional email goes live.

## 6. TLS

Cloudflare SSL/TLS mode → **Full (strict)**.

## Cron (wired)

The two HTTP cron routes (`/api/cron/verification-notifications`,
`/api/cron/resolve-votes`, guarded by `CRON_SECRET`) run via Cloudflare Cron
Triggers. `worker.ts` is a custom entry that re-exports the OpenNext fetch
handler and adds a `scheduled` handler; it maps each cron expression to its
route (CRON_ROUTES) and POSTs with the `CRON_SECRET` bearer. Schedules live in
`wrangler.jsonc` → `triggers.crons` (must match CRON_ROUTES keys):
`*/15 * * * *` → verification-notifications, `0 * * * *` → resolve-votes.

Required: `wrangler secret put CRON_SECRET`. Test locally with
`wrangler dev --test-scheduled` then hit `/__scheduled?cron=*+*+*+*+*`.

## Open items before production

- Set the real Paddle product price for vote creation to **₪50**
  (`PADDLE_PRICE_VOTE_CREATION`), matching `CREATE_VOTE_COST`.
- Set `GREENINVOICE_WEBHOOK_SECRET` (long random) — the merch webhook rejects
  unauthenticated POSTs once it's set; checkout appends it to the notify URL.
- Image optimization on Workers may need a custom loader / Cloudflare Images —
  verify after first deploy.

## Verified on workerd (2026-06-16, `wrangler dev --local`)

- **Module-top `process.env` reads work.** Probed the cron route
  (`const CRON_SECRET = process.env.CRON_SECRET` at import) + the webhook secret
  gate: requests passed config + auth checks using those values. No lazy-env
  refactor needed — `process.env.*` captured at module scope is populated on the
  OpenNext/Workers runtime.
- Webhook secret gate confirmed: valid token → 200, wrong token → 401.
- Build + `wrangler deploy --dry-run` + `wrangler dev` all succeed; the worker
  boots and routes. Remaining unknown is `next/image` (needs a real deploy).
