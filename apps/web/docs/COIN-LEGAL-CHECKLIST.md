# COIN-01 - Israeli Legal Sign-off Checklist (Bags.fm civic token)

> **Status: PENDING** - external human track. **This document is the QUESTION, not the answer.**
> COIN-01 is not satisfied until a written sign-off from Israeli counsel is on file; until then
> COIN-02, COIN-03 and COIN-04 are blocked.
> Hand this document, together with `COIN-CLAIM-INVENTORY.md`, to Israeli counsel.

**Nothing below is a legal position taken by Taruu.** Every statement of fact is a description of
what the code and the database do today, recorded so that counsel can rule on facts rather than on
intentions. Every question is open.

## Context

Taruu (תַּרְאוּ) is a civic-participation platform for Israeli municipalities. Verified residents
vote on local affairs. The money model, as it stands in the code today:

- **Participation is free.** `packages/shared/src/constants/index.ts:11` - `VOTE_PARTICIPATION_COST = 0`.
  Residents pay nothing to cast a ballot, and no per-ballot amount accrues anywhere.
- **Creating a vote costs ₪50, and that ₪50 is 100% platform revenue.**
  `packages/shared/src/constants/index.ts:12` - `CREATE_VOTE_COST = 50`. It is charged through the
  Green Invoice hosted form, with Green Invoice acting as Merchant of Record. No part of it is
  credited to any civic pool.
- **The civic pool is intended to be funded by a tradeable token.** Each resolved vote is intended
  to get its own "BAG" - a memecoin launched on **Bags.fm**, on the **Solana** public blockchain -
  which supporters, resident or not, buy. Trading itself happens on bags.fm, outside the platform.
- **Israeli securities and consumer-protection questions are the reason this document exists.** A
  tradeable token whose proceeds are earmarked for a municipality's civic projects is not a product
  decision.

**Partial token surfaces are already live on `taruu.co.il`**, ahead of this sign-off:
`/he/coin`, `/he/coin/[id]`, `/he/economics` and `/he/explore` all return 200 to the public, and
`POST /api/bags/quote` and `POST /api/bags/swap` are deployed behind a session check (verified
2026-08-04). **Every sentence those surfaces show a prospective buyer is enumerated, quoted verbatim
and cited by `file:line` in `COIN-CLAIM-INVENTORY.md`, which is the companion to this document.**
Section 3 below is answered by ruling on that inventory row by row.

---

## מעמד לפי דיני ניירות ערך

The core question: is the BAG a security (נייר ערך) under **חוק ניירות ערך, התשכ״ח-1968**, and if so
what follows.

- [ ] **Base question.** Is a freely tradeable token, launched on a third-party platform (bags.fm) on a
  public blockchain, whose sale proceeds are earmarked for a municipality's civic project pool,
  a **נייר ערך** or a **יחידת השתתפות** under Israeli law? Answer in writing, with the reasoning, and
  state which characteristics of the instrument drive the answer.
- [ ] **Buyer expectation.** Does it matter that a buyer may expect the price to rise? Does an
  expectation of profit created by the *issuer's marketing* (rather than by the instrument's terms)
  change the classification, and if so, does correcting the marketing change it back?
- [ ] **Absence of a promise.** Taruu neither promises a return, guarantees a price, nor controls
  secondary-market pricing (trading is on bags.fm, not on Taruu). Does that absence change the
  analysis, or is it insufficient on its own?
- [ ] **ISA position on digital assets.** Does the Israel Securities Authority's (רשות ניירות ערך)
  published position on digital assets / crypto-assets apply to this instrument? Cite the specific
  publication(s) relied on and state whether they are binding or indicative.
- [ ] **What would change the answer.** For each of the following, state whether adopting it changes
  the classification, reduces risk without changing classification, or does neither:
  (a) a lock-up period on purchased tokens; (b) freezing trading permanently at vote resolution
  (already implemented as an `is_frozen` flag on the token record); (c) a per-holder holdings cap;
  (d) restricting purchase to people who are **not** residents of the municipality whose vote the
  token funds; (e) capping the total raise per vote.
- [ ] **Route to compliance.** If the instrument is a security: is a **תשקיף** (prospectus) required,
  is an exemption available (and which), or is a **no-action / pre-ruling** from the ISA the right
  route? For each available route give an estimated elapsed time and an estimated cost.
- [ ] **Offering to the public.** Independently of classification, does offering the token to an
  unlimited Israeli public - which is what a public `/coin` page linking out to bags.fm does -
  constitute a **הצעה לציבור** requiring registration or filing? Does the fact that the buy action
  happens on a third-party site (bags.fm) rather than on `taruu.co.il` affect that?
- [ ] **Anti-money-laundering / financial-services licensing.** Does operating this flow bring Taruu
  within **חוק הפיקוח על שירותים פיננסיים (שירותים פיננסיים מוסדרים)** as a provider of a financial
  asset service, and does any AML/KYC obligation attach to the buyer side?

---

## מבנה החזקת הכספים (custody)

Facts counsel needs before answering. These describe the current implementation, not a proposal:

- The civic pool is a **fiat ledger in agorot**, in the `treasury_transactions` table
  (`supabase/migrations/20250116000001_treasury_and_issue_coins.sql:64`). It is an append-only audit
  log of `deposit` / `allocation` / `withdrawal` / `fee_claim` / `token_purchase` rows.
- **Taruu holds the keys to the master wallet.** The Worker's secret store holds
  `BAGS_MASTER_WALLET_PRIVATE_KEY` and `BAGS_MASTER_WALLET_ADDRESS` (secret **names** only are recorded
  here; no value appears in this repository or in this document). `apps/web/wrangler.jsonc:75` sets
  `QUBIK_NETWORK: "mainnet"`, i.e. this is not a testnet arrangement.
- **Fiat is converted to SOL and used to seed a bag.**
  `apps/web/src/services/treasury/bagSeeding.ts:51` (`agorotToSol`) and `:70` (`seedVoteBag`) sum the
  accrued ILS for a vote, convert it at a configured FX rate (`TREASURY_ILS_PER_SOL`, default 750),
  and launch and seed that vote's bag.
- A fee-share configuration exists in code -
  `apps/web/src/services/bags/index.ts:326` (`createDefaultFeeShareConfig`), currently written as
  platform 10% / creator 10% / municipality 80% of trading fees - and is applied at launch only when
  `BAGS_PLATFORM_PROVIDER_ID` is set. **No live fee-share split is currently in effect.**
- Taruu's own stated intent, recorded in `.planning/REQUIREMENTS.md` ("Out of Scope"), is that
  **civic money stays in fiat and the chain is a transparency mirror only**. In-house dual-control
  vendor payout (`BAG-03`) is explicitly recorded there as *gated on a license/trust structure* that
  does not exist today.

- [ ] **Trust / licensing.** Does holding funds earmarked for a municipality's civic projects require
  a **נאמנות** (trust), a licence, a segregated/escrow bank account, or a specific corporate form? If
  segregation is required, describe the minimum acceptable structure.
- [ ] **Legal owner of the pool.** Who legally owns the pool before it is spent - Taruu, the buyers,
  the municipality, or a trust? State the answer for the fiat balance and for the on-chain balance
  separately, since they are different assets held under different arrangements.
- [ ] **Does conversion change the answer?** Converting ILS to SOL and seeding a bag (`bagSeeding.ts`)
  moves value from a fiat ledger into a crypto asset held under Taruu's own private key. Does that
  step, on its own, create a custody, licensing, or trust obligation that holding the fiat did not?
- [ ] **Insolvency.** If Taruu becomes insolvent, what happens to the pool - is it an asset of the
  estate, or is it ring-fenced? What must the Terms of Use say about this, and what structure would
  be needed to make the ring-fence real rather than contractual?
- [ ] **Municipality relationship.** Is a written agreement with each municipality required before
  funds may be described as earmarked for that municipality? Does accruing a pool "for" a municipality
  that has not signed anything create any exposure, and what must the copy say in the meantime?
- [ ] **Accrual before the payout structure exists.** May the pool accrue at all before the
  dual-control vendor-payout structure (`BAG-03`) and its licence/trust exist? If yes, under what
  conditions and with what disclosure; if no, what must happen to funds already accrued?
- [ ] **Key custody.** Taruu holding the master wallet private key means Taruu can, technically, move
  the pool unilaterally. Does that require any specific control (multi-signature, third-party
  custodian, dual authorisation), and is any of it a legal requirement rather than good practice?
- [ ] **Fee-share destination.** If trading fees on the bag are directed to a municipality-linked
  account (`createDefaultFeeShareConfig`), does that create a payment to a public body, and does any
  restriction apply to a municipality receiving revenue from a tradeable token?

---

## מה מותר ומה אסור לומר לקונים

This section is answered by ruling on **`COIN-CLAIM-INVENTORY.md`**, the companion document, which
lists every token-related sentence currently shipping, quoted verbatim in Hebrew with a `file:line`
citation and a category. It has two deliberately empty columns - **Verdict** and **Replacement
wording** - which are counsel's to fill.

- [ ] **Rule on every row of `COIN-CLAIM-INVENTORY.md`** as **allowed** / **allowed-with-wording** /
  **prohibited**. Where a claim is salvageable, supply the replacement Hebrew wording; where it is not,
  say so plainly. Rows marked "conservative" are included on purpose: confirming that safe wording is
  safe is as useful as striking unsafe wording, because the approved sentences become the vocabulary
  the rewrite (COIN-04, plan `03-13`) is written toward.
- [ ] **The comparison to a share.** Several live surfaces tell the reader that buying the BAG means
  holding an asset **`בדיוק כמו במניה`** ("exactly like a share"). Rule on this phrase specifically.
  Is a securities analogy in marketing copy independently actionable, separately from whether the
  instrument is in fact a security?
- [ ] **The statement that more buyers means more value.** One live surface states
  **`אם יותר אנשים משקיעים, ה-BAG שווה יותר`** ("if more people invest, the BAG is worth more").
  Rule on it. Does describing a mechanical property of a bonding curve or an AMM constitute an implied
  promise of return under Israeli law, and does it matter whether the statement is factually true?
- [ ] **Implied guarantee of civic outcome.** Several surfaces state that a larger BAG means the
  majority's decision has more real resources behind it. Taruu cannot today guarantee that any pool is
  spent on the decision it was raised for - there is no executed payout path and no licence for one.
  Rule on whether these statements imply a guarantee of civic outcome and what wording, if any, is
  permissible while the payout path does not exist.
- [ ] **Mandatory disclaimer at the point of purchase.** What risk disclosure must accompany a surface
  that leads a user to a buy action - including a surface that only *links out* to bags.fm rather than
  executing the trade itself? Supply the required Hebrew text, and state where it must appear
  (adjacent to the buy control, on an interstitial, or in the Terms alone).
- [ ] **חוק הגנת הצרכן.** What obligations arise under the Consumer Protection Law and its
  regulations when a digital asset is offered to the Israeli public: pre-contract disclosure, a
  cancellation/cooling-off right, price and fee display, and the prohibition on misleading
  advertising (הטעיה)? State which of them apply to a token sale that settles on a third-party
  platform rather than on Taruu's own checkout.
- [ ] **Non-resident and non-Israeli buyers.** One live surface invites support "from anywhere in the
  world". Does offering to buyers outside Israel create obligations under any other regime that Taruu
  should be advised of, or should the offering be geo-restricted?
- [ ] **The "certificate" (NFT).** Participants and supporters receive a commemorative on-chain
  certificate (`תעודת מצביע מאומת` / `תעודת תומך קהילתי`). Confirm whether a commemorative,
  non-transferable-in-intent NFT issued to a buyer alongside a purchase forms part of the offering
  for legal purposes, and rule on the wording that describes it.
- [ ] **The words themselves.** State which Hebrew terms must not appear in Taruu's copy at all -
  for example `השקעה`, `משקיע`, `תשואה`, `מניה`, `נכס` - and supply the approved substitutes. This
  answer is what plan `03-13` implements as a mechanically enforceable register.

---

## חובות מס ודיווח

Direct to the accountant where appropriate; **cross-reference `GI-LEGAL-CHECKLIST.md`**, which already
asks the accountant about the ₪50 creation charge's document type and VAT treatment, so the same
question is not asked twice from two directions.

- [ ] **VAT on a token sale vs. a donation.** Is the sale of a BAG a VAT-bearing supply
  (עסקה החייבת במע״מ), a donation (תרומה), a financial transaction, or something else? If the
  characterisation depends on who receives the proceeds, state the answer for each possible recipient.
- [ ] **Who is the recipient for tax purposes.** When a supporter buys a BAG whose proceeds are
  earmarked for a municipality's civic pool, who is the recipient of the consideration for tax
  purposes - Taruu, the municipality, or a trust? State the consequence for each answer.
- [ ] **Does the buyer receive a document, and of which type?** Must a **חשבונית**, **קבלה**,
  **חשבונית קבלה**, or no document at all be issued to a BAG buyer? Note that the purchase settles on
  bags.fm and Taruu may never see the buyer's identity - state what that means for the obligation and
  who bears it. (`GI-LEGAL-CHECKLIST.md` covers the equivalent question for the ₪50 charge.)
- [ ] **Reporting on the pool.** What reporting obligations attach to the pool itself - to the Tax
  Authority, to the ISA, or to the municipality? At what point does the obligation arise: on accrual,
  on conversion to SOL, on receipt of trading fees, or on payout?
- [ ] **Trading fees as income.** If trading fees are claimed under `createDefaultFeeShareConfig`,
  how are they characterised for Taruu and for a municipality-linked recipient, and does receiving
  them in a crypto asset rather than in shekels change the treatment or the timing?
- [ ] **Fiat-to-crypto conversion.** Does converting pool fiat into SOL (`bagSeeding.ts`) create a
  taxable event, a valuation obligation, or a reporting obligation at the moment of conversion?
- [ ] **Buyer-side tax disclosure.** Is Taruu obliged to tell buyers anything about their own tax
  position, and if so, supply the required wording and where it must appear.

---

## Sign-off

**Lawyer name:** ___________________________

**Firm:** ___________________________

**Date:** ___________________________

- [ ] Written sign-off obtained and filed, covering all four sections above - securities status,
  custody structure, permissible claims (every row of `COIN-CLAIM-INVENTORY.md` ruled), and
  tax/reporting.

> **Until that box is checked, COIN-02, COIN-03 and COIN-04 remain blocked**, and so do their plans:
> `.planning/phases/03-payment-rails-hardening/03-11-PLAN.md` (COIN-02, the per-municipality civic
> pool ledger and its chain reconciliation), `03-12-PLAN.md` (COIN-03, server-side quote authority so
> the quote the UI shows is the quote that executes), and `03-13-PLAN.md` (COIN-04, rewriting every
> public claim to the approved wording). Each of those plans opens with a blocking human gate.
>
> Once signed off: update `COIN-01` to Complete in `.planning/REQUIREMENTS.md`, record the sign-off
> reference in `.planning/STATE.md`, and transcribe counsel's verdicts into the **Verdict** and
> **Replacement wording** columns of `COIN-CLAIM-INVENTORY.md` before plan `03-13` runs.
>
> **Separate from the sign-off, and not gated on it:** *removing* a claim requires no lawyer's
> permission - only keeping one or rewording one does. `COIN-CLAIM-INVENTORY.md` records which claims
> are live today so that decision can be made deliberately.
