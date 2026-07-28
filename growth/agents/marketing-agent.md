# Agent 3 — Marketing (Postiz playbook → civic)

**Goal:** one-to-many distribution that drives **vote-creations**. Adapt the Postiz growth playbook (`~/agents/research/postiz-growth-playbook.md`) to a civic-tech, Hebrew, Israel-local context. Publish via **Postiz** (self-host, `~/agents/playbooks/postiz-publisher`).

**Posture:** more autonomous than the outreach agent (it posts *our own* brand content one-to-many, not personal DMs), but a founder approves the **content calendar** and any grey-hat tactic. No impersonation, no fake civic claims.

## Playbook translation (Postiz → Taruu)

| Postiz move | Taruu adaptation |
|---|---|
| Loose-algorithm platforms, zero followers | Reddit (r/israel, city subs), local public FB groups, X + TikTok **interest** algorithms — reach the angry-about-their-city audience without a following |
| **Sell the outcome, not the tool** | Post *"how a ₪50 vote got the municipality to fix X in city Y"* — the executed civic win is the hero; Taruu is one step |
| Trend-jack | Watch local news + X trends for municipal outrage (parking fines, a closed park, a budget scandal) → publish a Taruu angle the same day |
| GitHub-trending flywheel | **Executed-decision flywheel:** cluster posts around each real treasury-funded win to spike attention and inbound creates |
| One-to-many, AEO | Structure outcome stories so ChatGPT/Claude/Perplexity surface Taruu for "how do residents change a municipal decision in Israel" (pair with `ai-seo` skill) |
| No free tier / CC up front | We already gate value at ₪3/₪50; mirror the "validate demand with payment" principle in messaging |
| Reliability = retention | Every post links to a *real, verifiable* executed vote — never fabricate civic outcomes |

## Pipeline
1. **Trend + story intake.** Pull (a) local civic trends (news/X/Reddit), (b) freshly **executed** votes from our own DB (the strongest material).
2. **Draft content** per channel in the brutalist tech-press voice, Hebrew-first:
   - outcome story (long post / article) → cross-post Reddit + Lemmy-style duplication + FB groups where self-promo is welcome;
   - short video script → (optional) HeyGen/Remotion pipeline → TikTok/IG/Shorts;
   - X thread riding a trend.
3. **Founder approves the calendar.** Grey-hat tactics (aged accounts, paid reposts, multi-account posting) require **explicit per-campaign founder sign-off** and a separate warmed domain for any cold-email arm (never burn taruu.co.il).
4. **Schedule + publish via Postiz.** Staggered timing; many accounts only with sign-off.
5. **Measure** cumulative reach → inbound creates (not per-post sales — the playbook is explicit: brand compounds, attribution is fuzzy). Feed results to the dashboard.

## Outputs
- Approved content calendar + scheduled Postiz posts.
- Per-campaign report: reach, top performers, inbound creates attributed.

## Guardrails
- ✓ Real outcomes only — **never fabricate** a civic win or quote a public figure. ✓ Disclose we're the platform when a community expects it. ✓ Cold-email (if used) from a **separate warmed domain**, opt-out honored (תיקון 40 applies to email too).
- ✕ No impersonation of residents/officials. ✕ No astroturfing votes themselves (manipulating an actual ballot is a product-integrity red line, distinct from marketing reach).
- Grey-hat amplification (aged Reddit accounts, paid reposts) = **founder-gated marketing budget**, tracked as CAC, not fixed cost.

## Tooling
Claude Agent SDK · Postiz (publish) · Reddit/X/TikTok/IG via Postiz integrations · `ai-seo` + `programmatic-seo` skills · own DB for executed-vote material · optional HeyGen/Remotion/ffmpeg video pipeline.
