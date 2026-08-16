# .agentic — PR autopilot (design: docs/PR-AUTOPILOT.md)

Conservative two-lane agentic delivery. GitHub is the only control surface;
email (Resend) is the notify feed; specs are human-approved before any code.

## Run (from repo root)
    node .agentic/runner/src/main.ts board          # admit candidates by priority
    node .agentic/runner/src/main.ts admit 22 rls-hotfixes
    node .agentic/runner/src/main.ts tick           # one pass over active lanes
    node .agentic/runner/src/main.ts daemon 10      # tick every 10 minutes
    node .agentic/runner/src/main.ts status

Requires: node ≥24, gh (authed), codex CLI, claude CLI, RESEND_API_KEY in env.

## Layout
    config.json     lanes/budgets/models/email — the knobs
    prompts/        versioned seat prompts (researcher/planner/parser/coder/reviewer)
    templates/      RESEARCH + SPEC templates
    specs/          per-lane RESEARCH.md + spec versions (committed via lane branches)
    memory/         bounded per-area verified facts — written only on merge
    lanes/          durable lane state (json) — the ONLY inter-step memory
    metrics/        per-lane jsonl: laps, defect trajectories, exit reasons, USD
    worktrees/      lane worktrees (gitignored)

## Gates
Spec gate: reply on the lane's draft PR — `agent: approve spec` / `agent: changes — …` / `agent: park`.
PR gate: normal GitHub review. `changes requested` re-enters the loop (budget resets once; 2nd rejection parks).
