# Phase 2: Spike + Gate - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 is the **hard gate** before any production payment code (Phase 3). It has one
code-gating item (SPIKE-01, the GI card-on-file sandbox verification) and two parallel
**external human tracks** (SPIKE-02 legal/accountant sign-off, SPIKE-03 GI Prime
provisioning + real credentials). 

**Critical constraint discovered during discuss:** no real Green Invoice sandbox
credentials are staged — `GREENINVOICE_API_KEY_ID` and `GREENINVOICE_API_SECRET` are
empty/placeholder in `apps/web/.dev.vars`. Therefore the live sandbox run (success
criteria #1 and the live half of #2) **cannot be executed autonomously** and is a
human-action gate. Criteria #3 and #4 are entirely human deliverables.

This phase's *codeable* scope (what we build now, before the gate):
1. A **runnable GI sandbox spike harness** — exercises the full card-on-file sequence
   (`/account/token` → `/payments/form` card-setup → webhook → token persist →
   `POST /payments/tokens/{id}/charge` MIT), guarded on `isGreenInvoiceConfigured()`,
   ready to run the moment real sandbox creds land.
2. A **code-derived trace of the existing merch GI flow** that pre-answers success
   criterion #2 (webhook shape, header-vs-query secret transport, document-id fields,
   token-charge gap) from the already-shipped merch integration.
3. **SPIKE-02 (legal/accountant) checklist** + **SPIKE-03 (GI Prime/creds/clearing)
   checklist** — the documents the owner hands to the accountant and the GI rep.

Out of this phase's code scope: running the harness against live sandbox; obtaining
sign-offs; provisioning Prime; staging real secrets. These are the gate — Phase 2
verification will be `human_needed` until they resolve.

</domain>

<decisions>
## Implementation Decisions

### Spike Harness
- Form: a standalone runnable TypeScript script under `apps/web/scripts/` (NOT a vitest
  test — it hits a live external API and must be invoked deliberately, never in CI).
- Guard: hard-exit with a clear message when `isGreenInvoiceConfigured()` is false, so it
  is safe to commit and run later without creds.
- Scope: the full sequence — token exchange → payment-form card-setup → (manual) webhook
  trace → token persistence → repeat token charge (`/payments/tokens/{id}/charge`). The
  token-charge MIT call is the novel surface the merch flow never exercises.
- Output: prints a structured result and writes/updates a markdown SPIKE-RESULT doc with
  the fields criterion #1/#2 require (charge id, document id, 3DS/SCA behavior, decline
  behavior, webhook shape, settlement timing, secret transport).
- Reuse: import the existing `apps/web/src/services/greenInvoice/` service where possible
  rather than re-implementing auth; extend it with the token-charge call.

### External Tracks (SPIKE-02, SPIKE-03)
- Both captured as checklist docs under `apps/web/docs/` (alongside existing
  INTEGRATIONS.md / MORNING-CHECKLIST.md).
- SPIKE-02 covers: correct GI document type per flow (חשבונית קבלה vs חשבונית מס), VAT
  treatment, refund/credit-note (זיכוי) mechanics, consumer-protection obligations under
  Israeli law.
- SPIKE-03 covers: Prime plan (₪0.15/receipt) confirmation in writing, real
  `GREENINVOICE_*` + Supabase prod creds staged in Cloudflare Workers secret store,
  written clearing terms (clearing %, hard minimums, brand/tourist-card surcharges,
  settlement payout threshold).
- Tracked as live blockers in STATE.md so Phase 3 (needs SPIKE-01) and Phase 4 (needs
  SPIKE-02/03) gate correctly.

### Gate / Verification expectation
- Phase 2 verification will land as `human_needed`, not `passed`: the harness + traces +
  checklists are deliverables we can verify exist and are correct, but the live sandbox
  result and the human sign-offs are confirmed by the owner. Autonomous halts here per
  the "run til gate, then stop" instruction.

### Claude's Discretion
- Exact harness file name, script runner wiring (package.json script vs `tsx` invocation),
  and the precise markdown layout of the SPIKE-RESULT + checklist docs are at Claude's
  discretion, following existing `apps/web/docs/` and `apps/web/scripts/` conventions.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/services/greenInvoice/index.ts` — `getToken()` (POST `/account/token`,
  token via `X-Authorization-Bearer` header or body), `createPaymentForm()` (POST
  `/payments/form`, `type: 320` = payment request issuing a receipt/invoice on success),
  `isGreenInvoiceConfigured()` guard, sandbox base
  `https://sandbox.d.greeninvoice.co.il/api/v1`. The harness extends this, not rebuilds it.
- `apps/web/src/app/api/merch/webhook/route.ts` — the proven webhook pattern: order id via
  `custom` field; secret via `?token=` query OR `x-greeninvoice-token` header;
  `timingSafeEqual` with length-guard; fail-CLOSED in production, fail-open dev; document
  id read defensively from `payload.id || documentId || paymentId`; atomic
  `markMerchOrderPaid` (`pending → paid`) as the idempotency template.

### Established Patterns
- Scripts live in `apps/web/scripts/`; integration docs in `apps/web/docs/`
  (INTEGRATIONS.md, MORNING-CHECKLIST.md already present).
- Env split: secrets in `.dev.vars` (Workers), non-secret public vars commented separately.

### Integration Points
- The spike's token-charge endpoint (`POST /payments/tokens/{id}/charge`) is NOT yet
  implemented anywhere — it is the net-new surface Phase 3 will productionize, and the
  reason the sandbox spike must de-risk it first.

</code_context>

<specifics>
## Specific Ideas

The merch flow uses `type: 320` payment requests. The membership vote flow needs a saved
**card token** then off-session **MIT charges** — a different GI capability the merch flow
never exercises. The single most important spike output: confirm `POST
/payments/tokens/{id}/charge` returns a usable document id + charge id in one response,
and observe real 3DS/SCA + soft-decline behavior.

</specifics>

<deferred>
## Deferred Ideas

- Productionizing the token-charge call, once-per-calendar-month gate, charge-then-commit,
  monthly-pool accrual, Paddle cutover — all Phase 3.
- Actually running the harness against live sandbox, obtaining sign-offs, provisioning
  Prime, staging real secrets — the human gate; deferred out of autonomous scope by the
  "run til gate, then stop" instruction.

</deferred>
