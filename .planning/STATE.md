---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 01-clean-foundation plan 01 (LAND-01)
last_updated: "2026-06-29T06:34:49.497Z"
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 2
  completed_plans: 1
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-28)

**Core value:** A resident pays ₪6 once a month to vote freely on their city's affairs, and trusts that the civic pool funds the decisions that actually execute.
**Current focus:** Phase 01 — clean-foundation

## Current Position

Phase: 01 (clean-foundation) — EXECUTING
Plan: 1 of 2

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
| Phase 01-clean-foundation P01 | 8 | 3 tasks | 32 files |

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
- [Phase 01-clean-foundation]: AUTH0_DOMAIN server var removed from env schema — bare var had no readers; NEXT_PUBLIC_AUTH0_DOMAIN and AUTH0_CLIENT_SECRET retained
- [Phase 01-clean-foundation]: POD columns (pod_order_id, tracking_number, tracking_url, carrier) dropped via idempotent migration 20260628000001 — Printful definitively abandoned
- [Phase 01-clean-foundation]: supabase/.temp/ and .mcp.json gitignored — machine-specific scratch files

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 2 gate: SPIKE-01 (GI sandbox spike) must clear before Phase 3 coding begins
- Phase 4 external gate: SPIKE-02 (legal/accountant sign-off) + SPIKE-03 (GI Prime + real creds) must resolve before go-live
- CONCERNS.md flags: tourist/foreign-card surcharge (~3.5%) erodes the ₪6 charge — block or flag at charge time
- CONCERNS.md flags: Auth0 callback has no server-side state/CSRF validation — deferred to v2 HARD-03

## Session Continuity

Last session: 2026-06-29T06:34:49.493Z
Stopped at: Completed 01-clean-foundation plan 01 (LAND-01)
Resume file: None
