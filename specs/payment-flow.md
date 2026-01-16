# Payment Flow Specification

**Status:** IMPLEMENTED
**Last Updated:** January 2025

---

## Overview

Sync uses Green Invoice, an Israeli payment gateway, to process payments for vote participation and vote creation. Successful payments trigger SYNC token minting on the Qubik blockchain and send receipt emails via Resend.

## Payment Types

| Type | Cost | Tokens Earned | Description |
|------|------|---------------|-------------|
| `vote_participation` | ₪3 | 3 SYNC | Cast a vote on an issue |
| `vote_creation` | ₪200 | 200 SYNC | Create a new vote topic |

**Token Rate:** 1 ILS = 1 SYNC token

## Payment Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Backend   │────▶│   Green     │────▶│   Client    │
│   Request   │     │   Creates   │     │   Invoice   │     │   Redirects │
│   Payment   │     │   Payment   │     │   Form      │     │   to Form   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                          ┌────────────────────────────────────────┘
                          ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Webhook   │◀────│   Green     │     │   User      │────▶│   Success/  │
│   Receives  │     │   Invoice   │◀────│   Pays      │     │   Failure   │
│   Event     │     │   Callback  │     │             │     │   Page      │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │
      ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Update    │────▶│   Mint      │────▶│   Send      │
│   Payment   │     │   SYNC      │     │   Receipt   │
│   Status    │     │   Tokens    │     │   Email     │
└─────────────┘     └─────────────┘     └─────────────┘
```

## API Endpoints

### POST /api/payments/create

Create a payment intent and redirect user to Green Invoice payment form.

**Prerequisites:**
- Authenticated user
- For `vote_participation`:
  - Identity score ≥40
  - GPS verification completed (`verification_status: 'verified'`)
  - Valid `voteId` provided

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

**Response (200 - Idempotent):**
```json
{
  "success": true,
  "idempotent": true,
  "payment": {
    "id": "existing-payment-uuid",
    "status": "pending",
    "amount": 3,
    "currency": "ILS"
  }
}
```

**Errors:**
- `400` - Invalid payment type
- `400` - Vote ID required for participation
- `401` - Unauthorized
- `403` - Insufficient identity score (<40)
- `403` - GPS verification required
- `404` - User not found
- `500` - Failed to create payment

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

### POST /api/payments/[id]/verify

Verify payment completion (for client-side polling).

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

### POST /api/payments/webhook

Handle Green Invoice webhook callbacks. This endpoint is called by Green Invoice when payment status changes.

**Security Features:**
1. **HMAC Signature Verification** - Validates `x-green-invoice-signature` header
2. **Timestamp Validation** - Rejects webhooks older than 5 minutes (prevents replay attacks)
3. **Event ID Tracking** - Prevents duplicate processing of same event
4. **Idempotent Processing** - Safe to retry failed webhooks

**Request Headers:**
```
x-green-invoice-signature: <hmac-sha256-signature>
x-green-invoice-timestamp: <unix-timestamp>
x-green-invoice-event-id: <unique-event-id>
```

**Request Body:**
```json
{
  "id": "green-invoice-payment-id",
  "status": "paid",
  "amount": 3,
  "custom": "{\"orderId\":\"payment-uuid\",\"voteId\":\"vote-uuid\",\"userId\":\"user-uuid\",\"type\":\"vote_participation\"}"
}
```

**Response (200):**
```json
{
  "received": true
}
```

**Response (200 - Replay Detected):**
```json
{
  "received": true,
  "idempotent": true,
  "replay": true
}
```

**Errors:**
- `401` - Invalid signature
- `401` - Webhook too old (>5 minutes)
- `404` - Payment not found
- `500` - Webhook processing failed

## Webhook Event Types

### payment.succeeded

Triggered when user completes payment successfully.

**Actions:**
1. Update payment status to `completed`
2. Create entitlement record
3. Mint SYNC tokens to user's Qubik wallet
4. Send receipt email
5. If vote participation: record user vote and increment option count

### payment.failed

Triggered when payment fails.

**Actions:**
1. Update payment status to `failed`

### refund.created

Triggered when payment is refunded.

**Actions:**
1. Update payment status to `refunded`

## Green Invoice Integration

### Authentication

```typescript
// Exchange API credentials for access token
POST https://api.greeninvoice.co.il/api/v1/account/token
{
  "id": "<GREEN_INVOICE_API_KEY>",
  "secret": "<GREEN_INVOICE_SECRET>"
}

// Response
{
  "token": "eyJ...",
  "expiresIn": 3600
}
```

### Create Payment Form

```typescript
POST https://api.greeninvoice.co.il/api/v1/payments/form
Authorization: Bearer <access_token>

{
  "description": "השתתפות בהצבעה: <vote_title>",
  "type": 320,
  "lang": "he",
  "currency": "ILS",
  "vatType": 0,
  "amount": 3,
  "maxPayments": 1,
  "client": {
    "name": "User Name",
    "emails": ["user@example.com"]
  },
  "income": [{
    "catalogNum": "SYNC-VOTE-001",
    "description": "השתתפות בהצבעה",
    "quantity": 1,
    "price": 3,
    "currency": "ILS",
    "vatType": 0
  }],
  "successUrl": "https://sync.co.il/votes/{voteId}/success",
  "failureUrl": "https://sync.co.il/votes/{voteId}/failed",
  "notifyUrl": "https://sync.co.il/api/payments/webhook",
  "custom": "{\"orderId\":\"...\",\"voteId\":\"...\",\"userId\":\"...\"}"
}

// Response
{
  "id": "green-invoice-id",
  "url": "https://api.greeninvoice.co.il/payment/form/xxx"
}
```

### Webhook Signature Verification

```typescript
const crypto = require('crypto');

function verifyWebhookSignature(payload: string, signature: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', GREEN_INVOICE_SECRET)
    .update(payload)
    .digest('hex');

  return signature === expectedSignature;
}
```

## Token Minting

After successful payment, SYNC tokens are minted to the user's Qubik wallet:

```typescript
await qubikService.mintTokens({
  walletAddress: user.qubik_wallet_address,
  amount: payment.amount / 100, // Convert agorot to ILS (= tokens)
  reason: payment.type, // 'vote_participation' or 'vote_creation'
});
```

**Note:** If user has no wallet address, tokens are logged but not minted. Manual minting may be required later.

## Email Receipt

After successful payment, receipt email sent via Resend:

```typescript
await emailService.sendPaymentReceiptEmail({
  to: user.email,
  firstName: user.first_name,
  amount: payment.amount / 100, // In ILS
  type: payment.type,
  receiptUrl: greenInvoiceReceiptUrl,
  tokensEarned: tokensToMint,
});
```

## Database Schema

### payments
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
type TEXT NOT NULL -- 'vote_participation', 'vote_creation'
amount INTEGER NOT NULL -- In agorot (300 = ₪3)
currency TEXT DEFAULT 'ILS'
status TEXT DEFAULT 'pending' -- 'pending', 'completed', 'failed', 'refunded'
idempotency_key TEXT UNIQUE
green_invoice_id TEXT
vote_id UUID REFERENCES votes(id)
option_id UUID REFERENCES vote_options(id)
metadata JSONB
created_at TIMESTAMPTZ DEFAULT NOW()
processed_at TIMESTAMPTZ
```

### entitlements
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
type TEXT NOT NULL -- 'vote', 'create_vote'
payment_id UUID REFERENCES payments(id)
vote_id UUID REFERENCES votes(id)
amount INTEGER NOT NULL -- Tokens earned
granted_at TIMESTAMPTZ DEFAULT NOW()
```

### webhook_events
```sql
id UUID PRIMARY KEY
event_id TEXT UNIQUE NOT NULL -- For replay prevention
provider TEXT DEFAULT 'green_invoice'
event_type TEXT NOT NULL
payload_hash TEXT NOT NULL
idempotency_key TEXT
status TEXT DEFAULT 'pending' -- 'pending', 'processed', 'failed'
error_message TEXT
created_at TIMESTAMPTZ DEFAULT NOW()
processed_at TIMESTAMPTZ
```

## Idempotency

### Client-side Idempotency

Clients can provide an `idempotencyKey` when creating payments:

```typescript
// Same idempotency key returns existing payment
POST /api/payments/create
{
  "type": "vote_participation",
  "voteId": "vote-123",
  "idempotencyKey": "user-123-vote-123-1705276800"
}
```

### Server-side Idempotency

If no key provided, server generates: `{userId}-{type}-{voteId}-{timestamp}`

Existing payments with matching key return cached response without creating new payment.

### Webhook Idempotency

Webhooks are tracked by event ID to prevent duplicate processing:
- Same event ID → return success without reprocessing
- Failed events can be retried

## Security Measures

### Replay Attack Prevention

1. **Timestamp Check:** Webhooks older than 5 minutes are rejected
2. **Event Tracking:** Each event ID is stored and checked
3. **Signature Verification:** HMAC-SHA256 validates webhook authenticity

### Payment Security

1. **Authentication Required:** All payment endpoints require valid session
2. **Identity Score Check:** Vote participation requires score ≥40
3. **GPS Verification:** Vote participation requires verified residency
4. **HTTPS Only:** All Green Invoice communication over HTTPS

## Error Codes

| Error | HTTP | Description |
|-------|------|-------------|
| `invalid_type` | 400 | Invalid payment type |
| `vote_id_required` | 400 | Vote ID required for participation |
| `unauthorized` | 401 | No valid session |
| `invalid_signature` | 401 | Webhook signature invalid |
| `webhook_too_old` | 401 | Webhook timestamp >5 minutes |
| `insufficient_score` | 403 | Identity score <40 |
| `verification_required` | 403 | GPS verification not completed |
| `user_not_found` | 404 | User doesn't exist |
| `payment_not_found` | 404 | Payment doesn't exist |
| `payment_failed` | 500 | Green Invoice API error |
| `webhook_error` | 500 | Webhook processing failed |

## Environment Variables

```env
# Green Invoice
GREEN_INVOICE_API_KEY=xxx
GREEN_INVOICE_SECRET=xxx

# App URL (for callbacks)
NEXT_PUBLIC_APP_URL=https://sync.co.il
```

---

## Mobile Implementation Notes

- Use `expo-web-browser` to open Green Invoice payment form
- Poll `/api/payments/[id]/status` after returning from browser
- Handle both success and failure redirect URLs
- Show loading spinner while awaiting webhook confirmation
- Cache payment status with React Query/SWR
