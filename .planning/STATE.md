# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-28)

**Core value:** A resident pays ₪6 once a month to vote freely on their city's affairs, and trusts that the civic pool funds the decisions that actually execute.
**Current focus:** Phase 1 — Clean Foundation

## Current Position

Phase: 1 of 4 (Clean Foundation)
Plan: 0 of 2 executed (both PLANs written + plan-checker PASSED)
Status: **PLANNED & VERIFIED — ready to execute**
Next action: `/gsd:execute-phase 1`  (run after `/clear` for a fresh window)
Last activity: 2026-06-29 — Phase 1 planned + verified; membership pricing pivot reconciled across all docs

Progress: [░░░░░░░░░░] 0%

## ▶ RESUME HERE (after /clear)

**Run `/gsd:execute-phase 1`** — executes 2 plans in 2 waves:
- 01-01 (LAND-01): land the uncommitted Auth0 + Printful-removal + RLS-fix bundle as one `feat(foundation):` commit (+ cleanups: dead PRINTFUL_* in .dev.vars.example, drop orphaned merch_orders columns). **Owner confirmed Auth0 IS intended.**
- 01-02 (SEC-01): new corrective migration `auth.uid()`→`public.user_id()` on treasury_transactions / issue_coin_holdings / phone_verifications, as a `fix(rls):` commit.

The Auth0/Printful app-code change is intentionally still in the working tree (19 files) — Phase 1 plan 01-01 stages + commits it with an explicit file list (NOT `git add -A`; growth/ + .planning/ already committed separately and stay out).

After Phase 1: Phase 2 = GI sandbox spike (the gate). Start the slow external tracks NOW in parallel — GI Prime plan provisioning + accountant/legal merchant-of-record sign-off — neither is code; both gate go-live.

Open question to resolve before Phase 3 planning: **monthly civic-pool allocation policy** (how the month's ₪2.10×members pool splits across executed decisions).

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
- Pricing CHANGED to MEMBERSHIP (2026-06-29): first vote of a calendar month = ₪6, rest of month FREE; creation ₪50; GI Prime required. The ₪6 splits ₪2.10 → monthly civic pool / ₪3.90 → platform (net ₪2.47/member/mo). (Supersedes the ₪5/vote model.)
- Treasury: ₪2.10/member/month → monthly POOL allocated to the month's executed decisions (NOT per-vote — free votes can't fund per-vote treasury)
- Growth bet: Target band (₪40k take-home) needs ~8,000 monthly members + 900 creates — ~1.5-2x old engagement
- Uncommitted working-tree change (Auth0 + Printful removal + RLS): verdict = coherent + landable as one commit
- SPIKE-02/03 (legal, Prime plan) are parallel external tracks — gate go-live, not the rails build

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 2 gate: SPIKE-01 (GI sandbox spike) must clear before Phase 3 coding begins
- Phase 4 external gate: SPIKE-02 (legal/accountant sign-off) + SPIKE-03 (GI Prime + real creds) must resolve before go-live
- CONCERNS.md flags: tourist/foreign-card surcharge (~3.5%) erodes the ₪6 charge — block or flag at charge time
- CONCERNS.md flags: Auth0 callback has no server-side state/CSRF validation — deferred to v2 HARD-03

## Session Continuity

Last session: 2026-06-28
Stopped at: Roadmap created — ready to run /gsd:plan-phase 1
Resume file: None
