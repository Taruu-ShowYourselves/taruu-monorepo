# API Contracts Specification

**Status:** IMPLEMENTED
**Last Updated:** January 2025

---

## Overview

This document defines all REST API endpoints for the Sync platform. All endpoints use JSON for request/response bodies and require HTTPS in production.

## Base URL

```
Production: https://sync.co.il/api
Development: http://localhost:3000/api
```

## Authentication

Most endpoints require JWT authentication via session cookie:

```
Cookie: session_token=eyJ...
```

Unauthenticated requests return `401 Unauthorized`.

---

## Auth Endpoints

### POST /api/auth/callback

Exchange Google OAuth authorization code for session.

**Request:**
```json
{
  "code": "4/0AY0e-g5..."
}
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "did": "did:sync:...",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "identityScore": 40,
    "verificationStatus": "none",
    "avatarUrl": "https://...",
    "municipality": null
  },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "isNewUser": true
}
```

**Errors:** `400 MISSING_CODE`, `500 CONFIG_ERROR`, `500 AUTH_FAILED`

---

### POST /api/auth/session

Validate current session.

**Request:** Uses cookies, no body needed

**Response (200):**
```json
{
  "valid": true,
  "user": {
    "id": "uuid",
    "did": "did:sync:...",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "avatarUrl": "https://...",
    "identityScore": 60,
    "verificationStatus": "in_progress",
    "municipality": "tel-aviv",
    "socialProofs": ["google", "facebook"]
  },
  "session": {
    "userId": "uuid",
    "did": "did:sync:...",
    "expiresAt": "2025-01-22T00:00:00.000Z"
  }
}
```

**Errors:** `401 INVALID_SESSION`, `404 USER_NOT_FOUND`

---

### DELETE /api/auth/session

Sign out and clear session.

**Response (200):**
```json
{
  "success": true,
  "message": "Signed out successfully"
}
```

---

### POST /api/auth/session/refresh

Refresh expired session using refresh token.

**Request:** Uses refresh token from cookies

**Response (200):**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": { ... },
  "expiresAt": "2025-01-22T00:00:00.000Z"
}
```

**Errors:** `401 NO_REFRESH_TOKEN`, `401 INVALID_REFRESH_TOKEN`, `404 USER_NOT_FOUND`

---

### GET /api/auth/did

Get user's DID (Decentralized Identifier).

**Response (200):**
```json
{
  "did": "did:sync:abc123...",
  "publicKey": { ... }
}
```

---

## User Endpoints

### GET /api/user/profile

Get current user's profile.

**Response (200):**
```json
{
  "profile": {
    "id": "uuid",
    "googleId": "google-id",
    "did": "did:sync:...",
    "qubikWalletAddress": "0x...",
    "firstName": "John",
    "lastName": "Doe",
    "email": "user@example.com",
    "phone": "+972501234567",
    "municipality": "tel-aviv",
    "avatarUrl": "https://...",
    "verificationStatus": {
      "phase": "in_progress",
      "checkInsCompleted": 3,
      "checkInsTotal": 6
    },
    "socialProofs": [
      {
        "platform": "google",
        "providerId": "123",
        "displayName": "John Doe",
        "email": "user@gmail.com",
        "connectedAt": "2025-01-15T00:00:00.000Z",
        "stampWeight": 40
      }
    ],
    "identityScore": {
      "total": 60,
      "breakdown": { "google": 40, "facebook": 20, "instagram": 0, "gps": 0 },
      "level": "basic"
    },
    "syncTokenBalance": 150,
    "createdAt": "2025-01-15T00:00:00.000Z",
    "updatedAt": "2025-01-15T00:00:00.000Z"
  }
}
```

---

### POST /api/user/profile

Create new user profile (after Google signup).

**Request:**
```json
{
  "municipality": "tel-aviv",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+972501234567"
}
```

**Response (201):**
```json
{
  "profile": { ... }
}
```

**Errors:** `400` (profile exists or missing municipality), `503` (wallet service unavailable)

---

### PATCH /api/user/profile

Update user profile.

**Request:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+972501234567",
  "municipality": "tel-aviv"
}
```

**Response (200):**
```json
{
  "profile": { ... }
}
```

---

### GET /api/user/tokens

Get token balance and wallet info.

**Response (200):**
```json
{
  "balance": 150,
  "walletAddress": "0x...",
  "lastUpdated": "2025-01-15T12:00:00.000Z"
}
```

---

### GET /api/user/tokens/transactions

Get token transaction history.

**Response (200):**
```json
{
  "transactions": [
    {
      "id": "tx-uuid",
      "type": "mint",
      "amount": 3,
      "reason": "vote_participation",
      "txHash": "0xabc123...",
      "timestamp": "2025-01-15T12:00:00.000Z"
    }
  ]
}
```

---

### GET /api/user/votes

Get user's voting history.

**Response (200):**
```json
{
  "participations": [
    {
      "id": "participation-uuid",
      "voteId": "vote-uuid",
      "voteTitle": "האם לבנות פארק חדש?",
      "optionLabel": "בעד",
      "createdAt": "2025-01-15T12:00:00.000Z",
      "txHash": "0xabc123..."
    }
  ]
}
```

---

### GET /api/user/participations

Get detailed participation history.

**Response (200):**
```json
{
  "participations": [
    {
      "id": "uuid",
      "vote": {
        "id": "vote-uuid",
        "title": "האם לבנות פארק חדש?",
        "status": "active"
      },
      "option": {
        "id": "option-uuid",
        "label": "בעד"
      },
      "createdAt": "2025-01-15T12:00:00.000Z"
    }
  ]
}
```

---

### GET /api/user/stats

Get user statistics.

**Response (200):**
```json
{
  "stats": {
    "totalVotes": 15,
    "votesCreated": 2,
    "tokensEarned": 165,
    "currentBalance": 150,
    "memberSince": "2025-01-01T00:00:00.000Z"
  }
}
```

---

### POST /api/user/push-token

Register push notification token.

**Request:**
```json
{
  "token": "ExponentPushToken[xxxx]",
  "platform": "ios"
}
```

**Response (200):**
```json
{
  "success": true
}
```

---

### POST /api/user/verify-location

Verify user's current GPS location against municipality.

**Request:**
```json
{
  "latitude": 32.0853,
  "longitude": 34.7818,
  "accuracy": 25
}
```

**Response (200):**
```json
{
  "verified": true,
  "municipality": "tel-aviv",
  "distanceFromCenter": 1.2
}
```

---

## Social Endpoints

### GET /api/social/proofs

Get user's social proofs and identity score.

**Response (200):**
```json
{
  "socialProofs": [
    {
      "platform": "google",
      "providerId": "123456789",
      "displayName": "John Doe",
      "profileImage": "https://...",
      "email": "user@gmail.com",
      "connectedAt": "2025-01-15T00:00:00.000Z"
    }
  ],
  "identityScore": {
    "total": 60,
    "breakdown": {
      "google": 40,
      "facebook": 20,
      "instagram": 0
    },
    "level": "basic",
    "lastCalculated": "2025-01-15T12:00:00.000Z"
  }
}
```

---

### DELETE /api/social/proofs?platform=facebook

Disconnect a social platform.

**Query:** `platform` - facebook or instagram (google cannot be disconnected)

**Response (200):**
```json
{
  "success": true,
  "socialProofs": [...],
  "identityScore": { ... }
}
```

**Errors:** `400` (invalid platform or trying to disconnect google)

---

### POST /api/social/connect/facebook

Initiate Facebook OAuth connection.

**Response (200):**
```json
{
  "authUrl": "https://www.facebook.com/v18.0/dialog/oauth?..."
}
```

---

### POST /api/social/connect/instagram

Initiate Instagram OAuth connection.

**Response (200):**
```json
{
  "authUrl": "https://api.instagram.com/oauth/authorize?..."
}
```

---

### POST /api/social/callback/facebook

Handle Facebook OAuth callback.

**Request:**
```json
{
  "code": "facebook-auth-code"
}
```

**Response (200):**
```json
{
  "success": true,
  "socialProof": {
    "platform": "facebook",
    "providerId": "987654321",
    "displayName": "John Doe",
    "connectedAt": "2025-01-16T00:00:00.000Z"
  },
  "identityScore": {
    "total": 60,
    "breakdown": { ... }
  }
}
```

---

### POST /api/social/callback/instagram

Handle Instagram OAuth callback.

**Request:**
```json
{
  "code": "instagram-auth-code"
}
```

**Response (200):** Same structure as Facebook callback

---

## Vote Endpoints

### GET /api/votes

List votes with optional filters.

**Query Parameters:**
- `municipality` - Filter by municipality ID
- `status` - Filter by status (pending, active, ended)

**Response (200):**
```json
{
  "votes": [
    {
      "id": "vote-uuid",
      "title": "האם לבנות פארק חדש?",
      "description": "...",
      "municipality": "tel-aviv",
      "creatorId": "user-uuid",
      "status": "active",
      "startDate": "2025-01-20T00:00:00.000Z",
      "endDate": "2025-02-10T00:00:00.000Z",
      "participantCount": 47,
      "createdAt": "2025-01-15T00:00:00.000Z",
      "updatedAt": "2025-01-15T00:00:00.000Z"
    }
  ]
}
```

---

### POST /api/votes

Create a new vote (requires ₪200 payment).

**Request:**
```json
{
  "title": "האם לבנות פארק חדש?",
  "description": "הצבעה על הקמת פארק ציבורי ברחוב הראשי",
  "municipality": "tel-aviv",
  "options": [
    { "label": "בעד", "description": "תומך בהקמת הפארק" },
    { "label": "נגד", "description": "מתנגד להקמת הפארק" }
  ],
  "startDate": "2025-01-20T00:00:00.000Z",
  "endDate": "2025-02-10T00:00:00.000Z",
  "paymentTxId": "green-invoice-tx-id"
}
```

**Response (201):**
```json
{
  "vote": {
    "id": "vote-uuid",
    "title": "האם לבנות פארק חדש?",
    "description": "...",
    "municipality": "tel-aviv",
    "creatorId": "user-uuid",
    "status": "pending",
    "startDate": "2025-01-20T00:00:00.000Z",
    "endDate": "2025-02-10T00:00:00.000Z",
    "participantCount": 0,
    "options": [
      { "id": "opt-uuid-1", "label": "בעד", "voteCount": 0 },
      { "id": "opt-uuid-2", "label": "נגד", "voteCount": 0 }
    ],
    "createdAt": "2025-01-15T00:00:00.000Z",
    "updatedAt": "2025-01-15T00:00:00.000Z"
  }
}
```

**Errors:** `400` (missing fields), `401` (unauthorized), `402` (payment required)

---

### GET /api/votes/[id]

Get vote details with options.

**Response (200):**
```json
{
  "vote": {
    "id": "vote-uuid",
    "title": "האם לבנות פארק חדש?",
    "description": "...",
    "municipality": "tel-aviv",
    "creatorId": "user-uuid",
    "status": "active",
    "startDate": "2025-01-20T00:00:00.000Z",
    "endDate": "2025-02-10T00:00:00.000Z",
    "participantCount": 47,
    "options": [
      { "id": "opt-1", "label": "בעד", "voteCount": 32 },
      { "id": "opt-2", "label": "נגד", "voteCount": 15 }
    ],
    "createdAt": "2025-01-15T00:00:00.000Z",
    "updatedAt": "2025-01-15T00:00:00.000Z"
  }
}
```

---

### POST /api/votes/[id]/participate

Cast a vote (requires ₪3 payment).

**Request:**
```json
{
  "optionId": "option-uuid",
  "paymentTxId": "green-invoice-tx-id",
  "gpsCoordinates": {
    "latitude": 32.0853,
    "longitude": 34.7818,
    "timestamp": "2025-01-15T12:00:00.000Z"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "participation": {
    "id": "participation-uuid",
    "voteId": "vote-uuid",
    "userId": "user-uuid",
    "optionId": "option-uuid",
    "paymentTxId": "green-invoice-tx-id",
    "qubikTxHash": "0xabc123...",
    "gpsCoordinates": { ... },
    "createdAt": "2025-01-15T12:00:00.000Z"
  },
  "txHash": "0xabc123...",
  "tokensEarned": 3
}
```

**Errors:**
- `400` - Missing fields, vote not active, vote ended, already participated, invalid option
- `401` - Unauthorized
- `403` - Insufficient identity score (<40)
- `404` - Vote not found
- `429` - Rate limited (3 req/min)
- `503` - Blockchain service unavailable

---

### GET /api/votes/[id]/participated

Check if current user has participated in vote.

**Response (200):**
```json
{
  "participated": true,
  "participation": {
    "optionId": "opt-1",
    "createdAt": "2025-01-15T12:00:00.000Z"
  }
}
```

---

### POST /api/votes/[id]/verify-location

Verify GPS location before voting.

**Request:**
```json
{
  "latitude": 32.0853,
  "longitude": 34.7818,
  "accuracy": 25
}
```

**Response (200):**
```json
{
  "verified": true,
  "municipality": "tel-aviv",
  "distanceFromCenter": 1.2
}
```

**Errors:** `400` (outside bounds or accuracy too low)

---

## Payment Endpoints

### GET /api/payments/create

Get payment pricing information.

**Response (200):**
```json
{
  "pricing": {
    "voteParticipation": {
      "amount": 3,
      "currency": "ILS",
      "syncTokens": 3,
      "description": "השתתפות בהצבעה"
    },
    "voteCreation": {
      "amount": 200,
      "currency": "ILS",
      "syncTokens": 200,
      "description": "יצירת הצבעה חדשה"
    }
  },
  "tokenRate": {
    "rate": 1,
    "description": "1 ILS = 1 SYNC token"
  },
  "paymentProvider": "green_invoice"
}
```

---

### POST /api/payments/create

Create payment intent.

**Request:**
```json
{
  "type": "vote_participation",
  "voteId": "vote-uuid",
  "optionId": "option-uuid",
  "voteTitle": "האם לבנות פארק חדש?",
  "idempotencyKey": "optional-client-key"
}
```

**Response (200):**
```json
{
  "success": true,
  "payment": {
    "id": "payment-uuid",
    "orderId": "payment-uuid",
    "paymentUrl": "https://api.greeninvoice.co.il/payment/form/xxx",
    "amount": 3,
    "currency": "ILS",
    "expiresAt": "2025-01-15T12:30:00.000Z"
  },
  "pricing": {
    "amount": 3,
    "currency": "ILS",
    "syncTokens": 3,
    "description": "השתתפות בהצבעה"
  }
}
```

**Errors:** `400` (invalid type), `401` (unauthorized), `403` (insufficient score or verification), `404` (user not found)

---

### GET /api/payments/[id]/status

Check payment status.

**Response (200):**
```json
{
  "payment": {
    "id": "payment-uuid",
    "status": "completed",
    "amount": 3,
    "currency": "ILS",
    "type": "vote_participation",
    "processedAt": "2025-01-15T12:05:00.000Z"
  }
}
```

---

### POST /api/payments/[id]/verify

Verify payment completion.

**Response (200):**
```json
{
  "verified": true,
  "payment": {
    "id": "payment-uuid",
    "status": "completed"
  }
}
```

---

### POST /api/payments/webhook

Handle Green Invoice webhooks (internal use).

**Headers:**
```
x-green-invoice-signature: <hmac-sha256>
x-green-invoice-timestamp: <unix-timestamp>
x-green-invoice-event-id: <event-id>
```

**Response (200):**
```json
{
  "received": true
}
```

---

## Verification Endpoints

### POST /api/verification/start

Start 21-day GPS verification period.

**Response (200):**
```json
{
  "success": true,
  "schedule": {
    "id": "run-uuid",
    "municipality": "tel-aviv",
    "periodStart": "2025-01-15T00:00:00.000Z",
    "periodEnd": "2025-02-05T00:00:00.000Z",
    "totalCheckIns": 6,
    "nextCheckIn": "2025-01-16T14:30:00.000Z"
  },
  "verificationStatus": {
    "phase": "in_progress",
    "completedCheckIns": 0,
    "totalCheckIns": 6
  }
}
```

**Errors:** `400` (no municipality, already verified, already in progress)

---

### POST /api/verification/check-in

Record GPS check-in.

**Request:**
```json
{
  "latitude": 32.0853,
  "longitude": 34.7818,
  "accuracy": 25,
  "scheduleId": "optional-schedule-uuid"
}
```

**Response (200 - Success):**
```json
{
  "success": true,
  "verified": true,
  "checkIn": {
    "id": "attempt-uuid",
    "completedAt": "2025-01-16T14:35:00.000Z",
    "location": {
      "latitude": 32.0853,
      "longitude": 34.7818,
      "accuracy": 25,
      "timestamp": "2025-01-16T14:35:00.000Z"
    },
    "municipalityVerified": true,
    "distanceFromCenter": 1.2
  },
  "verificationStatus": {
    "phase": "in_progress",
    "completedCheckIns": 1,
    "totalCheckIns": 6
  },
  "progress": {
    "completedCheckIns": 1,
    "totalCheckIns": 6,
    "completionRate": 0.167
  }
}
```

**Response (400 - Failed):**
```json
{
  "success": false,
  "verified": false,
  "error": "Location is outside תל אביב-יפו",
  "details": {
    "inMunicipality": false,
    "accuracyAcceptable": true,
    "distanceFromCenter": 15.3
  }
}
```

**Errors:** `400` (too early, too late, invalid coordinates, no verification), `429` (rate limited - 10 req/min)

---

### GET /api/verification/status

Get current verification status.

**Response (200):**
```json
{
  "verificationStatus": {
    "phase": "in_progress",
    "startedAt": "2025-01-15T00:00:00.000Z",
    "scheduleId": "run-uuid",
    "checkInsCompleted": 3,
    "checkInsTotal": 6,
    "nextCheckIn": "2025-01-20T10:00:00.000Z"
  },
  "progress": {
    "daysRemaining": 12,
    "daysElapsed": 9,
    "completedCheckIns": 3,
    "totalCheckIns": 6,
    "missedCheckIns": 1,
    "pendingCheckIns": 2,
    "completionRate": 0.5,
    "requiredCompletionRate": 0.8,
    "canStillPass": true
  },
  "municipality": "tel-aviv",
  "nextCheckIn": "2025-01-20T10:00:00.000Z"
}
```

---

### GET /api/verification/schedule

Get full check-in schedule.

**Response (200):**
```json
{
  "schedule": [
    {
      "id": "schedule-item-uuid",
      "windowStart": "2025-01-16T14:30:00.000Z",
      "windowEnd": "2025-01-16T15:00:00.000Z",
      "completed": true,
      "completedAt": "2025-01-16T14:35:00.000Z"
    },
    {
      "id": "schedule-item-uuid-2",
      "windowStart": "2025-01-20T10:00:00.000Z",
      "windowEnd": "2025-01-20T10:30:00.000Z",
      "completed": false,
      "completedAt": null
    }
  ],
  "runId": "run-uuid",
  "municipality": "tel-aviv"
}
```

---

## Other Endpoints

### POST /api/newsletter/subscribe

Subscribe to newsletter.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Successfully subscribed"
}
```

---

### GET /api/newsletter

Get newsletter subscription status.

**Response (200):**
```json
{
  "subscribed": true,
  "email": "user@example.com"
}
```

---

### GET /api/cron/verification-notifications

Cron job to send verification window notifications (internal use).

**Response (200):**
```json
{
  "success": true,
  "notificationsSent": 15
}
```

---

## Rate Limits

| Endpoint | Limit | Per |
|----------|-------|-----|
| `/api/votes/[id]/participate` | 3 | minute |
| `/api/verification/check-in` | 10 | minute |
| All other endpoints | 60 | minute |

Rate limited responses return `429 Too Many Requests` with:
```json
{
  "error": "Too many requests",
  "retryAfter": 60
}
```

---

## Common Error Response Format

```json
{
  "error": "Error message in Hebrew or English",
  "code": "ERROR_CODE"
}
```

---

## HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - No valid session |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |
| 503 | Service Unavailable - External service down |
