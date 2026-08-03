---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 02.1-05-PLAN.md (participation-persistence, plan 5 of 5 — phase complete)
last_updated: "2026-08-02T14:54:29.413Z"
progress:
  total_phases: 8
  completed_phases: 3
  total_plans: 18
  completed_plans: 9
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-28)

**Core value:** A resident votes freely on their city's affairs, and supporters who believe in the cause fund the civic pool by buying into its token — so the money behind executed decisions is visible and anyone can join it.
**Current focus:** Phase 02.1 COMPLETE. Phase 3 re-scoped 2026-08-03 (commit 1b3fe1e + roadmap criteria rewrite) — **ready to plan**.

## Current Position

Phase: 02.1 (participation-persistence) — COMPLETE (5/5 plans, VOTE-01..05 all satisfied)
Plan: 5 of 5 (all plans complete)

## ▶ RESUME HERE (after /clear)

**Next step: `/gsd:plan-phase 3`.** Phase 3 is re-scoped and plannable as written.

The re-scope is done (2026-08-03). REQUIREMENTS.md retired PAY-01..05 outright (the ₪6/month card-on-file membership is a product Taruu no longer sells — `cfa5d25` made participation free), corrected PAY-06's mechanism to the GI **hosted form** (`services/payments/greenInvoice.ts:213`, which already works) rather than the token-charge flow, narrowed PAY-07/08, added COIN-01..04 for the Bags.fm token that now funds the civic pool, and rewrote GO-02 to drop its impossible participation leg. ROADMAP.md's Phase 3 and Phase 4 success criteria were rewritten to match — they had been left describing the ₪6 membership and would have mis-briefed the planner.

**Plan Phase 3 as two independent tracks.** The security block (SEC-02..05) and the ₪50 creation rail (PAY-06..08) depend on nothing external and can execute immediately. The token block (COIN-01..04) sits behind COIN-01 — written Israeli legal sign-off on securities status, treasury custody, and permissible claims — which is a human external track, not code. Keep the coin work in its own wave so the phase can ship its security and creation-fee value without waiting on a lawyer.

Prior instruction, now complete: ~~`/gsd:plan-milestone-gaps` to re-scope Phase 3.~~ Done by direct requirement rewrite instead — `plan-milestone-gaps` creates phases to *build* audit gaps, which for the contradicted PAY-* requirements would have meant building the abandoned membership.

Prior instruction, now complete: ~~Run `/gsd:execute-phase 02.1`. Phase 02.1 is planned and verified — 5 plans in 2 waves, all autonomous. This is a P0 on live traffic, and it depends on nothing.~~

Plans: wave 1 = `02.1-01` (shared/api-client free contract), `02.1-02` (`recordUserVoteOnce` + server eligibility), `02.1-03` (₪3 legacy retirement) — fully parallel, zero file overlap. Wave 2 = `02.1-04` (participate route rewrite, RED→GREEN over the existing 30-test suite), `02.1-05` (client `submitParticipation` + honest receipt).

Plan-checker verdict: PASSED on iteration 2. One blocker was found and fixed — three tasks verified against test files created later in the same plan, which vitest reports as `No test files found, exit 1`; they now gate on `pnpm --filter @sync/web typecheck` plus a positive grep. `pnpm --filter @sync/web typecheck` was confirmed green on the current tree before being wired in as a gate.

Three things the planner found that the audit missed, all verified against code:

- A participate-route test already exists — `apps/web/src/__tests__/api/vote-participation.test.ts`, 693 lines, 30 passing tests — and its `participate` describe locks in the payment contract (402, 503, `tokensEarned: 3`). Plan 04 rewrites that block in place; the `verify-location` and `participated` describes must survive.
- There is no component-test setup at all: `environment: 'node'`, no jsdom, no `@testing-library/react`, and the include glob never collects `.tsx`. Rather than add a DOM stack mid-P0, plan 05 extracts the network logic to `submitParticipation.ts` with an injected `fetch` and asserts component copy against source.
- **The receipt stage is currently unreachable.** `sealVote()` calls `onComplete()` synchronously → `page.tsx:227` `showFlow = isActive && !hasVoted` flips false → the flow unmounts before the receipt renders. Users actually land on the results panel reading `הצבעתכם נקלטה ונחתמה בבלוקצ׳יין` (`page.tsx:524`). Plan 05 defers `onComplete(optionId)` to a receipt CTA and sweeps that copy too.

Server eligibility is being tightened, not relaxed: `identity_score >= 40` AND (`verification_status === 'verified'` OR `completed_check_ins >= 1`) — an exact mirror of `isEligibleToVote`. Locks out nobody, since `auth/callback/route.ts:87` sets 40 for every Google sign-in.

`.planning/v1.0-MILESTONE-AUDIT.md` (2026-08-02, commit 6c71835) audited the milestone at **2/28 requirements satisfied** and found a defect no requirement covered:

- `apps/web/src/app/[locale]/votes/[id]/flow/ParticipationFlow.tsx:149-157` seals a vote with a client-side `mockHash()` and a fabricated block number, then stops. The file has zero `fetch()` calls.
- `/api/votes/[id]/participate` is orphaned (zero client references) and still requires `paymentTxId` (`route.ts:52`, 402 at `:136-145`).
- `recordUserVote` only runs behind a completed GI payment (`payments/webhook/route.ts:191`), so no free vote persists at all.
- Live consequence: residents see `נחתם` / `✓ חתום בבלוקצ׳יין` for votes that were never recorded.

Phase 02.1 (VOTE-01..05) closes it. After that, the two decisions the audit forces:

1. **Phase 3 needs re-scoping, not planning.** PAY-02/03/04/08 and GO-02 are contradicted by shipped free participation — they describe a ₪6/month membership the product no longer sells (`PricingContent.tsx:64-65` says `אין מנוי, אין דמי חבר`). Rewrite or retire them via `/gsd:plan-milestone-gaps`.
2. **Phase 2's gate was never passed.** SPIKE-RESULT.md 0/7 fields, GI-LEGAL 0/19, GI-PRIME 0/24 — while `wrangler.jsonc:74` already runs `GREENINVOICE_ENV=production`.

GitHub issue #76 (municipality onboarding + authority dashboard) is queued behind Phase 5 — it needs RBAC-01..04's role model, authorization helper, admin review console, and audit table. It is a continuation of Phase 5, not a separate milestone.

Open question, still unresolved and now less urgent: **monthly civic-pool allocation policy** (moot until the pricing model is re-decided).

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
| Phase 02.1-participation-persistence P01 | 12min | 3 tasks | 6 files |
| Phase 02.1 P03 | 6min | 3 tasks | 5 files |
| Phase 02.1-participation-persistence P02 | 10min | 3 tasks | 3 files |
| Phase 02.1 P04 | 10min | 2 tasks | 2 files |
| Phase 02.1 P05 | 14min | 3 tasks | 7 files |

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
- [Phase 02.1-participation-persistence]: [02.1-01] Participate contract/types stripped of paymentTxId/qubikTxHash/gpsCoordinates/tokensEarned; ParticipateResponseSchema gains alreadyRecorded for idempotent-duplicate success
- [Phase 02.1]: [Phase 02.1-participation-persistence]: VOTE_COST retired from @sync/shared in favour of explicit VOTE_PARTICIPATION_COST=0; legacy GI vote_participation rail pinned to a local ₪3 literal (deliberately unchanged, deferred to Phase 3 re-scope) rather than importing the retired name
- [Phase 02.1-participation-persistence]: [02.1-02] recordUserVoteOnce added alongside recordUserVote (not a replacement) — payments webhook keeps the throwing signature; idempotency keyed off SQLSTATE 23505 read-back
- [Phase 02.1-participation-persistence]: [02.1-02] Server voter eligibility reconciles cleanly with the client's isEligibleToVote — identity_score>=40 kept AND residency rule mirrored exactly, no divergence to flag
- [Phase 02.1]: [Phase 02.1-participation-persistence]: [02.1-04] Route rewritten to the free contract: recordUserVoteOnce persists the ballot, tally/participant_count bump gated on created, no 402/503, no token mint, no receipt email
- [Phase 02.1]: [Phase 02.1-participation-persistence]: [02.1-04] Route's response returns the server row's id/created_at (never a client timestamp) and alreadyRecorded on a duplicate submit, matching ParticipateResponseSchema exactly for plan 05
- [Phase 02.1]: [02.1-05] onComplete now fires only from the receipt's own CTA (not from the write itself), passing the recorded optionId, fixing the bug where sealVote() unmounted the flow before the receipt could render

### Roadmap Evolution

- Phase 5 added (2026-08-02): **RBAC + Admin Review** — role model, one server-side authorization helper, community-manager application + admin review console, append-only role audit. From GitHub issue #79, split out as the role/approval half ("79a"). Carries no payment code.
- Phase 6 added (2026-08-02): **Manager Billing + Subscription** — ₪50/month community-manager subscription on the GI token rail with a full billing state machine gating role activation. From GitHub issue #79, the billing half ("79c").
- Sequencing decision (2026-08-02): both land **after** Phase 4 go-live, so manager onboarding never delays the voter launch during the 08-04 crunch. Phase 5 is unblocked by the GI sandbox gate; Phase 6 is blocked on it.
- Phase 02.1 inserted after Phase 2 (2026-08-02): **Participation Persistence** — record free votes server-side, drop the participate route's payment-shaped contract, remove the `mockHash()` blockchain-seal claim, reconcile the ₪3 legacy across web and mobile (VOTE-01..05). URGENT — P0 found by the v1.0 milestone audit, live on taruu.co.il, depends on nothing.
- GitHub issue #76 (municipality onboarding + authority dashboard) triaged 2026-08-02: **belongs to the Phase 5 line, not a new milestone.** Its acceptance criteria — super-admin approval before a verified badge, representative role isolation, append-only official responses, audit log — are RBAC-01..04's infrastructure. Add as a phase after 5 once 5 is planned; do not fork it into a parallel milestone.

- Phase 8 added (2026-08-03): **Municipality Onboarding + Authority Dashboard** — organization verification behind super-admin evidence review, scoped representative invitations, authority-only dashboard over aggregate civic data, append-only versioned official responses, commitment tracking, and aggregate satisfaction. From GitHub issue #76. Built entirely on Phase 5's RBAC primitives (role grants, authorization helper, review console, audit table) — it is a continuation of that line, not an independent milestone. Sequenced after Phase 7 so two organizations' data are not separated by an unenforced RLS boundary.

### Pending Todos

None yet.

### Blockers/Concerns

- **P0 CLOSED (2026-08-02):** free participation was not persisted — residents were shown a blockchain-seal receipt for votes that were never recorded. Phase 02.1 (VOTE-01..05) is now complete end to end: the server persists every free ballot idempotently through `recordUserVoteOnce` (plan 04), and the client (`ParticipationFlow.tsx`, plan 05) only shows a receipt after that persistence is confirmed via `submitParticipation`, with `mockHash()` and every chain-seal claim removed from the casting funnel. Manual production verification (cast a real vote as a verified resident, confirm the receipt shows a real `user_votes.id`) is still recommended before considering this fully closed on live traffic — see `02.1-05-SUMMARY.md`'s Next Phase Readiness.
- ~~**Milestone requirements are partly wrong (2026-08-02)**~~ **RESOLVED 2026-08-03.** PAY-01..05 retired, PAY-06/07/08 and GO-02 rewritten, COIN-01..04 added, ROADMAP Phase 3/4 success criteria rewritten to match. Phase 3 is plannable.
- **COIN-01 is a hard external gate (2026-08-03):** a tradeable token whose proceeds fund a civic treasury raises Israeli securities and consumer-protection questions. Written legal sign-off blocks every other COIN requirement, and it is stricter than SPIKE-02's merchant-of-record sign-off — not a reuse of it. Nothing in the repo can clear it.
- **Production GI runs in front of an unverified gate:** `wrangler.jsonc:74` sets `GREENINVOICE_ENV=production` while `GI-PRIME-CHECKLIST.md` is 0/24 and `GI-LEGAL-CHECKLIST.md` is 0/19.
- **CI deploy has been broken since 2026-07-28:** `.github/workflows/deploy.yml:62` references an unset `CLOUDFLARE_API_TOKEN`; 5/5 most recent runs failed. The live site is manual-deploy only.
- **`validateEnv()` is dead code** (`apps/web/src/lib/env.ts:135`, zero callers) and would fail closed on production if wired — it still requires four `AUTH0_*` vars that `da77848` orphaned, plus `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` which no reader uses (runtime reads `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`).
- **Mobile still charges ₪3** (`apps/mobile/app/vote/[id].tsx:340`) — `cfa5d25` was web-only and `packages/shared/src/constants/index.ts:6` still exports `VOTE_COST = 3`.
- Phase 2 gate: SPIKE-01 (GI sandbox spike) must clear before Phase 3 coding begins
- Phase 4 external gate: SPIKE-02 (legal/accountant sign-off) + SPIKE-03 (GI Prime + real creds) must resolve before go-live
- CONCERNS.md flags: tourist/foreign-card surcharge (~3.5%) erodes the ₪6 charge — block or flag at charge time
- CONCERNS.md flags: Auth0 callback has no server-side state/CSRF validation — deferred to v2 HARD-03
- **SPIKE-01 completion is contested (found 2026-08-02):** REQUIREMENTS.md and ROADMAP.md both mark SPIKE-01 complete, but `apps/web/docs/SPIKE-RESULT.md` Part A is still seven `(pending live run)` rows and plan `02-01-PLAN.md` is unchecked in the roadmap. Nobody appears to have run `pnpm spike:gi --charge` against the GI sandbox. This gates Phase 3 as well as Phase 6 — resolve before either is planned.
- **Phase 6 blocker — GI has no subscription object:** `chargeToken()` (`apps/web/src/services/greenInvoice/index.ts:220`) is a one-shot off-session MIT charge. Monthly recurring billing means Taruu owns the scheduler, renewal state, and retry policy; the provider does not.
- **Phase 6 blocker — Cloudflare cron gate:** `apps/web/wrangler.jsonc:58` records that the schedules API rejected the cron list behind an account-level gate; only `0 */6 * * *` is live. A monthly renewal job needs that gate resolved or an alternative trigger.

## Session Continuity

Last session: 2026-08-02T14:43:10.978Z
Stopped at: Completed 02.1-05-PLAN.md (participation-persistence, plan 5 of 5 — phase complete)
Resume file: None
