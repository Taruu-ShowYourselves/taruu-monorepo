# Taruu (תַּרְאוּ) · Site Overview · July 2026

Status: local work on branch `rebuild/launch-site`. Nothing in this document is deployed yet. Production remains taruu.co.il as last shipped on 2026-07-28.

## What Taruu is

A civic consensus platform for Israel. Residents vote on local and national issues. Every ballot is tied to a verified identity and a verified location, results are public, and each vote is signed on-chain. The product ships as a Hebrew-only, RTL, mobile-first web app styled as a brutalist tech-press newspaper: cream paper, ink rules, one red accent.

## Major product changes in this cycle

### 1. Payments removed. Participation is free
- The ₪3 participation fee is gone from the product story. No money before voting.
- Homepage fee box now reads: השתתפות · חינם (free participation, verified identity, transparent results).
- SEO structured data updated: offer price 0, FAQ answer says participation is free, priceRange says free.
- Sign-in and sign-up trust lines no longer mention the community-fund split.
- Still open (deliberately untouched): the vote ParticipationFlow still contains the wired payment step, and the pricing, economics and FAQ pages still describe the old fee model in places. Removing the payment step from the flow is product surgery and needs a decision.
- The community fund and vote-bags treasury remain described as future features.

### 2. Knesset Israel: the national desk
- The Knesset day-order feature is live: plenum agenda items become votes, section by section (issue #27, shipped and backfilled with 49 live votes).
- The homepage carries a national Knesset desk alongside the municipal civic desk; a dedicated /knesset page presents the full agenda as a broadsheet index.
- Together the two desks give the paper two tiers: the city and the country.

### 3. Verification
- Identity verification runs on-device: document scan with client-side OCR. Images never leave the device; only extracted fields are submitted (issue #32).
- ID numbers are stored as one-way HMAC hashes only. Erasure endpoint exists per privacy law (PPL §14).
- Residency is pinned by GPS: only someone physically inside the municipality can vote there.
- Votes are signed on-chain; certificates are issued as compressed NFTs on Solana.

## Design and experience changes in this cycle

### Typography
- Body font: Assistant replaces Frank Ruhl Libre (the serif is retired).
- All monospace is gone: 397 usages of JetBrains Mono replaced by IBM Plex Sans Hebrew through one token swap. Display font stays Heebo 900 with Secular One for the wordmark.
- Antialiasing pinned on form controls; image resampling switched to the GPU quality path.

### Forms
- New PressFormCard: translucent paper card, layered ink-tinted shadows, red folio tick, staggered field entrance and rejection shake (animejs).
- PressInput and PressSelect upgraded in place: soft top-light surface, focus ring, lift on focus. Nine pages inherit automatically.
- Municipality picker is now a searchable MUI Autocomplete themed to the newsprint tokens with RTL emotion cache. MUI stays scoped to complex controls only.
- Newsletter capsule rebuilt in the newsprint language; sign-in desk card elevated.
- The old flat boxes and hard 4px offset shadows are gone across the masthead menu and GeoGate as well.

### Theme breakage, on purpose
- Avatars are circles now (masthead, profile, team): the one round shape in a square grid.
- Cards may soften corners; pills exist for capsules and buttons. Everything else stays square.

### Motion
- PressLoader: the loading indicator is a schematic web-offset press. Rollers turn, the newsprint web runs, printed marks travel with the paper, sheets drop on the delivery stack. It replaced the rotating square in all 11 loading states across 7 pages.
- PressAtmosphere: drifting ink and red pigment blooms plus a panning halftone field behind form pages.
- Carousels (civic desk, Knesset desk) are full-bleed: the card river runs edge to edge with no side gutters.

### Copy
- The headline: הקול של האנשים, האזרחים, עכשיו במספרים.
- The word שכונה (neighborhood) is purged from the entire product; the language is city and citizens.
- Site-wide copy sweep complete: 230+ em dashes removed from every user-visible string (components, pages, dictionaries, metadata, legal pages), sentences restructured rather than blindly hyphenated. AI-slop phrasing rewritten into dry, factual press Hebrew: no "הגיע הזמן", no "סוף־סוף", no empty triples, no hype adjectives, duplicated boilerplate varied or cut. Grammar fixes along the way (ייספר, not יספור).
- The dashboard edition number is now a real issue number (days since the paper epoch), not a slice of the user UUID.

## Stack and infrastructure

- Next.js 15 on Cloudflare Workers via OpenNext; deployed manually with wrangler. Dev now runs Turbopack (compiles roughly 3x faster).
- Supabase (Postgres + RLS) for data, direct Google OIDC for auth (Auth0 removed), Resend for email.
- Solana for on-chain signatures and certificates (Metaplex Bubblegum compressed NFTs).
- Payments rail (Green Invoice card-on-file) remains integrated server-side but is not part of the voting flow.
- Design system: locked brutalist tech-press tokens (np-*), CSS Modules everywhere, Tailwind v4 utilities for the uikit layer only.

## Flags raised during the copy sweep

- MoneyTransparency component is still built entirely around the retired ₪3 fee (split bar, aria-labels). No page renders it today. Delete or rebuild for the free model.
- Launch facts disagree: TrustBar, Pilot and the old Hero hardcode a Kiryat Tivon pilot dated 23.01.26, while dictionaries and structured data say nationwide 04.08.26. Needs one truth.
- Vote creation still costs ₪50 and that is stated consistently (terms, refund, support). Participation is free everywhere.

## Open questions for review

1. Rip the payment step out of ParticipationFlow entirely, or keep it dormant behind a flag?
2. Pricing and economics pages: rewrite for the free model or remove the pages?
3. Community fund: keep describing it as future, or hide until the regulatory gate clears?
4. Launch date on the masthead is 04.08.26. Copy freeze deadline?
