# Requirements: Taruu — P0 Payments + Go-Live

**Defined:** 2026-06-28
**Core Value:** A resident pays ₪6 once a month to vote freely on their city's affairs, and trusts that the civic pool funds the decisions that actually execute.

## v1 Requirements

This milestone: move vote payments to a Green Invoice card-on-file **membership** model — the **first vote of a calendar month costs ₪6, the rest of the month is free** — make the money rails correct and secure, and go live. The ₪6 splits ₪2.10 → monthly civic pool / ₪3.90 → platform. Hard gate (spike + legal + Prime + creds) precedes production payment code.

### Foundation

- [x] **LAND-01**: Land the uncommitted change (Auth0 OIDC swap + Printful removal + RLS `public.user_id()` fix) as one clean commit, including the two cleanups — dead Printful entries in `.dev.vars.example` and orphaned `merch_orders` tracking/`pod_order_id` columns (drop or document as reserved).

### Security Prerequisites

- [ ] **SEC-01**: Corrective migration replaces `auth.uid()` with `public.user_id()` on `treasury_transactions`, `issue_coin_holdings`, and `phone_verifications` policies, so per-user reads work and tables aren't anon-readable — before any card-on-file write to `treasury_transactions`.
- [ ] **SEC-02**: Treasury transactions endpoint (`api/treasury/[municipality]/transactions`) scopes results to the caller's `user_id` for non-admin requests (or strips `userId` and exposes only anonymized aggregates) — no full-ledger enumeration.
- [ ] **SEC-03**: The vote-payment webhook verifies its secret via an HTTP header or payload HMAC (never a `?token=` URL param) and fails closed in production with constant-time comparison.
- [ ] **SEC-04**: The payment idempotency key is generated server-side and deterministically (`{userId}:{type}:{voteId|optionId}`), never using `Date.now()`, so retries dedupe.
- [ ] **SEC-05**: `env.ts` validates the variables actually read at runtime (rename `SUPABASE_SERVICE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`, add the `GREENINVOICE_*` vote-payment vars) and `validateEnv()` runs at app startup (fail-fast).

### Spike & Gate

- [ ] **SPIKE-01**: Green Invoice sandbox spike confirms the saved-card token charge is a valid off-session MIT, documents 3DS/SCA + soft-decline behavior, and verifies `/payments/tokens/{id}/charge` returns a usable document + charge id.
- [ ] **SPIKE-02**: Accountant/legal sign-off on merchant-of-record status — correct GI document type per flow, VAT treatment, refund/credit-note (זיכוי) mechanics, consumer-protection.
- [ ] **SPIKE-03**: GI **Prime** plan provisioned and real Green Invoice + Supabase credentials in place (the ₪0.15/receipt rate the economics depend on).

### Payments (Green Invoice card-on-file)

- [ ] **PAY-01**: A user with no saved card is sent to the GI `/payments/form` hosted page once; on completion the card token + GI client id are stored against the user, with off-session-charge consent captured.
- [ ] **PAY-02**: On a vote, the server checks whether the user has already paid this calendar month. First vote of the month → charge the saved token **₪6** via `/payments/tokens/{id}/charge` (no re-entry) and mark the membership-month paid. Subsequent votes that month → no charge. The month-paid check + write is atomic and idempotent (one charge per member per calendar month, even under concurrent first votes).
- [ ] **PAY-03**: The first (paid) vote of a month is recorded only after payment-success (charge-then-commit); a failed charge records no vote and no membership-month. Free votes commit directly.
- [ ] **PAY-04**: Each ₪6 membership charge accrues a fixed **₪2.10** to the **monthly civic pool** (and ₪3.90 to platform), atomically with the charge commit, idempotent under retries/webhook replay (mirrors `markMerchOrderPaid`). The pool is allocated to the month's executed decisions (allocation policy detailed in the bags spec) — NOT a per-vote treasury credit.
- [ ] **PAY-05**: A declined/expired/missing token shows a localized (Hebrew/RTL) retry/update-card path and never surfaces a raw gateway error.
- [ ] **PAY-06**: Vote creation charges **₪50** through the same token-charge flow (100% platform; not part of the monthly membership; treasury pool not credited on creation).
- [ ] **PAY-07**: Each settled charge (the ₪6 membership charge and the ₪50 create) issues a Green Invoice receipt (חשבונית/קבלה) with correct Israeli private-payer fields, and stores the document id with the transaction.
- [ ] **PAY-08**: Paddle is removed from the vote-payment flow; pricing/messaging states the model as "₪6/month, first vote of the month — then free" and the civic share as "₪2.10/member/month into the civic pool" (not per-vote, not "70%").

### Go-Live

- [ ] **GO-01**: The app deploys to Cloudflare Workers with real credentials and GI Prime live.
- [ ] **GO-02**: An end-to-end money check passes — one real ₪50 create + one real ₪5 participation, money lands, treasury ledger reconciles, webhook idempotent on replay.

## v2 Requirements

### Vote-Bags Treasury Execution (separate later milestone)

- **BAG-01**: The monthly civic pool (₪2.10 × paying members) is allocated to that month's executed decisions, each showing a live balance.
- **BAG-02**: On-chain (Solana) read-only transparency mirror of each bag's lifecycle.
- **BAG-03**: In-house, dual-control vendor payout (KYC + approval + proof-of-execution) — gated on a license/trust structure.
- **BAG-04**: Refund path for failed/cancelled votes (GI credit-note).

### Payment Hardening (post-launch)

- **HARD-01**: Orphaned-charge recovery cron (charged-but-uncommitted / committed-but-uncharged).
- **HARD-02**: Refund/chargeback reversal entries on the treasury ledger.
- **HARD-03**: OAuth login-CSRF fix (server-side signed state + PKCE) on the Auth0 callback.
- **HARD-04**: Constant-time secret compare on cron endpoints; logger secret redaction.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Vote-bags withdrawal/execution | Needs license/trust + legal; separate milestone |
| Prepaid wallet / top-ups | Dropped — GI card-on-file at ₪5 replaces it |
| Batching (multi-vote per charge) | Dropped — one charge + one receipt per vote |
| Crypto custody of civic money (USDC) | Value stays fiat; chain is transparency-only |
| Tourist/foreign-card support | Loses money at any sane vote price; block/flag |
| Mobile payment surfaces | Web-first |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LAND-01 | Phase 1 | Complete |
| SEC-01 | Phase 1 | Pending |
| SPIKE-01 | Phase 2 | Pending |
| SPIKE-02 | Phase 2 | Pending |
| SPIKE-03 | Phase 2 | Pending |
| SEC-02 | Phase 3 | Pending |
| SEC-03 | Phase 3 | Pending |
| SEC-04 | Phase 3 | Pending |
| SEC-05 | Phase 3 | Pending |
| PAY-01 | Phase 3 | Pending |
| PAY-02 | Phase 3 | Pending |
| PAY-03 | Phase 3 | Pending |
| PAY-04 | Phase 3 | Pending |
| PAY-05 | Phase 3 | Pending |
| PAY-06 | Phase 3 | Pending |
| PAY-07 | Phase 3 | Pending |
| PAY-08 | Phase 3 | Pending |
| GO-01 | Phase 4 | Pending |
| GO-02 | Phase 4 | Pending |

**Coverage:** 19/19 v1 requirements mapped — 0 orphaned

---
*Requirements defined: 2026-06-28*
*Traceability populated: 2026-06-28*
*Last updated: 2026-06-28 after initialization*
