---
phase: 02-spike-gate
plan: 02
subsystem: docs/external-gates
tags: [green-invoice, legal, compliance, checklist, spike]
dependency_graph:
  requires: []
  provides: [SPIKE-02 accountant/legal checklist, SPIKE-03 GI Prime/creds/clearing checklist]
  affects: [Phase 4 go-live gates]
tech_stack:
  added: []
  patterns: [runbook-style checklist docs, apps/web/docs/ convention]
key_files:
  created:
    - apps/web/docs/GI-LEGAL-CHECKLIST.md
    - apps/web/docs/GI-PRIME-CHECKLIST.md
  modified: []
decisions:
  - "Tourist/foreign-card surcharge (~3.5%) captured as explicit block-or-flag decision gate in GI-PRIME-CHECKLIST.md before go-live"
  - "Both docs flagged PENDING / external human track — they gate Phase 4 only, not Phase 3 build"
  - "Civic-pool refund impact (BAG-04/HARD-02) noted as forward-looking in the זיכוי section without blocking current checklist"
metrics:
  duration: 2m
  completed: 2026-06-30
---

# Phase 2 Plan 02: External-Track Checklists (SPIKE-02 + SPIKE-03) Summary

Two external-gate checklist documents: accountant/legal merchant-of-record sign-off (GI-LEGAL) and GI Prime plan + production credentials + written clearing terms (GI-PRIME) — covering every checkpoint the owner must clear with an accountant/lawyer and the GI account rep before Phase 4 go-live.

## What Was Built

### Task 1 — SPIKE-02: Legal/accountant merchant-of-record checklist

**Commit:** c649cbe
**File:** `apps/web/docs/GI-LEGAL-CHECKLIST.md`

A 19-checkbox accountant/lawyer runbook covering the four sections Phase 2 success criterion #3 requires:

1. **Document type per flow** — which GI document (חשבונית קבלה / חשבונית מס / קבלה) is correct for the ₪6 membership MIT, the ₪50 creation charge, and the ₪2.10 civic-pool split; confirmation that the existing `type: 320` payment-request flow is appropriate for card-on-file charges.
2. **VAT treatment** — inclusion in the ₪6/₪50 figures, display on document, civic-pool VAT impact, reverse-charge check.
3. **Refund / credit-note (זיכוי) mechanics** — חשבונית זיכוי issuance, partial vs full, GI API path, civic-pool reversal on refund, chargeback handling, timeframe obligations. Ties v2 BAG-04/HARD-02 as forward-looking.
4. **Consumer-protection obligations** — cooling-off under חוק הגנת הצרכן, off-session MIT consent disclosure, receipt-delivery obligation, legally safe "first vote then free" wording, self-service card-removal requirement.

Sign-off section with accountant name + date and a final checkbox.

### Task 2 — SPIKE-03: GI Prime/credentials/clearing checklist

**Commit:** 844ded1
**File:** `apps/web/docs/GI-PRIME-CHECKLIST.md`

A 24-checkbox runbook covering the three areas Phase 2 success criterion #4 requires:

1. **GI Prime plan** — written confirmation at ₪0.15/receipt, effective date, volume minimum/monthly fee, confirmation both ₪6 and ₪50 receipts bill at the Prime rate.
2. **Real credentials staged** — complete list of `GREENINVOICE_API_KEY_ID`, `GREENINVOICE_API_SECRET`, `GREENINVOICE_PLUGIN_ID`, `GREENINVOICE_WEBHOOK_SECRET`, `GREENINVOICE_ENV=production` (wrangler.jsonc var), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, staged via `./scripts/sync-secrets.sh` with `wrangler secret list` verification step.
3. **Written clearing terms** — clearing %, hard minimum per transaction, card-brand surcharges, **tourist/foreign-card surcharge with explicit block-or-flag decision gate**, settlement payout threshold, settlement cadence.

Sign-off section with GI rep name + date and three final checkboxes.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

```
apps/web/docs/GI-LEGAL-CHECKLIST.md   FOUND
apps/web/docs/GI-PRIME-CHECKLIST.md   FOUND
commit c649cbe (GI-LEGAL)              FOUND
commit 844ded1 (GI-PRIME)              FOUND
```
