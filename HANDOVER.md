# HANDOVER — Taruu Redesign → Full Build

_Updated 2026-06-15._

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

## DONE — full site migrated to brutalist tech-press (web-only, mobile-first)
Homepage front page (masthead · ticker · 3-col broadsheet Lead · Participate · Pillars · HowItWorks · PilotDispatch · Colophon) + newsletter capsule + newspaper OG.

**Site-wide migration complete (2026-06-15 build night).** 6 commits on `redesign/brutalist-tech-press` (ee9312d → 6f58807). tsc + lint green, all 19 routes verified at 390 (mobile) + 1600 (desktop) via Playwright.
- **Shell site-wide**: `Header`→`Masthead`, `Footer`→`Colophon` aliased at the layout barrels (`components/layout/{Header,Footer}/index.ts`) — every page inherits the press shell, zero call-site churn.
- **Press form/flow primitives** (NEW, `components/press/`): `PressInput`, `PressSelect`, `Segmented`, `Stepper`, `Receipt`, `SealCard` — hard-edge mono control surfaces, mobile-first, RTL logical props, red focus/error, reduced-motion guards. Exported from the `@/components/press` barrel.
- **Content pages** → press: votes board + archive, economics (deep Issue-Coin/flywheel), treasury (public ledger), pricing (rate card), about (editorial manifesto + drop-cap), faq, support, download (press dispatch), legal privacy/terms/refund (shared `LegalPage`/`LegalContent`).
- **Flows** → press: `votes/[id]` vote detail + full participation flow (choose → GPS verify → pay ₪3 → Receipt → SealCard) via `flow/ParticipationFlow.tsx`; `votes/create` wizard (Stepper, propose→options→duration→pay); `verification` (reassurance-first one-time GPS); `dashboard` (personal ledger: history, Issue-Coin balance, fund contributions, billing history, refund request, settings); auth `sign-in`/`sign-up`/`connect-social`/`onboarding`/`settings/social-connections` (OAuth preserved, municipality Stepper).
- Pricing/dashboard/create read `VOTE_COST`/`CREATE_VOTE_COST` from `@sync/shared` (no hardcoded amounts).

## OPEN DECISIONS / NEXT
1. **₪ create-vote price mismatch (decide):** code constant `CREATE_VOTE_COST = 200` (`packages/shared/src/constants/index.ts`); CONTENT_STRATEGY §5 says **₪50**. Whole site is wired to the constant → renders ₪200 everywhere. If ₪50 is canonical, change the one constant and the site follows.
2. **Payment wiring is real-with-mock-fallback:** participation ₪3 + create ₪200 POST `/api/payments/create` and redirect to Paddle when `paymentUrl` is returned; otherwise they synthesize an in-page Receipt + SealCard (consistent with the app's placeholder-cred MOCK behavior). Needs real Supabase/Paddle creds for live e2e. No standalone billing/refunds route — folded into `dashboard` (refund submit is a mock no-op; wire when an endpoint lands).
3. **VoteWidget hardcodes** `· גיליון 04` / place text — parametrize if per-vote issue numbers are wanted.
4. **Auth-gated pages** (`verification`, `dashboard`, `onboarding`) redirect to the press `sign-in` when unauthenticated — verified that redirect is graceful; their own press bodies need a logged-in session to screenshot.

Build approach that worked: fan out parallel agents (one per page/flow) with NEWSPRINT_TECH.md + Lead as reference + the canonical-scale block + "use press primitives, keep all data/logic, scope-locked to your page folder." Then assemble + verify with Playwright (`.redesign/shot-routes.mjs`, 390 + 1600). Gotcha caught: press sections render **static** — don't gate body content behind `whileInView` (it left legal bodies blank until fixed in 6f58807).

## Run / verify
- Dev: `cd apps/web && node_modules/.bin/next dev -p 3777` → http://localhost:3777/he. **Never `next build` while dev runs** (clobbers `.next`). Hebrew-only.
- Typecheck: `node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit`. Lint: `cd apps/web && node_modules/.bin/next lint`.
- Screenshots: playwright-core at `node_modules/.pnpm/playwright-core@1.57.0/...`; headless shell `~/Library/Caches/ms-playwright/chromium_headless_shell-1217/...`. See `.redesign/shot.mjs`.
- Local dev data: Supabase placeholder creds → components fall back to MOCK; real Supabase/Paddle creds needed for live e2e.

## Gotchas
- pnpm not on PATH in this shell; use `node_modules/.bin/*` directly.
- Background `&` inside a `run_in_background` bash detaches further — start dev with `nohup ... & disown`, poll the port.
- `.redesign/*.png|*.mjs|*.html` are throwaway (gitignored); the `.md` docs are tracked.
- Git rules: branch before commit, semantic commits, **NEVER** Claude/Anthropic co-author.
