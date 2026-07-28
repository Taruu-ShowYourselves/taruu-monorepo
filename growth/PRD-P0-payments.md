# PRD — P0 Payments: Green Invoice Card-on-File (Monthly Membership)

_Status: **Draft for review** · Owner: founders · Created 2026-06-27 · Updated 2026-06-29 (membership model) · Companion: [`ROADMAP.md`](./ROADMAP.md) · [`FINANCIAL-MODEL.md`](./FINANCIAL-MODEL.md)_

> **Supersedes the "credit wallet" and the per-vote-charge framing of roadmap item 0.1.** Investigation showed the underwater economics were driven by **fixed per-transaction costs**, not by single-charging. Switching the rail to **Green Invoice** cuts those costs (₪1.2 clearing + ₪0.15 receipt vs Paddle's ₪1.85). The model then changed shape: instead of charging every vote, Taruu charges a **₪6 monthly membership** — only the **first vote of a calendar month** is paid; every other vote that month is **free**, and a member who doesn't vote in a month pays **₪0**.
>
> **Model locked (owner 2026-06-29): MEMBERSHIP — ₪6 on the first vote of the calendar month (rest of month free), creation ₪50, Green Invoice Prime plan, card-on-file, no batching.** The ₪6 splits **₪2.10 → civic treasury pool + ₪3.90 → platform**; platform NET **₪2.47 / member / month** after the GI fee (₪1.43 on ₪6). Treasury is now a **monthly pool** allocated to the decisions executed that month — not a per-vote ₪2.10 credit (free votes can't fund a per-vote treasury). See §3.

---

## 1. Executive summary

Taruu charges a **₪6/month membership** (collected on the member's first vote of the calendar month) and ₪50 per vote-creation, in ILS, to Israeli residents. The first vote of any month triggers a single ₪6 charge; every subsequent vote that month is **free**; months with no vote cost the member nothing. On Paddle (Merchant-of-Record), the fixed fee on a small charge was fatal — at the old ₪3 per-vote price the platform lost **₪1.10 every vote**, so more voting meant more loss. This blocked all distribution.

The fix is two-fold: a payment-rail swap to **Green Invoice (morning)** using its **card-on-file token API** — a member enters their card **once** (hosted page, tokenized), and the monthly ₪6 is a **silent server-side charge** of the saved token, with Green Invoice auto-issuing the חשבונית מס — and a move from per-vote pricing to **monthly membership** so free voting can expand the funnel. No prepaid balance, no top-up friction, no batching. The treasury receives **₪2.10/member/month** into a **civic pool**; the rail swap + the membership price set who covers the (lower) processing + receipt cost.

**Value:** turns the income unit into a clean **+₪2.47/member/month** (receipts and all fees included), makes voting free after the first of the month (a major funnel unlock), unblocks go-live, and removes a UX step versus the abandoned wallet.

## 2. Problem statement

| Segment | Pain | Quantified |
|---|---|---|
| Platform (2 founders) | Charging every small vote on Paddle loses money | **−₪1.10/vote** at the old ₪3 price; losses scaled with engagement |
| Voter | Paying on every vote (and re-entering card details) is unacceptable friction | Per-vote payment → expected drop-off at the payment step; suppresses the voting that fuels the funnel |
| Treasury (civic promise) | Per-vote fee pressure threatened the civic share | Paddle ₪3-charge couldn't even fully fund ₪2.10 without platform subsidy |

Root cause (from [`FINANCIAL-MODEL.md`](./FINANCIAL-MODEL.md)): Paddle = 5% + **~₪1.85 fixed**/txn — the fixed component dominates micro-charges. The membership model additionally removes the per-vote pay-wall that was suppressing the engagement the funnel depends on.

## 3. The rail decision & economics

**Membership ₪6/month, charged on the first vote of the calendar month.** The ₪6 splits into a fixed **₪2.10 → civic treasury pool** (the civic promise — an *amount*, not a percentage) and **₪3.90 → platform** (before fees). Subsequent votes the same month are free and trigger no charge; a member who doesn't vote in a month is charged ₪0. Creation ₪50 → 100% platform. Treasury is now a **monthly pool**: ₪2.10 × paying members that month, allocated across the decisions executed that month (allocation policy in [`SPEC-vote-bags-treasury.md`](./SPEC-vote-bags-treasury.md)) — it is **not** a per-vote ₪2.10 bag, because most votes are free.

**The real Green Invoice cost stack (no batching, Prime plan):**
- Clearing: **1.4% + ₪1.2 fixed** per transaction.
- Receipt: each membership charge issues a קבלה/חשבונית; metered per-document — **₪0.15/doc on Prime** (the cheapest overage rate).
- So the fixed cost per membership charge ≈ **₪1.2 + ₪0.15 = ₪1.35**, plus 1.4%. One charge/member/month → far fewer documents than the per-vote model.

| Flow | Charge | GI fee (1.4% + ₪1.2 + ₪0.15 receipt) | Treasury pool | Platform NET |
|---|---|---|---|---|
| First vote of month (membership) | **₪6** | ₪0.08 + ₪1.20 + ₪0.15 = **₪1.43** | ₪2.10 | **+₪2.47** ✅ |
| Any later vote, same month | **₪0** | — | — | — |
| Creation | ₪50 | ₪0.70 + ₪1.20 + ₪0.15 = **₪2.05** | — | **+₪47.95** ✅ |

Why membership (not ₪5/vote): an un-batched per-vote charge is solvent (+₪1.48 at ₪5) but the pay-per-vote wall suppresses the voting that drives the funnel. Membership makes voting free after the first of the month, betting that a wider funnel (more members, more creators) more than offsets the lower revenue per unit of engagement — see [`FINANCIAL-MODEL.md`](./FINANCIAL-MODEL.md), "What the membership model costs vs the old per-vote model." At equal engagement the old per-vote model collected more; the new model only reaches the take-home band by **growing the base** (≈1.5–2× the old Target engagement). It is a deliberate growth bet.

> **Hard plan dependency:** the +₪2.47/member-month holds **only on the Prime plan (₪0.15/receipt)**. On Best (₪1.00/receipt) the GI fee on ₪6 rises and the member-net falls materially. **Prime is required**, not optional.

> **Provisional / verify in the Phase-0 spike:** exact merchant clearing terms (minimums, tokenization/settlement/refund fees), brand surcharges (Diners +0.5%, **tourist/foreign cards ~3.5%** — block or flag these, they lose money), the **₪16.9 bank-transfer fee** on settlements under ₪5k (batch payouts ≥₪5k to avoid), and confirmation that GI imposes no hard minimum charge.

Cost of the rail (fixed/opex, folded into the financial model): **Prime plan ₪155/mo**, plus the in-house treasury hire (see bags spec). Document volume is now one doc/member/month — far below per-vote scale — so the per-document overage line is much smaller than under per-vote pricing.

## 4. Goals & metrics

| ID | Goal | Metric | Target |
|---|---|---|---|
| G1 (P0) | Solvent income unit | Platform NET / paying member / month (receipts + fees in) | **+₪2.47** @ ₪6 / Prime |
| G2 (P0) | Frictionless repeat voting | Card re-entries after first vote · charges after the first vote of a month | **0** · **0** |
| G3 (P0) | Treasury integrity | Net civic-pool contribution per paying member-month (post refunds/chargebacks) | **₪2.10**, reconciled to zero open mismatches |
| G4 (P0) | No double-charge / no orphan | Duplicate membership charges in one month · charged-but-unrecorded votes | **0** · **0** unresolved |
| G5 (P1) | Conversion | Voter completes 1st card-setup → first paid vote | ≥ 70% |
| G6 (P1) | Resilience | Declined-card recovery (update + retry) | ≥ 50% recovered |

## 5. Non-goals

Prepaid wallet / top-up packs (explicitly dropped). Multi-currency (ILS only). Apple/Google Pay (P2). Standing-order / recurring auto-debit voting (הוראות קבע) — the membership is **triggered by the first vote of a month, not a fixed recurring debit**, and a member who doesn't vote pays nothing. Refund self-service UI (P1; manual ops at launch). Mobile-app payment surfaces (web-first per current build).

## 6. Personas

- **Dana, the engaged resident** — votes on several local issues a month. Pays ₪6 once when she casts her first vote of the month; the rest of her votes that month are free. Will not tolerate typing card details repeatedly; expects a receipt for tax/record. Card-on-file + membership is built for her.
- **Yossi, the vote-creator** — pays ₪50 to start a binding vote in his city. One-time payer; needs a clean חשבונית for the ₪50.
- **Founder (ops)** — must reconcile treasury ↔ Green Invoice ↔ internal ledger weekly; needs every charge idempotent (at most one membership charge per member per calendar month) and every treasury accrual provable.

## 7. Functional requirements

**Auth & client**
- FR-001 — Obtain a Green Invoice JWT via `POST /account/token` `{id, secret}`; cache server-side and refresh before the ~30-min expiry. Secrets live only in Worker secrets (`GREENINVOICE_API_KEY_ID`, `GREENINVOICE_API_SECRET`, `GREENINVOICE_PLUGIN_ID`); never client-exposed.
- FR-002 — On first payment, ensure a Green Invoice **client** exists for the user (create or look up); persist its GI client id on the user record.

**Card setup (first paid action)**
- FR-003 — When a user with no saved token initiates any paid action (first vote of a month, or a creation), generate a hosted card-entry page via `POST /payments/form` and redirect (Paddle-style redirect already exists in the codebase).
- FR-004 — On completion, Green Invoice fires a webhook to a dedicated payments endpoint; verify the shared-secret header (constant-time compare, fail-closed in prod — reuse the hardened pattern from `api/merch/webhook`), then persist the returned **card token id** against the user. Issue/store the document id.

**Membership charge (first vote of a calendar month)** — _off-session merchant-initiated transaction (MIT)_
- FR-005 — On each vote, the server first checks whether the user has **already paid the membership for the current calendar month** (FR-005a). If **not paid**: server-side `POST /payments/tokens/{tokenId}/charge` for **₪6** (one membership charge per member per calendar month, no batching). "Success" = the API's **payment-success (authorization/capture)** result, **not** bank settlement (which lands days later and is reconciled separately, FR-016). On payment-success, record the membership transaction, mark the membership-month **paid**, accrue **₪2.10** to the **monthly civic-pool** ledger and the remainder (₪3.90 − fees) to platform, then commit the vote (FR-008). If the membership is **already paid** for the month, **no charge** is made and the vote is recorded **free**.
- FR-005a — **Once-per-calendar-month charge gate:** the membership-month (`{userId}:{YYYY-MM}`) is the unit of charge. A membership is charged **at most once per user per calendar month**; persist the paid membership-month (see §8 `membership_periods`) so concurrent or duplicate first-votes (double-click, refresh, two tabs/devices, webhook re-delivery, two votes racing as "first") never produce a second ₪6 charge. The gate is enforced server-side and is never trusted from the client.
- FR-006 — Creation: same token-charge flow for **₪50**, 100% platform; treasury not credited on creation. A creation charge does **not** satisfy or consume the voting membership (they are independent).
- FR-007 — **Idempotency (server-side):** the server generates and enforces the key before calling GI. For membership the key is the membership-month (`{userId}:{YYYY-MM}:membership`); for creation `{userId}:{voteId}:creation`. Persist key→result so a duplicate request never double-charges or double-credits the pool. Keys are never trusted from the client.
- FR-008 — **Charge-then-commit:** a first-of-month vote is recorded as cast only after the membership charge reaches payment-success; a free (already-paid-month) vote commits without a charge; a created vote is recorded only after its ₪50 payment-success. No optimistic vote on a pending/failed charge.
- FR-009 — **Off-session consent + 3DS/SCA:** at card setup the user explicitly consents to future merchant-initiated **monthly ₪6 membership** charges (stored, timestamped). The spike (Phase 0) must confirm GI's token charge is a valid off-session MIT and how 3DS/SCA challenges and soft declines are handled; if a charge requires a step-up, fall back to FR-010.

**Declined / missing / changed card**
- FR-010 — Membership or creation charge declined (insufficient funds, revoked, expired, 3DS step-up, issuer soft decline) → the vote/creation is **not** recorded and the membership-month is **not** marked paid; show a localized (Hebrew, RTL) retry/update-card path re-running `POST /payments/form`. Never surface a raw gateway error.
- FR-011 — Lost/expired/revoked token (`/payments/tokens/search` returns none) → treat as first-payment setup (FR-003).
- FR-012 — **Single active payment method** per user for v1: a new card-setup replaces the prior active token (old marked inactive). Concurrent card-change + in-flight charge resolves against the token captured at charge start.

**Invoicing (Israeli)**
- FR-013 — Each payment-success produces a Green Invoice document automatically; store its id with the transaction. Receipt fields must be correct for an **Israeli private payer** (name, optional ת.ז., email delivery, Hebrew/RTL חשבונית מס/קבלה). Confirm document **type** and VAT treatment with the accountant before launch (open question).

**Treasury, refunds, reversals & reconciliation**
- FR-014 — Treasury ledger is **append-only with signed reversal entries**, accruing to a **monthly civic pool** (not a per-vote bag). Invariant is stated on the **net per month**: `net_pool(month) == (paid_memberships(month) − refunded − charged_back) × ₪2.10`. No destructive updates; reversals are new negative rows linked to the original.
- FR-015 — **Refund / זיכוי:** a refunded membership-month issues a GI **credit note (חשבונית זיכוי)**, posts a −₪2.10 civic-pool reversal + platform reversal, and marks that membership-month **unpaid**. Refunds are manual-ops at launch (no self-service UI — non-goal).
- FR-016 — **Chargeback:** on a dispute, post the same reversal as a refund, flag the transaction, and record whether the underlying vote already affected a closed result (integrity flag for ops review). Disputes may cluster by campaign — surface counts per vote.
- FR-017 — **Orphaned-charge recovery (the critical reliability path):** a reconciliation job detects *charged-membership-but-no-committed-vote* (membership payment-success with no committed vote, e.g. commit/webhook failure) and either completes the vote or auto-refunds within a bounded window, then notifies the user. Detects *committed-vote-but-no-membership-charge* too (a first-of-month vote recorded without a paid membership-month). Runs on a cron; every mismatch is logged, never silently dropped.
- FR-018 — Reconciliation surface: GI documents ↔ `transactions` ↔ `treasury_ledger` (monthly pool) ↔ GI settlement report must tie out; expose the query + a dashboard count of open mismatches.

**Ambassador funding (P1 — documented here, does not gate P0)**
- FR-019 — A founder can **comp** an ambassador's first creation: the ₪50 is **waived** (no charge, ₪0 cash cost, opportunity cost only — matches the financial model). Record as a `sponsored` transaction with the granting founder's id and an audit trail; comps are revocable before the vote goes live. Treasury is unaffected (creation doesn't fund treasury).
- FR-020 — Any promotional/granted credit is **non-refundable and expires 12 months** after grant (repurposes the earlier balance-expiry decision; applies only to comps, since there is no general balance).

## 8. Data model (additions; follow existing UUID + RLS + updated_at conventions)

- `payment_methods` — `id, user_id → users, gi_client_id, gi_token_id, brand, last4, exp, mit_consent_at, is_active, created_at, updated_at`. RLS: owner-only via `public.user_id()`. **No PAN/CVV ever stored** — only GI's token id + display metadata. Token ids are not written to application logs. `mit_consent_at` records consent to the recurring monthly ₪6 membership charge.
- `membership_periods` — `id, user_id → users, period (text 'YYYY-MM'), status ('paid'|'refunded'), transaction_id → transactions, paid_at, created_at, updated_at`, **`UNIQUE(user_id, period)`** — the once-per-calendar-month charge gate (FR-005a) and the source of "already paid this month?". RLS owner-read; service-role write.
- `transactions` — `id, user_id, kind ('membership'|'creation'|'sponsored'), vote_id (the vote that triggered the membership charge; nullable for creation), membership_period (text 'YYYY-MM', nullable; set for membership rows), amount_ils, gi_document_id, gi_charge_id, idempotency_key UNIQUE, status ('pending'|'paid'|'committed'|'refunded'|'charged_back'|'orphaned'), reverses_id (→ transactions, nullable), created_at`. RLS owner-read; service-role write.
- `treasury_ledger` — `id, transaction_id, membership_period (text 'YYYY-MM'), amount_ils (2.10), created_at`, append-only; balances roll up into the **monthly civic pool** for that period (allocation to executed decisions handled in [`SPEC-vote-bags-treasury.md`](./SPEC-vote-bags-treasury.md)). (Verify against the ledger the current merch webhook already accrues to; extend, don't duplicate.)

## 9. Integration sequence

```
First payment:  client → /api/payments/setup → GI POST /payments/form → redirect
                user consents to monthly ₪6 MIT → enters card → GI webhook → verify secret → store gi_token_id + consent + document
Vote (1st of month): client → /api/votes/[id]/participate → server checks membership-month →
                unpaid → make idempotency key {userId}:{YYYY-MM}:membership →
                GI POST /payments/tokens/{id}/charge (₪6) → payment-success →
                record membership txn → mark month paid → accrue ₪2.10 to monthly civic pool → commit vote
Vote (rest of month): membership already paid → no charge → commit vote (free)
Creation:       client → /api/votes (create) → GI POST /payments/tokens/{id}/charge (₪50) → payment-success → record txn → commit create
Recovery:       cron → detect charged-membership-but-uncommitted / committed-vote-but-uncharged → complete or refund + notify
Reconcile:      GI documents ↔ transactions ↔ treasury_ledger (monthly pool) ↔ GI settlement report → 0 open mismatches
```

## 10. Implementation phases

0. **Spike + sign-off gate (P0, blocks all build):** sandbox-verify GI off-session token charge (3DS/decline behavior, document return), confirm plan tier + written merchant terms, and get accountant/legal sign-off on merchant-of-record/VAT/refund mechanics (§12). No production code until this clears.
1. **Rails core (P0):** GI auth+client (FR-001/002), webhook endpoint + secret verify (FR-004), token charge + once-per-month gate + idempotency + charge-then-commit (FR-005/005a/007/008), monthly-pool treasury accrual (FR-005/014). Migration for the four tables (incl. `membership_periods`).
2. **Card setup UX (P0):** `/payments/form` redirect, first-vote-of-month detection, declined/retry path (FR-003/009/010), Hebrew/RTL.
3. **Creation flow (P0):** ₪50 token charge (FR-006), invoice storage (FR-011).
4. **Cutover (P0):** remove Paddle payment code paths; update `INTEGRATIONS.md` (Paddle→DEAD for payments, GI→REQ/PAY); update `FINANCIAL-MODEL.md` rail row + recompute `build_financial_model.py`.
5. **Ambassador comp + expiry (P1):** FR-019/020; dashboard surfacing.

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Treating GI as a drop-in cheaper Paddle** (biggest underweighted risk) | Taruu becomes **merchant-of-record**: it now owns VAT, consumer-protection, refunds, disputes, privacy, bookkeeping, support. Phase 0 includes an accountant + legal sign-off gate before launch, not after. |
| GI token charge isn't a valid off-session MIT, or forces 3DS step-up | Phase-0 spike against sandbox: confirm off-session charge, 3DS/SCA handling, soft-decline codes, and that `/payments/tokens/{id}/charge` returns a usable document + charge id, before any UX |
| "Payment-success" ≠ bank settlement | Commit on payment-success; reconcile actual settlement separately (FR-016/018); never assume money landed because the API returned 200 |
| **Double-charge across two "first" votes of a month** (race) | The once-per-month gate (FR-005a) + membership-month idempotency key + `UNIQUE(user_id, period)` on `membership_periods` make a second ₪6 charge impossible even under concurrency |
| Charged-but-vote-not-recorded (a predicted top complaint) | Charge-then-commit (FR-008) + orphaned-charge recovery cron (FR-017) + user notification; bounded auto-refund window |
| Fee assumption wrong (minimums, brand/tourist surcharges) | Lock merchant terms in writing; flag/block tourist-card (~3.5%) charges in monitoring |
| **Per-receipt document fee** | **Prime plan required** (₪0.15/doc); one membership doc per member per month keeps document volume — and overage — low; the ₪6 net absorbs it. On Best plan the per-member economics weaken. |
| **Not on Prime plan** → the +₪2.47/member-month erodes | Provision Prime (₪155/mo) before launch; the plan fee is negligible vs the per-doc savings at scale |
| Refund/chargeback breaks the treasury invariant | Append-only ledger with signed reversals (FR-014/015/016); invariant defined on the net monthly pool |
| Webhook spoof / duplicate / out-of-order / missing | Constant-time secret compare, **fail-closed in prod**, idempotent handler, reconciliation backstop for missed deliveries |
| Token vault as PII/PCI surface | Hosted fields (reduced PCI scope) **plus** controls on webhooks, logs, admin access, and stored consent; only token id + last4 persisted; RLS owner-only |
| Disputes cluster by contentious campaign | Per-vote dispute counts (FR-016); integrity flag when a disputed vote already affected a closed result |
| **Growth bet doesn't materialize** (membership collects less per engagement than per-vote) | The model only hits the band at ≈1.5–2× the old engagement; track paying-members/mo + creates/mo against [`FINANCIAL-MODEL.md`](./FINANCIAL-MODEL.md) scenarios; the per-vote rail remains a documented fallback |
| Sponsored-comp abuse | Audit trail + revocability (FR-019); founder-id on every comp |

## 12. Open questions (gate Phase 0 spike)

- **Accountant/legal sign-off** on becoming merchant-of-record: correct GI document type per flow, VAT treatment, refund/credit-note (זיכוי) mechanics, consumer-protection + cancellation rights under Israeli law for a monthly-membership charge.
- Provision the **Prime plan** (required for the ₪0.15/doc rate the economics depend on); confirm **written merchant clearing terms** (real %, any hard minimum charge, brand/tourist surcharges) and the **per-document overage** rate in writing.
- Does `POST /payments/tokens/{id}/charge` perform a valid **off-session MIT** for a recurring monthly membership, how does it report 3DS/SCA + soft declines, and does it issue the document in the same call or need a follow-up?
- Does the existing merch treasury ledger (the current Green-Invoice merch webhook already accrues to one) match the monthly-pool `treasury_ledger`, or need a shared-table migration?
- **Monthly-pool allocation policy:** how is each month's civic pool split across that month's executed decisions (per municipality)? — see [`SPEC-vote-bags-treasury.md`](./SPEC-vote-bags-treasury.md) open questions.
- **Paddle migration:** confirm there is **no production payment data** yet (app has been mock/pre-launch), so dropping Paddle for payments is a clean removal with no customer/record migration. Validate before deleting code.

---
_Decisions locked with owner: rail = Green Invoice card-on-file (2026-06-27); per-vote pricing ₪5 (2026-06-28) **superseded by MEMBERSHIP (2026-06-29): ₪6 on the first vote of the calendar month, rest of month free, ₪0 in no-vote months; creation ₪50; Green Invoice Prime plan; NO batching → one membership charge + one receipt per member per month → +₪2.47/member/month**; ₪6 splits ₪2.10 civic pool / ₪3.90 platform; treasury = monthly pool allocated to the month's executed decisions (net of reversals); both flows on GI, Paddle dropped for payments; ambassador first-create comped (waived, P1); promotional credits non-refundable, 12-mo expiry._

_Adversarial review: applied (provider: codex) — server-side idempotency, payment-success vs settlement, refund/chargeback reversals, orphaned-charge recovery, off-session MIT consent + 3DS, Israeli invoice fields, merchant-of-record legal gate, and provisional-fee caveat all incorporated 2026-06-27. **Pricing model changed from per-vote ₪5 to a monthly ₪6 membership on 2026-06-29: the charge trigger moved to first-vote-of-month, the membership-month became the idempotency unit, and treasury moved to a monthly pool — but all security, idempotency, webhook-header, charge-then-commit, and merchant-of-record/Prime gate mechanisms above continue to apply unchanged.**_
