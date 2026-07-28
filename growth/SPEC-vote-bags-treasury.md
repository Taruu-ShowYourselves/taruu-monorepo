# SPEC — Vote Bags: Per-Vote Civic Treasury & Execution Engine

_Status: **Draft for review** · Owner: founders · Created 2026-06-28 · Companion: [`ROADMAP.md`](./ROADMAP.md) · [`PRD-P0-payments.md`](./PRD-P0-payments.md) · [`FINANCIAL-MODEL.md`](./FINANCIAL-MODEL.md)_

> A **bag** is a per-decision civic-treasury pot, funded from the **monthly civic pool** (₪2.10 × paying members that month; see [`PRD-P0-payments.md`](./PRD-P0-payments.md)) allocated to the decisions executed that month, that a **vetted vendor** withdraws to actually execute the decision. This is the mechanism that makes a Taruu vote *binding*. Under the membership model most votes are free, so bags are **no longer filled ₪2.10 per participation** — they receive an allocated share of the month's pool. **"Bag" here is NOT a bags.fm token** — it is an escrow sub-ledger; the chain is used only as a transparency mirror.

## 1. Resolved decisions (owner, 2026-06-28)

- **Execution model:** **in-house.** A hired treasury/ops function manages and disburses bag money manually, with **full public transparency** — not an automated self-serve payout. (In-house simplifies the build, NOT the law — see §6.)
- **Beneficiary:** **vetted vendor, paid directly** by the in-house team. Bag money never lands in a personal account — it pays a verified supplier/contractor who executes the civic decision. Kills most fraud, cleanest legally.
- **Custody:** **value held in fiat (₪) in a segregated trust account; convert only at payout.** No civic money sits in a floating dollar stablecoin → no USD/ILS FX or depeg risk on a shekel obligation.
- **Transparency:** each bag is **mirrored read-only on-chain (Solana)** — balance, lifecycle, and payout proof hash — so anyone can audit it and nobody can quietly alter it. The chain is the proof layer, not the custody layer.
- **Payout currency:** ILS bank transfer to the vendor by default; USDC off-ramp only if a specific vendor requests crypto.

## 2. The bag model

One **segregated trust/escrow bank account** holds all civic money. Each vote's bag is a **ledger partition** — a claim on that pooled cash, not a separate bank account (per-vote accounts don't scale and are a regulatory nightmare).

Hard invariant: `sum(open bag balances) + paid_out == cash in trust account`, reconciled continuously. Civic money is **never commingled** with platform operating funds.

Money split per **paying member-month** (price per [`PRD-P0-payments.md`](./PRD-P0-payments.md)): **₪2.10 → the monthly civic pool**, remainder − processing → platform. Each month the pool (₪2.10 × paying members) is **allocated across that month's executed decisions** — each decision's bag receives a share, per the allocation policy (proposed: split across the month's executed decisions in the member's municipality; **exact allocation is an open question**, §9). The bag *is* the civic share made concrete and executable — now funded from the monthly pool, not per-vote.

## 3. Lifecycle & functional requirements

**Stage 1 — Creation**
- FR-B01 — On a paid vote-create, open a `vote_bags` row: `bag_id, vote_id, status='filling', balance_ils=0, beneficiary_type='vendor', beneficiary_id=NULL, purpose, on_chain_addr, created_at`.
- FR-B02 — Publish the bag's on-chain transparency record (read-only) and surface its address on the vote page.

**Stage 2 — Filling**
- FR-B03 — Each **paid membership-month** credits **₪2.10** to the **monthly civic pool** (not directly to a single vote's bag), **atomically with the membership charge-commit** and under the same server-side idempotency key (the membership-month — no double-credit on retries/webhook re-delivery). At month close the pool is **allocated to that month's executed-decision bags** per the allocation policy (§9).
- FR-B04 — Live **pool** balance + paying-member count, and each bag's **allocated** share once computed, shown on the vote page; the on-chain mirror updates (batched is fine) so the public figures are auditable.
- FR-B05 — Reconciliation job asserts the §2 invariant on every cycle; any drift is logged and alerts ops, never silently corrected.

**Stage 3 — Close**
- FR-B06 — At vote end, `status: 'filling' → 'pending_execution'`; further inflow is rejected.
- FR-B07 — Resolve outcome → determine the entitled action and the vendor to be paid (vendor may be proposed at creation or selected post-close per governance).
- FR-B08 — **Failed/cancelled vote** (quorum not met / voided): the bag's **allocated share returns to the month's civic pool** for re-allocation across the remaining executed decisions (funding is pooled monthly, not per-vote, so there is no per-vote contributor to refund). Individual membership refunds/credit-notes (זיכוי) and the matching −₪2.10 pool reversal are governed by the payments PRD (FR-014/015). No silent forfeiture.

**Stage 4 — In-site management**
- FR-B09 — Leader/vendor dashboard: balance, contributor count, status, execution plan, and required KYC + **proof-of-execution** document slots.
- FR-B10 — **Proof-of-execution is mandatory before/at payout** — receipts/evidence the money did what the vote decided. Published (with the on-chain proof hash) so contributors can see where their ₪2.10 went. Without this the civic trust promise is void.

**Stage 5 — Withdrawal (in-house treasury ops)**
- FR-B11 — The in-house treasury function vets the recipient vendor and records **KYC/AML**: legal entity / ת.ז.-ח.פ., verified bank-account ownership, tax status. No self-serve vendor portal — ops captures and verifies.
- FR-B12 — **Dual-control approval (anti-fraud + anti-self-dealing):** every disbursement requires **two distinct approvers** (segregation of duties — the person who records ≠ the person who approves; founders cannot unilaterally move civic money). Paying a *vetted vendor* (not the vote creator) is the primary structural defense against the farm-and-withdraw attack.
- FR-B13 — Payout executed by ops as an **ILS bank transfer** from the trust account to the vendor. Issue tax/accounting documentation; report as required.
- FR-B14 — `status → 'executed'`; publish the payout (amount, vendor ref, date) + proof-of-execution to the public bag record and write its proof hash on-chain. Every disbursement is visible. Bag closed.

## 4. Data model (additions; UUID + RLS + updated_at conventions)

- `vote_bags` — `id, vote_id → votes, status ('filling'|'pending_execution'|'refunding'|'executed'|'voided'), balance_ils, beneficiary_type, beneficiary_id, purpose, on_chain_addr, proof_doc_url, payout_tx_ref, created_at, updated_at`.
- `bag_ledger` — append-only entries: `id, bag_id → vote_bags, transaction_id → transactions (nullable), kind ('credit'|'refund'|'payout'|'adjustment'), amount_ils (signed), created_at`. Bag balance = `sum(amount_ils)`. Reversible only via signed entries, never updates.
- `vendors` — `id, legal_name, tax_id, bank_account_ref (tokenized), kyc_status, kyc_verified_at, created_at`. RLS: service-role; vendor self-view scoped.
- Reuse the payments `treasury_ledger`/`transactions` (PRD) as the source of the **₪2.10/member-month** credits to the monthly pool — `bag_ledger` records each bag's **allocated share** of that pool per executed decision; do not double-book.

## 5. On-chain transparency design

Custody is fiat; the chain carries **proof only**. Per bag, publish a read-only Solana record (a PDA or a lightweight published account) reflecting: current balance (₪), status transitions, close timestamp, payout amount + vendor reference, and a hash of the proof-of-execution doc. Anyone can verify a vote's full money trail; the record is tamper-evident. **No private key holds civic money** — there is no on-chain custody to compromise (this sidesteps the multisig/hot-key risk entirely, since the value never leaves the trust account until a fiat bank transfer). The existing `BAGS_MASTER_WALLET_PRIVATE_KEY` (single key) is acceptable for *writing public proof records*, never for holding funds.

## 6. The regulatory gate (hard prerequisite — blocks Stage 5)

Holding and disbursing the public's money in Israel is a **regulated financial activity.** Pooling strangers' funds and paying third parties almost certainly requires either a **license** (נותן שירותי תשלום / נותן שירותים פיננסיים, רשות שוק ההון) or operating through a **licensed escrow/trust partner**, plus full **AML/CTF** and a lawyer-defined trust structure.

**Doing it in-house does not lift this gate — it concentrates it.** A manual, human-run payout is still "holding and transmitting the public's money," and now **Taruu itself is the holding entity**, so the license/trust/AML obligations and the liability land squarely on the company (not on a payout program or a third-party PSP). The transparency mirror is a trust and audit asset, not a legal substitute for the structure. Fill/ledger/transparency (Stages 1–4) can be built ahead; **Stage 5 cannot legally operate without the trust/license structure.** Hard gate, like the payments merchant-of-record sign-off.

## 7. Fraud & integrity controls

In-house money management raises the bar on internal controls (a human moves the funds):
- **Segregation of duties + dual control** — record ≠ approve; no single person (founder included) can move civic money alone.
- Vendor-direct payout (money never to a personal account) · mandatory vendor KYC.
- **Radical transparency by default** — every credit, refund, and disbursement published + on-chain proof; the public ledger is the primary deterrent against insider misuse.
- Per-bag reconciliation invariant (§2) · refund path for failed votes · vote-integrity flag if a disputed/charged-back contribution sat in an already-executed bag · periodic independent audit of the trust account.

## 8. Build order

1. **Bags core (with payments):** `vote_bags` + `bag_ledger`, ₪2.10/member-month atomic credit to the monthly pool + month-close allocation to bags (FR-B03), reconciliation invariant (FR-B05), pool + bag balances on the vote page.
2. **Lifecycle + management:** close/refund (FR-B06/B08), leader dashboard + proof-of-execution (FR-B09/B10).
3. **On-chain transparency mirror** (FR-B02/B04, §5) — public bag ledger.
4. **Internal treasury-ops console** — the hired manager's tool: record vendor + KYC, dual-control approve, mark disbursed, publish proof (FR-B11–B14). Replaces the dropped automated/self-serve payout.
5. **Legal/trust structure + the hire** (Stage 5) — gated on §6; slowest. Start the legal track AND the treasury-hire now, in parallel. Folds a treasury/finance salary into opex (was not in the ~₪1,200/mo fixed costs — update the financial model).

## 9. Open questions

- Trust-account structure: own license vs licensed escrow/PSP partner? (drives timeline + cost; needs a lawyer).
- **Monthly-pool allocation policy (key open question):** exactly how is each month's civic pool (₪2.10 × paying members) split across that month's executed decisions? Proposed default: split across the executed decisions in the member's municipality — but the precise rule (equal split, weighted by turnout/quorum, capped per bag, handling of a member's municipality with no executed decision that month) is undecided.
- Vendor selection governance: proposed at vote creation, or chosen after close, and by whom?
- Reallocation/refund mechanics at scale: returning a failed vote's allocated share to the pool, and the membership-month reversals (per payments PRD) when a member is refunded after the pool was already allocated.
- Tax treatment of a vendor payout and Taruu's reporting obligations.
- Minimum bag size to be worth a payout (tiny bags → payout cost > value; roll-over or municipal pool?).

---
_Decisions locked with owner 2026-06-28: bag = per-decision fiat escrow sub-ledger (NOT a bags.fm token); value in ₪ trust account, convert only at payout (no FX); on-chain = read-only transparency mirror; beneficiary = vetted vendor paid directly in ILS; **execution & withdrawal handled in-house by a hired treasury/ops function under dual-control + full public transparency** (not automated/self-serve); all gated on KYC + proof-of-execution + the §6 regulatory structure (in-house does not lift the gate — it concentrates liability on Taruu)._

_Updated 2026-06-29 — MEMBERSHIP model: bags are **no longer filled ₪2.10 per participation**. The civic share is now a **monthly pool** (₪2.10 × paying members/month) **allocated across the decisions executed that month** (exact allocation policy is an open question, §9); a failed vote returns its allocated share to the pool. Everything else above — in-house vendor payout, dual-control, fiat trust custody, on-chain transparency mirror, the §6 regulatory gate, and the deferred Stage-5 milestone — is unchanged._
