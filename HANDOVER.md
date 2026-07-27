# HANDOVER — Taruu Redesign → Full Build

_Updated 2026-07-24. Launch-prep session: geo-first homepage v2 + discovery ingest pipeline shipped on `rebuild/launch-site` (pushed, NOT deployed); agents numeric-engagement work MERGED+DEPLOYED (taruu-agents PR #14 → fleet auto-pull). Resume via "RESUME HERE" below._

## ▶ RESUME HERE (2026-07-24, session 3 — launch prep)

**Branches:** taro `rebuild/launch-site` — pushed, 32 commits ahead of `origin/main`, working tree clean. **Site deliberately NOT deployed** (user instruction). taruu-agents: PR #14 **merged to main 2026-07-24 07:03Z** → fleet workers auto-pull within minutes (`taruu-update.timer`, ff-only from main) — that IS the agents deploy, done.

**Site work shipped this session (all on `rebuild/launch-site`, 3 commits `b3cccdd`/`2af2afd`/`8e032ca`):**
- **Homepage v2 (press system):** Lead → ConsensusDesk (municipal ToC boards; edition tabs; Embla RTL carousel w/ auto-scroll "sway" + cloned-slide loop for <6 cards) → KnessetDesk (national scope `KNESSET_SCOPE='כנסת ישראל'`, empty-state plate) → ActNow band → Colophon. Explanations moved to `/how-it-works`; `/knesset` national-desk page; nav = הצבעות/כנסת ישראל/איך זה עובד + **עוד** Radix dropdown (rest). Old `#participate` anchors repointed.
- **GeoGate** (`components/press/GeoGate`): entry modal when no session + no stored locality. GPS → nearest-centroid (`MUNICIPALITY_GEO` in `@sync/shared`, 21 cities, Haversine, 25km cap, on-device only) with **confirm step (never auto-commits)**, or typed town w/ alias matching. Stored `localStorage taruu.municipality` + `taruu_muni` cookie; `taruu:municipality` event → desk reorders, home tab ● first.
- **AI-discovery callout** on topic cards (`DeskTopicRow.SourceMetrics`): "ה־AI שלנו איתר · FROM FEED TO BALLOT" narrative + חום thermometer (hotness = 3·comments+reactions, x/(x+400) curve in `deskData.ts`) + per-reaction glyph tallies + מקור link. Renders ONLY when `vote_sources` row exists — no fabricated data anywhere (seed script strips sources on purpose).
- **Ingest API:** `POST /api/ingest/topics` (Bearer `INGEST_SECRET`, secureEqual; accepts 21 municipalities + Knesset scope; dedup (municipality,title) vs non-ended; new → pending vote + options; `vote_sources` upsert). Contract: `docs/INGEST.md`. Migration: `supabase/migrations/20260723000001_vote_sources.sql` — **NOT applied to prod Supabase yet**.
- **Header/system fixes:** dynamic Hebrew dateline (Asia/Jerusalem), wordmark niqqud clearance (0.26em pad under 0.9 line-height), single `--np-gutter` token across ~46 section shells + ticker inset, Radix dropdown (fixed dup `@types/react` 18/19 clash via tsconfig `paths` pin — Next's d.ts resolved hoisted RN 18 types).
- Gates at hand-off: web typecheck clean, 504/504 tests, lint clean on touched files (pre-existing `.open-next`/`.wrangler` lint noise remains — needs eslint `ignores`).

**Agents work (taruu-agents, merged):** per-reaction-kind extraction (DOM aria-labels + GraphQL `top_reactions`), archive v2 + atomic `rewrite`, `facebook-backfill-engagement` (live re-visit; **all 1,145 archived posts have NULL engagement**; 150/run, resumable, checkpoint-safe), comments-3× rerankers (`fb-post-ranker-v2`, `DISCOVERY_RANK_CAP_DISCUSSION_NUMERIC=400`), Topic numeric fields via `[POST n]` citations, migration `0023` (topic columns + re-created `commit_fleet_artifact` RPC), publisher `publish-taruu` + kill-switched auto-hooks. Full ops sequence in `discovery/HANDOFF.md`.

**⚠️ ORDERED OPS CHECKLIST (user-run, blocking launch):**
1. **NOW:** apply migration `0023` to discovery Supabase (workers already run code that emits the new columns; without it fleet topic commits silently drop engagement).
2. Backfill campaign: `uv run taruu-discovery facebook-backfill-engagement --commit` daily until `remaining==0` (first run attended, `FB_HEADLESS=false`, check `facebook-session-status` around runs).
3. `facebook-analyze-archive` per group → `rank --commit`.
4. Site go-live: apply taro `vote_sources` migration **and `20260727000001_knesset_items.sql`**; `wrangler secret put INGEST_SECRET` (+ optional `INGEST_CREATOR_ID`); merge/deploy `rebuild/launch-site` (`pnpm -C apps/web deploy` — NEVER while `next dev` runs); seed desk demo votes if wanted (`apps/web/scripts/seed-consensus-desk.mjs` — votes only, zero fabricated engagement; consider zeroing tallies).
   - **Knesset day order (issue #27, shipped 2026-07-27): OPS DONE same day.** Migrations `vote_sources` + `knesset_items` applied to prod Supabase (via Management API, CLI keychain token — works for DDL despite psql-less setup); cron `0 */6 * * *` registered on taruu-web via `wrangler triggers deploy` (ONLY that one — the other 3 activate at full deploy; knesset cron is a no-op on the old worker build until then); backfill ran locally against live DB: **49 active KNESSET_SCOPE votes + 49 knesset_items** (sitting 417, 13.07, 96 API rows → 49 unique ItemIDs). Remaining: just the site deploy. Contract: `docs/KNESSET.md`.
5. Nodes: `TARUU_INGEST_URL=https://taruu.co.il/api/ingest/topics`, `TARUU_INGEST_SECRET`, `TARUU_PUBLISH_ENABLED=true` → `publish-taruu --all` dry-run first.

**Session gotchas for the next resume:** dev server = port 3777 (`.dev.vars` sourced — `.env.local` holds PLACEHOLDER Supabase + stale Paddle vars, clean it); dev server was killed at session end — restart `next dev` alone; live DB has 9 seeded demo votes (desk user `99999999-…`, delete via 2 queries in seed-script header); prod-DB writes + DDL are permission-blocked for the agent — hand SQL/commands to user; shell is zsh (no word-split; `grep` aliased to ugrep — use `command grep`); reconstruct candidates: legacy Header/Footer pages (settings/sign-up/payments, votes/about/etc. still on old chrome), `--np-font-body` = Frank Ruhl Libre serif NOT webfont-loaded (falls back to Georgia — audit remaining usages), ticker copy fabricated/stale, ears ₪3 bidi.

---

## ▶ (older) RESUME (2026-06-16, session 2)
**State:** branch `redesign/brutalist-tech-press` — **41 commits, pushed**. **PR #7 OPEN** → https://github.com/SaharBarak/taro/pull/7 (base `main`). All 11 UX journeys (J1–J11) shipped. Code review done + fixes applied. **This session added: webhook hardening, the two cleanup nits, and the full Vercel→Cloudflare Workers migration scaffold (validated locally).** Verification: `tsc=0`, lint clean, **470/470 web tests pass** (+10 webhook tests).

**What's DONE:** whole-site brutalist migration + every primary journey (funnel, participate, verify, auth/account, BAGS coin, store, certificate, create, dashboard, treasury, info). Detail per journey + each one's "Deferred" list in `.redesign/UX_FLOWS.md`.

**Done this session (commits 71eafc5 → c464b89):**
- **GI webhook hardened** (was the security flag): `/api/merch/webhook` now requires a shared secret (`GREENINVOICE_WEBHOOK_SECRET`, timing-safe compare via `?token=` on the notify URL or `x-greeninvoice-token` header; fails OPEN only when unset, for dev). Paid transition is atomic via `markMerchOrderPaid` (`WHERE status='pending'`) — no double-process; distinguishes no-op (200) from DB error (500 retry). +10 tests. Checkout appends the secret; `.env.example` documents it.
- **Nits cleared:** `WHATSAPP_FOUNDERS_LINK` centralized in `@sync/shared` (was hardcoded in 24 files); `VoteWidget` `issueNo` is now an optional prop (real votes no longer show fake `· גיליון 04`; demo placements pass it explicitly).
- **Hosting moved Vercel → Cloudflare Workers (OpenNext).** Scaffold: `apps/web/wrangler.jsonc`, `open-next.config.ts`, `worker.ts` (custom entry: OpenNext fetch handler + scheduled handler driving the two `/api/cron/*` routes via Cron Triggers), `next.config.ts` dev shim, `package.json` scripts (`cf:build`/`preview`/`deploy`/`cf:typegen`) + deps (`@opennextjs/cloudflare`, `wrangler`; bumped `next ^15.5.18` for adapter peer), `.dev.vars.example`, gitignore. Validated WITHOUT creds: `opennextjs-cloudflare build` ✓, `wrangler deploy --dry-run` bundles (2.2MB gzip, bindings resolved) ✓. Full plan in **`DNS-SETUP.md`**.
- **DNS:** `taruu.co.il` (registered at box.co.il, .co.il — can't transfer to CF, DNS-host only) nameservers pointed to Cloudflare. Zone was empty → zero-risk cutover. Awaiting CF "Active". App DNS records auto-created when the Worker's custom domain is attached post-deploy.

**Decision needed from user:** merge PR #7, or keep hardening. Hosting cost: ~$5/mo Workers Paid (free DNS + free egress + free static assets).

**Highest-value remaining work (wiring/infra, not UX), priority order:**
1. **Deploy to Cloudflare + live creds e2e** — `wrangler login` → `wrangler kv namespace create OTP_KV` (paste id into `wrangler.jsonc`) → set secrets (`wrangler secret put` per `.dev.vars.example`) → `pnpm deploy` → attach `taruu.co.il`/`www`/`api` domains (auto-creates DNS). Then visually verify every auth-gated surface (dashboard, settings, verification, certificates, create-finalise, signed-in masthead) — built + tested but never seen with a real session. Fill the **Green Invoice** server creds (`GREENINVOICE_API_KEY_ID`/`GREENINVOICE_API_SECRET`/`GREENINVOICE_PLUGIN_ID`/`GREENINVOICE_ENV`) and set **`GREENINVOICE_WEBHOOK_SECRET`** (vote-creation resolves to ₪50 from `CREATE_VOTE_COST`, passed into the hosted payment page per request — no product price to set); wire an **SMS gateway** (`SMS_API_URL`/`SMS_API_KEY`) for OTP delivery.
2. **Image optimization on Workers** — verify `next/image` works post-deploy; may need a custom loader / Cloudflare Images (only thing not validatable locally).
3. **Deferred per-journey infra — ALL DONE (STACK LOCKED — see [[taruu-stack-decisions]] / `DNS-SETUP.md`):** ~~J4 OTP~~ (Workers KV, Twilio removed); ~~J7 refund~~ (manual Green Invoice credit note / חשבונית זיכוי); ~~J9 NFT mint~~ (Solana cNFT via Bubblegum + Pinata + Helius, `/api/cron/mint-nfts` — needs mainnet smoke test + a created merkle tree); ~~J7-push~~ (vote-results + new-city-vote push, `EXPO_ACCESS_TOKEN`); ~~J5 backing~~ (deep-link to `bags.fm/<mint>` — in-app swap declined); ~~J6 POD~~ (Printful: paid→fulfilling→shipped+tracking; populate catalog `podVariantId`s + creds at deploy). **Nothing left in Fork B — only live creds + deploy remain.**
4. **Minor:** treasury split/resolved-count are derived from a 25-row ledger (approximate at volume — API doesn't track them natively).

**Migrations added (session 1):** `user_city`, `user_notification_settings`, `merch_orders` (all under `supabase/migrations/2026061500000*`).

## 🔒 Security audit (2026-06-16) — `SECURITY-AUDIT.md`
Multi-agent static audit: 22 confirmed findings (2 HIGH, 4 MED, 14 LOW, 2 INFO), each adversarially verified. **Fixed this session:** both HIGHs (payment-webhook double-credit → atomic `markPaymentCompleted` + treasury UNIQUE(payment_id); GPS spoofing → server-side `verifyCheckIn` at participate), plus refund-email HTML escaping, constant-time cron compare, bags verifier hex+length-guard, resolution raw-error leak. **Deferred (in SECURITY-AUDIT.md, need provider info / bigger change):** Google OAuth state+PKCE (MED — drive-by blunted by JSON-preflight+sameSite, code-replay remains), webhook-secret-in-URL → header (MED, needs GI/Printful header support), merch_orders RLS, OTP attempt-reset-on-resend, send-code Upstash rate-limit, vote-template email escaping (subject-vs-body care). 4 false positives recorded (no action).

## ✅ LOCKED design decision
**Brutalist Tech-Press** is the approved, final art direction. Do NOT re-explore alternatives.
- Contract (read first): `.redesign/NEWSPRINT_TECH.md` (LOCKED).
- Copy/funnel: `.redesign/CONTENT_STRATEGY.md`. Progress: `.redesign/REDESIGN.md`.
- Luminous Civic (`.redesign/DESIGN_SYSTEM.md`) is **DEPRECATED** — still live only on un-migrated inner pages.

Look & feel: newsprint cream `--np-paper #F4F1E8` + ink `--np-ink #14110E` + pillarbox red `--np-red #E0301E`. Heavy grotesque headlines (Heebo 900), monospace data/control surfaces (JetBrains Mono), serif editorial body (Frank Ruhl Libre). Thick ink rules, newsprint grain + halftone, broadsheet density, hard corners (radius 0), red = only accent, in-page participation surfaces. Desktop-first wide, mobile minimized. RTL Hebrew, no emoji (glyphs ■▍●□✓✕/SVG), reduced-motion guards, mechanical motion (`--np-ease`).

## System map
- Tokens: `apps/web/src/styles/tokens.css` → `--np-*` block. Utilities: `apps/web/src/styles/globals.css` → `.np-*` (`.np-page` grain overlay, `.np-container`, `.np-rule*`, `.np-kicker`, `.np-mono`, `.np-halftone*`, `.np-block-*`, `.np-dropcap`).
- Press primitives: `apps/web/src/components/press/` → `Masthead`, `Ticker`, `NewsButton` (hard-edge, invert-hover; **wraps** long Hebrew — never add `nowrap`), `VoteWidget`+`TallyBar` (participation control surface), barrel `index.ts`.
- Front-page sections: `apps/web/src/components/press/sections/` → `Lead` (reference impl + canonical typescale), `Participate` (control-surface spec-sheet), `Pillars`, `HowItWorks`, `PilotDispatch`, `Colophon`.
- Homepage: `apps/web/src/app/[locale]/page.tsx` (`.np-page` wrapper).
- Assets (Higgsfield): `public/images/civic-engraving.png` (linocut lead art), `public/og-image.png` (newspaper OG). HF ~17 credits left, ~13/gen.

### Canonical type scale (match on EVERY press surface)
- Section H2: `clamp(var(--text-4xl), 5.5vw, var(--text-8xl))`, line-height 0.88, letter-spacing -0.04em, ink + red `<span>` accent. Page-1 lead headline → `--text-9xl`.
- Kicker: mono, `--text-sm`, weight 800, letter-spacing 0.12em, uppercase, red, ■ tick prefix.
- Standfirst: serif, `clamp(var(--text-base), 0.5vw+0.9rem, var(--text-xl))`, lh 1.45, ink-soft.
- Numbers/meta/captions: mono, tabular.

## DONE (branch `redesign/brutalist-tech-press`, commits ee9312d → 813bfb0)
tsc + lint green throughout. Hebrew-only, web-only, mobile-first.

**1. Whole-site migration to brutalist tech-press.** Shell swapped site-wide (`Header`→`Masthead`, `Footer`→`Colophon` via layout barrels). 6 new press form/flow primitives (`PressInput`, `PressSelect`, `Segmented`, `Stepper`, `Receipt`, `SealCard`). All content pages rebuilt (votes board+archive, economics, treasury, pricing, about, faq, support, download, legal). Verified 390 + 1600.
**2. BAGS (was "Issue Coin").** New product surface `/coin` (market index) + `/coin/[id]` (dossier) over the existing bags.fm engine — NO new token. Site-wide copy rebranded "Issue Coin"→**bags.fm BAGS** (per-vote memecoin; outsiders back a decision's execution like a stock; bridge tone). Lexicon: `BAGS`/`BAG` Latin caps (Hebrew "באג"=bug — never transliterate), `bags.fm` lowercase. New economics FAQ "why bags.fm" (censorship-resistant rails).
**3. Merch store** `/store` (catalogue → product → cart → thank-you), zustand cart, 5 POD products. Checkout re-prices server-side + creates a **Green Invoice (morning)** hosted payment page (`/api/merch/checkout`); mock-fallback without creds. Green Invoice is the Israeli MoR for both the merch store and the digital vote fees (₪3 participation / ₪50 creation via `/payments/form` type 320). `.env.example` documents `GREENINVOICE_*`.
**4. UX breakdown — 3 journeys dissected + shipped** (tracker: `.redesign/UX_FLOWS.md`):
  - **J1 funnel:** floating WhatsApp button removed; persistent ask is in masthead + footer as **קבוצת המייסדים** (founders' group); homepage ballot is a real micro-interaction (tap → +1 → "demo, join to count"); WhatsApp + newsletter = two channels; all join-CTAs unified to קבוצת המייסדים.
  - **J2 participation:** reshaped to **choice → pay ₪3 → seal** (per-vote GPS REMOVED). Gate at payment; selected option persisted across the sign-in/verify round-trip (sessionStorage `taruu-pending-vote` + `?option=`). ₪3 justified + tied to the BAG. `flow/ParticipationFlow.tsx`.
  - **J4 verification:** WIRED FOR REAL — phone OTP (Twilio, mock-degrades w/o creds) → immediate first GPS check-in (start→check-in, hard-fail+retry, surfaces next window) → eligible. `?redirect=` preserved through sign-in. `lib/verification.ts isEligibleToVote()` (phase completed OR ≥1 check-in) drives both the verification success state AND the J2 payment gate — one check-in unlocks voting; scheduled program continues in background.

**5. J8 auth/onboarding + account (absorbs B2/B3/B4).** Data layer: `UserProfile.city` + `notification_settings` added across shared type / DB types / PATCH whitelist / `transformToProfile`; migrations `20260615000001_user_city.sql`, `..0002_user_notification_settings.sql`. **B2** — `Masthead` gained auth state via `useAuth`: signed-out = founders'-group CTA (unchanged); signed-in = city chip (`city || municipality`, ● glyph, collapses into menu ≤767px) + avatar dropdown (לוח שלי · הפרופיל שלי · חשבונות מקושרים · התנתקות; outside-click/Esc/route close, aria-menu). **B3** — built the 3 previously-dead `/settings/*` pages (profile/municipality/notifications), press-styled, mirroring `social-connections` (auth guard, GET hydrate → PATCH → `refreshSession()`); `/dashboard` stays the hub. **B4** — single-country pilot: country fixed ישראל (no field); `city` is the editable location. tsc + lint green; routes compile 200. Live visual pending a real session (signed-in branch + auth-gated forms can't render on mock DB).

## NEXT SESSION — start here
**UX breakdown tracker = `.redesign/UX_FLOWS.md`** (per-journey MAP→FRICTION→UX→UI→COPY checklist). **ALL 11 JOURNEYS DISSECTED + SHIPPED** (J1–J11, 2026-06-15). The UX-breakdown pass is complete — what remains is live wiring + deferred infra, not design. Per-journey detail + "Deferred" notes in `.redesign/UX_FLOWS.md`.
Latest tier: **J7** (dashboard retention hook — open-votes-in-your-city callout; stale ₪200→₪50), **J10** (real treasury API wired + fabricated round-number mock removed → honest zeroed board), **J11** (SEO schema placeholders fixed; CTAs already consistent).
**What's left = live wiring, not UX:** real creds for e2e (Supabase / Green Invoice / Twilio); on-chain NFT mint + IPFS pin (J9); POD fulfilment + webhook→Printful (J6); in-app custodial swap via qubik (J5); push notifications + real refund endpoint (J7); per-vote NFT art. Auth-gated surfaces (dashboard, settings, verification, certificates, create-finalise) need a real session to visually verify.
**J9 note:** shipped **view-only certificates** — 2 Higgsfield civic seals (`public/images/certificates/<type>.png`), `CertificateCard`, dashboard **תעודות** tab + per-vote "your certificate" block; `/api/user/nfts` returns all records (status badge), image served from local type art. **Deferred:** real on-chain mint (no batch minter running) + IPFS pin; per-vote-unique art; archive NFT stats still mock. Auth-gated → live visual needs a session + a resolved vote with a `vote_nft`.
**Asset note:** Higgsfield generates on-system duotone art (ink+red on cream, halftone). CLI `higgsfield generate create gpt_image_2 --wait`; ~7 credits/gen; **~160 left (2026-06-16)**. Cap = 4 concurrent jobs — generate SEQUENTIALLY, pull URLs via `higgsfield generate list --image --json` (the --wait stdout grep is flaky). Save to `apps/web/public/...` (NOT repo-root public), optimize with `magick ... -resize -colors`.
**J5 note:** BACK = **link-out to bags.fm** (`bags.fm/<tokenMint>` on dossier when `live`). Deferred: in-app custodial swap via qubik (wire `quote`/`swap`), market-row quick-back. Anyone backs / residents vote.
**J6 note:** shipped order **persistence** (`merch_orders` table, checkout persists + requires sign-in, webhook flips to paid idempotently, thank-you reads the real order) + **5 Higgsfield duotone product images**. **Deferred:** POD provider wiring (Printful) → 'fulfilling'; buyer order-status/tracking; shipping/returns links. Live e2e needs Supabase + Green Invoice creds.

**Backlog status (2026-06-15):**
- **B1** OTP via serverless **Cloudflare Worker** (replace Twilio behind the `/api/user/phone/*` contract). **STILL PENDING** (J4 infra).
- ~~**B2** Account icon bar in masthead~~ **DONE (J8)** — signed-in city chip + avatar dropdown.
- ~~**B3** Dedicated account space~~ **DONE (J8)** — built the 3 dead `/settings/*` pages (profile · municipality · notifications); `/dashboard` stays the hub.
- ~~**B4** city + country~~ **DONE (J8)** — single-country pilot: country fixed ישראל (no field); `city` added as the editable location (chip + `/settings/profile`).

## OPEN DECISIONS / KNOWN GAPS
1. ~~**₪ create-vote price:**~~ **RESOLVED 2026-06-15 → ₪50** (`CREATE_VOTE_COST = 50`); matches CONTENT_STRATEGY §5. Green Invoice charges the ₪50 amount per request via the `/payments/form` hosted page (type 320) — no preconfigured product price to keep in sync.
2. **Payments real-with-mock-fallback:** ₪3/₪50 → `/api/payments/create` → Green Invoice hosted payment page when `paymentUrl` returned, else in-page mock seal. **The vote is recorded server-side when Green Invoice calls `/api/payments/webhook` on success (our internal payment id rides in the `custom` field), not the client; the mock path persists nothing.** Needs real Supabase/Green Invoice creds for live e2e.
3. **Merch:** webhook hardened + **POD wired (J6, session 2)** — paid→Printful→fulfilling→shipped+tracking. Needs `PRINTFUL_API_KEY`/`PRINTFUL_WEBHOOK_SECRET` + catalog `podVariantId`s filled from the Printful dashboard. Green Invoice creds + `GREENINVOICE_WEBHOOK_SECRET` still needed for live checkout.
4. ~~**BAGS trading unwired**~~ **J5 DONE (session 2)** — backing = deep-link to `bags.fm/<tokenMint>` (dossier "גבו ב-bags.fm"). In-app swap explicitly declined.
5. ~~**NFT resolution certificates**~~ **MINT WIRED (session 2)** — real Solana cNFT mint (`services/nft/solana.ts` + `pinata.ts`), batch minter `/api/cron/mint-nfts`. Needs live creds (Helius RPC, `SOLANA_MERKLE_TREE`, Pinata JWT) + a created Bubblegum tree + a mainnet smoke test. Voter NFTs only mint once users have a Solana wallet (`qubik_wallet_address` reused as recipient); patrons mint from `wallet_address`.
6. ~~**Verification creds:** Twilio~~ **DONE (session 2)** — OTP now in-app on Workers KV (`services/sms/otp.ts`); Twilio removed. Only an SMS gateway (`SMS_API_URL`/`SMS_API_KEY`) + the `OTP_KV` namespace are needed for live delivery; mock-degrades (503 → soft-pass) without them.
7. ~~**VoteWidget hardcodes** `· גיליון 04`~~ **DONE (session 2)** — `issueNo` optional prop; real votes omit it, demo placements pass it.
8. **Hosting = Cloudflare Workers (OpenNext)**, not Vercel. Deploy not yet run (needs `wrangler login` + secrets). Cron via `worker.ts` scheduled handler + Cron Triggers. `next/image` optimization on Workers unverified until first deploy. See `DNS-SETUP.md`.

Build approach that worked: fan out parallel agents (one per page/flow) with NEWSPRINT_TECH.md + `Lead` as reference + the canonical-scale block + "use press primitives, keep all data/logic, scope-locked to your folder." Assemble + verify with Playwright (`.redesign/shot-routes.mjs`, 390 + 1600). **Gotcha:** press sections render **static** — never gate body content behind `whileInView` (blanked legal bodies once); and globals `p`/`h*` now `color: inherit` so ink/red blocks render paper text (don't re-hardcode).

## Run / verify
- Dev: `cd apps/web && node_modules/.bin/next dev -p 3777` → http://localhost:3777/he. **Never `next build` while dev runs** (clobbers `.next`). Hebrew-only.
- Typecheck: `node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit`. Lint: `cd apps/web && node_modules/.bin/next lint`. Tests: `cd apps/web && node_modules/.bin/vitest run` (470 pass as of 2026-06-16, session 2).
- Cloudflare deploy (OpenNext): `cd apps/web && pnpm preview` (local worker) / `pnpm deploy` (ship). Validate the bundle without shipping: `node_modules/.bin/wrangler deploy --dry-run --outdir .wrangler/dryrun`. Full runbook in `DNS-SETUP.md`.
- Screenshots: `.redesign/shot-routes.mjs` (multi-route, 390 + 1600). Run: `PW_SHELL="$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell" ROUTES="/he,/he/votes" node .redesign/shot-routes.mjs` (binary is `chrome-headless-shell`, NOT `headless_shell`). Outputs `.redesign/r-{m,d}-<route>.png`.
- Local dev data: Supabase placeholder creds → components fall back to MOCK; real Supabase/Green Invoice creds needed for live e2e.

## Gotchas
- pnpm not on PATH in this shell; use `node_modules/.bin/*` directly.
- Background `&` inside a `run_in_background` bash detaches further — start dev with `nohup ... & disown`, poll the port.
- `.redesign/*.png|*.mjs|*.html` are throwaway (gitignored); the `.md` docs are tracked.
- Git rules: branch before commit, semantic commits, **NEVER** Claude/Anthropic co-author.
