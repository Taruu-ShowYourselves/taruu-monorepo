---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 05-02-PLAN.md
last_updated: "2026-08-02T16:09:17.732Z"
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 20
  completed_plans: 6
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-28)

**Core value:** A resident pays ₪6 once a month to vote freely on their city's affairs, and trusts that the civic pool funds the decisions that actually execute.
**Current focus:** Phase 05 — space-governance-substrate-and-space-admin-operations-dashboard

## Current Position

Phase: 05 (space-governance-substrate-and-space-admin-operations-dashboard) — EXECUTING
Plan: 3 of 16

## ▶ RESUME HERE (after /clear)

**Phase 5 is EXECUTING** (16 plans, 6 waves). **Wave 1 is complete** — plans 05-01 and 05-02 both landed.

- 05-01 (governance substrate — DB tables, two-file `vote_status` split, `types.ts`); see `05-01-SUMMARY.md`.
- 05-02 (capability vocabulary, review transitions, QUOTA_EXCEEDED, rollout flag, full contract surface); see `05-02-SUMMARY.md`.

Outstanding from 05-01: the Phase 5 migrations have **never been applied to a live Postgres** (no Docker/psql on the exec machine). `supabase/tests/audit_append_only.sql` is committed but uncaptured. 05-16 owns that verification.

For plans 03–09: import the capability vocabulary from `apps/web/src/server/domain/space/capability.ts`, the review rules from `.../space/review.ts`, and **every** request/response shape from `packages/shared/src/contracts/spaceAdmin.ts`. That contract file is complete for the phase — no later plan should need to edit it, or `apps/web/src/server/http/errors.ts`.

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
| Phase 05-space-governance-substrate-and-space-admin-operations-dashboard P01 | 7 min | 3 tasks | 6 files |
| Phase 05-space-governance-substrate-and-space-admin-operations-dashboard P02 | 12 min | 3 tasks | 10 files |

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
- [Phase 05-space-governance]: spaces.id reuses municipalities.council_id — the public council page and the administered space are the same object, no mapping table
- [Phase 05-space-governance]: vote_status extension MUST stay split across two migration files; Postgres rolls back ADD VALUE if the same transaction uses the new label
- [Phase 05-space-governance]: All four new vote_status labels anchor BEFORE 'pending' (a pre-existing label), never chained onto each other
- [Phase 05-space-governance]: space_audit_log is append-only by trigger + REVOKE, not RLS — the service role has BYPASSRLS; ON DELETE RESTRICT on both FKs makes SPACE-09 structurally true
- [Phase 05-space-governance]: Eleven-capability manifest is DB-enforced by CHECK and authoritative; 05-RESEARCH.md's draft vocabulary (space.read, proposal.decide, grant.manage, notification.compose) is SUPERSEDED
- [Phase 05-space-governance]: Audit actions are past tense (proposal.approved), capabilities imperative (proposal.approve) — not interchangeable; only 'proposal.approved' is structurally load-bearing via uq_space_proposal_single_approval
- [Phase 05-space-governance]: platform_escalations.space_id is nullable by design, paired with non-null raw_space_id, so the escalation endpoint cannot be used as a space-existence oracle
- [Phase 05-space-governance]: types.ts writers in phase 5 are 05-01 (wave 1) and 05-08 (wave 3) ONLY; 05-07 must not edit it, which is why space_admin_metrics is pre-typed
- [Phase 05-space-governance]: TS capability vocabulary in server/domain/space/capability.ts matches the DDL CHECK list identifier-for-identifier and in order — verified after both wave-1 plans landed
- [Phase 05-space-governance]: No twelfth `space.read` capability — reaching the dashboard shell is membership (holding ≥1 grant), resolved by resolveMembership() in 05-04, not a capability
- [Phase 05-space-governance]: proposal.reject covers request-changes as well as reject; only proposal.approve publishes. Do not add a separate request-changes capability
- [Phase 05-space-governance]: `pending` keeps its existing meaning ("scheduled, not started") and is NOT a decidable review state — pinned by test in review.test.ts
- [Phase 05-space-governance]: QUOTA_EXCEEDED → 429 with body {error:'Quota exceeded', code:'QUOTA_EXCEEDED'} only — no scope, count or limit leaked; localized text lives in the UI keyed off `code`
- [Phase 05-space-governance]: Notification quota is a CALENDAR MONTH with a reset date (`מכסה חודשית`), not a rolling 24h window
- [Phase 05-space-governance]: Escalations write to platform_escalations only, never to a space audit log — the log is append-only and any authenticated user can escalate, so there is deliberately no `escalation.raised` audit action
- [Phase 05-space-governance]: packages/shared/src/contracts/spaceAdmin.ts is the phase's COMPLETE contract surface — plans 03–09 import from it and must not reopen it or errors.ts
- [Phase 05-space-governance]: SpaceSummary.type stays z.string() rather than an enum so the contract does not fork the DDL's space-type list that #74 will extend
- [Phase 05-space-governance]: SPACE_ADMIN_ENABLED=false is the whole-dashboard kill switch (default on); rollback touches no governance table and no audit history

### Roadmap Evolution

- Phase 5 added: Space governance substrate and space-admin operations dashboard (issue #75) — out-of-milestone scope from the Grand Release Crunchtime board, appended rather than opened as a new milestone so the incomplete v1.0 payments phases are not archived

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 2 gate: SPIKE-01 (GI sandbox spike) must clear before Phase 3 coding begins
- Phase 4 external gate: SPIKE-02 (legal/accountant sign-off) + SPIKE-03 (GI Prime + real creds) must resolve before go-live
- CONCERNS.md flags: tourist/foreign-card surcharge (~3.5%) erodes the ₪6 charge — block or flag at charge time
- CONCERNS.md flags: Auth0 callback has no server-side state/CSRF validation — deferred to v2 HARD-03
- Phase 5 migrations (20260802000001-3) are unapplied and unproven — no Docker/psql on the exec machine; supabase/tests/audit_append_only.sql is committed but no transcript captured. 05-16 owns applying them to a scratch DB.

## Session Continuity

Last session: 2026-08-02T16:09:17.728Z
Stopped at: Completed 05-02-PLAN.md
Resume file: None
