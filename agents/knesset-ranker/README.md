# @sync/knesset-ranker

The desk's off-platform agents. Three jobs on the **Claude Agent SDK** with
your local Claude Code session — none needs an `ANTHROPIC_API_KEY`:

- **`docs`** — attaches each day-order item's official document and writes a
  short neutral Hebrew summary (`knesset_items.summary`).
- **`rank`** — scores every active Knesset vote for editorial hotness
  (`knesset_rankings`).
- **`art`** — renders one duotone background plate per active vote
  (`vote_card_art` + the `vote-art` storage bucket). The render step
  additionally needs the Higgsfield CLI (`higgsfield auth login`).

`docs` feeds `rank`: the summary is what the ranker reads to judge an item.

## docs — document summaries

Pulls the official document attached to each day-order item (bill text /
agenda-proposal text) from `fs.knesset.gov.il`, extracts it (docx → fflate →
plain text) and stores a 2–4 sentence neutral Hebrew summary, so the vote
page can explain what is actually on the table.

Work-queue semantics: items never attempted come first, and every attempt
stamps `summarized_at` — even doc-less ones — so repeated runs converge
instead of re-grinding the same rows. Transient failures leave the stamp
unset and get retried.

This job ran in the Cloudflare Worker until 2026-07-29 (`/api/cron/knesset-docs`),
which forced a raw Anthropic API call: the Agent SDK spawns the `claude` CLI
as a child process and reads credentials from disk, and a Worker isolate has
neither. Moving it here removed the last API-key dependency.

## rank — editorial hotness

Reads active Knesset votes
(title + AI document summary from `knesset_items`), asks a Claude agent to
judge each item on two axes — `relevance` (0–100, does the topic touch the
public) and `stakes` (0–100, what actually changes if it passes;
ceremonial/declaratory items score low regardless of resonance) — and to
hunt live Israeli press coverage **of the item itself** with WebSearch
(general topic coverage is out of bounds: for a memorial-day item, articles
about the tragedy don't count, only articles about the bill). The agent
never scores media coverage — the code does (`src/media.ts`):

- every coverage URL is HTTP-validated (HEAD, GET fallback; 404/410/network
  failure = dead — dead refs never count and never render);
- hits are filtered to Israeli press outlets (`.il` domains minus
  institutions, plus known Israeli outlets on foreign TLDs) published within
  the last 14 days;
- each counted outlet contributes a freshness weight that halves every
  4 days (undated hits count at a flat 0.4), so heat measures what the
  press is writing **now**, not what it wrote two weeks ago;
- the media sub-score maps the decay-weighted outlet total through a fixed
  editorial table (0→0, 1→35, 3→68, 6→90 …), interpolated between steps;
- `hotness = round(0.45·media + 0.35·stakes + 0.20·relevance)` — stakes
  falls back to relevance on rows ranked before v3.

Each row carries the full audit trail in `knesset_rankings.media_evidence`:
search queries, every hit with HTTP status / freshness / classification /
whether it counted, the outlet count and validation time. `media_refs` keeps
only validated counted refs (one per outlet) for the desk's evidence strip.

## art — card-art plates

Turns each active vote (every desk, municipal and national) into one faded
background plate for its front-page tile. A Claude agent compresses the
Hebrew title+description into one concrete English scene line (objects only
— no names, no flags, no text in the scene); the code wraps it in the fixed
house style — **two-colour risograph screenprint, black ink + pillarbox red
on newsprint cream, halftone, brutalist civic linocut** (the same recipe
that produced the merch and certificate plates) — and renders it through
the **Higgsfield CLI** (`generate create <model> --wait --json`; the same
account that produced those assets). `--image-model` / `HIGGSFIELD_IMAGE_MODEL`
picks the model — default `z_image`, 0.15 credits/plate (gpt_image_2 is 7;
beware `nano_banana_2` = Nano Banana *Pro*); `higgsfield generate cost
<model> --prompt …` checks; `--limit` (default 12) caps a run's spend. Renders run sequentially — the account
allows 4 concurrent jobs and the desk shares it with hand-run generations.
The result is downscaled to an 800px WebP with sharp, uploaded to the
public `vote-art` bucket and recorded in `vote_card_art`. Desk tiles print
the plate at ~14% opacity under the type; the lead ink tile inverts it.

Work-queue semantics: a stored plate is permanent; a failed attempt stamps
`attempted_at` and is retried after `--retry-hours` (default 24). `--dry-run`
prints scenes and prompts without spending.

## Prerequisites

- Claude Code installed and logged in on this machine (`claude` on PATH).
- Supabase service-role credentials in the environment (falls back to
  `apps/web/.env.local`): `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`) and
  `SUPABASE_SERVICE_ROLE_KEY`.

## Run

```bash
pnpm --filter @sync/knesset-ranker docs            # summarize pending documents
pnpm --filter @sync/knesset-ranker docs -- --limit 8
pnpm --filter @sync/knesset-ranker docs -- --dry-run

pnpm --filter @sync/knesset-ranker rank            # rank stale/unranked votes
pnpm --filter @sync/knesset-ranker rank -- --limit 6
pnpm --filter @sync/knesset-ranker rank -- --stale-hours 6
pnpm --filter @sync/knesset-ranker rank -- --dry-run   # print, don't write

pnpm --filter @sync/knesset-ranker test            # unit tests
```

Both accept `--model` (or `RANKER_MODEL`) to pin the model — useful when the
default one is spend-capped.

Votes ranked within the last `--stale-hours` (default 24) are skipped, so
both scripts are safe to run on a schedule. `scripts/deploy.sh` installs them
on the agents box as cron entries: `docs` every 30 minutes, `rank` every 6
hours.
