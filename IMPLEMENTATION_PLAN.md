# Taru Implementation Plan

**Target:** Late January 2025 Pilot Launch (Kiryat Tivon)
**First Vote Date:** January 23, 2025
**Last Audit:** January 15, 2025 (Opus 4.5 comprehensive codebase audit v22 - ESLint 9 mobile fix)
**Document Version:** 45.0

---

## Executive Summary

This document tracks the implementation status for the Taru civic consensus platform. Items are organized by priority with the Late January 2025 Kiryat Tivon pilot as the primary deadline.

**Codebase Statistics (verified Jan 15, 2025 - v43):**
- Shared Package: 5 type files, 5 contract files, 2 constant files (55+ Hebrew error messages), 4 utility files (47+ exported types/interfaces, 35+ utility functions, ~170+ total exports)
- API Client: 3 modules (votes.ts 8 methods, users.ts 10 methods, payments.ts 5 methods) - 21 methods total, 21 have working backends (100%), 0 missing backend implementations
- Web API: 31 route files (29 complete, 2 partial) - Added /api/payments/[id]/verify and /api/user/verify-location
- Services: 16 production-ready services (4,328 lines of code) - rate-limit utility added
- Mobile: 28 screens across 6 sections (27 complete, 1 with issues: profile stats)
- Web Pages: 14 pages (10 complete, 4 partial) - dashboard now connected to API
- Database: 11 tables (users, social_proofs, verification_runs, verification_schedule, verification_attempts, payments, entitlements, votes, vote_options, user_votes, push_tokens), 32+ indexes, 7 triggers, 12+ functions, RLS policies on all tables
- Specs: 2 complete (push-notifications 98% implemented, bags-integration 0% - Priority 2)

**Legend:**
- [x] Completed
- [ ] Not started
- [~] Partially complete / In progress
- [!] VERIFIED BLOCKER - Confirmed via code inspection

---

## SPEC STATUS SUMMARY

| Spec | Status | Implementation | Blocker |
|------|--------|----------------|---------|
| `specs/push-notifications.md` | ACCURATE | 98% complete | P0-7: EAS project ID placeholder |
| `specs/bags-integration.md` | ACCURATE | 0% - Priority 2 (post-pilot) | Full implementation needed |

**Missing Specs (code exists but no documentation):**
- `specs/auth-flow.md` - Google/Facebook/Instagram OAuth implemented
- `specs/verification-protocol.md` - 21-day GPS verification implemented
- `specs/voting-system.md` - Vote creation/participation implemented
- `specs/payment-flow.md` - Green Invoice integration implemented
- `specs/api-contracts.md` - 23 endpoints undocumented

---

## BLOCKERS BY PRIORITY

### P0 - CRITICAL (Breaks Core Flows)

These issues cause immediate runtime failures or prevent users from completing the core flow (sign up -> verify -> vote -> pay). **Must fix before any testing.**

| # | Issue | File | Line | Impact | Fix Required | Status |
|---|-------|------|------|--------|--------------|--------|
| P0-7 | **EAS project ID is placeholder** | `apps/mobile/app.json` | 67 | Push token registration fails | Replace `"your-project-id"` with actual EAS ID from expo.dev | [!] VERIFIED |

**P0 Total: 1 blocker** (6 resolved this session)

---

### P1 - HIGH (Required for Pilot)

**All P1 items resolved.** (11 resolved total)

---

### P2 - MEDIUM (Workarounds Exist)

These issues affect user experience but have workarounds or affect secondary flows. **Can be worked around for pilot.**

| # | Issue | File | Line | Impact | Fix Required | Status |
|---|-------|------|------|--------|--------------|--------|
| P2-14 | **In-memory rate limiting not production-ready** | `apps/web/src/app/api/newsletter/subscribe/route.ts` | 5-6 | Rate limits reset on server restart, don't work across instances | Requires Redis/Upstash infrastructure setup (out of scope for code changes) | [~] INFRA |

**P2 Total: 1 item** (11 resolved total)

**Note on P2-14:** Production rate limiting requires Redis/Upstash infrastructure which is out of scope for code changes. Recommended: Use Upstash Redis or Vercel KV for production deployment.

---

### P2-WEB - Web Type Errors (Pre-existing)

**All 7 items resolved.**

---

### P3 - LOW (Post-Pilot Cleanup)

Technical debt items that don't affect pilot functionality. **Address after January 23.**

| # | Issue | File | Line | Impact | Fix Required | Status |
|---|-------|------|------|--------|--------------|--------|
| P3-3 | **Branding inconsistency** | Multiple files | Various | Uses "Sync" and "Taru" inconsistently (see note below) | Standardize branding - needs team decision | [ ] |
| P3-5 | **Unsafe `as any` assertions** | Mobile + Web | 3 remaining | Type safety gap (3 of 9 fixed, 3 kept for React 19/Framer Motion compatibility) | See note below | [~] PARTIAL |

**P3 Total: 2 items** (11 resolved total)

**P3-3 Branding Inconsistency Note:**
- Web app uses "Taro" (Hebrew name shown as "תַּרְאוּ" and "Taru" in tech docs) throughout
- Mobile app uses "סינק" (Sync) branding in `app.json` and share functions
- Documentation (CLAUDE.md) refers to "Sync" (סינק)
- Package namespace uses "@sync/*" throughout
- Email uses taro.co.il domain
- **This needs team decision on which brand name to standardize on**

**P3-5 `as any` Assertions Note:**
- FIXED: `apps/web/src/middleware.ts` - replaced `as any` with proper type guard `isValidLocale()`
- FIXED: `apps/mobile/app/(auth)/connect-social.tsx` - replaced `as any` with properly typed `IdentityScore`
- FIXED: `apps/mobile/app/(tabs)/profile.tsx` - replaced `as any` with `IoniconsName` type
- KEPT (with comment): `apps/web/src/components/animations/AnimatedText.tsx` (3 locations) - React 19 + Framer Motion type incompatibility requires `as any` workaround

---

### P4 - CLEANUP (Technical Debt - Converge to Supabase Migration) COMPLETE

**STATUS: ALL ROUTES MIGRATED & CLEANUP COMPLETE** - The convergeService is no longer used by any active API routes. **convergeService file deleted on Jan 15, 2025 (421 lines removed).**

---

## RESOLVED BLOCKERS

**Total Resolved: 71 items** - See git history for details

**Recent Resolutions:**
- ESLint 9 configuration fixed for mobile app - lint now passes successfully for both web and mobile apps

---

## Summary Statistics

| Priority | Count | Description |
|----------|-------|-------------|
| **P0 Critical** | 1 | Breaks core flows - fix before testing |
| **P1 High** | 0 | Required for pilot - ALL RESOLVED |
| **P2 Medium** | 1 | Has workarounds - 1 requires infrastructure change (11 resolved total) |
| **P2-WEB** | 0 | All 7 web type errors resolved |
| **P3 Low** | 2 | Post-pilot cleanup (11 resolved total) |
| **P4 Cleanup** | 0 | **COMPLETE** - All routes migrated to Supabase, convergeService DELETED |
| **Resolved** | 71 | Already fixed |
| **Total Active** | 4 | P0 + P2 + P3 remaining (P4 complete) |

**Stack Simplification (January 2025):**
- Database: Supabase (PostgreSQL with RLS) - ONLY database
- Auth: Supabase Auth + custom JWT sessions - ONLY auth provider
- Removed: Clerk (auth), Converge (secondary database), Grow (payment management)

---

## Implementation Schedule

### Week 1 (Jan 15-19): P0 Critical Items

**Day 1: Mobile Fix (P0-7)**
1. **Team Action Required**: Get actual EAS project ID from expo.dev and replace placeholder "your-project-id"

### Week 2 (Jan 20-22): P1 High Priority

**All P1 items resolved.**

---

## Completed Components

### Services (14/14 Production-Ready - All Dead Code Removed)
- [x] Google OAuth - `apps/web/src/services/auth/google.ts` (222 lines)
- [x] Facebook OAuth - `apps/web/src/services/auth/facebook.ts` (168 lines)
- [x] Instagram OAuth - `apps/web/src/services/auth/instagram.ts` (189 lines)
- [x] JWT Sessions - `apps/web/src/services/auth/session.ts` (267 lines)
- [x] Green Invoice - `apps/web/src/services/payments/greenInvoice.ts` (295 lines)
- [x] Expo Push - `apps/web/src/services/notifications/expo.ts` (316 lines)
- [x] Qubik Blockchain - `apps/web/src/services/qubik/index.ts` (242 lines)
- [x] GPS Schedule - `apps/web/src/services/verification/schedule.ts` (411 lines)
- [x] Municipality Bounds - `apps/web/src/services/verification/municipality.ts` (436 lines) - 24 municipalities
- [x] Email (Resend) - `apps/web/src/services/email/index.ts` (538 lines) - 6 templates
- [x] Supabase Client - `apps/web/src/lib/supabase/` (5 files) - PRIMARY DATABASE
- [x] Logger Utility - `apps/web/src/lib/logger.ts` (~150 lines) - structured logging for production
- [x] Rate Limit Utility - `apps/web/src/lib/rate-limit.ts` (~50 lines) - in-memory rate limiting for API endpoints
- [x] DELETED: Converge and Grow Analytics (dead code removed)

**Total Service Code: ~3,750 lines (production-ready, no dead code)**

### API Routes (29 Files, 27 Complete)
- [x] Auth: /api/auth/did, callback, session (GET, POST, DELETE), session/refresh
- [x] User: /api/user/profile (GET, POST, PATCH), push-token (GET, POST, DELETE), participations, tokens, tokens/transactions, votes
- [x] Votes: /api/votes (GET, POST), /api/votes/[id] (GET), /api/votes/[id]/participate, /api/votes/[id]/participated, /api/votes/[id]/verify-location
- [x] Payments: /api/payments/create (GET, POST), /api/payments/[id]/status, webhook
- [x] Verification: start, schedule, check-in, status
- [x] Social: proofs (GET, DELETE), callback/facebook, callback/instagram
- [x] Newsletter: subscribe, beehiiv (GET, POST)
- [x] Cron: verification-notifications (FULLY WORKING - sends actual push notifications)

### Mobile Screens (28 Files, 27 Complete)
- [x] Auth: index, sign-in, sign-up, onboarding, connect-social (5 complete)
- [x] Tabs: index, votes, create, history, profile (5 complete - all connected to API)
- [x] Vote: [id].tsx (complete with GPS + share)
- [x] Verification: index, check-in, complete (3 complete)
- [x] Payment: checkout, success, failed (3 complete)
- [x] Settings: profile, notifications, verification, municipality, social-connections (5 complete)
- [x] Layouts: 6 _layout.tsx files (all complete)

### Mobile Push Notifications (98% Complete)
- [x] Dependencies: expo-notifications@0.29.0, expo-device@7.0.0 (installed)
- [x] Plugin: app.json configured with icon, color, channel
- [x] Registration: `apps/mobile/src/lib/notifications.ts` (360 lines, complete)
- [x] API: `/api/user/push-token` (GET, POST, DELETE - 154 lines)
- [x] Cron: `/api/cron/verification-notifications` (128 lines, working)
- [x] Database: push_tokens table with RLS (migration exists)
- [ ] EAS Project ID: Still placeholder "your-project-id" (P0-7)

### Web Pages (14 Files, 10 Complete)
- [x] Landing, About, FAQ, Auth (sign-in, sign-up), Onboarding, Create Vote, Votes, Download, Dashboard
- [~] Vote Detail, Verification, Settings Social, Connect Social (partial)

### Database (11/15 Tables Complete)
- [x] users, social_proofs, verification_runs, verification_schedule, verification_attempts, payments, entitlements, votes, vote_options, user_votes, push_tokens
- [ ] treasury, treasury_transactions, issue_coins, issue_coin_holdings (Priority 2 - Bags.fm)

---

## External Service Status

| Service | Provider | Status | Notes |
|---------|----------|--------|-------|
| Database | Supabase | [x] Complete | 11 tables with RLS, PostgreSQL 15, primary data storage |
| Auth | Supabase Auth | [x] Complete | OAuth (Google), JWT sessions |
| Google OAuth | Google | [x] Complete | PKCE flow, ID token verification |
| Facebook OAuth | Meta | [x] Complete | Long-lived tokens (60 days) |
| Instagram OAuth | Meta | [x] Complete | Long-lived tokens (60 days) |
| Green Invoice | Morning API | [x] Complete | Payment forms, webhooks, receipts |
| Qubik | Blockchain | [x] Complete | Mainnet/testnet, wallet creation, token minting |
| Expo Push | Expo | [x] Complete | Token validation, batch sending (100/batch) |
| Resend | Email | [x] Complete | 6 HTML templates, Hebrew RTL |
| Beehiiv | Newsletter | [x] Complete | Subscriber management |
| Bags.fm | SocialFi | [ ] Not Started | Priority 2 (post-pilot) |

**REMOVED SERVICES (January 2025):**
- ~~Clerk~~ - Replaced by Supabase Auth + custom JWT sessions
- ~~Converge~~ - Replaced by Supabase (all data now in PostgreSQL with RLS)

---

*Last Updated: January 15, 2025*
*Document Version: 45.0*

See git history for detailed change logs.
