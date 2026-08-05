# Phase 03: Payment Rails + Hardening - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning
**Source:** `.planning/ROADMAP.md` Phase 3 (success criteria rewritten 2026-08-03, commit `c5e7ff3`) + `.planning/REQUIREMENTS.md` (re-scoped `1b3fe1e`) + `.planning/STATE.md` + `.planning/v1.0-MILESTONE-AUDIT.md`, with every audit claim re-verified against the working tree on 2026-08-03.

> **No user interview was available for this phase.** There is no `/gsd:discuss-phase` transcript. Every decision below is derived from the four authoritative documents plus direct code verification. Assumptions the owner did not make explicitly are marked **[ASSUMPTION]** and each names what would falsify it.

---

<domain>
## Phase Boundary

**Delivers, in three independently shippable tracks:**

| Track | Requirements | Blocked by | Ships value alone? |
|-------|--------------|------------|--------------------|
| **A - Security hardening** | SEC-02, SEC-03, SEC-04, SEC-05 | nothing | yes |
| **B - ₪50 creation rail + honest money copy** | PAY-06, PAY-07, PAY-08 | nothing | yes |
| **C - Token / civic pool** | COIN-01, COIN-02, COIN-03, COIN-04 | **COIN-01, a written Israeli legal sign-off no one in this repo can produce** | no |

Tracks A and B are planned to execute now. Track C is planned but gated: COIN-01's own plan is a checklist/dossier (the artifact the owner hands a lawyer), and the three implementation plans sit in the final wave behind a blocking human gate.

**Does NOT deliver:** any recurring charge, any stored card token for participation, any per-user Green Invoice MIT token, any pool accrual per member or per vote. Those belonged to the ₪6/month membership, which is **retired** — see Locked Decisions. Also out of scope: go-live deployment (Phase 4), the RBAC/RLS line (Phases 5 and 7), and the ₪50/month manager subscription (Phase 6, which is the only thing SPIKE-01 still gates).

**Why now:** the money model in the code and the money model in the copy disagree, in public, on production. The homepage ticker currently tells every visitor `₪2 מכל הצבעה נצברים לקרן הקהילתית` for a product where participation is free and nothing is collected per vote.
</domain>

---

<decisions>
## Locked Decisions

These are **non-negotiable inputs**, not proposals. They come from `1b3fe1e`, `c5e7ff3`, `cfa5d25` and the re-scope recorded in STATE.md. Do not re-litigate any of them.

### 1. The ₪6/month card-on-file membership is RETIRED, not deferred

- PAY-01..05 are retired requirements. `cfa5d25` (2026-07-29) made participation free; Phase 02.1 made that free ballot persist.
- **No plan in this phase may introduce** a recurring participation charge, a per-user stored GI token for participation, a ₪2.10/member/month pool accrual, a "first vote of the month" charge, or any membership concept.
- `chargeToken()` (`apps/web/src/services/greenInvoice/index.ts:220`) stays exactly where it is — orphaned to the spike harness. Phase 6 is its only future consumer. This phase must not wire it.

### 2. The ₪50 creation fee runs on the GI HOSTED FORM, and SPIKE-01 does not gate this phase

- Mechanism is `createVoteCreationPayment` → `createPaymentForm` → `POST /payments/form` (`apps/web/src/services/payments/greenInvoice.ts:213`, `:126`), `type: 320`. **Verified present and it is the one money flow the v1.0 audit found working end to end.**
- The off-session MIT token charge that SPIKE-01 exists to validate is **not** on this path. ROADMAP.md line 77 states this explicitly. SPIKE-01 gates Phase 6 alone.
- STATE.md line 153 still carries a stale blocker — *"Phase 2 gate: SPIKE-01 must clear before Phase 3 coding begins"*. That line is superseded by `6ef6dbe` ("docs(planning): drop the SPIKE-01 gate from Phase 3"). Treat the roadmap as authoritative.

### 3. Participation is FREE and the participation *payment rail* is dead weight

`/api/payments/create` still accepts `type: 'vote_participation'` and still quotes ₪3 (`services/payments/greenInvoice.ts:42`, `:347`). Its only remaining web caller is gone (`votes/create/page.tsx:159` sends `vote_creation`); mobile's `payment/checkout.tsx` is the last caller and `30db847` already rerouted mobile's vote screen away from it.

**Decision: retire the rail rather than keep pinning a dead price.** Phase 02.1 deliberately deferred this ("Retiring this rail belongs to the Phase 3 payment re-scope" — `greenInvoice.ts:39`). This is that phase. One payment type survives: `vote_creation`.

### 4. Track C is gated on a human, and the gate is stricter than SPIKE-02

COIN-01 is written Israeli legal sign-off on securities status, treasury custody structure, and permissible claims. Nothing in this repository can clear it. Every COIN implementation plan opens with a blocking `checkpoint:human-verify` task and lives in the final wave.

### 5. Claude's Discretion

- Exact Hebrew wording of replacement copy, within the constraint that it must state only what Taruu can back.
- Whether a retired surface is deleted or rewritten (both are acceptable; deleting an unmounted component is preferred over maintaining a lie).
- Test file placement and naming, consistent with `apps/web/src/__tests__/`.
- The shape of the extracted pure modules, provided they follow the pure-core / async-shell pattern that plans 02.1-02 and 02.1-05 established.

</decisions>

---

<verified_findings>
## Code Verification — every audit claim re-checked 2026-08-03

**Baseline on the current tree:** `pnpm --filter @sync/web typecheck` exits 0. `pnpm --filter @sync/web test` is green — **69 files, 854 tests, ~2.3s**.

### SEC-02 — ALREADY SATISFIED. Do not plan implementation work.

`apps/web/src/app/api/treasury/[municipality]/transactions/route.ts` was fixed out of phase in commit `35b0709` (2026-07-27, "feat(dashboard): implement user dashboard foundation (#36)"). Verified in the current tree:

- `user_id` and `payment_id` are **not** mapped into the response (`:140-151`), with a load-bearing comment at `:137-139` telling future editors not to reintroduce them.
- `metadata` is projected through a fail-closed whitelist (`PUBLIC_METADATA_KEYS = ['tokenMint', 'ilsPerSol']`, `:23`), enforced at both key and value level, with `Object.prototype.hasOwnProperty.call` against prototype pollution (`:38-62`).
- It is already covered: `apps/web/src/__tests__/api/treasury-transactions.test.ts` has 22 tests including `'must not leak per-user identifiers on the municipality ledger'` (`:158`) and a six-test `metadata whitelisting` describe.
- The per-user ledger lives separately at `/api/user/treasury-contributions`, scoped in SQL, with its own guard test (`__tests__/services/treasury-transaction-scoping.test.ts`, 6 tests).

The requirement text permits either scoping to the caller **or** stripping `userId` and exposing anonymized aggregates. The second branch is implemented.

**The only outstanding SEC-02 work is bookkeeping:** `REQUIREMENTS.md:150` still reads `Pending`. Plan 03-01 closes that on the record and adds a source-level guard so a future refactor cannot silently re-add the identifiers. No route code changes.

### SEC-03 — partial, and the naive fix is impossible. Read this before planning.

- Constant-time comparison **exists**: `verifyWebhook` at `services/payments/greenInvoice.ts:303-320` uses `timingSafeEqual` with a length pre-check.
- Production fail-closed on an *unset* secret **exists** (`:305-311`).
- The forbidden transport is the one actually configured: `notifyUrl` is built as `.../api/payments/webhook?token=<secret>` at `:143`, and `:314` reads `searchParams.get('token')` **first**.

**The blocking constraint** — recorded in the code at `:139-142` and again at `webhook/route.ts:28-30`: *"Green Invoice's hosted-form notify supports only a URL (no custom headers), so the secret rides in the query string."* If that is true, "just move it to a header" **cannot work for the hosted-form path**, and a plan that only swaps the transport would break every production webhook.

**[ASSUMPTION A1]** GI's `/payments/form` `notifyUrl` accepts no custom headers and GI signs no payload. *Basis:* two independent in-repo assertions written by whoever built the integration; no contradicting evidence in `apps/web/docs/INTEGRATIONS.md`. *Falsified by:* the GI API console or the GI rep confirming custom notify headers or an HMAC signature header. This question belongs on `GI-PRIME-CHECKLIST.md` and plan 03-06 adds it there.

**Therefore SEC-03 is designed as two independent factors, not one swap:**

1. **Header, constant-time, no query fallback.** `verifyWebhook` reads `x-greeninvoice-token` only. The `?token=` read is deleted and `notifyUrl` stops carrying the secret. This is what the requirement literally demands and it is what makes any caller that *can* set a header (our own re-drive, a future GI capability) authenticate properly.
2. **Server-side document confirmation as the authenticity proof for the hosted-form path.** The notify becomes an untrusted ping: it only says "look at order X". Before any mutation, the route re-fetches the document from GI over the already-authenticated API (`giRequest` carries the JWT minted from `GREENINVOICE_API_KEY_ID`/`SECRET`) and confirms it exists and is settled. An attacker who guesses an order id gets nothing, because they cannot make GI vouch for a document that does not exist.

Fail closed in production if **neither** factor holds. Also fail closed on a DB error, which the roadmap names explicitly and which the current route does not do — `recordTreasuryDeposit` failure is swallowed as non-fatal at `webhook/route.ts:139-145`.

### SEC-04 — unsatisfied, exactly as the audit described

`apps/web/src/app/api/payments/create/route.ts:77`:

```
const paymentIdempotencyKey = idempotencyKey || `${user.id}-${type}-${voteId || 'create'}-${Date.now()}`;
```

Both defects are live: a **client-supplied override** (`:19`, `:36`) and a **`Date.now()` suffix**, which guarantees every retry mints a fresh key and a fresh pending `payments` row. Required shape is `{userId}:{type}:{voteId|optionId}`, server-derived only.

Also verified: `randomUUID` is imported at `:2` and never used — dead import, sweep it.

Test coupling to know about: `__tests__/api/payments.test.ts:246-270` passes `idempotencyKey: 'key-123'` in the request body. Plan 03-02 removes that from the body when it rewrites the create describe, so plan 03-07 can drop the override without a cross-plan test conflict.

### SEC-05 — confirmed dead, confirmed production-breaking as written, and the wiring point is NOT what the audit assumed

- `apps/web/src/lib/env.ts` has **zero importers**. Verified: `grep -rn "lib/env" apps/web/src` returns nothing, and `validateEnv` / `getServerEnv` / `getClientEnv` have no callers anywhere. The whole module is dead. (`validateEnv()` is now at `:146`, not `:135` — the file has drifted since the audit.)
- Wiring it as written would **take production down**. `serverEnvSchema` hard-requires:
  - `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `NEXT_PUBLIC_AUTH0_DOMAIN`, `NEXT_PUBLIC_AUTH0_CLIENT_ID` (`:31-34`) — **all four have zero readers** anywhere in `apps/web/src` since `da77848` deleted the Auth0 service. Login runs on Google OAuth (`api/auth/callback/route.ts:47` reads `GOOGLE_CLIENT_SECRET`).
  - `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (`:13-14`) — **neither is read at runtime**. `lib/supabase/server.ts:22-23` reads `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
  - `clientEnvSchema` (`:66-67`) also requires the two public Auth0 vars.
- Drift since the audit: `SUPABASE_JWT_SECRET` was added `.optional()` at `:25-28` by the Phase 5 RLS transport work (`96448b3`). Keep it optional — `lib/supabase/user-token.ts:34` guards at the point of use.

**Where "startup" actually is on this platform.** There is no Node app boot. Two hard constraints:

1. `next build` runs in CI **without** runtime secrets. `lib/supabase/server.ts:6-12` documents that the repo already learned this and made client creation lazy for exactly this reason. Any eager import-time validation reintroduces that break.
2. `apps/web/src/middleware.ts:46` matches `'/((?!_next|api|static|.*\\..*).*)'` — it **excludes `/api`**, so it cannot guard the routes that need the secrets.

**The correct hook is `apps/web/worker.ts`** — a custom Cloudflare Worker entry (`wrangler.jsonc:12` `"main": "worker.ts"`) that re-exports the OpenNext fetch handler and adds `scheduled`. It runs once per isolate on the real runtime, receives the `env` binding directly, sits outside the Next build graph, and is inside `tsconfig.json`'s `include` with `@/*` path mapping available. `instrumentation.ts` does not exist in this repo and its behaviour under `@opennextjs/cloudflare` is unverified — **do not bet the plan on it.**

Testability: `worker.ts` is not collected by vitest (`include: ['src/**/*.test.ts']`) and imports `./.open-next/worker.js`, which only exists post-build. So the decision logic must be a pure function in `src/lib/env.ts`, unit tested there; `worker.ts` gets a thin adapter verified by typecheck plus grep.

### PAY-06 — the ₪50 rail works, but the creation funnel can claim a vote that does not exist

Working path, verified: `votes/create/page.tsx:159` → `api/payments/create/route.ts:132` → `greenInvoice.ts:213` hosted form → `payments/return/page.tsx:70` → `POST /api/votes` → `create-vote.ts:72` `assertPaymentUsable`. The server re-verifies the payment, so a stale draft cannot publish for free. That gate is sound.

Two live defects the phase must close:

1. **A fabricated seal in the creation funnel.** `votes/create/page.tsx:196-203` is a "graceful MOCK fallback": when the API returns 200 with no `paymentUrl`, it sets `sealHash` to a **random hex string** (`Math.random().toString(16)`) and renders the success surface — headline `הצבעה נוצרה · CREATED`, a `Receipt` reading `דמי יצירה ₪50`, and a `SealCard` with `status="sealed"` (`:232-280`). **`POST /api/votes` is never called on that branch.** This is the identical class of defect Phase 02.1 removed from the participation funnel (`mockHash()`), still alive in the creation funnel. Delete it.
2. **The GI failure redirect is ignored.** `greenInvoice.ts:163` registers `failureUrl: .../payments/return?payment=<id>&status=failed`, and `payments/return/page.tsx` never reads `searchParams`. A user whose card declined lands with a `pendingVote` draft still in `sessionStorage`, the page POSTs `/api/votes` anyway, the server correctly refuses with 402, and the page shows the `processing` copy: *"התשלום עדיין נחתם. ההצבעה תפורסם תוך רגעים."* — a reassuring lie about a payment that failed.

What is already fine and must not be "fixed": the raw gateway string is already caught and replaced with Hebrew (`MSG_GENERAL` at `:24`, used at `:206`), and the error phase already offers retry plus support (`return/page.tsx` error branch). The 402-retry loop and the 400 "already consumed" handling are deliberate and correct.

### PAY-07 — receipt issues, but the stored "document id" can silently be our own order id

`payments.provider_id TEXT` (`20240101000000_initial_schema.sql:156`) is where the GI document id lands, via `markPaymentCompleted(payment.id, event.paymentId)` (`webhook/route.ts:108`, `db.ts:545-565`).

The defect is in `parseWebhookEvent` (`greenInvoice.ts:328-341`):

```
paymentId: documentId || orderId
```

If GI's notify payload carries no `id`/`documentId`/`paymentId`, `event.paymentId` silently becomes **our own order id**, which is then written to `provider_id` as though it were a GI document. Reconciliation (Phase 4 GO-02) would then match our id against itself and report zero mismatches while holding no document reference at all. The two must be distinguishable.

**There is no `transactions` table.** ROADMAP.md line 98 and REQUIREMENTS.md's GO-02 both say "the internal `transactions` table". Verified across all 31 migrations: the only tables are `payments` and `treasury_transactions`. **[ASSUMPTION A2]** "the transaction" in PAY-07 and GO-02 means the `payments` row. *Falsified by:* an owner statement that a new ledger table is intended — in which case it belongs to Phase 4, not here.

### PAY-08 — Paddle is already gone; the copy is not. Full enumerated inventory below.

**Paddle:** verified absent from the vote-payment flow. Two residues only: a historical sentence in a docstring (`services/payments/greenInvoice.ts:6`) and `'paddle' | 'green_invoice'` in the generated `provider` union (`lib/supabase/types.ts:320,336,352`), which mirrors a live database enum and must **not** be edited by hand. PAY-08's Paddle clause is satisfied; do not plan work for it.

**Money-model copy — every surface, enumerated by grep, not guessed:**

| # | Surface | The claim | Live? |
|---|---------|-----------|-------|
| 1 | `src/components/press/Ticker/Ticker.tsx:14` | `₪2 מכל הצבעה נצברים לקרן הקהילתית` | **YES — homepage (`[locale]/page.tsx:34`) and `/explore` (`:65`)** |
| 2 | `src/components/sections/MoneyTransparency/MoneyTransparency.tsx` | Whole component: ₪3 fee split ₪2 fund / ₪1 ops, bar chart, aria-label, two cards | Exported from `sections/index.ts:7`, **zero page usages** |
| 3 | `src/services/email/index.ts:368` | `מה הלאה? כל קול (₪3) נצבר בקופת ההצבעה.` | **YES — vote-created email** |
| 4 | `apps/mobile/app/(auth)/index.tsx:77` | `₪3` / `להצבעה` trust stat | **YES — mobile welcome screen** |
| 5 | `src/app/[locale]/economics/components/FAQ.tsx:17` | `70% זורם ישירות לקרן הקהילתית. 30% מממן את הפלטפורמה.` | **YES** |
| 6 | `.../economics/components/FAQ.tsx:42` | `30% מעמלות המסחר ומדמי יצירת הצבעות.` | **YES** |
| 7 | `.../economics/components/CTASection.tsx:16` | `70%` / `לקרן הקהילתית` trust stat | **YES** |
| 8 | `.../economics/components/HowItWorks.tsx:222-227` | `70%` fee-split callout + `30% מממנים את התחזוקה` | **YES** |
| 9 | `.../economics/components/FlywheelDiagram.tsx:85,91,92` | `70% לקרן הרשות, 30% לפלטפורמה`; `1% על כל עסקה`; `100% לקופת הקרן` | **YES** |
| 10 | `.../treasury/components/TreasuryDashboard.tsx:329,333` | `70% לקרן הרשות` / `30% תפעול הפלטפורמה` | **YES** |
| 11 | `.../pricing/components/PricingContent.tsx` | Price is already correct (free + ₪50 + `אין מנוי`), but it never says what funds the pool, and `:17` claims `זהות ו-GPS · חתום בבלוקצ׳יין` | **YES** |
| 12 | `src/services/greenInvoice/index.ts:218` | Docstring: `Use for the monthly membership fee (₪6)` | code comment |
| 13 | `src/services/payments/greenInvoice.ts:35-43,193,347` | The ₪3 `vote_participation` rail and `getPaymentAmounts().voteParticipation` | reachable API |
| 14 | `src/app/api/payments/create/route.ts` | `GET` publishes `voteParticipation: 3`; `POST` accepts `vote_participation` | **YES — public endpoint** |
| 15 | `src/__tests__/e2e/payment.test.ts` | `describe('Vote Payment (₪3)')`, Stripe mocks, self-asserting fake E2E | collected by vitest |

Already correct — **do not touch**: `[locale]/faq/data/faqData.ts:57-68` (says participation is free and the fund is filled by external BAG investment, not resident money), `[locale]/terms/page.tsx:99` (same), `PricingContent`'s ₪50 figure, `packages/shared/src/constants/index.ts:11-12` (`VOTE_PARTICIPATION_COST = 0`, `CREATE_VOTE_COST = 50`).

Also unmounted and stale, worth recording but not urgent: `src/components/sections/FundTransparency/FundTransparency.tsx` (zero usages, `monthlyAccumulation` framing is a membership artefact).

### COIN — the gate is already being violated by shipped code. Read this.

`/economics` and `/coin` are **live on taruu.co.il today** and make concrete investment claims while COIN-01 is unsigned:

- `economics/components/FAQ.tsx:12` — *"אתה לא רק תורם, אלא מחזיק נכס שמייצג את התמיכה שלך, **בדיוק כמו במניה**. אם יותר אנשים משקיעים, **ה-BAG שווה יותר**."* A securities analogy plus an implied return, which is precisely what COIN-04 forbids and COIN-01 gates.
- `coin/page.tsx:9-10` metadata and `economics/page.tsx:15-21` openGraph carry the same investment framing.
- `/api/bags/{quote,swap,trending}` are shipped and session-gated.

`/api/bags/swap` also has a concrete COIN-03 hole, verified at `apps/web/src/app/api/bags/swap/route.ts:35-52`: it accepts a **client-supplied `quote` object**, validates only that `inputAmount`/`outputAmount`/`fee` are present, and passes it straight to `bagsService.executeSwap`. The quote the UI shows is not provably the quote that executes; the client can hand the server any quote it likes.

**[FINDING - needs an owner decision, outside this planner's authority]** ROADMAP Phase 3 success criterion #6 reads *"No token surface is live without written Israeli legal sign-off."* That criterion is **currently false in production**, and this phase as scoped does not make it true — Track C is blocked. Removing an unbacked claim is not itself gated by a lawyer (a lawyer's permission is needed to *keep* or *add* claims, not to delete them), so an immediate takedown of the profit-implying copy is available at any time and would strictly reduce exposure.

Per the locked constraint that all COIN work sits in the final blocked wave, **no takedown is planned here.** Instead plan 03-09 (COIN-01, wave 2, unblocked) produces a file:line inventory of every live token claim as part of the dossier the lawyer receives, which is both the artifact the gate needs and the list the owner would work from if they choose to act sooner. Raised explicitly so the decision is made deliberately rather than by omission.

</verified_findings>

---

<contradictions>
## Where the Roadmap and the Code Disagree

| # | Roadmap / requirement says | Code says | Resolution taken |
|---|---|---|---|
| 1 | SEC-02 `Pending` (`REQUIREMENTS.md:150`) | Satisfied in `35b0709`, with 22 route tests + 6 scoping tests | No implementation planned. Plan 03-01 closes it on the record and adds a source-level regression guard. |
| 2 | SEC-03: *"verifies its secret via constant-time comparison of an HTTP header"* | GI's hosted form cannot attach headers (`greenInvoice.ts:139-142`) | Two factors, not one swap: header-only comparison **plus** server-side document confirmation. See Locked Decision context above. |
| 3 | PAY-07 / GO-02: *"the internal `transactions` table"* | No such table exists in 31 migrations. The ledger is **`payments`**; the GI document id lands in `payments.provider_id` via `markPaymentCompleted` (`db.ts:545-565`), and `payments.amount` is in **agorot** (`initial_schema.sql:152`), so ₪50 is stored as `5000` | **[A2]** Read as the `payments` row. **Rename nothing** — the discrepancy is documentation drift, not a missing table. Confirmed independently by the Phase 4 planner 2026-08-03. |
| 4 | ROADMAP SC#6: *"No token surface is live without written legal sign-off"* | `/coin`, `/economics`, `/explore` and three `/api/bags/*` routes are live now | Not resolvable inside a blocked track. Surfaced as a FINDING for owner decision; 03-09 produces the claim inventory. |
| 5 | STATE.md:153 *"SPIKE-01 must clear before Phase 3 coding begins"* | Superseded by `6ef6dbe` and ROADMAP:77 | Roadmap wins. SPIKE-01 gates Phase 6 only. |
| 6 | Audit: `validateEnv()` at `env.ts:135` | Now at `:146`; `SUPABASE_JWT_SECRET` added by `96448b3` | Plans cite verified current lines. |
| 7 | Phase 5 is "not started" (ROADMAP progress table) | `96448b3` and `3dedcf0` already landed the RLS transport (`lib/supabase/user-token.ts`, `user-client.ts`) and the role-grant schema (migrations `20260802000001`, `20260802000002`); `05-01`/`05-02` SUMMARYs are dated today | **Phase 5 is executing out of roadmap order in a parallel session.** Read env and migration state from the repo, never from the roadmap's sequencing. `SUPABASE_JWT_SECRET` is a real runtime variable now and plan 03-01's schema must keep it (optional). **Expect `apps/web/src/lib/env.ts` to have moved under you** — every line number this phase cites for that file is a 2026-08-03 snapshot, and plan 03-01 re-reads before editing. |

</contradictions>

---

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before implementing.**

### Security track
- `apps/web/src/lib/env.ts` — the dead module; schema at `:11-57` and `:61-68`, `validateEnv()` at `:146`
- `apps/web/worker.ts` — the real per-isolate startup hook (`wrangler.jsonc:12`)
- `apps/web/src/lib/supabase/server.ts:6-12` — why import-time validation is forbidden (lazy-by-necessity precedent)
- `apps/web/src/middleware.ts:45-47` — the matcher that excludes `/api`
- `apps/web/src/services/payments/greenInvoice.ts` — `createPaymentForm` `:126`, `notifyUrl` `:143`, `verifyWebhook` `:303`, `parseWebhookEvent` `:328`, `giRequest` `:99`
- `apps/web/src/app/api/payments/webhook/route.ts` — auth `:44`, replay guard `:53-89`, atomic claim `:108`, swallowed treasury error `:139-145`
- `apps/web/src/app/api/payments/create/route.ts:77` — the idempotency defect
- `apps/web/src/app/api/treasury/[municipality]/transactions/route.ts` — SEC-02, already done

### Payments track
- `apps/web/src/app/[locale]/votes/create/page.tsx:142-210` — the checkout kick-off and the mock-seal fallback at `:196-203`
- `apps/web/src/app/[locale]/payments/return/page.tsx` — the finalisation flow; never reads `searchParams`
- `apps/web/src/server/app/votes/create-vote.ts:72` — `assertPaymentUsable`, the server gate that already works
- `apps/web/src/lib/supabase/db.ts:433` `verifyPaymentCompleted`, `:466` `isPaymentAlreadyUsed`, `:545` `markPaymentCompleted`
- `supabase/migrations/20240101000000_initial_schema.sql:148-168` — `payments` table, `provider_id`, `idempotency_key TEXT UNIQUE NOT NULL`
- `packages/shared/src/constants/index.ts:11-12` — `VOTE_PARTICIPATION_COST = 0`, `CREATE_VOTE_COST = 50`

### Token track
- `apps/web/src/app/api/bags/swap/route.ts:35-75` — the client-supplied-quote hole
- `apps/web/src/app/api/bags/quote/route.ts`, `apps/web/src/services/bags/index.ts` (`getQuote:194`, `executeSwap:215`)
- `apps/web/src/services/treasury/bagSeeding.ts` — `agorotToSol:51`, `seedVoteBag:70`
- `supabase/migrations/20250116000001_treasury_and_issue_coins.sql:64` — `treasury_transactions`
- `apps/web/docs/GI-LEGAL-CHECKLIST.md` — the SPIKE-02 precedent COIN-01's dossier should mirror in shape (0/19 checked)

### Test precedents
- `apps/web/vitest.config.ts` — `environment: 'node'`, `include: ['src/**/*.test.ts', 'src/**/*.spec.ts']`. **`.tsx` is never collected.**
- `apps/web/src/__tests__/services/dashboard-free-mvp.test.ts:1-35` — the source-assertion pattern for copy guards, including the `code()` comment stripper
- `apps/web/src/__tests__/services/submit-participation.test.ts` — the injected-`fetch` pure-module pattern from plan 02.1-05
- `apps/web/src/__tests__/api/payments.test.ts` — 36 tests over create/status/verify/webhook; the create describe locks in ₪3

### Project rules
- `CLAUDE.md` — design tokens only, RTL Hebrew, strict TS with no `any`, functional/composable
- **Never** add Claude or Anthropic as a git co-author, trailer, or mentioned collaborator. Absolute.
- Never print or copy a secret value, in code, logs, tests, or documents.

</canonical_refs>

---

<repo_conventions>
## Repo Conventions That Constrain Every Plan

| Rule | Detail |
|------|--------|
| Package manager | pnpm workspaces |
| Typecheck | `pnpm --filter @sync/web typecheck` (exits 0 today) |
| Tests | vitest **1.6.1**, `environment: 'node'`, `include: ['src/**/*.test.ts', 'src/**/*.spec.ts']` |
| **No component tests** | No jsdom, no `@testing-library/react`, and the glob never collects `.tsx`. **Do not plan component-render tests.** Extract logic into `.ts` modules with injected dependencies (plan 02.1-05 precedent) and assert component copy against SOURCE (`dashboard-free-mvp.test.ts` precedent). |
| **Verification-gate rule** | **Never** write a task whose `<automated>` command runs a test file that a LATER task in the same plan creates — vitest 1.6.1 exits `1` with `No test files found`, which `execute-plan.md`'s failure gate reads as a real failure. This blocked the previous plan-check. Such tasks gate on `pnpm --filter @sync/web typecheck` plus a positive `grep -q` instead, and the behavioural proof lands one task later in the same plan. |
| Other packages | `pnpm --filter @sync/shared typecheck` · `pnpm --filter @sync/api-client test` · `pnpm --filter @sync/mobile typecheck` |
| Generated types | `apps/web/src/lib/supabase/types.ts` mirrors live database enums — never hand-edit |
| Git | No Claude/Anthropic co-authors, trailers, or mentions on any commit |

</repo_conventions>

---

<assumptions>
## Assumptions Register

No user interview was available. Every assumption below is explicit, with what would falsify it.

| ID | Assumption | Basis | Falsified by |
|----|------------|-------|--------------|
| **A1** | GI's hosted-form `notifyUrl` accepts no custom headers, and GI signs no payload | Two independent in-repo assertions (`greenInvoice.ts:139-142`, `webhook/route.ts:28-30`) | GI API console or rep confirming header/HMAC support. Plan 03-06 adds the question to `GI-PRIME-CHECKLIST.md` so it is asked, not assumed forever. |
| **A2** | "the transaction" in PAY-07 / GO-02 means the `payments` row; `provider_id` is the document-id column and `amount` is in agorot (₪50 = `5000`) | No `transactions` table exists in any of 31 migrations. Independently confirmed by the Phase 4 planner, 2026-08-03 | An owner statement that a new ledger table is intended (→ Phase 4). Until then, **rename nothing**. |
| **A3** | `GET /api/payments/create` may narrow its response to creation-only pricing | Its only shape consumers are `packages/shared/src/contracts/payment.ts:54` and `packages/api-client/src/payments.ts` — both in-repo | An undiscovered external consumer of the pricing endpoint. |
| **A4** | `apps/mobile/app/payment/checkout.tsx` may lose its `vote_participation` branch | `30db847` already rerouted the mobile vote screen away from checkout; participation is free on both platforms | An owner statement that mobile still needs a participation checkout. |
| **A5** | Deleting the unmounted `MoneyTransparency` component is preferred to rewriting it | Zero page usages; its entire premise is a retired ₪3 fee | An owner statement that the section is planned for reuse — in which case rewrite instead of delete. |
| **A6** | The economics page's `70%/30%` and `1% על כל עסקה` figures are **not** currently backed by any implemented split | `bagsService.createDefaultFeeShareConfig` (`services/bags/index.ts:326`) exists but no route or ledger implements a 70/30 civic split, and `webhook/route.ts:128-138` deposits the **full** amount | Evidence of a configured, live fee-share. Until then the honest move is to state what is true rather than a percentage. |
| **A7** | `worker.ts`'s module scope and fetch wrapper run once per isolate on Cloudflare and can fail a request closed | `wrangler.jsonc:12` `"main": "worker.ts"`; the OpenNext custom-worker pattern it documents at `:15` | Observed behaviour on the deployed Worker. **Recorded as a manual-only verification in `03-VALIDATION.md`** — it cannot be proven by a unit test. |
| **A8** | No user-facing surface should assert a `70%` civic split until a ledger proves it | COIN-02 requires exactly that ledger and is blocked on COIN-01 | The lawyer approving specific wording (which is COIN-04's job, in the blocked wave). |

</assumptions>

---

<deferred>
## Deferred — explicitly NOT in this phase

- **Any recurring/membership charge, stored participation card token, or MIT token charge.** Retired (PAY-01..05). `chargeToken()` stays orphaned; Phase 6 owns it.
- **Go-live deployment, real credentials, the end-to-end money check.** Phase 4 (GO-01, GO-02).
- **The CI deploy break** — `.github/workflows/deploy.yml:62` references an unset `CLOUDFLARE_API_TOKEN`; 5/5 recent runs failed. Phase 4.
- **The RLS/RBAC line.** Phases 5 and 7 (partially landed already in `96448b3` / `3dedcf0`).
- **Chain-seal marketing copy outside the money model** — `TrustBar`, `Hero/ConsensusVisual`, `VotesHero`, `ArchiveHero`, `about/Mission`, sign-in/sign-up, `verification`, and `PricingContent:17`'s `חתום בבלוקצ׳יין`. Recorded as a known gap by `02.1-VALIDATION.md`; only the **money-model** claims are in PAY-08's scope. `PricingContent:17` is the one exception a plan touches, and only to add what funds the pool.
- **`FundTransparency.tsx`** — unmounted, membership-era framing (`monthlyAccumulation`). Record, do not sweep.
- **Backfilling votes lost 2026-07-29 → the 02.1 fix.** A data question, deferred by `02.1-CONTEXT.md`.
- **`incrementVoteOption`'s non-atomic RPC fallback** (`db.ts:993-1005`).
- **Retiring `qubikService`** across the codebase. The webhook's mint call stays; only the participation branch around it goes.
- **`HARD-01..04`** (orphaned-charge cron, refund/chargeback reversal, OAuth CSRF, cron constant-time compare) — v2.

</deferred>

---

*Phase: 03-payment-rails-hardening*
*Context derived 2026-08-03 from ROADMAP/REQUIREMENTS/STATE/AUDIT plus first-hand code verification. No user interview was available; every assumption is registered above with a falsifier.*
