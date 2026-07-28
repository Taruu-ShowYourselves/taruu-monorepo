---
phase: 01-clean-foundation
verified: 2026-06-29T09:42:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 1: Clean Foundation Verification Report

**Phase Goal:** The codebase is a coherent, deployable base — uncommitted Auth0/Printful/RLS change landed, the latent HIGH RLS bug corrected on treasury and phone tables, no dead artifacts remaining.
**Verified:** 2026-06-29
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Auth0 + Printful-removal + RLS-fix working tree lands as ONE clean commit | VERIFIED | Commit `44961e0` — 32 files, authored SaharBarak, no Claude/Anthropic co-author |
| 2 | pnpm typecheck and pnpm test both pass | VERIFIED | typecheck exit 0; 42 test files, 504 tests pass |
| 3 | No PRINTFUL_* entries in .dev.vars.example or .env.example | VERIFIED | grep exits 1 (no matches) |
| 4 | Dead getMerchOrderByPodOrderId removed; orphaned merch_orders columns dropped via migration | VERIFIED | grep for podOrderId/trackingNumber/getMerchOrderByPodOrderId returns nothing; migration 20260628000001 has 4 DROP COLUMN IF EXISTS |
| 5 | supabase/.temp/ and .mcp.json gitignored; growth/ and .planning/ absent from code commits | VERIFIED | Both gitignored; 44961e0 and 31d6860 have zero growth/ or .planning/ paths |
| 6 | Redundant server-only AUTH0_DOMAIN removed from env schema | VERIFIED | env.ts has NEXT_PUBLIC_AUTH0_DOMAIN and AUTH0_CLIENT_SECRET; no bare server AUTH0_DOMAIN line |
| 7 | New corrective migration replaces auth.uid() with public.user_id() on treasury_transactions, issue_coin_holdings, phone_verifications | VERIFIED | 20260628000002 has 3x public.user_id(), 3x DROP POLICY IF EXISTS, 0x auth.uid() |
| 8 | Applied migrations NOT edited — fix is additive (DROP + recreate in new file) | VERIFIED | git diff --quiet on 20250116000001 and 20250119000001 exits 0 |
| 9 | USING(true) public-read policies on treasury and issue_coins documented as deliberate, not silently changed | VERIFIED | Migration header has explicit NOTE block; no alteration to those policies |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260628000001_drop_merch_pod_columns.sql` | Drops pod_order_id, tracking_number, tracking_url, carrier from merch_orders | VERIFIED | 4 DROP COLUMN IF EXISTS with IF EXISTS guard; comment references CONCERNS §1/§8 |
| `apps/web/src/lib/env.ts` | Env schema without redundant AUTH0_DOMAIN server var | VERIFIED | NEXT_PUBLIC_AUTH0_DOMAIN and AUTH0_CLIENT_SECRET present; bare server var absent |
| `supabase/migrations/20260628000002_fix_rls_user_id_helper.sql` | Corrective RLS migration for 3 latent auth.uid() policies | VERIFIED | Exists; 3x public.user_id(), 3x DROP POLICY IF EXISTS, 0x auth.uid() |
| Deleted: `apps/web/src/app/api/merch/fulfillment-webhook/route.ts` | File removed (dead Printful webhook) | VERIFIED | File absent from filesystem |
| Deleted: `apps/web/src/services/fulfillment/printful.ts` | File removed (dead Printful service) | VERIFIED | File absent from filesystem |
| `supabase/migrations/20260622000001_merch_orders_rls.sql` | merch_orders RLS enabled (anon-key denied) | VERIFIED | ALTER TABLE public.merch_orders ENABLE ROW LEVEL SECURITY; no public-read policies |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/web/src/app/api/merch/orders/[id]/route.ts` | MerchOrder type | no longer reads pod_order_id / tracking_* columns | VERIFIED | grep for podOrderId/trackingNumber/trackingUrl/carrier returns nothing in apps/web/src and packages/shared/src |
| treasury_transactions / issue_coin_holdings / phone_verifications per-user SELECT policies | public.user_id() helper | DROP POLICY + CREATE POLICY USING (user_id = public.user_id()) | VERIFIED | Pattern appears 3 times in 20260628000002; 0 auth.uid() occurrences |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LAND-01 | 01-01-PLAN.md | Land uncommitted Auth0/Printful/RLS change as one clean commit including two flagged cleanups | SATISFIED | Commit 44961e0 — 32 files, green typecheck, 504 tests pass, no dead artifacts |
| SEC-01 | 01-02-PLAN.md | Corrective migration replaces auth.uid() with public.user_id() on treasury_transactions, issue_coin_holdings, phone_verifications | SATISFIED | Commit 31d6860 — migration 20260628000002_fix_rls_user_id_helper.sql with 3 corrected policies |

No orphaned requirements — REQUIREMENTS.md Traceability table maps only LAND-01 and SEC-01 to Phase 1; both are accounted for.

### ROADMAP Success Criteria Coverage

| Criterion | Status | Evidence |
|-----------|--------|----------|
| 1. Working-tree change lands as single clean commit with green CI | PASSED | 44961e0; typecheck exit 0; 42 test files, 504 tests pass |
| 2. Corrective migration replaces auth.uid() with public.user_id() on 3 tables | PASSED | 20260628000002 committed as 31d6860 |
| 3. merch_orders RLS migration in effect: anon-key reads denied | PASSED | 20260622000001_merch_orders_rls.sql — ENABLE ROW LEVEL SECURITY, no anon policy |
| 4. No dead code artifacts remain: Printful files gone, no PRINTFUL_* in .dev.vars.example, orphaned columns dropped | PASSED | All checked — 0 matches on all grep patterns |

### Anti-Patterns Found

None detected. No TODO/FIXME/placeholder comments, empty implementations, or dead code remaining in the committed changeset.

### Human Verification Required

None. All success criteria are structurally verifiable without running the app.

## Summary

Phase 1 goal is fully achieved. Both code commits (`44961e0` LAND-01, `31d6860` SEC-01) are clean, green, and contain exactly the expected changeset. The codebase has no remaining Printful/POD artifacts, no dead env vars, and the three latent HIGH-severity RLS policies now resolve against the correct `public.user_id()` helper instead of the null-returning `auth.uid()`. The working tree is a coherent, deployable base ready for Phase 2.

---

_Verified: 2026-06-29_
_Verifier: Claude (gsd-verifier)_
