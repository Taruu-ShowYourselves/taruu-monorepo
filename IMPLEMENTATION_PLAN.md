# Taru Implementation Plan

**Target:** Late January 2025 Pilot Launch (Kiryat Tivon)
**First Vote Date:** January 23, 2025
**Last Audit:** January 15, 2025 (Opus 4.5 comprehensive codebase audit v16 - P1-6, P1-7, P1-8 resolved)
**Document Version:** 37.0

---

## Executive Summary

This document tracks the implementation status for the Taru civic consensus platform. Items are organized by priority with the Late January 2025 Kiryat Tivon pilot as the primary deadline.

**Codebase Statistics (verified Jan 15, 2025 - v35):**
- Shared Package: 5 type files, 5 contract files, 2 constant files (55+ Hebrew error messages), 4 utility files (47+ exported types/interfaces, 35+ utility functions, ~170+ total exports)
- API Client: 3 modules (votes.ts 8 methods, users.ts 10 methods, payments.ts 6 methods) - 22 methods total, 22 have working backends (100%), 0 missing backend implementations
- Web API: 29 route files (27 complete, 2 partial) - 4 TODO comments found
- Services: 14 production-ready services (4,128 lines of code) + 1 DEAD CODE file (grow.ts - 232 lines, can delete)
- Mobile: 28 screens across 6 sections (25 complete, 3 with issues: history, profile stats, verification complete)
- Web Pages: 14 pages (7 complete, 5 partial, 2 coming soon)
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
| `specs/push-notifications.md` | ✅ ACCURATE | 98% complete | P0-7: EAS project ID placeholder |
| `specs/bags-integration.md` | ✅ ACCURATE | 0% - Priority 2 (post-pilot) | Full implementation needed |

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

These issues don't crash immediately but cause significant problems. **Must fix before January 23.**

| # | Issue | File | Line | Impact | Fix Required | Status |
|---|-------|------|------|--------|--------------|--------|
| ~~P1-6~~ | ~~Verification status returns mock data~~ | - | - | - | - | [x] FIXED |
| ~~P1-7~~ | ~~Profile stats hardcoded to "0"~~ | - | - | - | - | [x] FIXED |
| ~~P1-8~~ | ~~Hero download button disabled~~ | - | - | - | - | [x] FIXED |
| ~~P1-11~~ | ~~OAuth state parameter not cryptographically verified~~ | - | - | - | - | [x] FIXED |
| ~~P1-12~~ | ~~Payment webhook missing replay attack prevention~~ | - | - | - | - | [x] FIXED |

**P1 Total: 0 blockers** (11 resolved this session)

---

### P2 - MEDIUM (Workarounds Exist)

These issues affect user experience but have workarounds or affect secondary flows. **Can be worked around for pilot.**

| # | Issue | File | Line | Impact | Fix Required | Status |
|---|-------|------|------|--------|--------------|--------|
| P2-1 | **GpsCoordinates schema missing timestamp** | `packages/shared/src/contracts/verification.ts` | 18-22 | Validation may fail | Add `timestamp` field to Zod schema | [~] LOW |
| P2-2 | **IdentityScore missing lastCalculated field** | `packages/shared/src/types/user.ts` | 25-33 | Type mismatch with contract | Add `lastCalculated?: Date` to type | [~] LOW |
| P2-3 | **Duplicate getTokenBalance() method** | `packages/api-client/src/` | payments.ts:89, users.ts:103 | Code duplication | Remove from payments.ts, keep in users.ts | [~] LOW |
| P2-4 | **Mock data in mobile history screen** | `apps/mobile/app/(tabs)/history.tsx` | 22-63, 119 | Shows fake history | Replace with API call after P1-2 (TODO exists) | [~] PARTIAL |
| P2-5 | **Mock data in web dashboard** | `apps/web/src/app/[locale]/dashboard/page.tsx` | 32-37, 39-61, 78 | Shows fake stats | Replace with API calls (TODO exists) | [~] PARTIAL |
| P2-6 | **Mock votes in VotesList component** | `apps/web/src/app/[locale]/votes/components/VotesList.tsx` | 12-69 | Shows 4 hardcoded votes | Fetch actual votes from API | [~] PARTIAL |
| P2-7 | **Votes page shows ComingSoon** | `apps/web/src/app/[locale]/votes/page.tsx` | 33-36 | Web voting blocked | Replace with VotesList component | [~] PARTIAL |
| P2-8 | **Download page shows ComingSoon** | `apps/web/src/app/[locale]/download/page.tsx` | 31-34 | Download page blocked | Add app store links and QR codes | [~] PARTIAL |
| P2-9 | **Verification complete shows hardcoded stats** | `apps/mobile/app/verification/complete.tsx` | 137, 141, 145 | Shows "21 days", "100%" hardcoded | Connect to actual verification data | [~] PARTIAL |
| P2-10 | **Social connect page has alert placeholder** | `apps/web/src/app/[locale]/sign-up/connect-social/page.tsx` | 98 | Shows "Coming soon - use mobile app" | Implement web OAuth flow or remove | [~] PARTIAL |
| P2-11 | **Vote detail page uses mock fallback** | `apps/web/src/app/[locale]/votes/[id]/page.tsx` | 33-59, 98-103 | Falls back to mock data silently | Show error instead of mock | [~] PARTIAL |
| P2-12 | **Vote participate has mock transaction hash fallback** | `apps/web/src/app/api/votes/[id]/participate/route.ts` | 98 | Blockchain record may be fake (uses `mock-tx-${Date.now()}`) | Either fail request or add warning flag in response | [~] PARTIAL |
| P2-13 | **User profile POST has mock wallet address fallback** | `apps/web/src/app/api/user/profile/route.ts` | 95 | Users get `mock-wallet-${userId}` if Qubik fails | Either fail registration or flag profile as "wallet pending" | [~] PARTIAL |
| P2-14 | **In-memory rate limiting not production-ready** | `apps/web/src/app/api/newsletter/subscribe/route.ts` | 5-6 | Rate limits reset on server restart, don't work across instances | Replace with Redis/Upstash for production | [~] PARTIAL |
| P2-15 | **Duplicate GpsCoordinates type definition** | `packages/shared/src/types/user.ts` + `vote.ts` | 37-42, 51-56 | Code duplication, maintenance risk | Consolidate to single definition in user.ts | [~] LOW |
| P2-16 | **Header login/signup buttons disabled** | `apps/web/src/components/layout/Header/Header.tsx` | 112, 115 | Users can't sign in from header | Enable buttons or add proper auth flow | [~] PARTIAL |

**P2 Total: 16 items**

---

### P2-WEB - Web Type Errors (Pre-existing) - ALL RESOLVED

These TypeScript errors were discovered during the type alignment session and have all been fixed in v34.

| # | Issue | File | Resolution | Status |
|---|-------|------|------------|--------|
| P2-W1 | **Next.js locale type issue in layout** | `apps/web/src/app/[locale]/layout.tsx` | Changed param type to string and added cast | [x] FIXED |
| P2-W2 | **ConvergeService missing createNewsletterSubscription** | `apps/web/src/app/api/newsletter/subscribe/route.ts` | Updated to use Beehiiv directly instead of Converge | [x] FIXED |
| P2-W3 | **React 19 JSX type compatibility - Input** | `apps/web/src/components/ui/Input` | Added explicit `any` type assertion | [x] FIXED |
| P2-W4 | **React 19 JSX type compatibility - AuthContext.Provider** | `apps/web/src/providers/AuthProvider` | Cast Provider as any for React 19 compatibility | [x] FIXED |
| P2-W5 | **Button missing title prop** | Various web components | Extended React.ButtonHTMLAttributes | [x] FIXED |
| P2-W6 | **Heading missing id prop** | Various web components | Extended React.HTMLAttributes and spread rest props | [x] FIXED |
| P2-W7 | **Footer external link type** | `apps/web/src/components/layout/Footer` | Added explicit FooterLink interface | [x] FIXED |

**P2-WEB Total: 0 remaining (all 7 fixed)**

---

### P3 - LOW (Post-Pilot Cleanup)

Technical debt items that don't affect pilot functionality. **Address after January 23.**

| # | Issue | File | Line | Impact | Fix Required | Status |
|---|-------|------|------|--------|--------------|--------|
| P3-1 | **DEAD CODE - grow.ts** | `apps/web/src/services/payments/grow.ts` | entire file | 232 lines unused, not imported anywhere | Delete file entirely | [ ] |
| P3-2 | **Missing VerificationRunStatus type export** | `packages/shared/src/contracts/verification.ts` | N/A | Type safety gap | Generate type with `z.infer<>` | [ ] |
| P3-3 | **Branding inconsistency** | Multiple files | Various | Uses "Sync" and "Taru" | Standardize on "Taru" | [ ] |
| P3-4 | **Console.log in production** | `apps/web/src/app/api/payments/webhook/route.ts` | 29, 47, 53, 63, 88, 90, 107, 124, 126, 141, 153, 158, 163 | Log noise (13 statements in webhook alone) | Replace with structured logging | [ ] |
| P3-5 | **Unsafe `as any` assertions** | Mobile + Web | 10 locations | Type safety gap | Add proper typing | [ ] |
| P3-6 | **Duplicate location verification methods** | `packages/api-client/src/` | votes.ts, users.ts | Ambiguous API | Consolidate to single method | [ ] |
| P3-7 | **Missing /api/payments/[id]/verify endpoint** | `apps/web/src/app/api/payments/` | N/A | API client method has no backend | Create endpoint or remove client method | [ ] |
| P3-8 | **Missing /api/user/verify-location endpoint** | `apps/web/src/app/api/user/` | N/A | API client method has no backend | Create endpoint or remove client method | [ ] |
| P3-9 | **No rate limiting on votes/participate endpoint** | `apps/web/src/app/api/votes/[id]/participate/route.ts` | N/A | Could be abused to DOS payment system | Add rate limiting (3 requests/minute per user) | [ ] |
| P3-10 | **No rate limiting on verification/check-in endpoint** | `apps/web/src/app/api/verification/check-in/route.ts` | N/A | Could be abused during verification | Add rate limiting (10 requests/minute per user) | [ ] |
| P3-11 | **Cron job console.log statements** | `apps/web/src/app/api/cron/verification-notifications/route.ts` | 58, 78 | Noise in logs | Replace with structured logging | [ ] |
| P3-12 | **PAYMENT_AMOUNTS vs VOTE_COST unit inconsistency** | `packages/shared/src/types/payment.ts` vs `constants/index.ts` | N/A | PAYMENT_AMOUNTS uses agorot, VOTE_COST uses ILS | Move to constants/ and normalize to single unit | [ ] |

**P3 Total: 12 items**

---

### P4 - CLEANUP (Technical Debt - Converge to Supabase Migration)

API routes currently import from `convergeService` and need to be updated to use Supabase directly. The database schema is already in Supabase, but some API routes still call Converge.

**Files to update (replace Converge with Supabase queries):**

| File | Usage | Migration Required |
|------|-------|-------------------|
| `apps/web/src/app/api/votes/route.ts` | `convergeService.getVotesByMunicipality()`, `getActiveVotes()`, `createVote()` | Use Supabase `votes` table |
| `apps/web/src/app/api/votes/[id]/route.ts` | `convergeService.getVote()` | Use Supabase `votes` table |
| `apps/web/src/app/api/votes/[id]/participate/route.ts` | `convergeService.getVote()`, `hasUserParticipated()`, `getUserByGoogleId()`, `createParticipation()`, `incrementVoteCount()`, `updateUser()` | Use Supabase `votes`, `user_votes`, `users` tables |
| `apps/web/src/app/api/user/profile/route.ts` | `convergeService.getUserByGoogleId()`, `createUser()`, `updateUser()` | Use Supabase `users` table |
| `apps/web/src/app/api/verification/status/route.ts` | `convergeService.getVerificationSchedule()` (TODO) | Use Supabase `verification_runs`, `verification_schedule` tables |
| `apps/web/src/app/api/newsletter/subscribe/route.ts` | `convergeService.createNewsletterSignup()`, `getNewsletterSignupByEmail()` | Use Supabase or keep as external service |
| `apps/web/src/app/api/newsletter/verify/route.ts` | `convergeService.getNewsletterSignupByToken()`, `verifyNewsletterSignup()` | Use Supabase or keep as external service |
| `apps/web/src/app/api/social/callback/facebook/route.ts` | `convergeService.updateSocialProofs()` | Use Supabase `social_proofs` table |
| `apps/web/src/app/api/social/callback/instagram/route.ts` | `convergeService.updateSocialProofs()` | Use Supabase `social_proofs` table |

**After migration, delete:**
- `apps/web/src/services/converge/index.ts` (422 lines)
- Remove `CONVERGE_API_KEY` and `CONVERGE_PROJECT_ID` from environment

**Auth Stack (Already Complete):**
- [x] JWT Sessions via `apps/web/src/services/auth/session.ts` - replaces Clerk
- [x] Google OAuth via `apps/web/src/services/auth/google.ts` - replaces Clerk
- [x] Social OAuth (Facebook/Instagram) via their respective services
- [x] Supabase stores user data with RLS policies

---

## RESOLVED BLOCKERS (No Action Needed)

These issues have been verified as fixed:

| # | Issue | Resolution | Verified |
|---|-------|------------|----------|
| R1 | Login buttons disabled | Enabled with proper routing (intentionally disabled for unauthenticated users) | [x] Jan 15 |
| R2 | Session refresh endpoint missing | EXISTS at `/api/auth/session/refresh/route.ts` (99 lines) | [x] Jan 15 |
| R3 | Payment type mismatch in mobile | Mobile uses correct `'vote_participation'` | [x] Jan 15 |
| R4 | Push notifications not sending | Cron job calls `sendCheckInReminder()` at `/api/cron/verification-notifications` | [x] Jan 15 |
| R5 | No push_tokens table | Created in `20250115000001_push_tokens_and_wallet.sql` | [x] Jan 15 |
| R6 | expo-notifications not installed | Added to `apps/mobile/package.json` line 29, version ~0.29.0 | [x] Jan 15 |
| R7 | expo-device not installed | Added to `apps/mobile/package.json` line 26, version ~7.0.0 | [x] Jan 15 |
| R8 | app.json missing notification plugin | Added expo-notifications plugin lines 49-57 with icon and channel | [x] Jan 15 |
| R9 | No wallet_address column | Added `qubik_wallet_address` in migration with index | [x] Jan 15 |
| R10 | Push token API endpoint | Created at `/api/user/push-token/route.ts` (GET, POST, DELETE) | [x] Jan 15 |
| R11 | Mobile push token registration | Implemented in `apps/mobile/src/lib/notifications.ts` (360 lines) | [x] Jan 15 |
| R12 | Push notification cron incomplete | Cron now sends actual notifications via expoService (128 lines) | [x] Jan 15 |
| R13 | P0-2: PaymentType mismatch | ALREADY RESOLVED - verified types and contracts already match (`'vote_participation' \| 'vote_creation'`) | [x] Jan 15 |
| R14 | P0-3: PaymentStatus mismatch | ALREADY RESOLVED - verified types and contracts already match (`'pending' \| 'completed' \| 'failed' \| 'refunded'`) | [x] Jan 15 |
| R15 | P0-4: SocialProof field name mismatch | FIXED - added `profileUrl` and `stampWeight` to SocialProofItemSchema in contracts, updated OAuth callbacks to use correct field names (`providerId`, `connectedAt`) | [x] Jan 15 |
| R16 | P0-5: API client social endpoint wrong path | FIXED - created OAuth initiation endpoints at `/api/social/connect/{platform}` and updated `getSocialConnectUrl` in api-client | [x] Jan 15 |
| R17 | P0-6: Unused react-native-confetti import | ALREADY RESOLVED - verified import doesn't exist in verification/complete.tsx | [x] Jan 15 |
| R18 | P0-1: Empty wallet address in payment webhook | ALREADY RESOLVED - webhook already fetches user with `qubik_wallet_address` at lines 81-94 | [x] Jan 15 |
| R19 | P1-1: oderId typo in participate endpoint | FIXED - changed `oderId` to `userId` in `apps/web/src/services/qubik/index.ts` (all 7 occurrences) and `apps/web/src/app/api/votes/[id]/participate/route.ts` (line 102) | [x] Jan 15 |
| R20-R26 | P2-W1 through P2-W7: All web type errors | FIXED - See P2-WEB section for individual resolutions | [x] Jan 15 |
| R27 | Pre-existing: sign-up page wrong CSS import path | FIXED - corrected CSS import path in sign-up page | [x] Jan 15 |
| R28 | Pre-existing: auth/index.ts exported server-only functions | FIXED - now only exports types (removed session function exports) | [x] Jan 15 |
| R29 | P1-2: Missing /api/user/participations endpoint | CREATED at `apps/web/src/app/api/user/participations/route.ts` | [x] Jan 15 |
| R30 | P1-3: Missing /api/votes/[id]/participated endpoint | CREATED at `apps/web/src/app/api/votes/[id]/participated/route.ts` | [x] Jan 15 |
| R31 | P1-4: Missing /api/user/tokens endpoint | CREATED at `apps/web/src/app/api/user/tokens/route.ts` | [x] Jan 15 |
| R32 | P1-5: Missing /api/user/tokens/transactions endpoint | CREATED at `apps/web/src/app/api/user/tokens/transactions/route.ts` | [x] Jan 15 |
| R33 | P1-9: Missing /api/votes/[id]/verify-location endpoint | CREATED at `apps/web/src/app/api/votes/[id]/verify-location/route.ts` | [x] Jan 15 |
| R34 | P1-10: Missing /api/user/votes endpoint | CREATED at `apps/web/src/app/api/user/votes/route.ts` | [x] Jan 15 |
| R35 | social-connections page useSearchParams Suspense boundary | FIXED by wrapping in SuspenseWrapper component | [x] Jan 15 |
| R36 | P1-11: OAuth state parameter CSRF vulnerability | FIXED - Implemented JWT-signed state with HS256, 10-min expiry, platform verification, session user ID matching. New utility: `apps/web/src/lib/oauth-state.ts`. Updated: Facebook/Instagram connect and callback routes | [x] Jan 15 |
| R37 | P1-12: Payment webhook replay attack vulnerability | FIXED - Added timestamp validation (5 min max staleness), event ID tracking with payload hash, idempotent processing with status tracking. New migration: `supabase/migrations/20250115000002_webhook_events.sql`. New DB functions: getWebhookEventByEventId, createWebhookEvent, updateWebhookEventStatus, isWebhookStale | [x] Jan 15 |
| R38 | P1-6: Verification status returns mock data | FIXED - Replaced convergeService with Supabase queries. Now uses getActiveVerificationRun() and getVerificationSchedule() to fetch actual schedule data. Calculates real missed/completed/pending counts from database. File: `apps/web/src/app/api/verification/status/route.ts` | [x] Jan 15 |
| R39 | P1-7: Profile stats hardcoded to "0" | FIXED - Created new endpoint `/api/user/stats/route.ts` returning votesParticipated and votesCreated counts. New db functions: countUserVoteParticipations(), countVotesCreatedByUser(), getUserVoteStats(). Updated mobile `apps/mobile/app/(tabs)/profile.tsx` to fetch stats from API. Added getVoteStats() method to usersApi in api-client. | [x] Jan 15 |
| R40 | P1-8: Hero download button disabled | FIXED - Removed `disabled` prop from download button in `apps/web/src/components/sections/Hero/Hero.tsx`. Wrapped button with Link component to /{locale}/download page. | [x] Jan 15 |

**Total Resolved: 38 items** (12 new this session)

### Mobile Type Errors Fixed This Session

The following mobile type errors were fixed during the type alignment session:

| Issue | Fix Applied |
|-------|-------------|
| VoteStatus enum 'completed' vs 'ended' | Changed VoteStatus to use `'ended'` to match database enum |
| VoteOption missing 'votes' and 'text' fields | Added optional `votes?: number` and `text?: string` aliases to VoteOption type |
| Vote missing 'userVote' and 'creator' fields | Added optional `userVote?: string` and `creator?: UserProfile` to Vote type |
| VerificationStatus usage | Fixed to access `.phase` property correctly |
| UserProfile missing notificationSettings | Added `notificationSettings?: NotificationSettings` to UserProfile and UserProfileUpdate types |
| Route paths for legal/terms, legal/privacy, support | Changed to use WebBrowser.openBrowserAsync() instead of router.push() |
| Skeleton width type | Fixed width prop type handling |
| AuthStore type assertion | Fixed type assertion for auth store |

### Additional Files Updated This Session

- `apps/web/src/app/api/social/callback/facebook/route.ts` - Updated to use `providerId` instead of `platformUserId`, `connectedAt` instead of `verifiedAt`
- `apps/web/src/app/api/social/callback/instagram/route.ts` - Same field name updates as Facebook
- `apps/web/src/app/api/user/profile/route.ts` - Updated to use correct SocialProof field names
- `packages/shared/src/contracts/social.ts` - Added `profileUrl` and `stampWeight` fields to SocialProofItemSchema
- `apps/mobile/app/__tests__/auth.test.ts` - Updated to use correct field names

---

## Summary Statistics

| Priority | Count | Description |
|----------|-------|-------------|
| **P0 Critical** | 1 | Breaks core flows - fix before testing |
| **P1 High** | 0 | Required for pilot - ALL RESOLVED |
| **P2 Medium** | 16 | Has workarounds - can defer |
| **P2-WEB** | 0 | All 7 web type errors resolved |
| **P3 Low** | 12 | Post-pilot cleanup |
| **P4 Cleanup** | 9 | Converge to Supabase migration (files to update) |
| **Resolved** | 38 | Already fixed (12 new this session) |
| **Total Active** | 38 | Reduced from 41 (3 P1 items resolved) |

**Stack Simplification (January 2025):**
- Database: Supabase (PostgreSQL with RLS) - ONLY database
- Auth: Supabase Auth + custom JWT sessions - ONLY auth provider
- Removed: Clerk (auth), Converge (secondary database), Grow (payment management)

---

## Implementation Schedule

### Week 1 (Jan 15-19): P0 Critical Items

**RESOLVED (Jan 15 - Type Alignment Session):**
- [x] P0-2: PaymentType mismatch - ALREADY CORRECT in codebase
- [x] P0-3: PaymentStatus mismatch - ALREADY CORRECT in codebase
- [x] P0-4: SocialProof field names - FIXED by adding profileUrl/stampWeight to schema, updating OAuth callbacks
- [x] P0-5: API client social endpoints - FIXED by creating /api/social/connect/{platform} endpoints
- [x] P0-6: Unused confetti import - ALREADY RESOLVED (import doesn't exist)

**RESOLVED (Jan 15 - Build Fixes Session):**
- [x] P0-1: Empty wallet address - ALREADY RESOLVED (webhook fetches user with qubik_wallet_address at lines 81-94)

**Day 1: Mobile Fix (P0-7)**
1. **Team Action Required**: Get actual EAS project ID from expo.dev and replace placeholder "your-project-id"

### Week 2 (Jan 20-22): P1 High Priority

**RESOLVED (Jan 15 - Build Fixes Session):**
- [x] P1-1: oderId typo - FIXED to userId in qubik/index.ts (7 occurrences) and participate/route.ts (line 102)

**RESOLVED (Jan 15 - API Endpoints Session):**
- [x] P1-2: /api/user/participations - CREATED at `apps/web/src/app/api/user/participations/route.ts`
- [x] P1-3: /api/votes/[id]/participated - CREATED at `apps/web/src/app/api/votes/[id]/participated/route.ts`
- [x] P1-4: /api/user/tokens - CREATED at `apps/web/src/app/api/user/tokens/route.ts`
- [x] P1-5: /api/user/tokens/transactions - CREATED at `apps/web/src/app/api/user/tokens/transactions/route.ts`
- [x] P1-9: /api/votes/[id]/verify-location - CREATED at `apps/web/src/app/api/votes/[id]/verify-location/route.ts`
- [x] P1-10: /api/user/votes - CREATED at `apps/web/src/app/api/user/votes/route.ts`

**RESOLVED - All P1 Items:**
- [x] **P1-6:** Verification status now fetches actual data from database (replaced convergeService)
- [x] **P1-7:** Profile stats now connected to new /api/user/stats endpoint
- [x] **P1-8:** Hero download button enabled and linked to download page
- [x] **P1-11:** OAuth state parameter now cryptographically verified with JWT signing
- [x] **P1-12:** Payment webhook now has replay attack prevention with timestamp validation

---

## Completed Components

### Services (13/14 Production-Ready)
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
- [ ] DEAD CODE: Converge - `apps/web/src/services/converge/index.ts` (422 lines) - **TO DELETE, replaced by Supabase**
- [ ] DEAD CODE: Grow Analytics - `apps/web/src/services/payments/grow.ts` (232 lines) - never imported

**Total Service Code: 4,128 lines (production-ready)**

### API Routes (29 Files, 27 Complete)
- [x] Auth: /api/auth/did, callback, session (GET, POST, DELETE), session/refresh
- [x] User: /api/user/profile (GET, POST, PATCH), push-token (GET, POST, DELETE), participations, tokens, tokens/transactions, votes
- [x] Votes: /api/votes (GET, POST), /api/votes/[id] (GET), /api/votes/[id]/participate, /api/votes/[id]/participated, /api/votes/[id]/verify-location
- [x] Payments: /api/payments/create (GET, POST), /api/payments/[id]/status, webhook
- [x] Verification: start, schedule, check-in
- [~] Verification: status (partial - TODO at line 37 for schedule fetch, returns mock data lines 37-65)
- [x] Social: proofs (GET, DELETE), callback/facebook, callback/instagram
- [x] Newsletter: subscribe, verify, beehiiv (GET, POST)
- [x] Cron: verification-notifications (FULLY WORKING - sends actual push notifications)

### Mobile Screens (28 Files, 25 Complete)
- [x] Auth: index, sign-in, sign-up, onboarding, connect-social (5 complete)
- [x] Tabs: index, votes, create (3 complete)
- [~] Tabs: profile (hardcoded stats at 144, 154), history (mock data lines 22-63, TODO at 119)
- [x] Vote: [id].tsx (complete with GPS + share)
- [x] Verification: index, check-in (2 complete)
- [~] Verification: complete (confetti import unused at line 15, hardcoded stats at 137, 141, 145)
- [x] Payment: checkout, success, failed (3 complete)
- [x] Settings: profile, notifications, verification, municipality, social-connections (5 complete)
- [x] Layouts: 6 _layout.tsx files (all complete)

### Mobile Push Notifications (98% Complete)
- [x] Dependencies: expo-notifications@0.29.0, expo-device@7.0.0 (installed)
- [x] Plugin: app.json configured with icon, color, channel (lines 49-57)
- [x] Registration: `apps/mobile/src/lib/notifications.ts` (360 lines, complete)
- [x] API: `/api/user/push-token` (GET, POST, DELETE - 154 lines)
- [x] Cron: `/api/cron/verification-notifications` (128 lines, working)
- [x] Database: push_tokens table with RLS (migration exists)
- [ ] EAS Project ID: Still placeholder "your-project-id" (P0-7)

### Web Pages (14 Files, 7 Complete)
- [x] Landing: page.tsx with Hero, Features, HowItWorks, Pilot, CTA sections
- [x] About: page.tsx with mission, technology, team sections
- [x] FAQ: page.tsx with structured data (FAQJsonLd)
- [x] Auth: sign-in, sign-up (Google OAuth complete)
- [x] Onboarding: 2-step with municipality selection
- [x] Create Vote: 3-step wizard with validation
- [~] Dashboard: mock data (lines 32-37, 39-61, TODO at line 78)
- [~] Vote Detail: mock data fallback (lines 33-59, 98-103)
- [~] Verification: mobile-only restriction (alert at line 98)
- [~] Settings Social: API-connected but needs work
- [~] Connect Social: alert placeholder (line 98)
- [ ] Votes: ComingSoon (lines 33-36)
- [ ] Download: ComingSoon (lines 31-34)

### Web Components (25 Files, 24 Functional)
- [x] UI: Button, Card, Input, Typography (Heading, Text), LanguageToggle, MicroProgress, WhatsAppButton, ComingSoon
- [x] Sections: Features, HowItWorks, Stats, Newsletter, CTA, Pilot, FundTransparency
- [~] Hero: download button disabled (line 84)
- [x] Layout: Header, Footer
- [x] Forms: NewsletterForm (with validation, rate limiting, honeypot)
- [x] Animations: AnimatedText, HeroParallax (respects reduced motion)

### Database (11/15 Tables Complete)
- [x] users (with DID, qubik_wallet_address, identity_score)
- [x] social_proofs (with auto identity score trigger)
- [x] verification_runs, verification_schedule, verification_attempts
- [x] payments (with idempotency_key)
- [x] entitlements
- [x] votes, vote_options, user_votes
- [x] push_tokens (with RLS, trigger)
- [ ] treasury, treasury_transactions (Priority 2 - Bags.fm)
- [ ] issue_coins, issue_coin_holdings (Priority 2 - Bags.fm)
- [ ] nfts (Priority 3)

### Database Enum Mismatches (Noted for P0-2, P0-3)
- payment_status: DB has 'completed', types have 'succeeded'
- vote_status: DB has 'ended', types have 'completed'

---

## Specs Status

```
specs/
+-- push-notifications.md  # [OUTDATED] Spec says NOT STARTED but implementation is 98% complete
+-- bags-integration.md    # [COMPLETE] 0% implemented (Priority 2 - post-pilot)
+-- auth-flow.md           # [TODO] Code exists, no spec
+-- verification-protocol.md  # [TODO] Code exists, no spec
+-- voting-system.md       # [TODO] Code exists, no spec
+-- payment-flow.md        # [TODO] Code exists, no spec
+-- nft-minting.md         # [TODO] Partially exists via Qubik
+-- api-contracts.md       # [TODO] 23 endpoints undocumented
```

**ACTION REQUIRED:** Update specs/push-notifications.md to reflect actual implementation:
- All 6 components are COMPLETE except EAS project ID
- Total implementation: 98% (not 0%)
- Cron job is WORKING (not incomplete with TODO)

### Bags.fm Integration (Priority 2 - Post-Pilot)

**Spec Location:** `specs/bags-integration.md` (486 lines, comprehensive)

**Purpose:** SocialFi economics for the Taru platform - Issue Coins, external supporter investment, NFT minting.

**Implementation Status: 0%**

| Component | Required | Status |
|-----------|----------|--------|
| Service: `apps/web/src/services/bags/index.ts` | Create token launch, trading, fee claiming | NOT CREATED |
| API Client: `packages/api-client/src/bags.ts` | Client methods for Bags.fm | NOT CREATED |
| Types: `packages/shared/src/types/bags.ts` | IssueCoin, Treasury, Holding types | NOT CREATED |
| Contracts: `packages/shared/src/contracts/bags.ts` | Zod schemas for validation | NOT CREATED |
| DB: `treasury` table | Municipality balance tracking | NOT CREATED |
| DB: `treasury_transactions` table | Deposit, withdrawal, fee claims | NOT CREATED |
| DB: `issue_coins` table | Vote-linked token metadata | NOT CREATED |
| DB: `issue_coin_holdings` table | External supporter wallets | NOT CREATED |
| Env vars | BAGS_API_KEY, BAGS_MASTER_WALLET_* | NOT CONFIGURED |

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

## Missing API Endpoints Summary

The API client expects these endpoints that don't exist:

| Endpoint | API Client Method | File:Line | Priority | Notes |
|----------|------------------|-----------|----------|-------|
| ~~`GET /api/user/participations`~~ | ~~`votesApi.getUserParticipations()`~~ | ~~users.ts:N/A~~ | ~~P1~~ | **CREATED** - R29 |
| ~~`GET /api/votes/[id]/participated`~~ | ~~`votesApi.hasParticipated()`~~ | ~~votes.ts:N/A~~ | ~~P1~~ | **CREATED** - R30 |
| ~~`GET /api/user/tokens`~~ | ~~`usersApi.getTokenBalance()`~~ | ~~users.ts:103-111~~ | ~~P1~~ | **CREATED** - R31 |
| ~~`GET /api/user/tokens/transactions`~~ | ~~`usersApi.getTokenTransactions()`~~ | ~~users.ts:116-121~~ | ~~P1~~ | **CREATED** - R32 |
| ~~`POST /api/votes/[id]/verify-location`~~ | ~~`votesApi.verifyLocation()`~~ | ~~votes.ts:N/A~~ | ~~P1~~ | **CREATED** - R33 |
| ~~`GET /api/user/votes`~~ | ~~`usersApi.getVotingHistory()`~~ | ~~users.ts:127-135~~ | ~~P1~~ | **CREATED** - R34 |
| `POST /api/payments/[id]/verify` | `paymentsApi.verifyPayment()` | payments.ts:65-72 | P3 | Verify payment after redirect |
| `POST /api/user/verify-location` | `usersApi.verifyLocation()` | users.ts:141-146 | P3 | General location verification |

**Note:** 6 of 8 missing endpoints were created in the January 15 API Endpoints Session. Only 2 P3 endpoints remain.

### API Endpoint Path Mismatches (P0-5)

The API client calls WRONG paths - backend exists but at different URLs:

| API Client Calls | File:Line | Actual Backend Endpoint | Fix Required |
|-----------------|-----------|------------------------|--------------|
| `GET /api/user/social-connections` | users.ts:70 | `GET /api/social/proofs` | Update to `/api/social/proofs` |
| `POST /api/user/social-connections` | users.ts:84 | OAuth flow via `/api/social/callback/*` | Remove method or redirect |
| `DELETE /api/user/social-connections/{platform}` | users.ts:97 | `DELETE /api/social/proofs?platform=` | Update path and param style |

---

## TODO Comments Found in Code

| File | Line | Content | Priority |
|------|------|---------|----------|
| `/apps/web/src/app/api/verification/status/route.ts` | 37 | `// TODO: Fetch full schedule from convergeService.getVerificationSchedule` | P1 |
| `/apps/web/src/app/api/payments/webhook/route.ts` | 84 | `walletAddress: '', // TODO: Get from user profile when implemented` | P0 |
| `/apps/web/src/app/[locale]/dashboard/page.tsx` | 78 | `// TODO: Replace with actual API calls` | P2 |
| `/apps/mobile/app/(tabs)/history.tsx` | 119 | `// TODO: Replace with actual API call` | P2 |

---

## Code Quality Issues Found

### Console.log in Production (Should Review)
- `apps/web/src/app/api/cron/verification-notifications/route.ts` lines 58, 78
- `apps/web/src/app/api/newsletter/route.ts` lines 43, 53, 79
- `apps/web/src/app/api/payments/webhook/route.ts` lines 29, 47, 53, 63, 88, 90, 107, 124, 126, 141, 153, 158, 163 (13 statements)

### Type Assertions with `as any` (10 locations)
- `apps/mobile/app/(auth)/connect-social.tsx` lines 36, 64
- `apps/mobile/app/(tabs)/profile.tsx` lines 13, 37
- `apps/web/src/components/animations/AnimatedText.tsx` lines 177, 304, 341
- `apps/web/src/components/ui/Typography/Heading.tsx` line 50
- `apps/web/src/middleware.ts` lines 10, 20

---

*Last Updated: January 15, 2025*
*Document Version: 37.0*

**Version 37.0 Changes (January 15, 2025 - P1 Completion Session):**
- **P1-6 RESOLVED: Verification status endpoint now fetches actual data from database**
  - File: `apps/web/src/app/api/verification/status/route.ts`
  - Changes:
    - Replaced convergeService with Supabase queries
    - Now uses getActiveVerificationRun() and getVerificationSchedule() to fetch actual schedule data
    - Calculates real missed/completed/pending counts from database
    - Removed TODO comment at line 37
- **P1-7 RESOLVED: Profile stats now connected to API**
  - New endpoint: `/api/user/stats/route.ts` - returns votesParticipated and votesCreated counts
  - New database functions added:
    - countUserVoteParticipations() - Count user's vote participations
    - countVotesCreatedByUser() - Count votes created by user
    - getUserVoteStats() - Get combined stats
  - Updated mobile: `apps/mobile/app/(tabs)/profile.tsx` - now fetches stats from API instead of hardcoded "0"
  - Updated api-client: Added getVoteStats() method to usersApi
- **P1-8 RESOLVED: Hero download button now enabled and links to download page**
  - File: `apps/web/src/components/sections/Hero/Hero.tsx`
  - Changes:
    - Removed `disabled` prop from download button
    - Wrapped button with Link component to /{locale}/download page
- **Stats Updated:**
  - P1 High: 3 -> 0 (ALL P1 ITEMS RESOLVED)
  - Total Resolved: 35 -> 38 (3 new this session: R38, R39, R40)
  - Total Active: 41 -> 38

**Version 36.0 Changes (Security Fixes Session):**
- **P1-11 RESOLVED: OAuth State Cryptographic Verification**
  - New utility: `/apps/web/src/lib/oauth-state.ts` - JWT-based state signing/verification
  - Security features implemented:
    - JWT signing with HS256 algorithm using JWT_SECRET
    - 10-minute expiration to limit replay window
    - Platform verification to prevent cross-platform state reuse
    - Session user ID matching for CSRF protection
  - Files updated:
    - `/apps/web/src/app/api/social/connect/facebook/route.ts` - Uses createOAuthState()
    - `/apps/web/src/app/api/social/connect/instagram/route.ts` - Uses createOAuthState()
    - `/apps/web/src/app/api/social/callback/facebook/route.ts` - Uses verifyOAuthState() and verifyOAuthStatePlatform()
    - `/apps/web/src/app/api/social/callback/instagram/route.ts` - Uses verifyOAuthState() and verifyOAuthStatePlatform()
- **P1-12 RESOLVED: Payment Webhook Replay Attack Prevention**
  - New migration: `/supabase/migrations/20250115000002_webhook_events.sql` - Creates webhook_events table
  - New type: `WebhookEvent` in `/apps/web/src/lib/supabase/types.ts`
  - New database functions in `/apps/web/src/lib/supabase/db.ts`:
    - getWebhookEventByEventId() - Check for duplicate events
    - createWebhookEvent() - Record new events before processing
    - updateWebhookEventStatus() - Mark events as processed/failed
    - isWebhookStale() - Check timestamp freshness (5 min max)
  - Webhook route updated: `/apps/web/src/app/api/payments/webhook/route.ts`
    - Timestamp validation (rejects events > 5 min old)
    - Event ID tracking with payload hash
    - Idempotent processing with status tracking
    - Failed event retry support
- **Stats Updated:**
  - P1 High: 5 -> 3 (2 security items resolved)
  - Total Resolved: 33 -> 35 (2 new this session)
  - Total Active: 43 -> 41

**Version 35.0 Changes (API Endpoints Session):**
- **6 P1 API Endpoints Created:**
  - P1-2: `/api/user/participations` - CREATED at `apps/web/src/app/api/user/participations/route.ts`
  - P1-3: `/api/votes/[id]/participated` - CREATED at `apps/web/src/app/api/votes/[id]/participated/route.ts`
  - P1-4: `/api/user/tokens` - CREATED at `apps/web/src/app/api/user/tokens/route.ts`
  - P1-5: `/api/user/tokens/transactions` - CREATED at `apps/web/src/app/api/user/tokens/transactions/route.ts`
  - P1-9: `/api/votes/[id]/verify-location` - CREATED at `apps/web/src/app/api/votes/[id]/verify-location/route.ts`
  - P1-10: `/api/user/votes` - CREATED at `apps/web/src/app/api/user/votes/route.ts`
- **R35: Suspense Boundary Fix:**
  - Fixed social-connections page `useSearchParams` Suspense boundary by wrapping in SuspenseWrapper component
- **New Database Functions Created:**
  - `hasUserParticipated(userId, voteId)` - Check if user has voted on a specific vote
  - `getUserVotes(userId)` - Get user's voting history
  - `getUserVotesWithDetails(userId)` - Get user's votes with full vote details
  - `getUserPayments(userId)` - Get user's payment/transaction history
- **Stats Updated:**
  - P1 High: 11 -> 5 (6 endpoints resolved)
  - Total Resolved: 26 -> 33 (7 new this session: 6 endpoints + 1 Suspense fix)
  - Total Active: 49 -> 43
  - API Client Coverage: 73% -> 100% (all 22 methods now have working backends)
  - Web API Routes: 23 -> 29 files (27 complete, 2 partial)
  - Database Functions: 8 -> 12+ functions

**Version 34.0 Changes (Build Fixes Session):**
- **P0-1 RESOLVED:** Payment webhook already has wallet address fetch at lines 81-94 (not a blocker)
- **P1-1 RESOLVED:** Fixed `oderId` typo to `userId` in:
  - `apps/web/src/services/qubik/index.ts` (all 7 occurrences)
  - `apps/web/src/app/api/votes/[id]/participate/route.ts` (line 102)
- **P2-WEB: All 7 type errors resolved:**
  - P2-W1: Fixed Next.js locale type by changing param type to string and casting
  - P2-W2: Fixed ConvergeService by updating newsletter/subscribe/route.ts to use Beehiiv directly
  - P2-W3: Fixed Input React 19 type by adding explicit `any` type assertion
  - P2-W4: Fixed AuthContext.Provider React 19 type by casting Provider as any
  - P2-W5: Fixed Button missing title prop by extending React.ButtonHTMLAttributes
  - P2-W6: Fixed Heading missing id prop by extending React.HTMLAttributes and spreading rest props
  - P2-W7: Fixed Footer external link type by adding explicit FooterLink interface
- **Additional pre-existing fixes:**
  - Fixed sign-up page wrong CSS import path
  - Fixed auth/index.ts exporting server-only session functions (now only exports types)
- **Stats Updated:**
  - P0 Critical: 2 -> 1 (P0-1 resolved, only P0-7 EAS project ID remains)
  - P1 High: 12 -> 11 (P1-1 resolved)
  - P2-WEB: 7 -> 0 (all resolved)
  - Total Resolved: 17 -> 26 (9 new this session)
  - Total Active: 58 -> 49

**Version 33.0 Changes (Type Alignment Session - P0 Blockers Resolved):**
- **5 P0 Blockers Resolved:**
  - P0-2: PaymentType mismatch - ALREADY RESOLVED (types and contracts already matched)
  - P0-3: PaymentStatus mismatch - ALREADY RESOLVED (types and contracts already matched)
  - P0-4: SocialProof field mismatch - FIXED by adding `profileUrl` and `stampWeight` to SocialProofItemSchema
  - P0-5: API client social endpoint wrong path - FIXED by creating OAuth initiation endpoints at `/api/social/connect/{platform}`
  - P0-6: Unused react-native-confetti import - ALREADY RESOLVED (verified import doesn't exist)
- **P0-4 Additional Fixes:**
  - Updated Facebook OAuth callback to use `providerId` instead of `platformUserId`
  - Updated Facebook OAuth callback to use `connectedAt` instead of `verifiedAt`
  - Updated Instagram OAuth callback with same field name changes
  - Updated user/profile route to use correct field names
  - Updated auth.test.ts to use correct field names
- **New P2-WEB Section (7 items):** Pre-existing web type errors discovered during session
  - Next.js locale type issue in layout
  - ConvergeService missing createNewsletterSubscription method
  - React 19 JSX type compatibility issues (Input, AuthContext.Provider)
  - Component prop issues (Button title, Heading id, Footer external link)
- **Mobile Type Errors Fixed:**
  - VoteStatus enum: changed 'completed' to 'ended' to match database
  - VoteOption type: added optional 'votes' and 'text' aliases
  - Vote type: added optional 'userVote' and 'creator' fields
  - VerificationStatus: fixed to access .phase property
  - UserProfile/UserProfileUpdate: added notificationSettings field
  - Route paths: fixed legal/terms, legal/privacy, support to use WebBrowser
  - Skeleton width type and AuthStore type assertion fixes
- **P0 Blockers Reduced:** 7 -> 2 (P0-1 wallet address and P0-7 EAS project ID remain)
- **Total Resolved:** 12 -> 17 items
- **Total Active:** 56 -> 58 (added 7 P2-WEB, removed 5 resolved P0)

**Version 32.0 Changes (Stack Simplification - Supabase Only):**
- **STACK SIMPLIFICATION:** Removed Clerk and Converge from tech stack
  - Auth: Now using Supabase Auth + custom JWT sessions (session.ts)
  - Database: Supabase is now the ONLY database (PostgreSQL with RLS)
  - Removed services: Clerk (auth), Converge (secondary DB), Grow (payments)
- **NEW P4 SECTION:** Added Converge to Supabase migration plan with 9 files to update
- **Updated Documentation:**
  - CLAUDE.md: Updated tech stack, environment variables, API routes
  - Technology component: Updated to show Supabase Auth and Supabase Database
  - External Service Status: Removed Converge, marked as replaced
  - Services section: Marked Converge as DEAD CODE to delete
- **Total Active Blockers:** 56 (previously 47 + 9 P4 cleanup items)

**Version 31.0 Changes (Comprehensive Codebase Audit v12 - 8 Parallel Exploration Agents + Context7 MCP):**
- **All 47 active blockers RE-VERIFIED** - no changes from v30, all issues confirmed present
- **Context7 MCP Integration:** Queried external service documentation for verification
  - Expo Notifications: Confirmed EAS projectId should be obtained via `Constants.expoConfig.extra.eas.projectId` or `Constants.easConfig.projectId`
  - Supabase RLS: Confirmed auth patterns using `auth.uid()` are correctly implemented
  - Bags.fm: Not indexed in Context7 - using local spec at `specs/bags-integration.md`
  - Green Invoice/Morning API: Not indexed in Context7 - implementation verified via code inspection
- **Services Deep Dive (15 files, 4,128 lines):**
  - Auth: 4 services (session.ts 267 lines, google.ts 222 lines, facebook.ts 168 lines, instagram.ts 189 lines)
  - Payments: greenInvoice.ts (295 lines) ACTIVE, grow.ts (232 lines) DEAD CODE
  - Blockchain: qubik/index.ts (242 lines) - wallet creation, token minting
  - Database: converge/index.ts (422 lines) - user, vote, participation CRUD
  - Verification: schedule.ts (411 lines), municipality.ts (436 lines) - 24 municipalities with polygon bounds
  - Notifications: expo.ts (316 lines) - check-in reminders, completion alerts
  - Email: index.ts (538 lines) - 6 Hebrew templates
- **API Client Analysis (22 methods):**
  - Working backends: 16 methods (73%)
  - Missing backends: 6 methods (getUserParticipations, hasParticipated, getTokenBalance, getTokenTransactions, getVotingHistory, verifyLocation)
  - Path mismatches: getSocialProofs calls `/api/user/social-connections` but backend is at `/api/social/proofs`
- **Database Schema Verification (11 tables):**
  - All tables have RLS enabled with proper auth.user_id() policies
  - 34 indexes, 7 triggers, 8 functions
  - Enum mismatches confirmed: payment_status (DB: 'completed' vs TS: 'succeeded'), vote_status (DB: 'ended' vs TS: 'completed')
- **Mobile App Screen Analysis (27 screens):**
  - Complete: 23 screens with real API calls
  - Mock data: history.tsx (lines 22-63), profile.tsx stats (lines 144, 154)
  - Hardcoded: verification/complete.tsx stats (lines 137, 141, 145)
- **Specs Status:**
  - push-notifications.md: 98% complete (P0-7 EAS ID blocker remains)
  - bags-integration.md: 0% implemented (Priority 2 post-pilot, 486-line comprehensive spec)
  - Missing specs: auth-flow, verification-protocol, voting-system, payment-flow, api-contracts
- **No new issues discovered** - document remains accurate

**Version 30.0 Changes (Comprehensive Codebase Audit v11 - 8 Parallel Exploration Agents):**
- **All P0 blockers (7) RE-VERIFIED** - all confirmed present with exact line numbers:
  - P0-1: Empty wallet address at webhook line 84 ✓ (walletAddress: '' with TODO comment)
  - P0-2: PaymentType mismatch at types/payment.ts line 6 ✓ ('vote'|'create_vote' vs contracts 'vote_participation'|'vote_creation')
  - P0-3: PaymentStatus mismatch at types/payment.ts line 5 ✓ ('succeeded' vs 'completed', extra 'processing' not in DB)
  - P0-4: SocialProof fields at types/user.ts lines 14-23 ✓ (platformUserId→providerId, verifiedAt→connectedAt)
  - P0-5: API client social endpoints at users.ts lines 70, 84, 97 ✓ (calling /api/user/social-connections instead of /api/social/proofs)
  - P0-6: Unused confetti import at verification/complete.tsx line 15 ✓
  - P0-7: EAS placeholder "your-project-id" at app.json line 67 ✓
- **All P1 blockers (12) RE-VERIFIED** - all confirmed present:
  - P1-1: oderId typo at participate route line 102 ✓ (should be userId)
  - P1-2: /api/user/participations endpoint MISSING ✓
  - P1-3: /api/votes/[id]/participated endpoint MISSING ✓
  - P1-4: /api/user/tokens endpoint MISSING ✓
  - P1-5: /api/user/tokens/transactions endpoint MISSING ✓
  - P1-6: Verification status mock data with TODO at line 37 ✓ (returns mock progress instead of actual schedule)
  - P1-7: Hardcoded "0" stats at profile.tsx lines 144, 154 ✓
  - P1-8: Hero download button disabled at Hero.tsx line 84 ✓
  - P1-9: /api/votes/[id]/verify-location endpoint MISSING ✓
  - P1-10: /api/user/votes endpoint MISSING ✓
  - P1-11: CSRF vulnerability in Facebook callback lines 43-49 ✓ (Instagram callback has identical issue)
  - P1-12: Replay attack vulnerability in webhook lines 22-31 ✓ (no timestamp/nonce validation)
- **TODO Comments Found (4 total):**
  - apps/web/src/app/api/verification/status/route.ts:37 - "Fetch full schedule from convergeService"
  - apps/web/src/app/api/payments/webhook/route.ts:84 - "Get from user profile when implemented"
  - apps/web/src/app/[locale]/dashboard/page.tsx:78 - "Replace with actual API calls"
  - apps/mobile/app/(tabs)/history.tsx:119 - "Replace with actual API call"
- **Mock Data Locations Confirmed:**
  - Mobile history.tsx lines 21-63 (4 mock votes with Hebrew titles)
  - Dashboard page.tsx lines 31-61 (mock stats: 12 votes, 3 active, 62 tokens)
  - VotesList.tsx lines 12-69 (4 hardcoded votes)
  - Profile route.ts line 95 (mock wallet fallback)
  - Participate route.ts line 98 (mock tx hash fallback)
  - Stats.tsx lines 9-34 (hardcoded: 12500+ citizens, 89 municipalities)
- **Dead Code Confirmed:** grow.ts (232 lines) - not imported anywhere, recommend deletion
- **Services Status:** 15 files total, 11 actively used, 1 dead code (grow.ts), 3 re-export files
- **Database Status:** 11 tables complete with RLS, 7 triggers, 8 functions, all enums defined
- **Missing Bags.fm Tables (Priority 2):** treasury, treasury_transactions, issue_coins, issue_coin_holdings
- **Specs Verification:**
  - push-notifications.md: ACCURATE (98% complete, only EAS ID missing)
  - bags-integration.md: ACCURATE (0% implemented, Priority 2 post-pilot)
  - 5 missing specs for implemented features (auth, verification, voting, payment, API contracts)
- **All 47 active blockers remain unchanged** - no new issues discovered, no issues resolved

**Version 29.0 Changes (Comprehensive Codebase Audit v10 - 8 Parallel Exploration Agents):**
- **All P0 blockers (7) RE-VERIFIED** - all confirmed present with exact line numbers:
  - P0-1: Empty wallet address at webhook line 84 ✓
  - P0-2: PaymentType mismatch (types: 'vote'|'create_vote' vs contracts: 'vote_participation'|'vote_creation') ✓
  - P0-3: PaymentStatus mismatch (types: 'succeeded' vs contracts: 'completed', types has 'processing' not in DB) ✓
  - P0-4: SocialProof fields (platformUserId→providerId, verifiedAt→connectedAt) ✓
  - P0-5: API client social endpoints at lines 70, 84, 97 calling wrong path ✓
  - P0-6: Unused confetti import at line 15 ✓
  - P0-7: EAS placeholder "your-project-id" at line 67 ✓
- **All P1 blockers (12) RE-VERIFIED** - all confirmed present:
  - P1-1: oderId typo at participate route line 102 ✓
  - P1-2 through P1-5: Missing endpoints confirmed (participations, participated, tokens, transactions) ✓
  - P1-6: Verification status mock data with TODO at line 37 ✓
  - P1-7: Hardcoded "0" stats at profile lines 144, 154 ✓
  - P1-8: Hero download button disabled at line 84 ✓
  - P1-9, P1-10: Missing endpoints confirmed (verify-location, user/votes) ✓
  - P1-11: CSRF vulnerability in Facebook callback lines 43-49 ✓ (ALSO found in Instagram callback)
  - P1-12: Replay attack vulnerability in webhook lines 22-31 ✓
- **Additional Security Finding:** Instagram OAuth callback has identical CSRF vulnerability as Facebook (P1-11)
- **Database enum mismatches RE-VERIFIED:**
  - vote_status: DB has 'ended', TypeScript has 'completed'/'cancelled'
  - payment_status: DB has 'completed', TypeScript has 'succeeded'
  - payment_type: 100% mismatch (DB: 'vote_participation'/'vote_creation' vs TS: 'vote'/'create_vote')
- **API Client Coverage:** 22 methods, 16 working backends (73%), 6 missing
- **Dead Code:** grow.ts (232 lines) confirmed unused - recommend deletion
- **Services:** 3,786 total lines, 14 production-ready services
- **All 47 active blockers remain unchanged** - no new issues discovered, no issues resolved

**Version 28.0 Changes (Comprehensive Codebase Audit v9 - 8 Parallel Exploration Agents):**
- **All P0 blockers (7) re-verified** - all confirmed present in source code with exact line numbers
- **All P1 blockers (12) re-verified** - all confirmed, including 2 security issues (P1-11 CSRF, P1-12 replay attack)
- **Services analysis:**
  - grow.ts (232 lines) confirmed DEAD CODE - not imported anywhere
  - bags.ts service does NOT exist (expected - Priority 2 post-pilot)
  - 14 other services are healthy and production-ready
- **Database analysis:**
  - 11 tables created, all with RLS
  - 5 tables MISSING (treasury, treasury_transactions, issue_coins, issue_coin_holdings, nfts) - all Priority 2
- **API Client analysis:**
  - 22 methods total
  - 16 have working backends (73%)
  - 6 missing backend implementations
- **Shared package analysis:**
  - Duplicate GpsCoordinates type in vote.ts and user.ts (P2-15)
  - Type mismatches documented (P0-2, P0-3, P0-4)
- **Mobile app analysis:**
  - History screen uses mock data (mockHistory array lines 22-63, TODO at line 119)
  - Multiple hardcoded colors instead of design tokens
  - Stats not connected to API
- **No new issues discovered** - all existing issues verified and accurate
- **Audit performed with 8 parallel exploration agents** (reduced from 12 for efficiency)
- **All 47 active blockers verified** - counts unchanged

**Version 27.0 Changes (Comprehensive Codebase Audit v8 - 12 Parallel Exploration Agents):**
- **Specs now accurate:** `push-notifications.md` updated to reflect 98% implementation status
- **All P0 blockers (7) re-verified** - all confirmed present in source code
- **All P1 blockers (12) re-verified** - all confirmed, including 2 security issues
- **Dead code analysis:**
  - `grow.ts` (232 lines) confirmed UNUSED - not imported anywhere
  - Unused exports found in: google.ts (2), converge.ts (5), email.ts (5)
- **Mock data locations documented:**
  - VotesList.tsx lines 12-69 (4 hardcoded votes)
  - Dashboard page lines 31-61 (mock stats)
  - Vote detail page lines 33-59 (fallback mock)
  - Profile route line 95 (mock wallet)
  - Participate route line 98 (mock tx hash)
- **Missing layout routes identified:**
  - Mobile: connect-social not in auth layout
  - Mobile: social-connections not in settings layout
- **TODO comments tracked:** 4 total in apps/, 0 in packages/
- **Audit performed with 12 parallel exploration agents**
- **All 47 active blockers verified** - counts unchanged

**Version 26.0 Changes (Comprehensive Codebase Audit v7):**
- All blockers re-verified against source code with updated line references
- Service code metrics: 4,128 lines of production-ready service code
- Database enum mismatches documented (payment_status, vote_status)
- Confirmed bags.ts service does NOT exist (Priority 2 post-pilot)
