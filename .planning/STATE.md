---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 02-spike-gate plan 01 (02-01-PLAN.md)
last_updated: "2026-06-30T07:22:13.014Z"
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 4
  completed_plans: 4
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-28)

**Core value:** A resident pays ₪6 once a month to vote freely on their city's affairs, and trusts that the civic pool funds the decisions that actually execute.
**Current focus:** Phase 01 — clean-foundation

## Current Position

Phase: 01 (clean-foundation) — COMPLETE
Plan: 2 of 2 (all plans done)

## ▶ RESUME HERE (after /clear)

**Phase 1 is COMPLETE.** Run `/gsd:execute-phase 2` to begin Phase 2 (GI sandbox spike).

Phase 1 completed:

- 01-01 (LAND-01): Auth0 OIDC swap, Printful POD removal, RLS user_id helper fix — commit 44961e0
- 01-02 (SEC-01): Corrective RLS migration for treasury/issue_coin/phone_verifications per-user policies — commit 31d6860

After Phase 1: Phase 2 = GI sandbox spike (the gate). Start the slow external tracks NOW in parallel — GI Prime plan provisioning + accountant/legal merchant-of-record sign-off — neither is code; both gate go-live.

Open question to resolve before Phase 3 planning: **monthly civic-pool allocation policy** (how the month's ₪2.10×members pool splits across executed decisions).

## Performance Metrics

**Velocity:**

- Total plans completed: 2
- Average duration: ~5 min
- Total execution time: ~13 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-clean-foundation | 2 | ~13 min | ~6.5 min |

**Recent Trend:**

- Last 5 plans: 8 min (P01), 3 min (P02)
- Trend: fast

*Updated after each plan completion*
| Phase 01-clean-foundation P01 | 8 min | 3 tasks | 32 files |
| Phase 01-clean-foundation P02 | 3 min | 2 tasks | 1 file |
| Phase 02-spike-gate P02 | 2 | 2 tasks | 2 files |
| Phase 02-spike-gate P01 | 4 | 3 tasks | 4 files |

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
- [Phase 01-clean-foundation]: auth.uid() replaced with public.user_id() on treasury_transactions, issue_coin_holdings, phone_verifications per-user SELECT policies — built-in helper returns NULL under custom JWT
- [Phase 01-clean-foundation]: USING(true) public-read policies on treasury and issue_coins deliberately left untouched — balances and token info are public by product design
- [Phase 02-spike-gate]: Tourist/foreign-card surcharge (~3.5%) captured as explicit block-or-flag decision gate in GI-PRIME-CHECKLIST.md
- [Phase 02-spike-gate]: Both SPIKE-02/03 checklist docs flagged PENDING/external-human-track — gate Phase 4 go-live only, not Phase 3 build
- [Phase 02-spike-gate]: chargeToken() appended to greenInvoice service — extend, not rebuild; mirrors createPaymentForm auth pattern
- [Phase 02-spike-gate]: type:320 reused in chargeToken() — same GI document-issuance type as createPaymentForm
- [Phase 02-spike-gate]: Spike harness uses plain console.log only (no @/lib/logger) — tsx-clean, no Next.js path-alias deps

### Roadmap Evolution

- Phase 5 added (2026-08-02): **RBAC + Admin Review** — role model, one server-side authorization helper, community-manager application + admin review console, append-only role audit. From GitHub issue #79, split out as the role/approval half ("79a"). Carries no payment code.
- Phase 6 added (2026-08-02): **Manager Billing + Subscription** — ₪50/month community-manager subscription on the GI token rail with a full billing state machine gating role activation. From GitHub issue #79, the billing half ("79c").
- Sequencing decision (2026-08-02): both land **after** Phase 4 go-live, so manager onboarding never delays the voter launch during the 08-04 crunch. Phase 5 is unblocked by the GI sandbox gate; Phase 6 is blocked on it.

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 2 gate: SPIKE-01 (GI sandbox spike) must clear before Phase 3 coding begins
- Phase 4 external gate: SPIKE-02 (legal/accountant sign-off) + SPIKE-03 (GI Prime + real creds) must resolve before go-live
- CONCERNS.md flags: tourist/foreign-card surcharge (~3.5%) erodes the ₪6 charge — block or flag at charge time
- CONCERNS.md flags: Auth0 callback has no server-side state/CSRF validation — deferred to v2 HARD-03
- **SPIKE-01 completion is contested (found 2026-08-02):** REQUIREMENTS.md and ROADMAP.md both mark SPIKE-01 complete, but `apps/web/docs/SPIKE-RESULT.md` Part A is still seven `(pending live run)` rows and plan `02-01-PLAN.md` is unchecked in the roadmap. Nobody appears to have run `pnpm spike:gi --charge` against the GI sandbox. This gates Phase 3 as well as Phase 6 — resolve before either is planned.
- **Phase 6 blocker — GI has no subscription object:** `chargeToken()` (`apps/web/src/services/greenInvoice/index.ts:220`) is a one-shot off-session MIT charge. Monthly recurring billing means Taruu owns the scheduler, renewal state, and retry policy; the provider does not.
- **Phase 6 blocker — Cloudflare cron gate:** `apps/web/wrangler.jsonc:58` records that the schedules API rejected the cron list behind an account-level gate; only `0 */6 * * *` is live. A monthly renewal job needs that gate resolved or an alternative trigger.

## Session Continuity

Last session: 2026-06-30T07:22:13.010Z
Stopped at: Completed 02-spike-gate plan 01 (02-01-PLAN.md)
Resume file: None
