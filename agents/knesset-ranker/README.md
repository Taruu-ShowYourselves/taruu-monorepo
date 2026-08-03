# @sync/knesset-ranker

The Knesset desk's off-platform agents. Two jobs, both on the **Claude Agent
SDK** with your local Claude Code session — neither needs an
`ANTHROPIC_API_KEY`:

- **`docs`** — attaches each day-order item's official document and writes a
  short neutral Hebrew summary (`knesset_items.summary`).
- **`rank`** — scores every active Knesset vote for editorial hotness
  (`knesset_rankings`).

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
judge how relevant and pressing each item is to the Israeli public
(`relevance`, 0–100) and to hunt live Israeli press coverage with WebSearch.
The agent never scores media coverage — the code does (`src/media.ts`):

- every coverage URL is HTTP-validated (HEAD, GET fallback; 404/410/network
  failure = dead — dead refs never count and never render);
- hits are filtered to Israeli press outlets (`.il` domains minus
  institutions, plus known Israeli outlets on foreign TLDs) published within
  the last 14 days;
- the media sub-score is a fixed table over the count of **distinct** live
  outlets (0→0, 1→35, 3→68, 6→90 …);
- `hotness = round(0.6·relevance + 0.4·media)`.

Each row carries the full audit trail in `knesset_rankings.media_evidence`:
search queries, every hit with HTTP status / freshness / classification /
whether it counted, the outlet count and validation time. `media_refs` keeps
only validated counted refs (one per outlet) for the desk's evidence strip.

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
