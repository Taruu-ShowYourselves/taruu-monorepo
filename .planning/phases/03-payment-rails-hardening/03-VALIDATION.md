---
phase: 03
slug: payment-rails-hardening
status: planned
nyquist_compliant: true
wave_0_complete: n/a
created: 2026-08-03
updated: 2026-08-03
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

> **Note:** no `/gsd:discuss-phase` transcript and no `RESEARCH.md` exist for this phase. This strategy was derived from `03-CONTEXT.md`, the existing test suite, and direct verification against the working tree on 2026-08-03.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest **1.6.1** (`apps/web/package.json`) |
| **Config** | `apps/web/vitest.config.ts` — `environment: 'node'`, `include: ['src/**/*.test.ts', 'src/**/*.spec.ts']`, `exclude: ['node_modules', 'tests/e2e/**']` |
| **Quick run** | `pnpm --filter @sync/web test -- <path>` |
| **Full suite** | `pnpm --filter @sync/web test` |
| **Typecheck** | `pnpm --filter @sync/web typecheck` |
| **Other packages** | `pnpm --filter @sync/shared typecheck` · `pnpm --filter @sync/api-client test` · `pnpm --filter @sync/api-client typecheck` · `pnpm --filter @sync/mobile typecheck` |
| **Measured baseline (2026-08-03)** | typecheck green; full suite green — **69 files, 854 tests, ~2.3s** |
| **Estimated runtime** | <1s quick · ~3s full |

**Five constraints that shaped every choice below — all verified, none assumed:**

1. **There is no component-test setup.** `environment: 'node'`, no jsdom in use, no `@testing-library/react`, and the include glob **never collects `.tsx`**. No plan in this phase adds a DOM stack. Logic is extracted into `.ts` modules with injected dependencies (the plan 02.1-05 precedent, `services/participation/submitParticipation.ts`), and component copy is asserted against **source** (the `dashboard-free-mvp.test.ts` precedent, including its `code()` comment-stripper so prose explaining a retirement is never read as live UI).

2. **No task verifies against a test file a later task in the same plan creates.** vitest 1.6.1 exits `1` with `No test files found`, which `execute-plan.md`'s `verification_failure_gate` reads as a real failure and routes to `node-repair`. This is the blocker that failed the previous phase's plan-check. Every such task instead gates on `pnpm --filter @sync/web typecheck` plus a positive or negative `grep`, and its behavioural proof lands one task later in the same plan — recorded in the Test Type column below.

3. **`apps/web/worker.ts` is not collected by vitest** (the glob is `src/**`) and it imports `./.open-next/worker.js`, which only exists after a build. Plan 03-01 therefore puts the decision logic in `src/lib/env.ts` as a pure function and gives `worker.ts` a thin adapter verified by typecheck plus grep. The runtime behaviour of that adapter is a **manual-only** verification (assumption A7).

4. **`apps/web/src/__tests__/api/payments.test.ts` is contended.** Plans 03-02 (wave 1), 03-07 and 03-08 (wave 2) all touch this area. Ownership is explicit and non-overlapping: **03-02 owns it in wave 1** and rewrites the create describe; **03-07 owns it in wave 2** and rewrites the webhook auth cases; **03-08 does not edit it at all** — it reads it as a regression gate and puts its own proof in a new file. Plan 03-02 also removes `idempotencyKey: 'key-123'` from a request body specifically so 03-08 can drop the client override without a cross-plan edit.

5. **Phase 5 is executing out of roadmap order in a parallel session.** `apps/web/src/lib/env.ts` already gained `SUPABASE_JWT_SECRET` (`96448b3`) and the role-grant migrations have landed (`3dedcf0`). Every line number this phase cites is a 2026-08-03 snapshot; plans re-read before editing.

---

## Sampling Rate

- **After every task commit:** run that task's `<automated>` command
- **After every plan:** `pnpm --filter @sync/web test` (full web suite)
- **After every wave:** full web suite + `pnpm --filter @sync/web typecheck` + `pnpm --filter @sync/shared typecheck` + `pnpm --filter @sync/api-client test` + `pnpm --filter @sync/mobile typecheck`
- **Before `/gsd:verify-work`:** all five green
- **Max feedback latency:** 60 seconds (the full suite currently runs in ~2.3s; plan 03-09's repo-wide sweep must keep it under 10s)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-T1 | 01 | 1 | SEC-05 | typecheck + grep (self-contained) | `pnpm --filter @sync/web typecheck && grep -q "SUPABASE_SERVICE_ROLE_KEY" apps/web/src/lib/env.ts && ! grep -q "AUTH0" apps/web/src/lib/env.ts` | ✅ n/a | ⬜ pending |
| 03-01-T2 | 01 | 1 | SEC-05 | unit (pure gate + schema source) — behavioural proof for T1 | `pnpm --filter @sync/web test -- src/__tests__/lib/env-contract.test.ts` | ❌ new | ⬜ pending |
| 03-01-T3 | 01 | 1 | **SEC-02** | unit (existing suite, extended) + record | `pnpm --filter @sync/web test -- src/__tests__/api/treasury-transactions.test.ts && grep -q "35b0709" .planning/REQUIREMENTS.md` | ✅ exists | ⬜ pending |
| 03-02-T1 | 02 | 1 | PAY-08 | typecheck + negative grep (self-contained) | `pnpm --filter @sync/web typecheck && ! grep -q "VOTE_PARTICIPATION_AMOUNT" apps/web/src/services/payments/greenInvoice.ts && grep -q "createVoteCreationPayment" apps/web/src/services/payments/greenInvoice.ts` | ✅ n/a | ⬜ pending |
| 03-02-T2 | 02 | 1 | PAY-08, PAY-06 | typecheck + negative grep (self-contained) | `pnpm --filter @sync/web typecheck && ! grep -q "recordTreasuryDeposit" apps/web/src/app/api/payments/webhook/route.ts && ! grep -q "voteParticipation" apps/web/src/app/api/payments/create/route.ts` | ✅ n/a | ⬜ pending |
| 03-02-T3 | 02 | 1 | PAY-08, PAY-06 | unit (**rewritten in place**) — proof for T1 and T2 | `pnpm --filter @sync/web test -- src/__tests__/api/payments.test.ts && test ! -f apps/web/src/__tests__/e2e/payment.test.ts` | ✅ rewritten | ⬜ pending |
| 03-03-T1 | 03 | 1 | PAY-08 | typecheck (shared) + grep (self-contained) | `pnpm --filter @sync/shared typecheck && grep -q "CreatablePaymentTypeSchema" packages/shared/src/contracts/payment.ts && grep -q "PaymentTypeSchema = z.enum" packages/shared/src/contracts/payment.ts` | ✅ n/a | ⬜ pending |
| 03-03-T2 | 03 | 1 | PAY-08 | unit (api-client, rewritten) — proof for T1 | `pnpm --filter @sync/api-client test && pnpm --filter @sync/api-client typecheck` | ✅ exists | ⬜ pending |
| 03-03-T3 | 03 | 1 | PAY-08 | typecheck (mobile) + negative grep | `pnpm --filter @sync/mobile typecheck && ! grep -q "vote_participation" apps/mobile/app/payment/checkout.tsx` | ✅ n/a | ⬜ pending |
| 03-04-T1 | 04 | 1 | PAY-08 | typecheck + grep + path check (self-contained) | `pnpm --filter @sync/web typecheck && ! grep -q "₪2" apps/web/src/components/press/Ticker/Ticker.tsx && test ! -d apps/web/src/components/sections/MoneyTransparency` | ✅ n/a | ⬜ pending |
| 03-04-T2 | 04 | 1 | PAY-08 | typecheck ×2 + negative grep (self-contained) | `pnpm --filter @sync/web typecheck && pnpm --filter @sync/mobile typecheck && ! grep -q "₪3" apps/web/src/services/email/index.ts && ! grep -q "₪3" "apps/mobile/app/(auth)/index.tsx"` | ✅ n/a | ⬜ pending |
| 03-04-T3 | 04 | 1 | PAY-08 | source assertion — proof for T1 and T2 | `pnpm --filter @sync/web test -- src/__tests__/services/money-model-copy.test.ts` | ❌ new | ⬜ pending |
| 03-05-T1 | 05 | 1 | PAY-08 | typecheck + negative grep (self-contained) | `pnpm --filter @sync/web typecheck && ! grep -q "70%" "apps/web/src/app/[locale]/economics/components/FAQ.tsx" && ! grep -q "70%" "apps/web/src/app/[locale]/economics/components/CTASection.tsx"` | ✅ n/a | ⬜ pending |
| 03-05-T2 | 05 | 1 | PAY-08 | typecheck + negative grep (self-contained) | `pnpm --filter @sync/web typecheck && ! grep -qE "70%\|30%" "apps/web/src/app/[locale]/economics/components/HowItWorks.tsx" && ! grep -qE "70%\|30%\|1% על כל עסקה" "apps/web/src/app/[locale]/economics/components/FlywheelDiagram.tsx"` | ✅ n/a | ⬜ pending |
| 03-05-T3 | 05 | 1 | PAY-08 | source assertion — proof for T1 and T2 | `pnpm --filter @sync/web test -- src/__tests__/services/economics-fee-split-copy.test.ts` | ❌ new | ⬜ pending |
| 03-06-T1 | 06 | 1 | PAY-06 | typecheck + grep (self-contained) | `pnpm --filter @sync/web typecheck && grep -q "classifyFinalizeResponse" apps/web/src/services/payments/createVoteCheckout.ts && ! grep -q "Math.random" apps/web/src/services/payments/createVoteCheckout.ts` | ✅ n/a | ⬜ pending |
| 03-06-T2 | 06 | 1 | PAY-06 | typecheck + grep (self-contained) | `pnpm --filter @sync/web typecheck && ! grep -q "Math.random" "apps/web/src/app/[locale]/votes/create/page.tsx" && grep -q "decideReturnPhase" "apps/web/src/app/[locale]/payments/return/page.tsx"` | ✅ n/a | ⬜ pending |
| 03-06-T3 | 06 | 1 | PAY-06 | unit (injected fetch) + source assertion — proof for T1 and T2 | `pnpm --filter @sync/web test -- src/__tests__/services/create-vote-checkout.test.ts` | ❌ new | ⬜ pending |
| 03-07-T1 | 07 | 2 | SEC-03, PAY-07 | typecheck + negative grep (self-contained) | `pnpm --filter @sync/web typecheck && ! grep -q "token=" apps/web/src/services/payments/greenInvoice.ts && grep -q "confirmDocumentIssued" apps/web/src/services/payments/greenInvoice.ts` | ✅ n/a | ⬜ pending |
| 03-07-T2 | 07 | 2 | SEC-03, PAY-07 | typecheck + grep (self-contained) | `pnpm --filter @sync/web typecheck && grep -q "confirmDocumentIssued" apps/web/src/app/api/payments/webhook/route.ts && grep -q "23505" apps/web/src/app/api/payments/webhook/route.ts` | ✅ n/a | ⬜ pending |
| 03-07-T3 | 07 | 2 | SEC-03, PAY-07 | unit (**rewritten in place**) + doc grep — proof for T1 and T2 | `pnpm --filter @sync/web test -- src/__tests__/api/payments.test.ts && grep -q "## Webhook transport" apps/web/docs/GI-PRIME-CHECKLIST.md && grep -q "vatType" apps/web/docs/GI-LEGAL-CHECKLIST.md` | ✅ rewritten | ⬜ pending |
| 03-08-T1 | 08 | 2 | SEC-04 | typecheck + negative grep (self-contained) | `pnpm --filter @sync/web typecheck && grep -q "resolveIdempotencyKey" apps/web/src/services/payments/idempotency.ts && ! grep -q "Date.now" apps/web/src/services/payments/idempotency.ts` | ✅ n/a | ⬜ pending |
| 03-08-T2 | 08 | 2 | SEC-04 | typecheck + grep + **existing** wave-1 suite as regression gate | `pnpm --filter @sync/web typecheck && ! grep -q "Date.now" apps/web/src/app/api/payments/create/route.ts && pnpm --filter @sync/web test -- src/__tests__/api/payments.test.ts` | ✅ exists (03-02) | ⬜ pending |
| 03-08-T3 | 08 | 2 | SEC-04 | unit (injected lookup) — proof for T1 and T2 | `pnpm --filter @sync/web test -- src/__tests__/services/payment-idempotency.test.ts` | ❌ new | ⬜ pending |
| 03-09-T1 | 09 | 2 | PAY-08 | typecheck + negative grep (self-contained) | `pnpm --filter @sync/web typecheck && ! grep -qE "\* 0\.7\|\* 0\.3\|70%\|30%" "apps/web/src/app/[locale]/treasury/components/TreasuryDashboard.tsx"` | ✅ n/a | ⬜ pending |
| 03-09-T2 | 09 | 2 | PAY-08 | typecheck + grep (self-contained) | `pnpm --filter @sync/web typecheck && grep -q "BAG" "apps/web/src/app/[locale]/pricing/components/PricingContent.tsx" && grep -q "CREATE_VOTE_COST" "apps/web/src/app/[locale]/pricing/components/PricingContent.tsx"` | ✅ n/a | ⬜ pending |
| 03-09-T3 | 09 | 2 | **PAY-08 (closing proof)** | repo-wide source sweep | `pnpm --filter @sync/web test -- src/__tests__/services/money-model-sweep.test.ts` | ❌ new | ⬜ pending |
| 03-10-T1 | 10 | 2 | COIN-01 | document structure grep | `grep -q "## מעמד לפי דיני ניירות ערך" apps/web/docs/COIN-LEGAL-CHECKLIST.md && grep -q "custody" apps/web/docs/COIN-LEGAL-CHECKLIST.md && grep -q "COIN-CLAIM-INVENTORY" apps/web/docs/COIN-LEGAL-CHECKLIST.md && grep -q "Sign-off" apps/web/docs/COIN-LEGAL-CHECKLIST.md && grep -qF "PENDING" apps/web/docs/COIN-LEGAL-CHECKLIST.md` | ✅ n/a (doc) | ⬜ pending |
| 03-10-T2 | 10 | 2 | COIN-01 | document structure grep | `grep -q "## Claim inventory" apps/web/docs/COIN-CLAIM-INVENTORY.md && grep -q "## Trading surfaces" apps/web/docs/COIN-CLAIM-INVENTORY.md && grep -q "bags.fm" apps/web/docs/COIN-CLAIM-INVENTORY.md && grep -qF "PENDING" apps/web/docs/COIN-CLAIM-INVENTORY.md` | ✅ n/a (doc) | ⬜ pending |
| 03-11-T1 | 11 | 3 | COIN-02 | **checkpoint:decision (blocking gate)** | — human gate, no command | — | 🔒 blocked on COIN-01 |
| 03-11-T2 | 11 | 3 | COIN-02 | typecheck + SQL grep (self-contained) | `pnpm --filter @sync/web typecheck && grep -q "civic_pool_entries" supabase/migrations/20260803000001_civic_pool_ledger.sql && grep -qiE "before (update\|delete)" supabase/migrations/20260803000001_civic_pool_ledger.sql` | ✅ n/a | 🔒 blocked |
| 03-11-T3 | 11 | 3 | COIN-02 | unit (pure reconcile + mocked insert) — proof for T2 | `pnpm --filter @sync/web test -- src/__tests__/services/civic-pool-ledger.test.ts` | ❌ new | 🔒 blocked |
| 03-12-T1 | 12 | 3 | COIN-03 | **checkpoint:decision (blocking gate)** | — human gate, no command | — | 🔒 blocked on COIN-01 |
| 03-12-T2 | 12 | 3 | COIN-03 | typecheck + grep (self-contained) | `pnpm --filter @sync/web typecheck && grep -q "verifyQuoteToken" apps/web/src/app/api/bags/swap/route.ts && ! grep -q "quote.inputAmount" apps/web/src/app/api/bags/swap/route.ts` | ✅ n/a | 🔒 blocked |
| 03-12-T3 | 12 | 3 | COIN-03 | unit (new) + unit (rewritten) — proof for T2 | `pnpm --filter @sync/web test -- src/__tests__/api/bags-quote-authority.test.ts src/__tests__/api/bags-swap.test.ts` | ❌ new / ✅ rewritten | 🔒 blocked |
| 03-13-T1 | 13 | 3 | COIN-04 | **checkpoint:decision (blocking gate)** | — human gate, no command | — | 🔒 blocked on COIN-01 |
| 03-13-T2 | 13 | 3 | COIN-04 | typecheck + register grep (**deliberately not the suite** — see note) | `pnpm --filter @sync/web typecheck && grep -q "Shipped wording" apps/web/docs/COIN-CLAIM-INVENTORY.md` | ✅ n/a | 🔒 blocked |
| 03-13-T3 | 13 | 3 | COIN-04 | unit (register-driven) + flipped boundary assertion — proof for T2 | `pnpm --filter @sync/web test -- src/__tests__/services/token-claim-register.test.ts src/__tests__/services/economics-fee-split-copy.test.ts` | ❌ new / ✅ flipped | 🔒 blocked |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · 🔒 blocked on an external gate*

### Requirement coverage

| Requirement | Plans | Track |
|---|---|---|
| SEC-02 | 01 (closure record + source guard — implementation shipped in `35b0709`) | A |
| SEC-03 | 07 | A |
| SEC-04 | 08 | A |
| SEC-05 | 01 | A |
| PAY-06 | 02 (no pool credit on creation), 06 (funnel truth) | B |
| PAY-07 | 07 | B |
| PAY-08 | 02, 03, 04, 05, 09 (closing sweep) | B |
| COIN-01 | 10 | C |
| COIN-02 | 11 🔒 | C |
| COIN-03 | 12 🔒 | C |
| COIN-04 | 13 🔒 | C |

Every requirement in `ROADMAP.md`'s Phase 3 `**Requirements:**` line appears in at least one plan. No plan has an empty `requirements` field.

### Sampling continuity

Every task has an `<automated>` command that is green-on-success at the moment it runs, except the three
`checkpoint:decision` gates, which are human decisions and carry no command by design. There is no run of
three consecutive tasks without an automated verify.

### Two deliberate exceptions, both documented

1. **`03-13-T2` leaves the suite RED.** It rewrites claims that `economics-fee-split-copy.test.ts`'s
   `describe('COIN-04 boundary is intact')` block currently asserts are *present* — an assertion plan 03-05
   wrote on purpose so the gated boundary would be visible in the diff. `03-13-T3` flips it. T2 therefore
   gates on typecheck plus a register grep rather than on the suite, and its acceptance criteria say to record
   the failing test names. This mirrors the TDD RED convention `02.1-04-T1` established.
2. **`03-08-T2` runs a test file it does not own.** `payments.test.ts` belongs to 03-02 (wave 1) and 03-07
   (wave 2). 03-08 runs it read-only as a regression gate and asserts `git diff` on it is empty.

---

## Test Files Created, Rewritten, or Deleted

| File | Plan/Task | New / rewritten / deleted | Covers |
|------|-----------|---------------------------|--------|
| `apps/web/src/__tests__/lib/env-contract.test.ts` | 01 / T2 | new | `checkRuntimeEnv` truth table; schema names match runtime readers; no value ever in the result |
| `apps/web/src/__tests__/api/treasury-transactions.test.ts` | 01 / T3 | **appended** (22 existing tests untouched) | SEC-02 source guard: `userId`/`paymentId` cannot be reintroduced |
| `apps/web/src/__tests__/api/payments.test.ts` | 02 / T3, **then** 07 / T3 | **rewritten in place, twice, in different describes** | 02: creation-only contract, no treasury credit, legacy participation settles without fulfilment. 07: two-factor auth, `?token=` rejected, `23505` vs other DB errors, document-id integrity |
| `apps/web/src/__tests__/e2e/payment.test.ts` | 02 / T3 | **deleted** | Stripe-mocking, self-asserting fake E2E for the retired ₪3 rail |
| `packages/api-client/src/__tests__/payments.test.ts` | 03 / T2 | rewritten (`createVotePayment` describe deleted) | the corrected `vote_creation` wire contract |
| `apps/web/src/__tests__/services/money-model-copy.test.ts` | 04 / T3 | new | Ticker, vote-created email, mobile welcome, MoneyTransparency deletion |
| `apps/web/src/__tests__/services/economics-fee-split-copy.test.ts` | 05 / T3, **then** 13 / T3 | new, then its COIN-04 boundary describe flipped | no `70%`/`30%`/`1%` on `/economics`; the true figures survive; the gated boundary |
| `apps/web/src/__tests__/services/create-vote-checkout.test.ts` | 06 / T3 | new | checkout-start branches with injected fetch, return-phase decisions, no fabricated seal in source |
| `apps/web/src/__tests__/services/payment-idempotency.test.ts` | 08 / T3 | new | derivation, reuse, the bounded spent-key chain, no clock and no client key |
| `apps/web/src/__tests__/services/money-model-sweep.test.ts` | 09 / T3 | new | **PAY-08's closing proof** — repo-wide walk of `apps/web/src` + `apps/mobile/app` |
| `apps/web/src/__tests__/services/civic-pool-ledger.test.ts` | 11 / T3 🔒 | new | append-only projection, `reconcilePool` mismatch kinds, zero-mismatch case |
| `apps/web/src/__tests__/api/bags-quote-authority.test.ts` | 12 / T3 🔒 | new | issue/verify round trip, wrong user, expiry, tamper |
| `apps/web/src/__tests__/api/bags-swap.test.ts` | 12 / T3 🔒 | rewritten | hand-built quote rejected, token terms win, no chain error string |
| `apps/web/src/__tests__/services/token-claim-register.test.ts` | 13 / T3 🔒 | new | prohibited claims absent, approved wording shipped, register complete |

**Framework install: none.** No jsdom, no `@testing-library`, no new test dependency anywhere in this phase.

---

## Manual-Only Verifications

| Behavior | Requirement | Why manual | Test instructions |
|----------|-------------|-----------|-------------------|
| The `worker.ts` env gate actually runs on the deployed Worker (assumption **A7**) | SEC-05 | `worker.ts` is outside vitest's glob and imports a build artefact. Nothing short of a deploy proves the OpenNext custom-worker wrapper runs per isolate | Deploy to a preview Worker with `SUPABASE_SERVICE_ROLE_KEY` unset; confirm every request returns 503 and the tail log names the missing variables **and no values**. Restore the secret and confirm normal serving. Do this **before** Phase 4 go-live — ROADMAP Phase 4 SC#1 depends on it |
| A real ₪50 creation charge issues a GI document with correct Israeli private-payer fields | PAY-07 | Requires live Green Invoice credentials and an accountant's judgement on the fields | Phase 4 GO-02. The field question is on `GI-LEGAL-CHECKLIST.md` (plan 03-07 T3); the answer is an accountant's, not a test's |
| Green Invoice's hosted form genuinely cannot attach a notify header (assumption **A1**) | SEC-03 | Only Green Invoice can answer | Ask the rep the four questions plan 03-07 adds under `## Webhook transport` in `GI-PRIME-CHECKLIST.md`. A "yes" makes the header the primary factor and the document confirmation a backstop |
| A declined card lands on the failure copy | PAY-06 | Needs a real declined transaction on the GI hosted page | In sandbox, use a declining test card; confirm the return page shows the `failed` phase in Hebrew, that `sessionStorage.pendingVote` is cleared, that no `POST /api/votes` fires (check the network tab), and that no vote appears |
| A double-clicked create button produces one payment and one hosted form | SEC-04 | Genuine concurrency against the real `UNIQUE(idempotency_key)` constraint; the unit test can only simulate it | Double-click the create button; confirm exactly one `payments` row and one redirect |
| An unauthenticated webhook delivery mutates nothing in production | SEC-03 | Needs the deployed Worker with `NODE_ENV=production` and a real GI account | `curl -X POST https://…/api/payments/webhook` with a plausible `custom` order id, no header; expect 401 and no change to the `payments` row |
| The mobile checkout and welcome screens read correctly | PAY-08 | Requires the Expo app running | Open the app: the welcome screen's middle trust stat reads `חינם`, and `/payment/checkout` is reachable only for vote creation |
| Every claim in `COIN-CLAIM-INVENTORY.md` is ruled | COIN-01 | A lawyer's written opinion. Nothing in this repository can produce it | Hand `COIN-LEGAL-CHECKLIST.md` + `COIN-CLAIM-INVENTORY.md` to Israeli counsel; file the written response; check the `## Sign-off` boxes |

---

## Known Gaps Recorded, Not Closed Here

- **ROADMAP Phase 3 success criterion #6 does not hold and this phase does not make it hold.** `/coin`, `/economics`, `/explore` and three `/api/bags/*` routes are live now, ahead of COIN-01. Track C is blocked by the locked scope, so plan 03-10 produces the claim inventory instead. Removing a claim is not itself gated on a lawyer; the takedown decision is the owner's and is raised explicitly in `03-CONTEXT.md`.
- **Chain-seal copy on marketing surfaces** — `TrustBar`, `Hero/ConsensusVisual`, `VotesHero`, `ArchiveHero`, `about/Mission`, sign-in/sign-up, `verification`, and `PricingContent`'s `זהות ו-GPS · חתום בבלוקצ׳יין`. Recorded as a known gap by `02.1-VALIDATION.md`; only **money-model** claims are in PAY-08's scope.
- **The Ticker's `1,247 קולות מאומתים נחתמו השבוע`** is a hardcoded figure on the homepage. Not a money claim, so out of PAY-08's scope; recorded by plan 03-04.
- **`FundTransparency.tsx`** — unmounted, membership-era `monthlyAccumulation` framing. Recorded, not swept.
- **`chargeToken()` stays orphaned** to the spike harness. Phase 6 is its only planned consumer; SPIKE-01 gates that, not this phase.
- **CI deploy has been broken since 2026-07-28** (`.github/workflows/deploy.yml:62`, unset `CLOUDFLARE_API_TOKEN`, 5/5 runs failed). Phase 4.
- **`payments.type` keeps its `'vote_participation' | 'vote_creation'` database enum.** Historical rows exist; only *creating* one is retired. `PaymentTypeSchema` and `GetPaymentStatusResponseSchema` still parse a legacy row deliberately.
- **`incrementVoteOption`'s non-atomic RPC fallback** (`db.ts:993-1005`). Untouched since 02.1.

---

## Validation Sign-Off

- [x] All tasks have an `<automated>` verify command, except the three `checkpoint:decision` gates
- [x] Sampling continuity: no three consecutive tasks without an automated verify
- [x] No task verifies against a test file created later in the same plan — the two deliberate exceptions are named and explained above
- [x] No missing test framework — nothing to install
- [x] No watch-mode flags (`vitest run` via `pnpm test`, never `--watch`), no `.only`
- [x] Feedback latency < 60s (measured baseline ~2.3s; plan 03-09's sweep is capped at 10s)
- [x] Contended test files have a single named owner per wave
- [x] Every Phase 3 requirement appears in at least one plan
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned 2026-08-03
