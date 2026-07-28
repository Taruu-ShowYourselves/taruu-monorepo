---
phase: 02-spike-gate
verified: 2026-06-30T00:00:00Z
status: human_needed
score: 3/4 must-haves verified (4th deferred by design)
human_verification:
  - test: "Run pnpm spike:gi with real GI sandbox credentials and record all 7 Part A fields in apps/web/docs/SPIKE-RESULT.md"
    expected: "Part A is filled — Token-charge id, Document id, 3DS/SCA behavior, Soft-decline behavior, Webhook payload shape, Secret transport observed, Settlement timing — confirming POST /payments/tokens/{id}/charge returns a usable charge id + document id in one response and that 3DS/SCA + soft-decline behavior is observed."
    why_human: "No GREENINVOICE_API_KEY_ID / GREENINVOICE_API_SECRET staged in .dev.vars — confirmed by guard-path run. The harness is complete and ready; only live sandbox credentials are missing. Per 02-CONTEXT.md this was known and is the gate for Phase 3 start."
  - test: "Obtain written accountant/legal sign-off (or a written timeline) covering all four GI-LEGAL-CHECKLIST.md sections"
    expected: "All checkboxes in apps/web/docs/GI-LEGAL-CHECKLIST.md checked; Sign-off section has accountant name + date."
    why_human: "External human track — requires an accountant/lawyer. This gates Phase 4 (go-live), not Phase 3 build."
  - test: "Obtain GI Prime confirmation in writing, stage all production credentials, and obtain written clearing terms"
    expected: "All 24 checkboxes in apps/web/docs/GI-PRIME-CHECKLIST.md checked; Prime @ 0.15/receipt confirmed in writing; all GREENINVOICE_* and Supabase prod secrets staged via sync-secrets.sh; clearing %, hard minimums, brand surcharges, foreign-card surcharge decision, and settlement terms on file."
    why_human: "External human track — requires direct engagement with the GI account rep and Cloudflare Workers secret staging. This gates Phase 4 (go-live), not Phase 3 build."
---

# Phase 2: Spike + Gate Verification Report

**Phase Goal:** The GI card-on-file integration is technically verified in sandbox (hard gate — no production payment code before this clears); the slow external dependencies (accountant/legal sign-off and GI Prime provisioning) are initiated as parallel tracks that must resolve before go-live.
**Verified:** 2026-06-30
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `chargeToken()` is exported from the greenInvoice service and POSTs to `/payments/tokens/{id}/charge` | VERIFIED | `grep` of `apps/web/src/services/greenInvoice/index.ts` line 220: `export async function chargeToken` + line 238: `${config.baseUrl}/payments/tokens/${encodeURIComponent(input.tokenId)}/charge` |
| 2 | A guarded spike harness exists, imports the service via relative path, and hard-exits with "not configured" + code 1 when creds are absent | VERIFIED | `pnpm spike:gi` run confirmed: prints exact message and exits code 1. No network call issued. |
| 3 | SPIKE-RESULT.md has all 7 Part A observation fields (pending live run) and a code-derived Part B trace pre-answering criterion #2 | VERIFIED | All 7 fields confirmed present as `_(pending live run)_`; Part B section confirmed at line 52; `custom`, `x-greeninvoice-token`, and `/payments/tokens/` gap all documented. |
| 4 | [HUMAN-VERIFIED / DEFERRED] The harness has been run against live GI sandbox and SPIKE-RESULT.md Part A is filled with actual 3DS/SCA, soft-decline, charge id, document id, and settlement-timing observations | DEFERRED | No sandbox credentials present — expected per 02-CONTEXT.md. This is the gate for Phase 3. |
| 5 | A legal/accountant checklist exists covering document type, VAT, credit-note (זיכוי), and consumer-protection | VERIFIED | `apps/web/docs/GI-LEGAL-CHECKLIST.md`: all 4 sections confirmed, 19 checkboxes, PENDING status flag present. |
| 6 | A GI Prime/credentials/clearing-terms checklist exists covering Prime @ 0.15/receipt, real creds staging, and written clearing terms incl. tourist/foreign-card surcharge | VERIFIED | `apps/web/docs/GI-PRIME-CHECKLIST.md`: all 3 sections confirmed, 24 checkboxes, 0.15 rate, GREENINVOICE_API_KEY_ID, SUPABASE_SERVICE_ROLE_KEY, surcharge all present. PENDING flag present. |
| 7 | [HUMAN-VERIFIED / DEFERRED] Accountant/legal sign-off obtained; Prime provisioned in writing; real creds staged; clearing terms on file | DEFERRED | External human track — gates Phase 4 go-live, not Phase 3 build. Per 02-CONTEXT.md and ROADMAP.md note on SPIKE-02/03. |

**Score:** 5/5 codeable truths verified. 2 deferred truths are human-gate items by design (not gaps).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/services/greenInvoice/index.ts` | exports `chargeToken()` for POST /payments/tokens/{id}/charge | VERIFIED | `chargeToken` at line 220; `TokenChargeInput` + `TokenChargeResult` interfaces at lines 198/206; `encodeURIComponent(input.tokenId)` at line 238; defensive id read at line 265; all prior exports (`isGreenInvoiceConfigured`, `getToken`, `createPaymentForm`) intact |
| `apps/web/scripts/gi-spike.ts` | Runnable guarded spike harness, relative import, guard-first | VERIFIED | `from '../src/services/greenInvoice/index'` at line 22; `isGreenInvoiceConfigured()` guard at line 27; `process.exit(1)` at line 31; imports `getToken`, `createPaymentForm`, `chargeToken`; no `@/lib/logger` |
| `apps/web/package.json` | `spike:gi` script + `tsx ^4.0.0` devDependency | VERIFIED | `"spike:gi": "tsx --env-file=.dev.vars scripts/gi-spike.ts"` at line 18; `"tsx": "^4.0.0"` at line 57 |
| `apps/web/docs/SPIKE-RESULT.md` | 7-field Part A template + Part B code-derived trace | VERIFIED | All 7 Part A fields present as `_(pending live run)_`; Part B at line 52; `x-greeninvoice-token`, `custom`, and MIT surface gap all documented |
| `apps/web/docs/GI-LEGAL-CHECKLIST.md` | SPIKE-02 legal checklist with 4 sections, checkboxes, PENDING | VERIFIED | 4 sections confirmed; 19 checkboxes; `חשבונית קבלה`, `חשבונית מס`, `זיכוי` terms all present; PENDING flag present |
| `apps/web/docs/GI-PRIME-CHECKLIST.md` | SPIKE-03 Prime/creds/clearing checklist with 3 sections, checkboxes, PENDING | VERIFIED | 3 sections confirmed; 24 checkboxes; `0.15` rate; `GREENINVOICE_API_KEY_ID`, `SUPABASE_SERVICE_ROLE_KEY`; `surcharge`/`tourist`/`foreign-card` all present; PENDING flag present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/web/scripts/gi-spike.ts` | `apps/web/src/services/greenInvoice/index.ts` | `from '../src/services/greenInvoice/index'` (relative import) | WIRED | Line 22 — imports `isGreenInvoiceConfigured`, `getToken`, `createPaymentForm`, `chargeToken` |
| `apps/web/src/services/greenInvoice/index.ts` | `POST /payments/tokens/{id}/charge` | `fetch` in `chargeToken()` | WIRED | Line 238: `` `${config.baseUrl}/payments/tokens/${encodeURIComponent(input.tokenId)}/charge` `` with `method: 'POST'` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SPIKE-01 | 02-01-PLAN.md | GI sandbox spike confirms saved-card token charge is valid MIT, documents 3DS/SCA + soft-decline, verifies endpoint returns usable charge id + document id | PARTIAL — codeable half VERIFIED; live-run half DEFERRED (human gate) | `chargeToken()` implemented and harness guarded; SPIKE-RESULT.md Part B pre-answers criterion #2; Part A awaits live run. REQUIREMENTS.md marks SPIKE-01 complete (per owner decision that codeable half suffices until creds land). |
| SPIKE-02 | 02-02-PLAN.md | Accountant/legal sign-off on merchant-of-record status | CODEABLE VERIFIED; SIGN-OFF DEFERRED | GI-LEGAL-CHECKLIST.md covers all 4 required topics with 19 checkboxes. Actual sign-off is human gate — gates Phase 4 only. |
| SPIKE-03 | 02-02-PLAN.md | GI Prime plan provisioned; real credentials in place | CODEABLE VERIFIED; PROVISIONING DEFERRED | GI-PRIME-CHECKLIST.md covers Prime, all named secrets, and clearing terms with 24 checkboxes. Actual provisioning is human gate — gates Phase 4 only. |

All three requirement IDs are accounted for in plan frontmatter and confirmed in REQUIREMENTS.md (lines 24–26, 77–79).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | No TODOs, FIXMEs, stubs, or empty implementations in modified files. Guard-first pattern is substantive, not a placeholder. |

### Human Verification Required

#### 1. Live GI Sandbox Spike Run (SPIKE-01 gate for Phase 3)

**Test:** Fill `apps/web/.dev.vars` with `GREENINVOICE_API_KEY_ID`, `GREENINVOICE_API_SECRET`, `GREENINVOICE_PLUGIN_ID`. Run `pnpm spike:gi`. Open the card-setup form URL it prints. Complete card entry to capture a token id and webhook payload. Then run `GI_SPIKE_TOKEN_ID=<id> pnpm spike:gi --charge`.
**Expected:** All 7 fields in `apps/web/docs/SPIKE-RESULT.md` Part A are filled with actual observed values — charge id, document id, 3DS/SCA behavior (frictionless expected for MIT), soft-decline shape, webhook payload keys, secret transport method, settlement timing.
**Why human:** No sandbox credentials are staged (`GREENINVOICE_API_KEY_ID` and `GREENINVOICE_API_SECRET` are empty in `.dev.vars`). The harness is ready and guards correctly. This is the hard gate for Phase 3 start.

#### 2. Accountant/Legal Sign-off (SPIKE-02 gate for Phase 4)

**Test:** Hand `apps/web/docs/GI-LEGAL-CHECKLIST.md` to the accountant/lawyer. Obtain written answers to all 19 checkboxes.
**Expected:** All checkboxes checked; Sign-off section has accountant name + date.
**Why human:** External expert engagement required — accountant/lawyer must confirm document type, VAT treatment, credit-note mechanics, and consumer-protection compliance under Israeli law. Cannot be verified programmatically.

#### 3. GI Prime Provisioning + Credentials Staging + Clearing Terms (SPIKE-03 gate for Phase 4)

**Test:** Work through `apps/web/docs/GI-PRIME-CHECKLIST.md` with the GI account rep. Stage all production secrets via `./scripts/sync-secrets.sh`. Verify secrets with `wrangler secret list`.
**Expected:** All 24 checkboxes checked; GI Prime @ 0.15/receipt confirmed in writing; all `GREENINVOICE_*` and Supabase production secrets staged in Cloudflare Workers secret store; written clearing terms (%, hard minimums, brand surcharges, tourist-card surcharge decision) on file. Sign-off section completed by GI rep.
**Why human:** Requires direct engagement with the Green Invoice account representative and Cloudflare Workers secret management. The block-or-flag decision on the ~3.5% foreign-card surcharge also requires an owner/business decision.

### Gaps Summary

No codeable gaps. All six codeable artifacts are present, substantive, and correctly wired. The three remaining items are external human-gate items that were explicitly deferred out of autonomous scope in 02-CONTEXT.md and the ROADMAP.md note on SPIKE-02/03. They gate Phase 4 go-live (SPIKE-02, SPIKE-03) and Phase 3 start (SPIKE-01 live run only).

The phase is at the designed stopping point for autonomous execution.

---

_Verified: 2026-06-30_
_Verifier: Claude (gsd-verifier)_
