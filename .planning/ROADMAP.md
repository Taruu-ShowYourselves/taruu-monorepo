# Roadmap: Taruu — P0 Payments + Go-Live

## Overview

Starting from a brownfield Next.js codebase with Paddle vote payments and a working Green Invoice merch rail, this milestone moves vote payments to a Green Invoice card-on-file monthly membership (first vote of the month ₪6, rest free), makes the money rails correct and secure, and ships a live product. Four phases, sequenced by hard dependencies: land the coherent working-tree change first, validate the GI integration in sandbox before writing a line of production payment code, build all payment rails and security hardening together, then go live once the external gates (legal sign-off, GI Prime provisioning) have cleared. Two further phases, added from GitHub issue #79, follow go-live: the role/approval system Taruu has never had, then the ₪50/month community-manager subscription built on top of it.

## Phases

- [x] **Phase 1: Clean Foundation** - Land the uncommitted change and corrective RLS migration — clean, secure base before payment rails
- [x] **Phase 2: Spike + Gate** - Validate GI card-on-file in sandbox (hard technical gate); initiate parallel external tracks (legal sign-off, Prime plan) (completed 2026-06-30)
- [ ] **Phase 3: Payment Rails + Hardening** - Build complete GI card-on-file vote payment loop with full security hardening
- [ ] **Phase 4: Go-Live** - Deploy with real credentials, run end-to-end money check, reconcile treasury
- [ ] **Phase 5: RBAC + Admin Review** - Role model, server-side authorization helper, and the human approval console for community-manager applicants (issue #79a) — no billing
- [ ] **Phase 6: Manager Billing + Subscription** - ₪50/month community-manager subscription on the GI token rail, with a full billing state machine gating role activation (issue #79c)

## Phase Details

### Phase 1: Clean Foundation
**Goal**: The codebase is a coherent, deployable base — uncommitted Auth0/Printful/RLS change landed, the latent HIGH RLS bug corrected on treasury and phone tables, no dead artifacts remaining.
**Depends on**: Nothing (first phase)
**Requirements**: LAND-01, SEC-01
**Success Criteria** (what must be TRUE):
  1. The working-tree change (Auth0 OIDC swap + Printful service/webhook/test deletion + existing RLS fixes + dead Printful `.dev.vars.example` entries + orphaned `merch_orders` tracking/`pod_order_id` columns) lands as a single clean commit with green CI — no compilation errors, tests pass.
  2. A new corrective migration replaces `auth.uid()` with `public.user_id()` on `treasury_transactions`, `issue_coin_holdings`, and `phone_verifications` policies — authenticated users' per-user SELECT policies now return their own rows instead of nothing.
  3. The `merch_orders` RLS migration (already in tree) is in effect: anon-key reads of merch orders are denied.
  4. No dead code artifacts remain: Printful webhook and fulfillment-service files are gone, `.dev.vars.example` contains no `PRINTFUL_*` entries, and orphaned tracking/pod columns are either dropped via migration or documented as reserved.
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Land the Auth0/Printful/RLS bundle + cleanups (dead env vars, orphaned merch_orders POD columns, gitignore CLI temp) as one clean commit [LAND-01] — commit 44961e0
- [x] 01-02-PLAN.md — New corrective RLS migration: auth.uid() to public.user_id() on treasury_transactions, issue_coin_holdings, phone_verifications [SEC-01] — commit 31d6860

### Phase 2: Spike + Gate
**Goal**: The GI card-on-file integration is technically verified in sandbox (hard gate — no production payment code before this clears); the slow external dependencies (accountant/legal sign-off and GI Prime provisioning) are initiated as parallel tracks that must resolve before go-live.
**Depends on**: Phase 1

> **Note on SPIKE-02 and SPIKE-03:** These are parallel external tracks, not sequential coding blockers. Accountant/legal sign-off (SPIKE-02) and GI Prime plan provisioning (SPIKE-03) can be pursued concurrently with Phase 3 payment rails build. They gate Phase 4 (go-live) only. SPIKE-01 (sandbox verification) is the only item here that gates the start of Phase 3.

**Requirements**: SPIKE-01, SPIKE-02, SPIKE-03
**Success Criteria** (what must be TRUE):
  1. A documented sandbox result confirms that `POST /payments/tokens/{id}/charge` is a valid off-session MIT — actual 3DS/SCA and soft-decline behavior is observed and recorded, the API returns a usable document id + charge id in the same response.
  2. The integration sequence — card setup via `/payments/form`, webhook delivery, token persistence, repeat token charge — is traced end-to-end in sandbox with no undocumented surprises; any deviations from the merch flow (different webhook shape, header vs query-param secret, settlement timing) are documented.
  3. Accountant/legal sign-off is obtained (or a written timeline is in place) covering: correct GI document type per flow (חשבונית קבלה vs חשבונית מס), VAT treatment, refund/credit-note (זיכוי) mechanics, and consumer-protection obligations under Israeli law.
  4. GI Prime plan (₪0.15/receipt rate) is provisioned and confirmed in writing; real `GREENINVOICE_*` and Supabase production credentials are staged in the Cloudflare Workers secret store; written merchant clearing terms (actual clearing %, hard minimums, brand/tourist-card surcharges, settlement payout threshold) are on file.
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md — GI card-on-file sandbox spike harness (chargeToken MIT call + guarded runner) + SPIKE-RESULT trace [SPIKE-01]
- [ ] 02-02-PLAN.md — External-track checklists: legal/accountant merchant-of-record + GI Prime/creds/clearing terms [SPIKE-02, SPIKE-03]

### Phase 02.1: Participation Persistence (INSERTED — URGENT)

**Goal**: A resident's free vote is actually recorded. The participation flow reaches the server, the ballot lands in `user_votes`, the tally and participant count move, and the receipt states only what is true — no fabricated blockchain seal.
**Depends on**: Nothing (P0 defect on live traffic; independent of the payment gate)
**Source**: `.planning/v1.0-MILESTONE-AUDIT.md` — P0 finding, outside the original requirement set
**Requirements**: VOTE-01, VOTE-02, VOTE-03, VOTE-04, VOTE-05
**Context**: Commit `cfa5d25` (2026-07-29) made participation free but never resolved the payment-shaped contract on the participate API — the UI bypassed it instead. `apps/web/src/app/[locale]/votes/[id]/flow/ParticipationFlow.tsx:149-157` seals the vote with `mockHash()` (`crypto.getRandomValues` over 32 bytes) plus a fabricated block number, sets local React state, and stops; the file contains zero `fetch()` calls. `/api/votes/[id]/participate` is fully orphaned (zero client references) and still rejects any body without `paymentTxId` (`route.ts:52`, 402 at `:136-145`) while hardcoding ₪3 semantics (3 tokens at `:190-194`, `amount: 3` at `:224`, `tokensEarned: 3` at `:253`). `recordUserVote` has exactly two call sites — `payments/webhook/route.ts:191` (requires a completed GI payment) and the unreachable participate route (`:200`) — so no free vote can ever persist. This ships on taruu.co.il today.
**Success Criteria** (what must be TRUE):
  1. A signed-in, residency-verified resident casting a free vote produces a `user_votes` row, an `incrementVoteOption` bump, and an updated `participant_count` — verified by reading the row back after a real request, not by a client-state assertion.
  2. `/api/votes/[id]/participate` accepts a free-participation body with no `paymentTxId` and never returns 402 for it; it remains gated on session and residency, and a double submission (double-click, retry, replay) records exactly one vote rather than a second row or a 500.
  3. `ParticipationFlow.tsx` calls the endpoint and advances to the receipt only after a server-confirmed write; a failed or rejected write shows a Hebrew/RTL error and no seal, and never leaves the user believing an unrecorded vote was counted.
  4. `mockHash()` is gone and no user-facing copy claims a blockchain seal (`נחתם`, `✓ חתום בבלוקצ׳יין · בלתי ניתן לשינוי`) unless an actual chain write backs it — the receipt states only verifiable facts about the recorded ballot.
  5. The ₪3 legacy is reconciled across the monorepo: the participate route no longer mints 3 tokens or emails `amount: 3` on a free vote, and `packages/shared/src/constants/index.ts` no longer leaves mobile (`apps/mobile/app/vote/[id].tsx:340`) charging ₪3 for what web gives free.
**Plans**: TBD

Plans:
- [ ] TBD (run `/gsd:plan-phase 02.1` to break down)

### Phase 3: Payment Rails + Hardening
**Goal**: A voter sets up their card once and votes freely all month after a single ₪6 first-vote-of-the-month charge — the full GI card-on-file membership loop (card setup, once-per-calendar-month token charge, charge-then-commit, monthly-pool accrual, receipt, Paddle cutover) is implemented, idempotent, and hardened against the security gaps identified in CONCERNS.md.
**Depends on**: Phase 1 (corrective RLS migration in place), Phase 2 SPIKE-01 cleared (sandbox verified)
**Requirements**: SEC-02, SEC-03, SEC-04, SEC-05, PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06, PAY-07, PAY-08
**Success Criteria** (what must be TRUE):
  1. A user with no saved card is redirected to the GI hosted card-entry page; on completion their GI token id is persisted against their user record; every subsequent vote in the same session (and in a new session) charges the saved token without prompting for card details.
  2. The first vote of a calendar month atomically charges ₪6 and commits the ballot; subsequent votes that month commit free with no charge. A failed/declined first-vote charge records no vote and no membership-month; a double-click, concurrent first vote, or webhook replay charges once and accrues one pool row — the once-per-month idempotency key collision returns the original result, not a second charge.
  3. Each ₪6 membership charge accrues exactly ₪2.10 to the monthly civic pool (`treasury_ledger` append-only row, ₪3.90 to platform); one, zero, or many webhook deliveries of the same event produce exactly one pool row per member per month.
  4. Vote creation charges ₪50 through the same token-charge flow (100% platform, not part of membership, no pool credit); Paddle is removed from the vote-payment route; the `/api/payments/create` pricing endpoint and all user-facing copy state the model as "₪6/month — first vote then free" and the civic share as "₪2.10/member/month to the civic pool" (not per-vote, not "70%").
  5. A declined, expired, or missing token shows a Hebrew/RTL message with a card-update path — no raw gateway error string is ever surfaced to the user; a GI receipt (חשבונית מס/קבלה) with correct Israeli private-payer fields is issued and its document id stored with every settled charge.
  6. The payments webhook verifies its secret via a constant-time header comparison (not `?token=` URL param), fails closed in production on any secret mismatch or DB error; the idempotency key is `{userId}:{voteId}:{action}` generated server-side; `env.ts` validates all runtime-read vars (including renamed `SUPABASE_SERVICE_ROLE_KEY` and new `GREENINVOICE_*` vars) at app startup with fail-fast behavior; the treasury transactions endpoint scopes results to the caller's `user_id` or exposes only anonymized aggregates.
**Plans**: TBD

### Phase 4: Go-Live
**Goal**: The platform is live — real Israeli residents pay ₪6 on their first vote of the month and vote free after, the ₪2.10 civic share reaches the monthly pool, and the end-to-end money flow reconciles with zero open mismatches.
**Depends on**: Phase 3 (payment rails complete) + SPIKE-02/03 cleared (legal sign-off obtained, GI Prime provisioned with real credentials)
**Requirements**: GO-01, GO-02
**Success Criteria** (what must be TRUE):
  1. The app deploys to Cloudflare Workers with real GI Prime credentials, all production secrets validated at startup (no `validateEnv()` failures), and the Cloudflare Worker serving live traffic without errors.
  2. A real ₪50 vote-creation charge lands in the GI dashboard, a חשבונית with correct Israeli private-payer fields is issued, and the charge id + document id are stored in the internal `transactions` table.
  3. A real ₪6 first-vote-of-month membership charge lands; the `treasury_ledger` shows exactly ₪2.10 accrued to the monthly pool; a second vote that month charges nothing; a webhook replay produces no second ledger row.
  4. GI settlement report, internal `transactions` table, and `treasury_ledger` reconcile to zero open mismatches after the end-to-end check — every settled charge has a matching ledger row, every ledger row has a matching settled charge.
**Plans**: TBD

### Phase 5: RBAC + Admin Review

**Goal**: Taruu has a real authorization system — a role model, one server-side authorization helper enforced on every privileged route, and a human review console where an admin approves, rejects, or suspends a community-manager applicant with a recorded reason. Approval is modeled as a standalone prerequisite that by itself grants nothing.
**Depends on**: Phase 4 (go-live ships first; this is post-launch work)
**Source**: GitHub issue #79 (split — this is the role/approval half, "79a")
**Requirements**: RBAC-01, RBAC-02, RBAC-03, RBAC-04
**Context**: The codebase currently has **no** role concept at all — `users` (`supabase/migrations/20240101000000_initial_schema.sql:24`) has no role column, and there is not a single `is_admin` / `super_admin` / `space_admin` check anywhere in `apps/web/src`. Everything in issue #79 that reads "platform or authorized space admins review applicants" and "super admins may suspend" presumes infrastructure that does not exist yet. This phase builds it, with no money involved, so it can proceed regardless of the Green Invoice sandbox gate.
**Success Criteria** (what must be TRUE):
  1. A roles/role-grants schema exists with `super_admin`, `space_admin`, and `community_manager`, scoped per space where applicable; grants are rows with an explicit lifecycle, not a boolean column on `users`.
  2. One server-side authorization helper is the single enforcement point, and every privileged route calls it — authorization is never inferred client-side and never derived from payment state.
  3. An applicant can submit a community-manager application; an admin sees it in a review console and can approve, reject, or suspend it, and every one of those transitions records an actor, a timestamp, and a reason.
  4. An **approved** applicant with no billing has **no** manager access — approval alone changes no authorization outcome (issue #79 acceptance criteria 1 and 2, role half).
  5. Every grant, revocation, and suspension writes an append-only audit row that survives the role change itself; RLS denies anon-key reads of applications and audit rows.
**Plans**: 7 plans in 5 waves

Plans:
- [ ] 05-01-PLAN.md — Schema: role_grants + community_manager_applications + append-only role_grant_events, DB types, shared Zod contracts (wave 1)
- [ ] 05-02-PLAN.md — Authorization core: pure policy, role repository, and `requireRole` — the single enforcement point (wave 2)
- [ ] 05-03-PLAN.md — Applicant API: POST/GET /api/manager-applications (wave 3)
- [ ] 05-04-PLAN.md — Admin review API: scoped queue, approve/reject, suspend/reinstate/revoke, audit on every transition (wave 3)
- [ ] 05-05-PLAN.md — Applicant screen /he/settings/community-manager + UX-only roles on the profile (wave 4)
- [ ] 05-06-PLAN.md — Admin review console /he/admin/manager-applications (wave 4)
- [ ] 05-07-PLAN.md — Manual gate: apply migration, anon-key RLS + append-only proof, super_admin bootstrap, visual evidence (wave 5, checkpoints)

### Phase 6: Manager Billing + Subscription

**Goal**: An approved community-manager applicant subscribes for ₪50/month on the Green Invoice token rail and holds scoped access only while approval **and** billing are both live — with a full billing state machine, idempotent renewals, and reconciliation.
**Depends on**: Phase 5 (role model + authorization helper), Phase 3 (shared GI token-charge rail, webhook, idempotency, treasury), Phase 2 SPIKE-01 **actually cleared**
**Source**: GitHub issue #79 (split — this is the billing half, "79c")
**Requirements**: MGR-01, MGR-02, MGR-03, MGR-04, MGR-05
**Context and open risks**:
  - **The sandbox gate is not actually closed.** `apps/web/docs/SPIKE-RESULT.md` Part A is still seven rows of `(pending live run)`, and `.planning/ROADMAP.md` plan `02-01-PLAN.md` is unchecked even though Phase 2 is marked complete. Issue #79's own Risks section says to confirm provider contracts first. Someone must run `pnpm spike:gi --charge` against the GI sandbox before any renewal code is written.
  - **Green Invoice has no subscription object.** `chargeToken()` (`apps/web/src/services/greenInvoice/index.ts:220`) is a one-shot off-session MIT charge. "Monthly ₪50" therefore means Taruu owns the scheduler, the renewal state, and the retry policy — the provider does not.
  - **The renewal scheduler needs a cron slot that Cloudflare currently refuses.** `apps/web/wrangler.jsonc:58` records that the schedules API rejected the cron list at deploy behind an account-level gate; only `0 */6 * * *` is active. Resolve the gate or pick an alternative trigger before planning the renewal job.
**Success Criteria** (what must be TRUE):
  1. A successful ₪50 charge from someone who was never approved grants **no** manager access, and an approved applicant gains scoped access only after billing activation is confirmed server-side (issue #79 acceptance criteria 1 and 2, billing half).
  2. The states `active`, `past_due`, `grace`, `cancelled`, `rejected`, `suspended`, and `expired` exist with explicit, recorded transitions; a super admin can suspend access independently of billing, with the reason stored.
  3. Duplicate or replayed renewal events produce exactly one charge, one invoice, and one role transition — idempotency keys are generated server-side, and no raw card data is ever stored.
  4. Cancellation and the failed-payment grace policy produce predictable, documented access outcomes, and the user is notified on every state change that affects their access.
  5. A reconciliation check matches GI settlement records against internal subscription and charge rows with zero open mismatches; on any ambiguous payment state the role stays inactive (the issue's stated rollback posture).
**Plans**: TBD

## Progress

**Execution Order:** 1 → 2 → **02.1** → 3 → 4 → 5 → 6
(SPIKE-02/03 run as parallel external tracks during Phase 2 and Phase 3; they gate Phase 4 only)
(Phases 5 and 6 are the two halves of issue #79, deliberately sequenced **after** go-live so manager onboarding never delays the voter launch. Phase 5 carries no payment code and is unblocked by the GI sandbox gate; Phase 6 is blocked on it.)
(Phase 02.1 is an urgent insertion from the v1.0 audit — a P0 on live traffic. It depends on nothing and should run before any further phase work, including Phase 5.)

> **Post-audit status (2026-08-02):** `.planning/v1.0-MILESTONE-AUDIT.md` found 2/28 requirements satisfied. Phase 2's three requirement artifacts are unfilled templates, so its gate is **not** actually passed. Phase 3's requirements (PAY-02/03/04/08) and GO-02 are **contradicted** by shipped free participation, not merely unbuilt — they need re-scoping before Phase 3 can be planned. Statuses below reflect the roadmap as written, not the audit's findings.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Clean Foundation | 2/2 | Done (audit: partial — see AUDIT) | 2026-06-29 |
| 2. Spike + Gate | 2/2 | Complete (audit: gate NOT passed) | 2026-06-30 |
| 02.1 Participation Persistence | 0/TBD | **Not started — P0, URGENT** | - |
| 3. Payment Rails + Hardening | 0/TBD | Blocked — requirements contradicted, needs re-scope | - |
| 4. Go-Live | 0/TBD | Not started (audit: GO-01 de-facto partial) | - |
| 5. RBAC + Admin Review | 0/TBD | Not started — unblocked; carries issue #76 | - |
| 6. Manager Billing + Subscription | 0/TBD | Not started | - |
