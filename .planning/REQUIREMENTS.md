# Requirements: Taruu — P0 Payments + Go-Live

**Defined:** 2026-06-28
**Core Value:** A resident pays ₪6 once a month to vote freely on their city's affairs, and trusts that the civic pool funds the decisions that actually execute.

## v1 Requirements

This milestone: move vote payments to a Green Invoice card-on-file **membership** model — the **first vote of a calendar month costs ₪6, the rest of the month is free** — make the money rails correct and secure, and go live. The ₪6 splits ₪2.10 → monthly civic pool / ₪3.90 → platform. Hard gate (spike + legal + Prime + creds) precedes production payment code.

### Foundation

- [x] **LAND-01**: Land the uncommitted change (Auth0 OIDC swap + Printful removal + RLS `public.user_id()` fix) as one clean commit, including the two cleanups — dead Printful entries in `.dev.vars.example` and orphaned `merch_orders` tracking/`pod_order_id` columns (drop or document as reserved).

### Security Prerequisites

- [x] **SEC-01**: Corrective migration replaces `auth.uid()` with `public.user_id()` on `treasury_transactions`, `issue_coin_holdings`, and `phone_verifications` policies, so per-user reads work and tables aren't anon-readable — before any card-on-file write to `treasury_transactions`. *(Done: 20260628000002_fix_rls_user_id_helper.sql — commit 31d6860)*
  > **Necessary but not sufficient — superseded by RLS-01..05 (Phase 5) and MIG-01..04 (Phase 7).** Discovered 2026-08-02 while researching Phase 5: SEC-01 corrected the *policies*, which were genuinely wrong, but the *transport* that would make any policy match was never wired up. `public.user_id()` (`20240101000001_rls_policies.sql:10-21`) reads `request.jwt.claims->>'sub'` first and falls back to `app.current_user_id`; nothing ever sets either. `withUserContext()` (`apps/web/src/lib/supabase/server.ts:67`) calls `set_claim('user_id', …)`, which writes `app.user_id` — a different key — and has zero call sites; even with the name fixed, `set_config(…, true)` is transaction-local and PostgREST is stateless HTTP, so the value would not survive to the next query. All real traffic uses the service-role client, which bypasses RLS entirely. SEC-01's policies are correct and remain correct; they simply never evaluate. Do not re-open SEC-01 — the corrective work is tracked below.
- [ ] **SEC-02**: Treasury transactions endpoint (`api/treasury/[municipality]/transactions`) scopes results to the caller's `user_id` for non-admin requests (or strips `userId` and exposes only anonymized aggregates) — no full-ledger enumeration.
- [ ] **SEC-03**: The vote-payment webhook verifies its secret via an HTTP header or payload HMAC (never a `?token=` URL param) and fails closed in production with constant-time comparison.
- [ ] **SEC-04**: The payment idempotency key is generated server-side and deterministically (`{userId}:{type}:{voteId|optionId}`), never using `Date.now()`, so retries dedupe.
- [ ] **SEC-05**: `env.ts` validates the variables actually read at runtime (rename `SUPABASE_SERVICE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`, add the `GREENINVOICE_*` vote-payment vars) and `validateEnv()` runs at app startup (fail-fast).

### Spike & Gate

- [x] **SPIKE-01**: Green Invoice sandbox spike confirms the saved-card token charge is a valid off-session MIT, documents 3DS/SCA + soft-decline behavior, and verifies `/payments/tokens/{id}/charge` returns a usable document + charge id.
- [x] **SPIKE-02**: Accountant/legal sign-off on merchant-of-record status — correct GI document type per flow, VAT treatment, refund/credit-note (זיכוי) mechanics, consumer-protection.
- [x] **SPIKE-03**: GI **Prime** plan provisioned and real Green Invoice + Supabase credentials in place (the ₪0.15/receipt rate the economics depend on).

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

### Participation Persistence (Phase 02.1 — P0 from the v1.0 audit, URGENT)

Free participation shipped in `cfa5d25` without resolving the participate API's payment-shaped contract; the UI bypassed the server entirely. These requirements exist because the live site currently shows residents a signed-and-sealed receipt for votes it never records.

- [ ] **VOTE-01**: `/api/votes/[id]/participate` accepts a free-participation request with no `paymentTxId` and never returns 402 for it, while remaining gated on session and residency — the payment-shaped contract is removed, not bypassed. (Contract layer done in plan 02.1-01, server eligibility check done in plan 02.1-02; route itself still pending plan 02.1-04.)
- [ ] **VOTE-02**: The participation flow calls the server and reaches the receipt only on a confirmed write; a rejected or failed write shows a Hebrew/RTL error and no seal. A repeated submission records exactly one vote.
- [ ] **VOTE-03**: A recorded free vote produces a `user_votes` row, an `incrementVoteOption` bump, and an updated `participant_count` — the same persistence the paid path got via `recordUserVote`. (Idempotent insert primitive `recordUserVoteOnce` done in plan 02.1-02; route wiring still pending plan 02.1-04.)
- [ ] **VOTE-04**: `mockHash()` is removed and no user-facing copy claims a blockchain seal unless an actual chain write backs it; the receipt states only verifiable facts about the recorded ballot.
- [ ] **VOTE-05**: The ₪3 legacy is reconciled — the participate route stops minting 3 tokens and emailing `amount: 3` for a free vote, and `packages/shared/src/constants/index.ts` no longer leaves mobile charging ₪3 for what web gives free. (Contract layer done in plan 02.1-01, mobile copy done in plan 02.1-03; route mint/email removal still pending plan 02.1-04.)

### RBAC + Admin Review (Phase 5 — issue #79a, post-launch)

- [ ] **RBAC-01**: A roles/role-grants schema exists with `super_admin`, `space_admin`, and `community_manager`, scoped per space where applicable — grants are rows with an explicit lifecycle, not a boolean column on `users`.
- [ ] **RBAC-02**: A single server-side authorization helper is the only enforcement point for privileged routes; authorization is never inferred client-side and never derived from payment state.
- [ ] **RBAC-03**: A community-manager application can be submitted and reviewed in an admin console — approve, reject, and suspend each record an actor, a timestamp, and a reason. Approval alone changes no authorization outcome.
- [ ] **RBAC-04**: Every grant, revocation, and suspension writes an append-only audit row that outlives the role change, and RLS denies anon-key reads of applications and audit rows.

### RLS Foundation (Phase 5 — corrective, supersedes SEC-01's transport gap)

- [ ] **RLS-01**: A server-side minter issues a short-lived Supabase access token from an already-verified session — HS256 over the Supabase project JWT secret, `sub` = the user's UUID, `role` and `aud` = `authenticated`, expiry measured in minutes not days. The long-lived `sync-session` cookie is never itself sent to PostgREST.
- [ ] **RLS-02**: A user-scoped Supabase client factory builds a client on the **anon/publishable** key with supabase-js's `accessToken` callback (confirmed available in the installed 2.90.1), so `request.jwt.claims->>'sub'` populates and `public.user_id()` returns the real user id with RLS enforced. `supabaseAdmin` remains available but is renamed or documented as explicitly privileged.
- [ ] **RLS-03**: The dead transport is removed, not left to mislead — `withUserContext()` (`apps/web/src/lib/supabase/server.ts:67`) and the `set_claim` SQL function are deleted, and `public.user_id()`'s `app.current_user_id` fallback is either removed or documented as unreachable under PostgREST.
- [ ] **RLS-04**: An automated RLS test harness exists: mint a token for user A, read through the user-scoped client, and assert that user B's rows are invisible and that anon-key reads return zero rows. This replaces the manual-only anon-key check and establishes the repo's first RLS test precedent.
- [ ] **RLS-05**: Phase 5's three new tables (`role_grants`, `community_manager_applications`, `role_grant_events`) carry real working policies rather than deny-all, and any policy that must consult a role table does so through a `SECURITY DEFINER` helper so policy evaluation cannot recurse.

### Service-Role Migration (Phase 7 — full migration off unguarded service-role access)

- [ ] **MIG-01**: Every one of the 25 RLS-enabled tables has its policies audited and corrected against the now-working transport; each of the 15 existing `USING (true)` policies is either confirmed as deliberately public with a written reason or replaced.
- [ ] **MIG-02**: All 112 exports of `apps/web/src/lib/supabase/db.ts` are classified user-initiated vs system, and every user-initiated path runs through the RLS-enforced user-scoped client.
- [ ] **MIG-03**: Remaining privileged access is legitimate and visible — webhooks, cron routes, NFT minting, and notification fan-out keep an explicitly-named privileged client with a per-call-site justification; no route reaches for service-role merely by habit.
- [ ] **MIG-04**: Migration is proven, not asserted — each migrated table has an RLS test in the RLS-04 harness showing cross-user reads are denied, and the full suite is green.

### Manager Billing + Subscription (Phase 6 — issue #79c, post-launch)

- [ ] **MGR-01**: Approval and billing are separate prerequisites — a ₪50 charge without approval grants nothing, and an approved applicant gains scoped access only after server-side confirmation of billing activation.
- [ ] **MGR-02**: The subscription state machine implements `active`, `past_due`, `grace`, `cancelled`, `rejected`, `suspended`, and `expired` with explicit recorded transitions; a super admin can suspend independently of billing, with a stored reason.
- [ ] **MGR-03**: Renewal handling is idempotent — duplicate or replayed provider events produce exactly one charge, one invoice, and one role transition; idempotency keys are server-generated and no raw card data is stored.
- [ ] **MGR-04**: Cancellation and the failed-payment grace policy produce documented, predictable access outcomes, and the user is notified on every state change affecting access.
- [ ] **MGR-05**: Reconciliation matches GI settlement records against internal subscription and charge rows to zero open mismatches; any ambiguous payment state leaves the role inactive.

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
| SEC-01 | Phase 1 | Complete |
| SPIKE-01 | Phase 2 | Complete |
| SPIKE-02 | Phase 2 | Complete |
| SPIKE-03 | Phase 2 | Complete |
| VOTE-01 | Phase 02.1 | Pending (contract done plan 01, eligibility check done plan 02; route pending plan 04) |
| VOTE-02 | Phase 02.1 | Pending |
| VOTE-03 | Phase 02.1 | Pending (idempotent insert primitive done plan 02; route wiring pending plan 04) |
| VOTE-04 | Phase 02.1 | Pending |
| VOTE-05 | Phase 02.1 | Pending (contract + mobile copy done, plans 01/03; route pending plan 04) |
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
| RBAC-01 | Phase 5 | Pending |
| RBAC-02 | Phase 5 | Pending |
| RBAC-03 | Phase 5 | Pending |
| RBAC-04 | Phase 5 | Pending |
| RLS-01 | Phase 5 | Pending |
| RLS-02 | Phase 5 | Pending |
| RLS-03 | Phase 5 | Pending |
| RLS-04 | Phase 5 | Pending |
| RLS-05 | Phase 5 | Pending |
| MGR-01 | Phase 6 | Pending |
| MGR-02 | Phase 6 | Pending |
| MGR-03 | Phase 6 | Pending |
| MGR-04 | Phase 6 | Pending |
| MGR-05 | Phase 6 | Pending |
| MIG-01 | Phase 7 | Pending |
| MIG-02 | Phase 7 | Pending |
| MIG-03 | Phase 7 | Pending |
| MIG-04 | Phase 7 | Pending |

**Coverage:** 42/42 v1 requirements mapped — 0 orphaned

> **Audit note (2026-08-02):** the checkbox and Status columns above predate `.planning/v1.0-MILESTONE-AUDIT.md` and overstate progress. SPIKE-01/02/03 are marked Complete but their artifacts are unfilled templates. SEC-02 reads Pending but shipped out of phase in `35b0709`. PAY-02/03/04/08 and GO-02 are contradicted by shipped free participation and need rewriting rather than building. Audit-verified coverage is 2/28 of the pre-02.1 set.

---
*Requirements defined: 2026-06-28*
*Traceability populated: 2026-06-28*
*Updated: 2026-08-02 — added Phase 5 (RBAC-01..04) and Phase 6 (MGR-01..05) from GitHub issue #79*
*Last updated: 2026-08-02 — added Phase 02.1 (VOTE-01..05) from the v1.0 milestone audit P0 finding*
