# Voting System Specification

**Status:** IMPLEMENTED
**Last Updated:** January 2025

---

## Overview

The voting system enables verified residents to create and participate in municipal votes. Each vote is recorded on the Qubik blockchain for transparency and immutability. Voting requires payment (₪1 participation, ₪50 creation) and GPS verification.

## Vote Lifecycle

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ pending │────▶│ active  │────▶│  ended  │────▶│ results │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
   (future)      (voting)        (closed)       (tallied)
```

### Status Transitions
- **pending** → Created but start date not reached
- **active** → Voting is open (startDate ≤ now < endDate)
- **ended** → Voting closed (now ≥ endDate)

## Vote Creation

### Cost
- **Creation fee:** ₪50 (via Green Invoice)
- **Creator becomes:** Topic Lead

### Requirements
- Authenticated user
- Valid payment transaction ID
- Municipality selected
- At least 2 vote options

### API: POST /api/votes

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
    "description": "הצבעה על הקמת פארק ציבורי...",
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

**Errors:**
- `400` - Missing required fields
- `401` - Unauthorized
- `402` - Payment required

## Vote Participation

### Cost
- **Participation fee:** ₪1 (via Green Invoice)
- **Tokens earned:** 3 Sync tokens

### Requirements
- Authenticated user
- Identity score ≥40
- Valid payment transaction ID
- GPS coordinates provided
- Vote is active (not ended)
- User hasn't already voted

### API: POST /api/votes/[id]/participate

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
    "gpsCoordinates": {
      "latitude": 32.0853,
      "longitude": 34.7818,
      "timestamp": "2025-01-15T12:00:00.000Z"
    },
    "createdAt": "2025-01-15T12:00:00.000Z"
  },
  "txHash": "0xabc123...",
  "tokensEarned": 3
}
```

**Errors:**
- `400` - Missing required fields
- `400` - Vote not active
- `400` - Vote has ended
- `400` - Already participated
- `400` - Invalid option
- `401` - Unauthorized
- `403` - Insufficient identity score (< 40)
- `404` - Vote not found
- `429` - Rate limited (3 req/min)
- `503` - Blockchain service unavailable

### Blockchain Recording

Each vote is recorded on Qubik blockchain:

```typescript
await qubikService.recordVote({
  voteId,           // Vote UUID
  userId,           // Voter UUID
  optionId,         // Selected option UUID
  locationHash,     // Base64 GPS coordinates
  paymentHash,      // Green Invoice TX ID
});
```

**Location Hash:**
```typescript
const locationHash = Buffer.from(JSON.stringify({
  lat: gpsCoordinates.latitude,
  lng: gpsCoordinates.longitude,
  timestamp: gpsCoordinates.timestamp,
})).toString('base64');
```

### Token Minting

After successful vote, mint Sync tokens:

```typescript
await qubikService.mintTokens({
  walletAddress: user.qubik_wallet_address,
  amount: 3,  // 3 tokens for ₪3 vote
  reason: 'vote',
});
```

## Vote Queries

### GET /api/votes

Get votes with optional filters.

**Query Parameters:**
- `municipality` - Filter by municipality ID
- `status` - Filter by status (pending, active, ended)

**Response:**
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

### GET /api/votes/[id]

Get a specific vote with options.

**Response:**
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

### GET /api/votes/[id]/participated

Check if current user has participated.

**Response:**
```json
{
  "participated": true,
  "participation": {
    "optionId": "opt-1",
    "createdAt": "2025-01-15T12:00:00.000Z"
  }
}
```

### GET /api/user/votes

Get current user's vote history.

**Response:**
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

## GPS Location Verification

Before voting, user must verify GPS location:

### POST /api/votes/[id]/verify-location

**Request:**
```json
{
  "latitude": 32.0853,
  "longitude": 34.7818,
  "accuracy": 25
}
```

**Response:**
```json
{
  "verified": true,
  "municipality": "tel-aviv",
  "distanceFromCenter": 1.2
}
```

**Errors:**
- `400` - Location outside municipality bounds
- `400` - GPS accuracy too low (> 100m)

## Database Schema

### votes
```sql
id UUID PRIMARY KEY
title TEXT NOT NULL
description TEXT NOT NULL
municipality_id TEXT NOT NULL
creator_id UUID REFERENCES users(id)
status TEXT DEFAULT 'pending' -- 'pending', 'active', 'ended'
start_date TIMESTAMPTZ NOT NULL
end_date TIMESTAMPTZ NOT NULL
participant_count INTEGER DEFAULT 0
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```

### vote_options
```sql
id UUID PRIMARY KEY
vote_id UUID REFERENCES votes(id)
text TEXT NOT NULL
votes INTEGER DEFAULT 0
```

### user_votes
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
vote_id UUID REFERENCES votes(id)
option_id UUID REFERENCES vote_options(id)
payment_id TEXT NOT NULL
created_at TIMESTAMPTZ DEFAULT NOW()
UNIQUE(user_id, vote_id)
```

## Rate Limiting

- **Vote participation:** 3 requests per minute per user
- Returns `429` with Hebrew error message
- Prevents vote manipulation/spamming

## Email Notifications

After successful vote, payment receipt email sent:

```typescript
await emailService.sendPaymentReceiptEmail({
  to: user.email,
  firstName: user.first_name,
  amount: 3,
  type: 'vote',
  receiptUrl: `${APP_URL}/receipts/${paymentTxId}`,
  tokensEarned: 3,
});
```

## Identity Score Requirement

| Score | Can Vote? |
|-------|-----------|
| < 40 | ❌ No |
| 40+ | ✅ Yes |

**How to reach 40:**
- Google OAuth alone = 40 points (minimum requirement)

## Error Codes

| Error | HTTP | Description |
|-------|------|-------------|
| `unauthorized` | 401 | Not authenticated |
| `payment_required` | 402 | No payment TX ID |
| `insufficient_score` | 403 | Identity score < 40 |
| `vote_not_found` | 404 | Invalid vote ID |
| `vote_not_active` | 400 | Vote pending or ended |
| `vote_ended` | 400 | Past end date |
| `already_participated` | 400 | User already voted |
| `invalid_option` | 400 | Option not in vote |
| `blockchain_unavailable` | 503 | Qubik service down |
| `rate_limited` | 429 | Too many requests |

---

## Mobile Implementation Notes

- Use `expo-location` to get GPS before voting
- Show option percentages only after voting (prevent bias)
- Display "Already Voted" badge on participated votes
- Cache vote list with SWR/React Query
- Optimistic UI update after vote submission
