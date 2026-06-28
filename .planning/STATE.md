# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-28)

**Core value:** A resident can pay for a civic vote and trust that the fixed ₪2.10 civic share reaches the treasury — every vote, provably, with the platform solvent on each transaction.
**Current focus:** Phase 1 — Clean Foundation

## Current Position

Phase: 1 of 4 (Clean Foundation)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-06-28 — Roadmap created (4 phases, 19 requirements mapped)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Rail swap: Green Invoice card-on-file replaces Paddle for vote payments (2026-06-27)
- Pricing locked: participation ₪5, creation ₪50, GI Prime plan required, no batching (2026-06-28)
- Treasury: fixed ₪2.10/vote (not 70%) — civic promise is an amount
- Uncommitted working-tree change (Auth0 + Printful removal + RLS): verdict = coherent + landable as one commit
- SPIKE-02/03 (legal, Prime plan) are parallel external tracks — gate go-live, not the rails build

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 2 gate: SPIKE-01 (GI sandbox spike) must clear before Phase 3 coding begins
- Phase 4 external gate: SPIKE-02 (legal/accountant sign-off) + SPIKE-03 (GI Prime + real creds) must resolve before go-live
- CONCERNS.md flags: tourist/foreign-card surcharge (~3.5%) makes ₪5 votes lose money — block or flag at charge time
- CONCERNS.md flags: Auth0 callback has no server-side state/CSRF validation — deferred to v2 HARD-03

## Session Continuity

Last session: 2026-06-28
Stopped at: Roadmap created — ready to run /gsd:plan-phase 1
Resume file: None
