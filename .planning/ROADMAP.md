# Roadmap: Taruu — P0 Payments + Go-Live

## Overview

Starting from a brownfield Next.js codebase with Paddle vote payments and a working Green Invoice merch rail, this milestone moves vote payments to a Green Invoice card-on-file monthly membership (first vote of the month ₪6, rest free), makes the money rails correct and secure, and ships a live product. Four phases, sequenced by hard dependencies: land the coherent working-tree change first, validate the GI integration in sandbox before writing a line of production payment code, build all payment rails and security hardening together, then go live once the external gates (legal sign-off, GI Prime provisioning) have cleared.

## Phases

- [x] **Phase 1: Clean Foundation** - Land the uncommitted change and corrective RLS migration — clean, secure base before payment rails
- [x] **Phase 2: Spike + Gate** - Validate GI card-on-file in sandbox (hard technical gate); initiate parallel external tracks (legal sign-off, Prime plan) (completed 2026-06-30)
- [ ] **Phase 3: Payment Rails + Hardening** - Build complete GI card-on-file vote payment loop with full security hardening
- [ ] **Phase 4: Go-Live** - Deploy with real credentials, run end-to-end money check, reconcile treasury

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

## Progress

**Execution Order:** 1 → 2 → 3 → 4
(SPIKE-02/03 run as parallel external tracks during Phase 2 and Phase 3; they gate Phase 4 only)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Clean Foundation | 2/2 | Done | 2026-06-29 |
| 2. Spike + Gate | 2/2 | Complete   | 2026-06-30 |
| 3. Payment Rails + Hardening | 0/TBD | Not started | - |
| 4. Go-Live | 0/TBD | Not started | - |

### Phase 5: Space governance substrate and space-admin operations dashboard

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Nothing — independent of the v1.0 payments track (phases 1–4). Appended scope from issue #75.
**Canonical refs:** `.planning/phases/05-space-governance-substrate-and-space-admin-operations-dashboard/05-CONTEXT.md`, issue #75
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 5 to break down)
