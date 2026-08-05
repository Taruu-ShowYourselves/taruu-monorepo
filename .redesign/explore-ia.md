# /explore — Information Architecture + Data Layout Spec (v1)

> Status: SPEC ONLY — no code. Build phase implements against this contract.
> Placement note: the canonical `.redesign/` directory lives at the repo root
> (`/Users/saharbarak/personal/taro/.redesign/`), not under `apps/web/` — this
> spec lives there alongside `NEWSPRINT_TECH.md` (LOCKED) and `REDESIGN.md`.
>
> Operating skill: `~/.claude/skills/taste-skill/SKILL.md`.
> Dials for this page: DESIGN_VARIANCE 7 · MOTION_INTENSITY 5 · VISUAL_DENSITY 6.
> (Explore is an index/desk page — denser than the site default 4, below cockpit 8.
> Per skill: at density ≥6 numbers are always mono, generic cards give way to
> rules/dividers, and every asymmetric layout collapses to strict single column < 768px.)

---

## 0. Concept

**/explore is the newsroom floor plan.** The homepage is the front page (one
lead, curated desks); /explore is the full standing index of everything the
paper covers: every live decision, every desk, every ledger, every explainer —
organized by what a visitor *wants*, not by the route tree.

Public, no sign-in gate. Hebrew, RTL-only, mobile-first. The single gated act
is casting/creating a vote — those interactions bounce to
`/sign-in?redirect=…` (existing `ParticipationFlow` pattern already persists
the chosen option across the redirect; reuse, do not reinvent).

**Style direction — "liquid glass yet brutalist", reconciled:**
The brutalist tech-press language (NEWSPRINT_TECH.md, LOCKED) stays the
*ground*: newsprint cream, ink rules, red accent, mono meta, hard corners.
Liquid glass is introduced as a *second material with one strict meaning*:
**glass = the live-money / floating-chrome layer.** Anything editorial or
civic (headlines, ballots, municipality profiles, explainers) is ink on
paper. Anything that is market-live (BAGS, treasury balances, network pulse)
or that floats above the page (sticky section rail, future quick-vote sheet)
renders as frosted glass *over the newsprint*, so the paper texture refracts
through it. Glass panels still obey press discipline: hard 2px ink border,
square-ish corners (`--np-radius-card` max), red-only accent, mono numbers.
Full recipe in §5.

---

## 1. Content inventory

Every platform function, its data source, visibility, and its priority on
/explore. Priority: P0 = above the fold / primary desks, P1 = mid-page desks,
P2 = index-of-links treatment, P3 = deliberately not surfaced (gated or
noise for a public visitor).

| # | Function | Route it deep-links to | Data source for /explore | Public? | Priority |
|---|----------|------------------------|--------------------------|---------|----------|
| 1 | Live municipal votes (tallies, options, hotness) | `/votes`, `/votes/[id]` | Server: `getActiveVotesWithOptions()` (same helper the homepage desks use); client alt: `GET /api/votes?include=options` | Public | P0 |
| 2 | Cast a vote | `/votes/[id]` → participate | `POST /api/votes/[id]/participate` | **Auth-gated action** (page is public) | P0 (as the bounce target) |
| 3 | Knesset agenda + civic counter-vote | `/knesset` | Server: `getActiveVotesWithOptions(KNESSET_SCOPE)` + `getKnessetItemsByVoteIds()` | Public | P0 |
| 4 | Municipality profiles (engagement, satisfaction, time-to-vote) | `/municipality/[slug]` | Static `MUNICIPALITIES` list + per-muni aggregates derived from the one votes payload; deep profile stays on its page (`GET /api/municipalities/[m]`, s-maxage=300) | Public | P0 |
| 5 | Network pulse (registered, active votes, municipalities, total raised, weekly growth) | — (in-page) | `GET /api/stats/network` + `GET /api/stats/registrations` (server-fetched) | Public | P0 |
| 6 | BAGS market (trending coins per vote) | `/coin`, `/coin/[id]` | `GET /api/bags/trending?limit=5` (client fetch — market data, skeleton while loading) | Public | P1 |
| 7 | Treasury / civic fund transparency | `/treasury` | Network `totalRaised` from #5 for the summary; per-muni `GET /api/treasury/[m]` stays on /treasury | Public | P1 |
| 8 | Economics explainer (flywheel, model) | `/economics` | Static | Public | P1 (entry tile) |
| 9 | Create a vote (₪50) | `/votes/create` | — | **Auth + payment gated** | P1 (entry point with gate marked) |
| 10 | Vote archive (ended + results) | `/votes/archive` | Static link; data lives on that page | Public | P2 |
| 11 | How it works (participate, pillars, steps, pilot) | `/how-it-works` | Static | Public | P1 (entry tile) |
| 12 | Pricing (vote free · ₪50 create) | `/pricing` | Static | Public | P2 |
| 13 | FAQ | `/faq` | Static `faqData.ts` | Public | P2 |
| 14 | About (mission, tech, team) | `/about` | Static | Public | P2 |
| 15 | Store (merch) | `/store`, `/store/[slug]` | Static `MERCH_CATALOG` (server import, no fetch) | Public (guest checkout) | P2 |
| 16 | Download app (coming soon) | `/download` | Static | Public | P2 |
| 17 | Sign-in / sign-up | `/sign-in`, `/sign-up` | — | Public (auth entry) | P0 as CTA |
| 18 | WhatsApp founders group | external `WHATSAPP_FOUNDERS_LINK` | `@sync/shared` constant | Public | P0 CTA |
| 19 | Newsletter subscribe | — (in-page form, optional) | `POST /api/newsletter/subscribe` | Public | P2 |
| 20 | Personal dashboard, certificates, fund | `/dashboard` | `GET /api/user/*` | **Gated** | P3 — one masthead link when signed in; not an explore section |
| 21 | Settings / verification / onboarding | `/settings/*`, `/verification`, `/onboarding` | — | **Gated** | P3 — not surfaced |
| 22 | Support / legal (privacy, terms, refund) | `/support`, `/privacy`, `/terms`, `/refund` | Static | Public | P3 — Colophon links only (already exist there) |

Notes:
- #4: per-municipality *registered* counts obey the existing cohort floor
  (`municipalityWithheld`) — when withheld, show open-votes count only, never a
  small number. Same privacy contract as `/api/stats/registrations`.
- #6: `priceChange24h`/`volume24h` are currently placeholder zeros in the API.
  The explore Money Desk must not print fake movement — show raised (real) and
  suppress the change/volume columns until the API returns non-placeholder data
  (pilot-honesty rule from DESIGN_SYSTEM/REDESIGN carried forward).

---

## 2. Page hierarchy (mobile-first)

Single column < 768px, strictly. Section order is the intent funnel:
**see it live → see it near you → see the country → follow the money →
understand it → join.** A skeptical visitor gets proof before philosophy;
philosophy before checkout.

| Order | Section (Hebrew working title) | What it shows | Why here (intent narrative) |
|-------|-------------------------------|----------------|------------------------------|
| S0 | **Masthead + Ticker** (global chrome) | Existing press masthead, breaking ticker | Site chrome; unchanged |
| S1 | **Explore rail** — `סדר היום המלא` | Page title (display), standfirst line, and a sticky in-page section index (mono chips: חי · רשויות · כנסת · הכסף · המנגנון · הצטרפות) with scrollspy | Orientation in 2 seconds; the rail is the page's promise: "everything, indexed". On mobile it is a horizontally scrollable chip strip pinned under the masthead |
| S2 | **Pulse strip** — `הדופק` | 4 mono counters: registered citizens (national), active votes, municipalities on the ledger, ₪ total raised; weekly-growth arrow when non-zero | Proof-of-life before any pitch. Numbers first — the brand is "the exact number". Tick-up on view |
| S3 | **Now deciding** — `מכריעים עכשיו` | Top 6–8 live municipal votes across all desks, sorted by hotness (`hotnessOf`), each row: kicker (municipality), headline, top-2 option tally bars, mono ballots count, closing date | The #1 visitor intent: "what is being decided right now?" Immediately actionable; every row deep-links to the ballot |
| S4 | **Municipality index** — `דסקי הרשויות` | All municipalities as an editorial index: name (display), open-votes count, live-ballots count, registered count (or withheld); municipality search field on top | Second intent: "near me". This is the directory the homepage doesn't have room for. Asymmetric two-column list on desktop (VARIANCE 7), single column mobile |
| S5 | **The national desk** — `על סדר היום בכנסת` | Compact strip on `--np-paper-2` band: top 3 Knesset agenda items with civic tallies + link to full desk | Third intent: national scale. Kept compact — /knesset owns the depth |
| S6 | **The money desk** — `הכסף, גלוי` | **The glass section.** One glass ledger panel over a halftone paper band: network total raised (large mono), top-5 BAGS rows (symbol, issue title, ₪ raised, share-of-top bar), links to /treasury, /coin, /economics | Fourth intent: "where does the money go?" — the trust question. Glass here is semantic: this is the live market layer floating over the civic paper |
| S7 | **The mechanism** — `איך זה עובד` | Index of 4 entry tiles (editorial boxed links, NOT a 3-card row — 2×2 zig-zag with one wide tile): איך זה עובד · תמחור (חינם להצביע · ₪50 ליצור) · שאלות נפוצות · אודות. Plus a quiet inline link to the archive | Fifth intent: comprehension for the skeptic. Static, zero data cost |
| S8 | **Join / act** — `הצטרפו למהדורה` | Reuse of `ActNow` furniture: primary red NewsButton → WhatsApp founders; secondary → sign-up; tertiary strip: create-a-vote entry (lock glyph, marked "דורש חשבון"), store teaser (2 products, static), download coming-soon link | The conversion floor. One primary action per CONTENT_STRATEGY (WhatsApp), everything else subordinated |
| S9 | **Colophon** (global) | Existing colophon incl. support/legal links | Site chrome; unchanged |

Fold discipline (mobile): S1 title + rail and the first two Pulse counters must
land inside the first `100dvh`. S3's first row should be reachable within one
swipe. Hero is NOT full-height — this is an index page, not a landing hero
(skill anti-oversized-H1 rule: hierarchy via weight, not scale).

---

## 3. Data architecture

### 3.1 Fetch plan

| Data | Where fetched | Mechanism | Feeds sections |
|------|---------------|-----------|----------------|
| All active votes + options (municipal + knesset) | **Server (RSC)** | `getActiveVotesWithOptions()` once, `.catch(() => [])`; split in memory by `KNESSET_SCOPE` (exact homepage pattern) | S3 (top by hotness), S4 (per-muni counts), S5 (knesset top 3) |
| Network stats | **Server (RSC)** | `GET /api/stats/network` equivalent server helper or direct queries, `.catch(() => null)` | S2, S6 (total raised) |
| Registrations (national total) | **Server (RSC)** | `countRegisteredUsers()` helper (what `/api/stats/registrations` wraps), `.catch(() => null)` | S2 |
| BAGS trending (top 5) | **Client** | `fetch('/api/bags/trending?limit=5')` in an isolated client leaf | S6 rows |
| Merch teaser (2 products) | **Server (static import)** | `MERCH_CATALOG` filter, no fetch | S8 |
| Everything else | none | static links | S1, S7, S8 |

Rules:
- **One page, one votes query.** S3, S4, S5 all derive from the single
  server-side votes payload — no per-section refetch, no client votes fetch.
- **`export const revalidate = 300`** — same ISR window as home, /knesset,
  /municipality. The page is a cached static artifact that refreshes every
  5 minutes; zero Supabase load per request.
- BAGS stays client-side because it is the one genuinely market-live surface
  and its API is placeholder-partial; a failed fetch must degrade to the
  section's empty state without touching the rest of the page (established
  CoinMarket pattern).
- **Build-time degradation:** every server fetch `.catch()`es to empty
  (CI prerender has no service-role key — issue #39 pattern). The page must
  render a complete, honest empty edition with zero data.

### 3.2 Empty / loading / error states (mandatory per skill Rule 5)

| Section | Loading | Empty | Error |
|---------|---------|-------|-------|
| S2 Pulse | none (server-rendered) | counter shows `—` with mono note `בהכנה` — never a fake 0 for money; registered-count 0 pre-launch is real and may print | same as empty |
| S3 Now deciding | none (server) | press notice box: `המהדורה הראשונה בדפוס · 04.08` + red NewsButton → WhatsApp founders (mirrors KnessetDesk empty state) | same as empty |
| S4 Muni index | none (server) | full `MUNICIPALITIES` list still renders (static), counts show `—` | same |
| S5 Knesset | none (server) | one-line notice + link to /knesset (which owns the richer waiting state) | same |
| S6 Money desk | skeleton shimmer rows inside the glass panel (skeletal, layout-matched — no spinners) | `עוד לא נפתחו BAGS` + first-BAG note (CoinMarket empty-state copy reuse) | inline error line inside panel, rest of page unaffected |
| S8 Store teaser | none (static) | hidden if catalog empty | — |

### 3.3 Caching summary

- Page: ISR 300s. No `cache: 'no-store'` anywhere server-side.
- `/api/bags/trending`: client fetch, browser default; acceptable staleness.
- No new API routes required for v1 of /explore. (Optional later: a
  `GET /api/explore` aggregate if client-side refresh of S2/S3 is ever wanted —
  out of scope now.)

---

## 4. Interaction map

Every tappable surface, its destination, and whether it crosses the auth gate.
Legend: [PUB] no gate · [AUTH] bounces to `/sign-in?redirect=<current>` when
signed out.

| Surface | Tap → | Gate |
|---------|-------|------|
| Rail chip (S1) | smooth-scroll to section anchor | [PUB] |
| Pulse counter `הצבעות פעילות` (S2) | `/votes` | [PUB] |
| Pulse counter `₪ בקרן` (S2) | `/treasury` | [PUB] |
| Now-deciding row (S3) | `/votes/[id]` | [PUB] — the *page* is public; the vote button on that page is [AUTH] via existing ParticipationFlow (`router.push('/sign-in?redirect=…')`, option persisted) |
| `לכל ההצבעות ←` (S3 footer) | `/votes` | [PUB] |
| Municipality row (S4) | `/municipality/[slug]` | [PUB] |
| Municipality search (S4) | filters the index in place; Enter on exact match → profile | [PUB] |
| Knesset item row (S5) | `/votes/[id]` (the civic counter-vote) | [PUB] page / [AUTH] act |
| `לדסק הארצי המלא ←` (S5) | `/knesset` | [PUB] |
| Glass ledger header (S6) | `/treasury` | [PUB] |
| BAGS row (S6) | `/coin/[id]` | [PUB] |
| `לשוק המלא ←` / `איך הכלכלה עובדת ←` (S6) | `/coin` / `/economics` | [PUB] |
| Mechanism tiles (S7) | `/how-it-works` · `/pricing` · `/faq` · `/about` | [PUB] |
| Archive inline link (S7) | `/votes/archive` | [PUB] |
| Primary CTA (S8) | external WhatsApp founders link (`target=_blank`) | [PUB] |
| `הרשמה` (S8) | `/sign-up` | [PUB] (it *is* the gate) |
| `פתיחת נושא · ₪50` (S8) | `/votes/create` | [AUTH] — tile carries a lock glyph + mono caption `דורש חשבון מאומת`; signed-out tap goes to `/sign-in?redirect=/votes/create` |
| Store teaser card (S8) | `/store/[slug]` | [PUB] |
| Download link (S8) | `/download` | [PUB] |
| Masthead account menu | `/dashboard`, `/settings/*` | [AUTH] — existing masthead behavior, unchanged |

Auth-gate principle restated for the build phase: **no interaction on /explore
itself ever hard-blocks.** The page never renders a login wall; gates are
encountered only after a deliberate act (vote / create / dashboard), always via
redirect-with-return, never via modal interception.

---

## 5. Visual system contract

### 5.1 Material assignment — glass vs. brutalist, per section

| Section | Material | Rationale |
|---------|----------|-----------|
| S0 Masthead/Ticker | Brutalist (existing) | LOCKED chrome |
| S1 Title + rail | Paper title; **rail = glass** when it detaches and pins on scroll (floating chrome) | Glass is allowed for elements that float above the paper. At rest (in-flow) the rail is flat paper with an ink rule; once sticky, it gains the glass recipe so newsprint scrolls visibly beneath it |
| S2 Pulse | Brutalist — no boxes; counters separated by ink column rules (`divide` hairlines), halftone backdrop optional | Density-6 rule: data breathes between rules, not in cards |
| S3 Now deciding | Brutalist press furniture (DeskTopicRow language: rules, tally bars, mono meta) | Civic/editorial layer = ink on paper, always |
| S4 Muni index | Brutalist editorial index — `border-block` hairline rows, no cards | Directory = newsprint listings page |
| S5 Knesset strip | Brutalist on `--np-paper-2` band | Matches homepage KnessetDesk |
| S6 Money desk | **Glass** — the one full glass panel on the page, sitting on an ink-halftone band | Market-live layer = glass, by definition. The contrast (one frosted slab over dotted newsprint) *is* the "liquid glass yet brutalist" statement |
| S7 Mechanism | Brutalist boxed tiles (2px ink borders, invert on hover) | Editorial links |
| S8 Join/act | Brutalist (ActNow language); red block CTA | Conversion furniture is press furniture |
| S9 Colophon | Brutalist (existing) | LOCKED chrome |

### 5.2 The np-glass recipe (new tokens, to be added next to `--np-*`)

Glass over newsprint, not over gradients — derived from the LOCKED palette,
not from the deprecated `--lc-*` set:

```
--np-glass-fill:   rgba(251, 250, 244, 0.55);   /* paper-box at 55% */
--np-glass-blur:   14px;                         /* + saturate(120%) */
--np-glass-stroke: var(--np-ink);                /* hard 2px ink border — press discipline */
--np-glass-inner:  inset 0 1px 0 rgba(255,255,255,0.5);  /* refraction edge */
--np-glass-shadow: 0 16px 40px -20px rgba(20,17,14,0.35); /* ink-tinted diffusion */
```

Constraints: corners at `--np-radius-card` (10px) max — never pill panels;
red remains the only accent inside glass; body copy never sits on glass
(numbers, symbols, kickers, and single-line labels only); fallback for
browsers without `backdrop-filter` = solid `--np-paper-box`. Grain/halftone
never applied *to* the glass element itself, only to the band behind it
(skill: no filters on scrolling containers; glass panels are static in-flow).

### 5.3 Typography scale usage

| Role | Token | Face/weight |
|------|-------|-------------|
| Page H1 (S1) | `--text-5xl` mobile / `--text-7xl` desktop | Heebo 900, tracking -0.02em, leading 0.95 — deliberately smaller than the homepage lead |
| Section H2 | `--text-3xl` / `--text-4xl` | Heebo 800–900 |
| Kickers / rail chips | `--text-xs`–`--text-sm` | `--np-font-meta`, tracked +0.12em, red |
| Pulse counters | `--text-4xl` / `--text-5xl` | `--np-font-meta` mono, tabular-nums, weight 700 |
| Row headlines (S3/S5) | `--text-lg` / `--text-xl` | Heebo 800 |
| All numbers everywhere | — | `--np-font-meta`, `font-variant-numeric: tabular-nums` (density rule: numbers are always mono) |
| Body/standfirst | `--text-base` / `--text-lg` | Assistant / Heebo 400, `--np-ink-soft`, max-measure ~60ch |

### 5.4 Motion budget (MOTION_INTENSITY 5 — mechanical, press-grade)

Engine: **animejs v4** for all new one-shot choreography on this page (it is
already the engine of `uikit/animate-in`, `PressForm`, `PressMachine`; do not
introduce framer-motion into new explore components — one engine per tree,
per skill §8 mixing rule).

| # | Motion point | Spec | Engine |
|---|--------------|------|--------|
| M1 | Pulse counters tick up on first view | 600–800ms, `--np-ease` hard-out, integers only, once | animejs (`onScroll`/IntersectionObserver leaf) |
| M2 | Tally bars fill on view (S3, S5, S6) | width 0→pct, 500–700ms, once, `-40px` margin | animejs or the existing `AnimateIn`/`TallyBar` behavior — reuse |
| M3 | Section entrance | hard clip reveal (inset wipe), 200ms, stagger 80–100ms per row, max first 6 rows | animejs via `AnimateIn` |
| M4 | Rail pin transition | flat→glass: backdrop-filter + shadow fade, 200ms; scrollspy chip underline wipe | CSS only |
| M5 | Hover states | button/row invert, red underline wipe, `:active translateY(1px)` | CSS only |
| M6 | Ticker marquee (S0) | existing; the **only perpetual** animation on the page | existing component |

Budget ceiling: one perpetual (M6, pre-existing), everything else one-shot
on-view. No parallax, no magnetic, no spring physics — press motion is
mechanical (NEWSPRINT §6). `prefers-reduced-motion`: counters/bars jump to
final value, wipes become opacity, marquee static. Never animate
top/left/width/height except the tally-bar width fills, which are the
established site-wide exception (they run once, off the compositor critical
path); everything else transform/opacity only.

### 5.5 Density targets

- Mobile: ≥ 2 pulse counters + page title inside first viewport; S3 rows are
  ~96–120px tall (headline + 2 bars + meta line) — 3 rows per viewport.
- Desktop (≥1024): 12-col `--np-container` grid with visible column rules;
  S3 as 2-col asymmetric (`2fr 1fr` split: 4 lead rows inline-start, 4 compact
  rows inline-end); S4 two-column directory; S6 glass panel spans 8 cols,
  offset inline-start with the halftone band bleeding full-width (the one
  deliberate overlap/offset for VARIANCE 7).
- Section vertical padding tighter than site default: `clamp(var(--space-12), 8vw, var(--space-24))` (index page, not gallery).
- No generic 3-equal-card rows anywhere (skill ban); S7 is a 2×2 zig-zag with
  one wide tile.

---

## 6. Component plan (names only — no code)

### Reused as-is
- `Masthead`, `Ticker`, `Colophon` — global chrome
- `NewsButton` (variants red/ink/outline), `Segmented`
- `TallyBar` (from `VoteWidget`) — S3/S5/S6 bars
- `DeskTopicRow`, `DeskCarousel`, `toDeskTopic` + `hotnessOf` (deskData) — S3/S5 rows and sorting
- `AnimateIn` (uikit, animejs) — entrance choreography
- `uikit`: `Badge`, `Separator`, `MetricBar`, `Progress`, `MunicipalityLink`
- `PressAutocomplete` (MUI v9 + RTL cache) — S4 municipality search field
- `ActNow` section — S8 base (parameterized, see below)

### Reused with a new variant
- `GlassCard` — currently Luminous (`--lc-*`); gains a `press` variant driven
  by the new `--np-glass-*` tokens (§5.2). The Luminous variants remain
  untouched until the legacy pages migrate.
- `ActNow` — needs a `variant="explore"` slot row (create-vote gate tile +
  store teaser + download link) without forking the section.

### New components (names only)
- `ExploreRail` — sticky section index, scrollspy, flat→glass on pin
- `PulseStrip` + `PulseCounter` — mono counters with tick-up leaf
- `NowDecidingDesk` — cross-municipality hottest-votes desk (composes DeskTopicRow)
- `MuniIndex` + `MuniIndexRow` — municipality directory with search + withheld-count handling
- `KnessetStrip` — 3-item compact national desk (thinner than KnessetDesk)
- `MoneyDesk` — the glass ledger section (composes GlassCard `press` variant)
- `BagsRow` — single trending-BAG line (symbol · issue · ₪ raised · share bar)
- `MechanismTiles` — 2×2 zig-zag editorial link tiles
- `GateTile` — locked entry tile (lock glyph + `דורש חשבון` caption + redirect wiring)

### Stack notes for the build phase
- Styling: CSS Modules on `--np-*` tokens (page-level), Tailwind v4 utilities
  allowed inside uikit-derived pieces (existing coexistence pattern —
  municipality profile page is the precedent). Do not mix both systems inside
  one new component.
- MUI v9 appears **only** via `PressAutocomplete` (already wrapped with the
  RTL emotion cache) — no new raw MUI surfaces.
- animejs v4 is the only animation engine in new explore components;
  framer-motion is legacy-only here.
- Server components by default; client leaves only for: BAGS fetch (MoneyDesk
  rows), PulseCounter tick, ExploreRail scrollspy, MuniIndex search.

---

## 7. Open questions (for the build phase, non-blocking)
1. Should S2 registered-count use the national total only, or also surface the
   pilot municipality's count when above the cohort floor? (Spec default:
   national only — S4 rows carry per-muni counts.)
2. `/explore` in the Masthead nav: proposed as the second item after `הצבעות`
   (label: `סדר היום`), replacing nothing. Needs a nav-copy decision.
3. Countdown component (04.08 launch) — homepage owns it; explore deliberately
   omits it to avoid duplicated urgency chrome. Revisit after launch day.
