# Alignment Matrix - Critical User Journeys

This document maps the 5 critical user journeys through the system, tracing each from UI components through API routes, services, database entities, and tests.

## Journey 1: Authentication (Signup/Signin/Session/Logout)

| Layer | Component | Auth Required | Notes |
|-------|-----------|---------------|-------|
| **Pages** | `/sign-in`, `/sign-up`, `/` | No | Entry points for auth |
| **Components** | `AuthProvider`, `useAuth` hook | No | Manages auth state |
| **API Routes** | | | |
| → Callback | `POST /api/auth/callback` | No | Handles Google OAuth callback |
| → Session | `POST /api/auth/session` | No | Validates session, returns user |
| → Session | `DELETE /api/auth/session` | Yes | Signs out, clears cookies |
| **Services** | | | |
| → Google OAuth | `services/auth/google.ts` | - | Token exchange, user info |
| → Session | `services/auth/session.ts` | - | JWT creation, validation |
| **DB Entities** | `users`, `social_proofs` | - | User profile, Google social proof |
| **Edge Cases** | | | |
| • Invalid OAuth state | Returns 400 | | |
| • Expired session | Returns 401 | | |
| • Missing user | Returns 404 | | |
| **Tests** | `__tests__/integration/auth.test.ts` | | |

### Contract Schema
```typescript
// POST /api/auth/callback
Request: { code: string; state: string }
Response: { success: true; redirectUrl: string } | { error: string; code: string }

// POST /api/auth/session
Request: {} (uses cookies)
Response: { valid: true; user: UserResponse; session: SessionInfo } | { error: string; code: string }

// DELETE /api/auth/session
Request: {} (uses cookies)
Response: { success: true }
```

---

## Journey 2: DID (Create/Stability Across Refresh)

| Layer | Component | Auth Required | Notes |
|-------|-----------|---------------|-------|
| **Pages** | `/dashboard`, `/settings` | Yes | DID displayed after auth |
| **Components** | `AuthProvider` (auto-generates) | Yes | DID created on first signin |
| **API Routes** | | | |
| → Get DID | `GET /api/auth/did` | Yes | Returns existing DID |
| → Create/Recover | `POST /api/auth/did` | Yes | Generate new or recover |
| **Services** | | | |
| → DID Utils | `@sync/shared/utils/did.ts` | - | Key generation, encryption |
| **DB Entities** | `users.did`, `users.did_public_key`, `users.did_encrypted_private_key` | - | |
| **Edge Cases** | | | |
| • DID already exists | Returns 409 with existing DID | | |
| • Recovery with wrong token | Returns 400 | | |
| • No DID found | Returns 404 | | |
| **Tests** | `__tests__/integration/auth.test.ts` (DID section) | | |

### Contract Schema
```typescript
// GET /api/auth/did
Response: { did: string; publicKey: JWK } | { error: string; code: string }

// POST /api/auth/did (generate)
Request: { action: 'generate'; oauthToken: string }
Response: { success: true; did: string; publicKey: JWK }

// POST /api/auth/did (recover)
Request: { action: 'recover'; oauthToken: string }
Response: { success: true; did: string; publicKey: JWK; privateKey: JWK; message: string }
```

---

## Journey 3: Social Proofs (Connect/Disconnect + Score Updates)

| Layer | Component | Auth Required | Notes |
|-------|-----------|---------------|-------|
| **Pages** | `/sign-up/connect-social`, `/settings/social-connections` | Yes | Social proof management |
| **Components** | Social connection cards | Yes | Platform-specific buttons |
| **API Routes** | | | |
| → Get Proofs | `GET /api/social/proofs` | Yes | Returns proofs + score |
| → Delete Proof | `DELETE /api/social/proofs?platform=x` | Yes | Disconnect platform |
| → FB Callback | `GET /api/social/callback/facebook` | Yes | OAuth callback |
| → IG Callback | `GET /api/social/callback/instagram` | Yes | OAuth callback |
| **Services** | | | |
| → Facebook | `services/auth/facebook.ts` | - | Token exchange |
| → Instagram | `services/auth/instagram.ts` | - | Token exchange |
| **DB Entities** | `social_proofs`, `users.identity_score` | - | |
| **Edge Cases** | | | |
| • Cannot disconnect Google | Returns 400 | Required for auth | |
| • Platform already connected | Overwrites | | |
| • Invalid OAuth token | Returns 400 | | |
| **Tests** | `__tests__/integration/social-proofs.test.ts` | | |

### Contract Schema
```typescript
// GET /api/social/proofs
Response: {
  socialProofs: Array<{
    platform: string;
    providerId: string;
    displayName: string;
    connectedAt: string;
  }>;
  identityScore: {
    total: number;
    breakdown: { google: number; facebook: number; instagram: number };
    level: 'basic' | 'verified' | 'trusted';
  };
}

// DELETE /api/social/proofs?platform=facebook|instagram
Response: { success: true; socialProofs: [...]; identityScore: {...} }
```

---

## Journey 4: Verification (Start/Schedule/Check-in/Status/Complete)

| Layer | Component | Auth Required | Notes |
|-------|-----------|---------------|-------|
| **Pages** | `/verification` | Yes | Main verification page |
| **Components** | Verification status card, check-in button | Yes | |
| **API Routes** | | | |
| → Start | `POST /api/verification/start` | Yes | Begins 21-day period |
| → Schedule | `GET /api/verification/schedule` | Yes | Returns next check-in |
| → Check-in | `POST /api/verification/check-in` | Yes | Records GPS location |
| → Status | `GET /api/verification/status` | Yes | Returns current status |
| **Services** | | | |
| → Municipality | `services/verification/municipality.ts` | - | Polygon bounds check |
| → Schedule | `services/verification/schedule.ts` | - | Window generation |
| **DB Entities** | `verification_runs`, `verification_schedule`, `verification_attempts`, `users.verification_status` | - | |
| **Edge Cases** | | | |
| • No municipality selected | Returns 400 | | |
| • Already verified | Returns 400 | | |
| • Already in progress | Returns 400 | | |
| • Check-in outside window | Returns 400 (too_early/too_late) | | |
| • Check-in outside polygon | Returns 400 (outside municipality) | | |
| • GPS accuracy too low | Returns 400 | >100m rejected | |
| • 80% completion → verified | Updates status | | |
| **Tests** | `__tests__/integration/verification.test.ts` | | |

### Contract Schema
```typescript
// POST /api/verification/start
Request: {} (uses session for user/municipality)
Response: {
  success: true;
  schedule: { id: string; municipality: string; periodStart: string; periodEnd: string; totalCheckIns: number; nextCheckIn: string };
  verificationStatus: { phase: string; completedCheckIns: number; totalCheckIns: number };
}

// GET /api/verification/schedule
Response: {
  schedule: { id: string; userId: string; municipality: string; ... };
  metadata: { generatedAt: string };
}

// POST /api/verification/check-in
Request: { latitude: number; longitude: number; accuracy?: number; scheduleId?: string }
Response: {
  success: boolean;
  verified: boolean;
  checkIn?: { id: string; completedAt: string; location: {...}; municipalityVerified: boolean };
  verificationStatus: { phase: string; completedCheckIns: number; totalCheckIns: number };
  error?: string;
}

// GET /api/verification/status
Response: {
  status: 'none' | 'pending' | 'verified' | 'failed';
  run?: { ... };
}
```

---

## Journey 5: Payment (Create/Status/Webhook/Idempotent Entitlement)

| Layer | Component | Auth Required | Notes |
|-------|-----------|---------------|-------|
| **Pages** | `/vote/[id]`, `/create-vote` | Yes | Payment trigger points |
| **Components** | Payment button, payment status | Yes | |
| **API Routes** | | | |
| → Create | `POST /api/payments/create` | Yes | Creates Green Invoice payment |
| → Status | `GET /api/payments/[id]/status` | Yes | Returns payment status |
| → Webhook | `POST /api/payments/webhook` | No* | Green Invoice callback |
| **Services** | | | |
| → Green Invoice | `services/payments/greenInvoice.ts` | - | Payment form creation |
| → Email | `services/email/index.ts` | - | Receipt emails |
| → Qubik | `services/qubik/index.ts` | - | Token minting |
| **DB Entities** | `payments`, `entitlements`, `user_votes`, `vote_options` | - | |
| **Edge Cases** | | | |
| • Insufficient identity score | Returns 403 | <40 rejected | |
| • Not GPS verified | Returns 403 | | |
| • Idempotent request | Returns existing payment | | |
| • Duplicate webhook | Idempotent (no double mint) | | |
| • Payment failed | Status updated, no entitlement | | |
| **Tests** | `__tests__/e2e/payment.test.ts` | | |

### Contract Schema
```typescript
// POST /api/payments/create
Request: {
  type: 'vote_participation' | 'vote_creation';
  voteId?: string;
  optionId?: string;
  voteTitle?: string;
  idempotencyKey?: string;
}
Response: {
  success: true;
  payment: { id: string; paymentUrl: string; amount: number; currency: string; expiresAt: string };
  pricing: { amount: number; currency: string; syncTokens: number; description: string };
}

// GET /api/payments/[id]/status
Response: {
  id: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  amount: number;
  currency: string;
  receiptUrl?: string;
  succeeded: boolean;
  tokensEarned: number;
}

// POST /api/payments/webhook (Green Invoice)
Request: { type: string; paymentId: string; ... } (signed payload)
Response: { received: true; idempotent?: boolean }
```

---

## Summary Table

| Journey | API Routes | DB Tables | Auth | E2E Test |
|---------|------------|-----------|------|----------|
| Auth | `/api/auth/*` | users, social_proofs | No/Yes | auth.e2e.ts |
| DID | `/api/auth/did` | users | Yes | did.e2e.ts |
| Social Proofs | `/api/social/*` | social_proofs, users | Yes | social.e2e.ts |
| Verification | `/api/verification/*` | verification_*, users | Yes | verification.e2e.ts |
| Payment | `/api/payments/*` | payments, entitlements, user_votes | Yes* | payment.e2e.ts |

---

## Environment Variables Required

| Variable | Used By | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | DB client | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | DB client | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | DB admin | Yes |
| `JWT_SECRET` | Session | Yes |
| `GOOGLE_CLIENT_ID` | OAuth | Yes |
| `GOOGLE_CLIENT_SECRET` | OAuth | Yes |
| `FACEBOOK_APP_ID` | Social | No |
| `FACEBOOK_APP_SECRET` | Social | No |
| `INSTAGRAM_APP_ID` | Social | No |
| `INSTAGRAM_APP_SECRET` | Social | No |
| `GREEN_INVOICE_API_KEY` | Payments | Yes |
| `GREEN_INVOICE_SECRET` | Webhook | Yes |
| `RESEND_API_KEY` | Email | Yes |
| `QUBIK_API_KEY` | Tokens | No |

---

*Last Updated: January 2026*
