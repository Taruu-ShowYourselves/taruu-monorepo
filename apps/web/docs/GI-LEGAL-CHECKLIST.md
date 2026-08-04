# GI Legal & Accountant - Merchant-of-Record Checklist (SPIKE-02)

> **Status: PENDING** - external human track; gates Phase 4 go-live, not Phase 3 build.
> Hand this document to the accountant/lawyer for written sign-off before go-live.

## Context

Taruu operates a civic-voting platform on a membership model: the **first vote of a
calendar month costs ₪6** (all subsequent votes that month are free), and a separate
**₪50 fee** applies per vote created. Of each ₪6 membership charge, **₪2.10 routes to
a monthly civic pool** (held in fiat, allocated to that month's executed city decisions)
and **₪3.90 remains on the platform**. The payment rail is Green Invoice (GI)
card-on-file - the platform charges the consumer's saved card off-session
(Merchant-Initiated Transaction / MIT) and issues a GI document for each settled charge.
The payer is an Israeli private individual (פרטי, not a business).

---

## Document type per flow

The accountant must confirm in writing which GI document type is correct for each charge flow.

- [ ] **₪6 membership charge (private payer, first vote of the month):** Is the correct
  document a **חשבונית קבלה** (combined invoice-receipt), a **חשבונית מס** (tax invoice
  only, requiring a separate קבלה), or a plain **קבלה** (receipt only)? Provide the
  answer in writing with reference to Israeli invoicing law.
- [ ] **₪50 vote-creation charge (private payer, 100% platform):** Same question - which
  document type applies, and does the higher amount or the fact that it is a one-time
  (non-recurring) charge change the answer?
- [ ] **₪2.10 civic-pool portion of the ₪6 charge:** Is the pool split purely an internal
  ledger entry (no additional GI document issued), or does routing ₪2.10 to the civic
  pool change the required document type or necessitate a second document? Confirm in
  writing that no additional GI document is required for the pool split.
- [ ] **MIT / card-on-file document type:** The platform uses the GI `type: 320`
  payment-request flow (already live for merch). Confirm whether this document type is
  appropriate for off-session MIT charges against a private payer, or whether a different
  GI document type or API flow is required for recurring card-on-file charges.
- [ ] **Private-payer fields on the ₪50 vote-creation document (PAY-07):** These are the
  **only** fields the app sends today when it opens the hosted form for the ₪50 charge
  (`services/payments/greenInvoice.ts`, `createPaymentForm`):

  | Field | Value sent |
  |---|---|
  | `type` | `320` (payment request) |
  | `lang` | `he` |
  | `currency` | `ILS` |
  | `sum` | `50` |
  | `description` | `יצירת הצבעה: <vote title>` |
  | `client` | `{ name: <user's name>, emails: [<user's email>] }` |
  | `income[0]` | `{ description: <same as above>, quantity: 1, price: 50, currency: 'ILS', vatType: 0 }` |
  | `remarks` | `Payment <our internal payment id>` |
  | `custom` | `<our internal payment id>` |

  Two questions, both requiring a written answer:
  1. Which **additional** fields (if any) must the document carry for a **private** (non-
     business) Israeli payer for the receipt to be lawful and complete? Name each required
     field exactly as Green Invoice's API names it - the app will send whatever is listed
     and invents nothing.
  2. Is **`vatType: 0`** correct for this charge? State which VAT treatment applies to a
     ₪50 one-time platform fee charged to a private Israeli payer, and which `vatType`
     value expresses it. If ₪50 is VAT-inclusive, state the VAT component in ₪.

---

## VAT treatment

- [ ] **Inclusion:** Is VAT (מע״מ) already included in the ₪6 and ₪50 figures (consumer
  pays ₪6 total, of which X% is VAT), or must VAT be added on top? Confirm the current
  Israeli VAT rate (17% as of writing) and whether it has changed.
- [ ] **Display on document:** How must VAT appear on the issued חשבונית/קבלה - as a
  separate line item (₪X VAT on a ₪Y base), or is a VAT-inclusive total acceptable
  for a private payer with no independent VAT deduction right?
- [ ] **Civic-pool portion:** Does the ₪2.10 civic-pool split affect VAT in any way - for
  example, if the pool is held by a non-profit or municipal-adjacent entity, is there
  an exemption or reduced rate for that portion? Confirm whether the platform must account
  for this on the GI document, or whether it is immaterial (internal ledger only).
- [ ] **Reverse-charge / special status:** Does any aspect of the civic/municipal-adjacent
  flow trigger a reverse-charge obligation, reduced VAT rate, or exemption under Israeli
  law? Confirm in writing that no special VAT treatment applies to the platform.

---

## Refund / credit-note (זיכוי) mechanics

- [ ] **Credit-note issuance:** When a charge must be refunded, confirm the correct GI
  document is a **חשבונית זיכוי** (credit note) issued against the original document id.
  Provide the GI API endpoint and dashboard path for issuing the credit note, and confirm
  whether the original document id is required as a reference.
- [ ] **Partial vs. full refund:** Can a חשבונית זיכוי cover a partial amount (e.g.,
  refunding ₪3 of a ₪6 charge), or must it always match the full original document amount?
- [ ] **Civic-pool impact on refund:** When a ₪6 charge is refunded, the ₪2.10 already
  accrued to the monthly pool must be reversed. Confirm whether issuing the credit note
  causes an automatic reversal in GI's records, or whether the platform must also post an
  internal ledger reversal separately. (Forward-looking: ties to v2 BAG-04 / HARD-02 -
  note timeline for resolution.)
- [ ] **Chargeback handling:** If the consumer's bank initiates a chargeback, does GI
  automatically issue a חשבונית זיכוי, or must the platform issue one manually? Confirm
  the process and any statutory deadline under Israeli consumer-protection law.
- [ ] **Timeframe obligation:** Is there a statutory or GI-mandated deadline within which
  a credit note must be issued after a refund or chargeback event?

---

## Consumer-protection obligations (Israeli law)

- [ ] **Cooling-off / cancellation right:** Under **חוק הגנת הצרכן** (and associated
  digital-service regulations), does the ₪6 monthly membership charge qualify as a
  recurring digital subscription triggering a mandatory cancellation/cooling-off period?
  If so, what is the window (typically 14 days for digital subscriptions in Israel), and
  what disclosure is required at the point of card entry?
- [ ] **Off-session / card-on-file consent:** The platform stores the consumer's card
  token and charges it off-session on the first vote of each calendar month (MIT - no
  consumer interaction at charge time). Confirm the exact pre-charge disclosure language
  and consent mechanism required under Israeli law - specifically whether a checkbox at
  card-entry time is sufficient, or whether a written notice must be sent before each
  recurring charge.
- [ ] **Receipt-delivery obligation:** Under Israeli law, is the platform required to
  deliver the חשבונית קבלה to the consumer by email or SMS immediately upon charge, or
  is making it available on-demand (e.g., downloadable from the user's account) sufficient?
- [ ] **"First vote then free" presentation:** The pricing model must not constitute a
  deceptive or misleading recurring charge under Israeli consumer-protection law. Confirm
  the legally safe wording for the pricing page, checkout flow, and recurring-charge
  reminder notice. In particular: does charging on the first vote of each calendar month
  (rather than on a fixed billing date) create any unusual disclosure obligation, and how
  must the "free after first vote" benefit be described so it is unambiguous?
- [ ] **Self-service cancellation mechanism:** Is the platform legally required to provide
  an in-app self-service path for the consumer to remove their saved card (cancelling
  future off-session charges) without contacting support? Confirm the requirement and
  what it means for the card-management UI.

---

## Sign-off

**Accountant / lawyer name:** ___________________________

**Date:** ___________________________

- [ ] Written sign-off obtained (or written timeline on file) covering all four sections
  above (document type, VAT, זיכוי, consumer-protection)

> Once signed off: update `SPIKE-02` to Complete in `.planning/REQUIREMENTS.md` and
> remove from Phase 4 blockers in `.planning/STATE.md`.
