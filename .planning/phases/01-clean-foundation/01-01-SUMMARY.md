---
phase: 01-clean-foundation
plan: 01
subsystem: foundation/auth/merch
tags: [auth0, printful-removal, rls, env-cleanup, migration, gitignore]
dependency_graph:
  requires: []
  provides: [LAND-01]
  affects: [env-schema, merch-types, supabase-types, rls-policies]
tech_stack:
  added: []
  patterns: [auth0-oidc-universal-login, no-pod-fulfilment]
key_files:
  created:
    - supabase/migrations/20260628000001_drop_merch_pod_columns.sql
    - apps/web/src/services/auth/auth0.ts
    - supabase/migrations/20260622000001_merch_orders_rls.sql
    - apps/web/docs/INTEGRATIONS.md
    - apps/web/docs/MORNING-CHECKLIST.md
    - apps/web/scripts/sync-secrets.sh
  modified:
    - apps/web/src/lib/env.ts
    - apps/web/.dev.vars.example
    - .env.example
    - .gitignore
    - packages/shared/src/types/merch.ts
    - apps/web/src/lib/supabase/db.ts
    - apps/web/src/lib/supabase/types.ts
    - apps/web/src/app/api/merch/orders/[id]/route.ts
    - apps/web/src/app/[locale]/store/thank-you/components/ThankYouView.tsx
    - apps/web/src/app/api/auth/callback/route.ts
    - apps/web/src/providers/AuthProvider.tsx
    - supabase/migrations/20240101000001_rls_policies.sql
    - supabase/migrations/20250115000001_push_tokens_and_wallet.sql
    - supabase/config.toml
decisions:
  - "AUTH0_DOMAIN server var removed from env schema — nothing reads process.env.AUTH0_DOMAIN; NEXT_PUBLIC_AUTH0_DOMAIN retained"
  - "POD columns (pod_order_id, tracking_number, tracking_url, carrier) dropped via idempotent migration — Printful definitively abandoned"
  - "supabase/.temp/ and .mcp.json added to .gitignore — machine-specific, never committed"
  - "settings.local.json staged — contains no secrets (permission config only)"
  - "ThankYouView.tsx auto-fixed — dead carrier/trackingNumber/trackingUrl UI removed (Rule 1 deviation)"
metrics:
  duration_minutes: 8
  completed_date: "2026-06-29"
  tasks_completed: 3
  files_changed: 32
---

# Phase 1 Plan 1: Land Auth0 OIDC Swap + Printful Removal + RLS Fix Summary

**One-liner:** Auth0 Universal Login swap, Printful POD removal with orphaned-column migration, and RLS `public.user_id()` fix landed as one clean semantic commit — closes LAND-01.

## Commit

**SHA:** 44961e0
**Message:** `feat(foundation): land Auth0 OIDC swap, remove Printful POD, fix RLS user_id helper`

**Staged file set (32 files):**

Modified: `.claude/settings.local.json`, `.env.example`, `.gitignore`, `apps/web/.dev.vars.example`, `apps/web/src/__tests__/api/auth-callback.test.ts`, `apps/web/src/__tests__/integration/auth.test.ts`, `apps/web/src/app/[locale]/layout.tsx`, `apps/web/src/app/api/auth/callback/route.ts`, `apps/web/src/app/api/merch/orders/[id]/route.ts`, `apps/web/src/app/api/merch/webhook/route.ts`, `apps/web/src/components/AnalyticsEvents.tsx`, `apps/web/src/components/press/sections/Lead.tsx`, `apps/web/src/lib/env.ts`, `apps/web/src/lib/merch/catalog.ts`, `apps/web/src/lib/supabase/db.ts`, `apps/web/src/lib/supabase/types.ts`, `apps/web/src/providers/AuthProvider.tsx`, `packages/shared/src/types/merch.ts`, `supabase/config.toml`, `supabase/migrations/20240101000001_rls_policies.sql`, `supabase/migrations/20250115000001_push_tokens_and_wallet.sql`

Deleted: `apps/web/src/__tests__/api/merch-fulfillment-webhook.test.ts`, `apps/web/src/__tests__/services/printful.test.ts`, `apps/web/src/app/api/merch/fulfillment-webhook/route.ts`, `apps/web/src/services/fulfillment/printful.ts`

Added: `apps/web/src/services/auth/auth0.ts`, `supabase/migrations/20260622000001_merch_orders_rls.sql`, `supabase/migrations/20260628000001_drop_merch_pod_columns.sql`, `apps/web/docs/INTEGRATIONS.md`, `apps/web/docs/MORNING-CHECKLIST.md`, `apps/web/scripts/sync-secrets.sh`

## Verification

- `pnpm --filter @sync/web typecheck` — exit 0 (no errors)
- `pnpm --filter @sync/web test` — 42 test files, 504 tests, all pass
- No `growth/` or `.planning/` paths in commit
- No `Co-Authored-By: Claude/Anthropic` trailer
- `.mcp.json` and `supabase/.temp/` absent from commit (gitignored)

## Decisions Made

**AUTH0_DOMAIN env var removed:** `process.env.AUTH0_DOMAIN` had no readers in the codebase. `NEXT_PUBLIC_AUTH0_DOMAIN` (read by `auth0.ts` and `AuthProvider.tsx`) and `AUTH0_CLIENT_SECRET` (read by the callback route) are both retained. The bare server var was pure dead weight.

**POD columns dropped:** `pod_order_id`, `tracking_number`, `tracking_url`, `carrier` are permanently NULL after Printful removal. Migration `20260628000001_drop_merch_pod_columns.sql` uses `DROP COLUMN IF EXISTS` for idempotency. Revert path: re-add as `TEXT NULL`.

**settings.local.json staged:** Contains only permission config (no API keys or credentials). Safe.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dead POD fields in ThankYouView.tsx**
- **Found during:** Task 2 verification
- **Issue:** `grep -RnE "podOrderId|trackingNumber|trackingUrl"` hit `apps/web/src/app/[locale]/store/thank-you/components/ThankYouView.tsx` at lines 69–74 and 133–144. The component rendered `order.carrier`, `order.trackingNumber` (receipt rows) and a "track shipment" button using `order.trackingUrl` — all now removed from the `MerchOrder` type.
- **Fix:** Removed the three receipt rows (`carrier`, `trackingNumber`) and the conditional tracking URL `NewsButton` block. The thank-you page now shows only the core order summary (status, item count, shipping cost, total).
- **Files modified:** `apps/web/src/app/[locale]/store/thank-you/components/ThankYouView.tsx`
- **Commit:** included in 44961e0 (same bundle commit)

## Self-Check: PASSED
