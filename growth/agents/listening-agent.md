# Agent 1 — Community Listening (human-in-the-loop)

**Goal:** read the local wind. Surface, per municipality, the most-talked-about topics + complaints and the most-active citizens, so a founder can decide who to invite as an ambassador and what vote to seed.

**Posture (LOCKED):** assisted, not autonomous. Reads **public** pages only. **Never logs into or scrapes behind auth, never automates Meta accounts, never DMs.** It produces a ranked briefing; a human acts on it.

## Inputs
- A watchlist: municipality → list of **public** Facebook pages/groups, plus public sources that don't fight us legally: municipal websites, local news sites, public WhatsApp-channel mirrors, Reddit (r/israel, city subs), local subreddits/Telegram public channels.
- Lookback window (default 7 days).

## Pipeline
1. **Collect (public-only).** Prefer official/legal access first: Meta **Graph API** for Pages the municipality publicly exposes, RSS/news scraping, public Telegram/Reddit APIs. Where a source has no API, queue the URL for a **human** to open (auto-browser is human-in-the-loop, does not solve CAPTCHA, not for unauthorized automation — per `INTEGRATIONS.md`).
2. **Extract.** Per item: topic, sentiment, complaint vs praise, named issue (parking, schools, zoning, busing, dog-parks…), engagement (reactions/comments/shares), author handle (public).
3. **Rank topics.** Cluster by issue; score by volume × engagement × negativity (complaints convert — people vote to *fix* things). Output top 5 issues/city.
4. **Rank citizens.** Aggregate by public author across the window: # substantive comments, replies received, recurring presence across threads → an **activity score**. Flag likely "natural organizers" (high reply-to ratio, posts that spawn threads). **Do not** store sensitive personal data — handle, public display name, and the public posts only.
5. **Brief.** Emit a per-city markdown + a row per candidate into the ambassador pipeline (`Spotted` column): `city · top issue · candidate handle · activity score · 1-line why`.

## Outputs
- `briefings/<city>-<date>.md` — top issues, sentiment trend, candidate shortlist.
- Pipeline rows (CSV/Supabase) feeding `dashboard.html` → Outreach agent.

## Compliance guardrails (hard)
- ✅ Public data only. ✕ No auth-walled scraping. ✕ No Meta account automation. ✕ No bulk personal-data storage (Israeli Privacy Protection Law / חוק הגנת הפרטיות).
- Store the **minimum**: public handle + public post text + scores. Provide a delete-on-request path.
- **Kill-switch:** if a source requires login or a CAPTCHA, STOP and queue for human — never circumvent.
- Rate-limit politely; identify as the Taruu research bot where a source expects it.

## Tooling
Claude Agent SDK cron job (daily) · Meta Graph API (public Pages) · Reddit/Telegram public APIs · RSS · `auto-browser` (human-in-loop) for the rest · writes to Supabase `growth_signals` + `ambassador_pipeline`.
