# SPIKE-01: Green Invoice Card-on-File Sandbox Results

Spike harness: `pnpm spike:gi` (guards - exits before any network call when creds absent).
Full charge sequence: `GI_SPIKE_TOKEN_ID=<id> pnpm spike:gi --charge`
Service under test: `apps/web/src/services/greenInvoice/index.ts`

---

## Part A - Live sandbox observations (fill after running `pnpm spike:gi --charge`)

All values below are _(pending live run)_ until a human runs the harness against the real
GI sandbox with valid `GREENINVOICE_API_KEY_ID` / `GREENINVOICE_API_SECRET` credentials.
Filling this section satisfies Phase 2 success criteria #1 and #2 (see `ROADMAP.md`).

| Field | Observed value |
|---|---|
| **Token-charge id** | _(pending live run)_ |
| **Document id** | _(pending live run)_ |
| **3DS / SCA behavior** | _(pending live run)_ |
| **Soft-decline behavior** | _(pending live run)_ |
| **Webhook payload shape** | _(pending live run)_ |
| **Secret transport observed** | _(pending live run)_ |
| **Settlement timing** | _(pending live run)_ |

### Field definitions

- **Token-charge id** - The transaction/charge id returned in the response body from
  `POST /payments/tokens/{id}/charge`. Confirms criterion #1: the off-session MIT charge
  surface returns a usable id in the same response.

- **Document id** - The tax document id (חשבונית/קבלה) returned in that SAME response.
  Confirms criterion #1: a GI document is auto-issued on a token charge, not separately.

- **3DS / SCA behavior** - Did the off-session MIT charge trigger a challenge? Did it
  proceed frictionlessly? Note any exemption headers or flags GI sends for recurring MITs.

- **Soft-decline behavior** - What a soft-decline looks like from the API: HTTP status
  code, error object shape, presence/absence of a retriable flag, and any Retry-After.

- **Webhook payload shape** - Key names delivered to `notifyUrl` on a token charge. Note
  any keys that differ from the merch `/payments/form` flow (see Part B, code-derived trace).

- **Secret transport observed** - Whether GI sends the webhook secret in `?token=` query
  param, `x-greeninvoice-token` header, or both - specifically for this token-charge flow.
  Note any difference from the merch form flow.

- **Settlement timing** - Calendar delay from authorization to settlement as visible in the
  GI sandbox dashboard or webhook event timeline.

---

## Part B - Code-derived trace (pre-answers criterion #2 from the shipped merch flow)

The following is derived directly from the existing codebase - no live sandbox run required.
It pre-answers Phase 2 success criterion #2 ("any deviations from the merch flow … are
documented") for the parts already proven by the shipped merch integration.

### Token transport - `getToken()` (`src/services/greenInvoice/index.ts`)

GI returns the JWT either in the `X-Authorization-Bearer` response header **or** the JSON
response body (`body.token || body.bearer`). Both are read; the header takes precedence.
The token is then sent on every authenticated call as `Authorization: Bearer <token>`.
In-memory cache with a 30-second expiry safety margin (honours `body.expires` epoch when
present; falls back to 50 minutes).

### Payment-form document type - `createPaymentForm()` (`src/services/greenInvoice/index.ts`)

`type: 320` is the payload field that instructs GI to issue a חשבונית קבלה (payment
request that auto-issues a receipt/invoice) on successful card settlement. Same value must
be used in `chargeToken()` - confirmed in the current implementation.

### Webhook order correlation - `merch/webhook/route.ts`

Order id is carried in the `custom` field of the payment-form request body. GI echoes it
back in the webhook `payload.custom`. The merch webhook reads:

```typescript
const orderId = (payload.custom as string) || undefined;
```

The same `custom` field is used in `chargeToken()` as the correlation id for vote/membership
charges (e.g. `gi-spike-<timestamp>` in the harness, `userId:month` in production Phase 3).

### Webhook secret transport - `merch/webhook/route.ts`

Secret is registered with GI in the `notifyUrl` as `?token=<secret>`. The webhook handler
accepts it via EITHER the query param OR the `x-greeninvoice-token` header:

```typescript
const provided =
  new URL(request.url).searchParams.get('token') ||
  request.headers.get('x-greeninvoice-token') ||
  '';
```

Verification uses `timingSafeEqual` with a length-guard (throws on mismatched lengths).
Fails **CLOSED** in production on any mismatch - `GREENINVOICE_WEBHOOK_SECRET` unset in
production is an explicit reject. Fails open in dev only so mock checkout works without creds.

### Document id - defensive read - `merch/webhook/route.ts`

```typescript
const paymentId =
  (payload.id as string) ||
  (payload.documentId as string) ||
  (payload.paymentId as string) ||
  order.payment_id ||
  null;
```

GI field names for the issued document vary by account type and flow. The defensive OR chain
mirrors the `chargeToken()` implementation (`data.documentId || data.id || data.paymentId`).

### The gap - `POST /payments/tokens/{id}/charge`

**None of the above is derived from the token-charge MIT endpoint.** The merch flow uses
`POST /payments/form` (redirect + webhook for card-on-file card-setup) but NEVER calls
`POST /payments/tokens/{id}/charge` (the off-session recurring charge). This is precisely
what the harness must confirm:

- Does the token-charge endpoint return a usable `chargeId` **and** `documentId` in one
  synchronous response? (criterion #1)
- Does it deliver a webhook, and if so is the shape / secret-transport identical to the
  merch form flow, or does it differ? (criterion #2 delta)
- What is the real 3DS/SCA and soft-decline behaviour? (criterion #1 / #2 delta)

### Summary of what is pre-answered vs what the live run must confirm

| Item | Pre-answered from code? | Needs live run? |
|---|---|---|
| JWT token transport (header vs body) | Yes - `getToken()` reads both | No |
| `Authorization: Bearer` header shape | Yes - all service calls | No |
| `type: 320` document-type on payment form | Yes - `createPaymentForm()` | No |
| `custom` field for order/member correlation | Yes - merch webhook | No |
| Webhook secret: `?token=` OR `x-greeninvoice-token` | Yes - `isAuthentic()` | No |
| `timingSafeEqual` + length-guard secret check | Yes - `isAuthentic()` | No |
| Fail-CLOSED on missing secret in production | Yes - `isAuthentic()` | No |
| Defensive `payload.id \|\| documentId \|\| paymentId` | Yes - merch webhook | No |
| Token-charge response: chargeId present | No | **Yes - criterion #1** |
| Token-charge response: documentId present in SAME call | No | **Yes - criterion #1** |
| Token-charge 3DS / SCA frictionless or challenge | No | **Yes - criterion #2 delta** |
| Token-charge soft-decline error shape + retriable flag | No | **Yes - criterion #2 delta** |
| Token-charge webhook shape (vs form webhook) | No | **Yes - criterion #2 delta** |
| Token-charge secret transport (query vs header) | No | **Yes - criterion #2 delta** |
| Settlement timing for token charges | No | **Yes - criterion #2 delta** |

Criterion #2's "different webhook shape / header-vs-query secret / settlement timing" deltas
are pre-answered from code for the **merch form flow**; only the token-charge-specific webhook
shape and timing remain for the live run (Part A above).
