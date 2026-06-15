# HANDOVER — Taruu Redesign → Full Build

_Updated 2026-06-15 (end of session: brutalist migration + BAGS + store + UX J1/J2/J4). Resume via "NEXT SESSION" below._

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
**3. Merch store** `/store` (catalogue → product → cart → thank-you), zustand cart, 5 POD products. Checkout re-prices server-side + creates a **Green Invoice (morning)** hosted payment page (`/api/merch/checkout`); mock-fallback without creds. Paddle stays the rail for the digital vote fees. `.env.example` documents `GREENINVOICE_*`.
**4. UX breakdown — 3 journeys dissected + shipped** (tracker: `.redesign/UX_FLOWS.md`):
  - **J1 funnel:** floating WhatsApp button removed; persistent ask is in masthead + footer as **קבוצת המייסדים** (founders' group); homepage ballot is a real micro-interaction (tap → +1 → "demo, join to count"); WhatsApp + newsletter = two channels; all join-CTAs unified to קבוצת המייסדים.
  - **J2 participation:** reshaped to **choice → pay ₪3 → seal** (per-vote GPS REMOVED). Gate at payment; selected option persisted across the sign-in/verify round-trip (sessionStorage `taruu-pending-vote` + `?option=`). ₪3 justified + tied to the BAG. `flow/ParticipationFlow.tsx`.
  - **J4 verification:** WIRED FOR REAL — phone OTP (Twilio, mock-degrades w/o creds) → immediate first GPS check-in (start→check-in, hard-fail+retry, surfaces next window) → eligible. `?redirect=` preserved through sign-in. `lib/verification.ts isEligibleToVote()` (phase completed OR ≥1 check-in) drives both the verification success state AND the J2 payment gate — one check-in unlocks voting; scheduled program continues in background.

**5. J8 auth/onboarding + account (absorbs B2/B3/B4).** Data layer: `UserProfile.city` + `notification_settings` added across shared type / DB types / PATCH whitelist / `transformToProfile`; migrations `20260615000001_user_city.sql`, `..0002_user_notification_settings.sql`. **B2** — `Masthead` gained auth state via `useAuth`: signed-out = founders'-group CTA (unchanged); signed-in = city chip (`city || municipality`, ● glyph, collapses into menu ≤767px) + avatar dropdown (לוח שלי · הפרופיל שלי · חשבונות מקושרים · התנתקות; outside-click/Esc/route close, aria-menu). **B3** — built the 3 previously-dead `/settings/*` pages (profile/municipality/notifications), press-styled, mirroring `social-connections` (auth guard, GET hydrate → PATCH → `refreshSession()`); `/dashboard` stays the hub. **B4** — single-country pilot: country fixed ישראל (no field); `city` is the editable location. tsc + lint green; routes compile 200. Live visual pending a real session (signed-in branch + auth-gated forms can't render on mock DB).

## NEXT SESSION — start here
**UX breakdown tracker = `.redesign/UX_FLOWS.md`** (per-journey MAP→FRICTION→UX→UI→COPY checklist). Done: J1, J2, J4, **J8**, **J5** (link-out tier), **J6** (integrity+imagery tier), **J9** (certificate view-only tier). **Pending:** J3 (create), J7 (dashboard pass), J10 (treasury), J11 (info). Method: dissect ONE journey at a time; present grounded MAP + friction; get UX forks via questions; then UI; then COPY; commit per journey. **Natural next: J3 (create)** — the last core journey not dissected.
**J9 note:** shipped **view-only certificates** — 2 Higgsfield civic seals (`public/images/certificates/<type>.png`), `CertificateCard`, dashboard **תעודות** tab + per-vote "your certificate" block; `/api/user/nfts` returns all records (status badge), image served from local type art. **Deferred:** real on-chain mint (no batch minter running) + IPFS pin; per-vote-unique art; archive NFT stats still mock. Auth-gated → live visual needs a session + a resolved vote with a `vote_nft`.
**Asset note:** Higgsfield generates on-system duotone art (ink+red on cream, halftone). CLI `higgsfield generate create gpt_image_2 --wait`; ~7 credits/gen; ~167 left. Cap = 4 concurrent jobs — generate SEQUENTIALLY, pull URLs via `higgsfield generate list --image --json` (the --wait stdout grep is flaky). Save to `apps/web/public/...` (NOT repo-root public), optimize with `magick ... -resize -colors`.
**J5 note:** BACK = **link-out to bags.fm** (`bags.fm/<tokenMint>` on dossier when `live`). Deferred: in-app custodial swap via qubik (wire `quote`/`swap`), market-row quick-back. Anyone backs / residents vote.
**J6 note:** shipped order **persistence** (`merch_orders` table, checkout persists + requires sign-in, webhook flips to paid idempotently, thank-you reads the real order) + **5 Higgsfield duotone product images**. **Deferred:** POD provider wiring (Printful) → 'fulfilling'; buyer order-status/tracking; shipping/returns links. Live e2e needs Supabase + Green Invoice creds.

**Backlog status (2026-06-15):**
- **B1** OTP via serverless **Cloudflare Worker** (replace Twilio behind the `/api/user/phone/*` contract). **STILL PENDING** (J4 infra).
- ~~**B2** Account icon bar in masthead~~ **DONE (J8)** — signed-in city chip + avatar dropdown.
- ~~**B3** Dedicated account space~~ **DONE (J8)** — built the 3 dead `/settings/*` pages (profile · municipality · notifications); `/dashboard` stays the hub.
- ~~**B4** city + country~~ **DONE (J8)** — single-country pilot: country fixed ישראל (no field); `city` added as the editable location (chip + `/settings/profile`).

## OPEN DECISIONS / KNOWN GAPS
1. **₪ create-vote price:** constant `CREATE_VOTE_COST = 200` (`packages/shared/src/constants/index.ts`); CONTENT_STRATEGY §5 says **₪50**. Site is wired to the constant (renders ₪200). Flip the one constant if ₪50 is canonical.
2. **Payments real-with-mock-fallback:** ₪3/₪200 → `/api/payments/create` → Paddle when `paymentUrl` returned, else in-page mock seal. **The vote is recorded server-side on the Paddle `payment.completed` webhook, not the client; the mock path persists nothing.** Needs real Supabase/Paddle creds for live e2e.
3. **Merch:** POD fulfilment + `/api/merch/webhook` persistence are TODO (webhook only ACKs); no product imagery (press placeholders); Green Invoice creds needed for live checkout.
4. **BAGS trading unwired:** `/api/bags/quote` + `/api/bags/swap` exist; no buy/back UI or wallet connect (J5).
5. **NFT resolution certificates** (`user/nfts`, `votes/[id]/resolution`, cron) — engine exists, no claim/view UX (J9).
6. **Verification creds:** Twilio (OTP) — mock-degrades in dev; B1 plans a Cloudflare Worker replacement.
7. **VoteWidget hardcodes** `· גיליון 04` / place — parametrize for per-vote issue numbers.

Build approach that worked: fan out parallel agents (one per page/flow) with NEWSPRINT_TECH.md + `Lead` as reference + the canonical-scale block + "use press primitives, keep all data/logic, scope-locked to your folder." Assemble + verify with Playwright (`.redesign/shot-routes.mjs`, 390 + 1600). **Gotcha:** press sections render **static** — never gate body content behind `whileInView` (blanked legal bodies once); and globals `p`/`h*` now `color: inherit` so ink/red blocks render paper text (don't re-hardcode).

## Run / verify
- Dev: `cd apps/web && node_modules/.bin/next dev -p 3777` → http://localhost:3777/he. **Never `next build` while dev runs** (clobbers `.next`). Hebrew-only.
- Typecheck: `node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit`. Lint: `cd apps/web && node_modules/.bin/next lint`.
- Screenshots: `.redesign/shot-routes.mjs` (multi-route, 390 + 1600). Run: `PW_SHELL="$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell" ROUTES="/he,/he/votes" node .redesign/shot-routes.mjs` (binary is `chrome-headless-shell`, NOT `headless_shell`). Outputs `.redesign/r-{m,d}-<route>.png`.
- Local dev data: Supabase placeholder creds → components fall back to MOCK; real Supabase/Paddle creds needed for live e2e.

## Gotchas
- pnpm not on PATH in this shell; use `node_modules/.bin/*` directly.
- Background `&` inside a `run_in_background` bash detaches further — start dev with `nohup ... & disown`, poll the port.
- `.redesign/*.png|*.mjs|*.html` are throwaway (gitignored); the `.md` docs are tracked.
- Git rules: branch before commit, semantic commits, **NEVER** Claude/Anthropic co-author.
