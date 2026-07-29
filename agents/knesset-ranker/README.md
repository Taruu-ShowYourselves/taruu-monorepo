# @sync/knesset-ranker

Editorial hotness ranker for the Knesset desk. Reads active Knesset votes
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

Built on the **Claude Agent SDK** — authenticates with your local Claude Code
session, so no `ANTHROPIC_API_KEY` is needed.

## Prerequisites

- Claude Code installed and logged in on this machine (`claude` on PATH).
- Supabase service-role credentials in the environment (falls back to
  `apps/web/.env.local`): `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`) and
  `SUPABASE_SERVICE_ROLE_KEY`.

## Run

```bash
pnpm --filter @sync/knesset-ranker rank            # rank stale/unranked votes
pnpm --filter @sync/knesset-ranker rank -- --limit 6
pnpm --filter @sync/knesset-ranker rank -- --stale-hours 6
pnpm --filter @sync/knesset-ranker rank -- --dry-run   # print, don't write
```

Votes ranked within the last `--stale-hours` (default 24) are skipped, so the
script is safe to run on a schedule (cron / launchd on the agents box).
