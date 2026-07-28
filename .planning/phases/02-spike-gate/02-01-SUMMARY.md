---
phase: 02-spike-gate
plan: 01
subsystem: payments
tags: [green-invoice, card-on-file, mit, token-charge, spike, typescript]

# Dependency graph
requires:
  - phase: 01-clean-foundation
    provides: Clean codebase base; existing greenInvoice service with getToken/createPaymentForm

provides:
  - chargeToken() — POST /payments/tokens/{id}/charge off-session MIT call in greenInvoice service
  - TokenChargeInput + TokenChargeResult TypeScript interfaces
  - gi-spike.ts — guarded standalone spike harness (deliberate-invocation only, never CI)
  - spike:gi npm script (tsx --env-file=.dev.vars) + tsx ^4.0.0 devDep
  - SPIKE-RESULT.md — 7-field live-observation template (Part A) + code-derived trace (Part B)

affects: [02-02-PLAN, 03-payment-rails, 04-go-live]

# Tech tracking
tech-stack:
  added: [tsx ^4.0.0 (devDep — runs TypeScript scripts directly without Next.js)]
  patterns:
    - "Guard pattern: isGreenInvoiceConfigured() throw before any network call"
    - "Defensive id read: data.field1 || data.field2 || data.field3 (mirrors webhook route)"
    - "Spike harness: standalone script under apps/web/scripts/, --env-file loads .dev.vars"

key-files:
  created:
    - apps/web/scripts/gi-spike.ts
    - apps/web/docs/SPIKE-RESULT.md
  modified:
    - apps/web/src/services/greenInvoice/index.ts
    - apps/web/package.json

key-decisions:
  - "chargeToken() appended to greenInvoice service — extend, not rebuild; mirrors createPaymentForm auth pattern exactly"
  - "type:320 reused in chargeToken — same document-issuance type as payment form for consistent GI tax document behaviour"
  - "Spike harness uses plain console.log only (no @/lib/logger) — keeps it free of Next.js path-alias dependencies so tsx resolves cleanly"
  - "documentId defensive read uses || chain without per-field casts (one-liner) to satisfy grep acceptance criterion and match webhook route pattern"
  - "SPIKE-RESULT Part B summary table maps pre-answered vs live-run-required items — unambiguous scope for the human gate"

patterns-established:
  - "Off-session MIT pattern: guard → getToken() → fetch /payments/tokens/{id}/charge → defensive id extraction → log custom only"
  - "Spike harness guard-first: isGreenInvoiceConfigured() checked before banner, before any network op"

requirements-completed: [SPIKE-01]

# Metrics
duration: 4min
completed: 2026-06-30
---

# Phase 2 Plan 01: GI Spike Harness Summary

**chargeToken() MIT call + guarded spike harness + SPIKE-RESULT trace de-risk POST /payments/tokens/{id}/charge before any production payment code**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-30T07:16:30Z
- **Completed:** 2026-06-30T07:20:46Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Added `chargeToken()` to the existing greenInvoice service — the off-session MIT endpoint (`POST /payments/tokens/{id}/charge`) that the merch flow never exercised; includes `TokenChargeInput` / `TokenChargeResult` interfaces and defensive id extraction mirroring the webhook route.
- Created `apps/web/scripts/gi-spike.ts` — a deliberately-invoked (never CI) harness that exercises the full sequence (token → card-form → MIT charge), guards on `isGreenInvoiceConfigured()` before any network call, and verifiably exits non-zero with a clear "not configured" message when creds are absent.
- Created `apps/web/docs/SPIKE-RESULT.md` — Part A observation template (7 fields, all pending live run, satisfies criteria #1/#2 when filled) + Part B code-derived trace (pre-answers criterion #2 for the merch flow, names the exact MIT-surface gaps the live run must close).

## Task Commits

1. **Task 1: Add chargeToken()** - `12e9be6` (feat)
2. **Task 2: Spike harness + tsx runner** - `8ded7c9` (feat)
3. **Task 3: SPIKE-RESULT.md** - `af54682` (docs)

## Files Created/Modified

- `apps/web/src/services/greenInvoice/index.ts` — Added `TokenChargeInput`, `TokenChargeResult` interfaces and `chargeToken()` async function (77 lines appended)
- `apps/web/scripts/gi-spike.ts` — New standalone spike harness (guard + JWT + card-form + MIT charge, 130 lines)
- `apps/web/package.json` — Added `spike:gi` script + `tsx ^4.0.0` devDependency
- `apps/web/docs/SPIKE-RESULT.md` — New: Part A 7-field template + Part B code-derived trace (149 lines)

## Decisions Made

- `chargeToken()` extends the existing module (same file, same auth pattern) — avoids rebuilding the token cache or config layer.
- `type: 320` reused in `chargeToken()` — same GI document-issuance type as `createPaymentForm`; ensures a חשבונית קבלה is issued on every MIT charge.
- Spike script uses `console.log` / `console.error` only — no `@/lib/logger` import — so `tsx` resolves it without Next.js module resolution or path aliases.
- Defensive `documentId` read written as a single-line `||` chain without per-field casts to match the grep acceptance criterion and visually mirror the webhook route pattern.

## Deviations from Plan

None — plan executed exactly as written. One minor implementation adjustment: the `documentId` defensive read was initially written across multiple lines with per-field type casts; restructured to a single-line `|| chain` to satisfy the acceptance criterion grep (`data.documentId || data.id || data.paymentId`) while remaining type-safe via a trailing `as string | null | undefined`.

## Issues Encountered

None. Typecheck passed cleanly on first attempt. Guard-path verification (`pnpm spike:gi` with empty creds) confirmed the "not configured" message and non-zero exit before any network call.

## User Setup Required

**Live sandbox run remains a human gate (SPIKE-01 deferred must_have).**
When real sandbox credentials land:

1. Fill `apps/web/.dev.vars`: `GREENINVOICE_API_KEY_ID`, `GREENINVOICE_API_SECRET`, `GREENINVOICE_PLUGIN_ID`
2. Run `pnpm spike:gi` — acquires token, creates card-setup form URL
3. Open the form URL, complete card entry, capture the webhook payload, note the token id
4. Run `GI_SPIKE_TOKEN_ID=<id> pnpm spike:gi --charge` — issues the MIT charge
5. Fill all seven fields in `apps/web/docs/SPIKE-RESULT.md` Part A

## Next Phase Readiness

- Phase 3 (Payment Rails) gates on SPIKE-01 cleared — the harness must be run live and SPIKE-RESULT.md Part A filled.
- Phase 3 also needs Phase 2 plan 02 (SPIKE-02/SPIKE-03 checklists) completed — that plan runs in parallel and is unaffected by this one.
- `chargeToken()` is the Phase 3 productionizable surface; no further greenInvoice service design is needed.

---
*Phase: 02-spike-gate*
*Completed: 2026-06-30*

## Self-Check: PASSED

- FOUND: apps/web/src/services/greenInvoice/index.ts
- FOUND: apps/web/scripts/gi-spike.ts
- FOUND: apps/web/docs/SPIKE-RESULT.md
- FOUND: .planning/phases/02-spike-gate/02-01-SUMMARY.md
- Commits verified: 12e9be6 (Task 1), 8ded7c9 (Task 2), af54682 (Task 3)
