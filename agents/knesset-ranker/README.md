# @sync/knesset-ranker

Editorial hotness ranker for the Knesset desk. Reads active Knesset votes
(title + AI document summary from `knesset_items`), asks a Claude agent to
judge how relevant and pressing each item is to the Israeli public and how
much media coverage it currently draws (the agent verifies with live web
search), and writes a 0–100 hotness score per vote into `knesset_rankings`.
The web app's Knesset desk orders its topics by this score.

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
