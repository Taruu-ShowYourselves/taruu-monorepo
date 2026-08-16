# Autopilot host onboarding (Dolev — 10 minutes)

The PR autopilot is a conservative two-lane delivery loop (full design:
`docs/PR-AUTOPILOT.md`). Sahar's instance already runs on the Hermes VM.
Yours runs on your machine, works only issues **assigned to you**, and
mails **you**. The two daemons split the board by assignee — they never
touch each other's work.

## Setup

```bash
git clone https://github.com/Taruu-ShowYourselves/taruu-monorepo   # or cd to your clone
cd taruu-monorepo && git pull
bash .agentic/setup-host.sh
```

The script checks node ≥24, installs the `claude` + `codex` CLIs, walks you
through `gh` / `codex login` / `claude setup-token` if missing, writes your
gitignored host identity (`.agentic/config.local.json` — your email + your
GitHub login as the assignee filter), asks for the Resend key (optional —
without it you just don't get emails; the PR comments carry everything),
and installs a systemd user service that ticks every 10 minutes.

## How work flows

1. The daemon picks the highest-priority board item **assigned to you**
   with status **Todo** (M0 → P0 → P1 → …). It never grabs In-Progress
   work and never re-opens parked lanes.
2. Codex researches the current codebase state and drafts a whole spec;
   a **draft PR** opens with the spec as its first commit.
3. **Gate 1 — you, on the PR:** reply in a comment:
   - `agent: approve spec` — implementation starts (Opus 5, isolated worktree)
   - `agent: changes — <what's wrong>` — spec revises
   - `agent: park` — lane stops
   No code is written before your approval. If the spec touches protected
   paths (migrations, workflows, payments), your approve comment must
   quote those paths explicitly or the runner rejects it.
4. Implementation runs ≤2 laps with deterministic verification between
   laps (typecheck, tests, screenshot gates). Then the PR flips
   ready-for-review with a gate/evidence table.
5. **Gate 2 — normal GitHub review:** approve → you merge; request
   changes → your comment is parsed into named defects and the loop runs
   once more. A second rejection parks the lane for a human.

## Ground rules baked in

- Agents never merge, never push to main, never approve.
- WIP limit 2 per host; the two lanes can't claim overlapping paths.
- Every model call is budget-capped and cost-logged (`.agentic/metrics/`).
- A lane that keeps blowing its context budget parks with
  `scope_too_big` instead of burning tokens.

## Useful commands (from repo root)

```bash
node .agentic/runner/src/main.ts status     # your lanes
node .agentic/runner/src/main.ts board      # what it'll pick next
node .agentic/runner/src/main.ts admit <n> <slug>   # force a specific issue
journalctl --user -u taruu-autopilot -f     # daemon logs
systemctl --user stop taruu-autopilot       # pause the whole thing
```
