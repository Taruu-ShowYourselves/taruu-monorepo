# Testing Patterns

**Analysis Date:** 2026-06-28

## Test Frameworks

**Web app (`apps/web`):**
- Runner: Vitest `^1.0.0`
- Config: `apps/web/vitest.config.ts`
- Assertion: Vitest built-in (Jest-compatible API)
- E2E: Playwright (`apps/web/playwright.config.ts`) — currently sparse

**Mobile app (`apps/mobile`):**
- Runner: Jest (via Expo preset)
- Config: `apps/mobile/package.json` jest key

**Run commands (web):**
```bash
pnpm test                     # Run all tests once (vitest run)
pnpm --filter @sync/web test  # Scoped to web
# No watch command configured; use: npx vitest --watch
# Coverage:
npx vitest run --coverage
```

**vitest.config.ts settings:**
- `environment: 'node'` — all tests run in Node (no jsdom)
- `globals: true` — `describe`, `it`, `expect`, `vi` available without import
- `include: ['src/**/*.test.ts', 'src/**/*.spec.ts']`
- `testTimeout: 10000`, `hookTimeout: 10000`
- Coverage provider: `v8`, reporters: `text`, `json`, `html`
- Path alias `@/` resolves to `./src/`

## Test File Organization

**Location:**
```
apps/web/src/__tests__/
├── api/          # One file per API route or logical group of routes
│   ├── auth-callback.test.ts
│   ├── merch-webhook.test.ts
│   ├── payments.test.ts
│   ├── payments-refund.test.ts
│   └── ... (35+ files)
├── integration/  # Multi-layer flows (no full mocking; uses real jose, shared utils)
│   ├── auth.test.ts
│   └── verification.test.ts
├── services/     # Pure service unit tests (no HTTP layer)
│   ├── otp.test.ts
│   ├── pinata.test.ts
│   └── ...
└── e2e/          # Lightweight E2E stubs (not full Playwright flows yet)
    └── payment.test.ts

packages/shared/src/utils/__tests__/  # Shared util tests
apps/mobile/src/__tests__/            # Mobile: hooks/, lib/, stores/
```

**Naming:** test file mirrors the file or route it covers, e.g. `apps/web/src/app/api/merch/webhook/route.ts` → `apps/web/src/__tests__/api/merch-webhook.test.ts`.

## API Route Test Structure

Every API route test file follows this exact layout:

```ts
/**
 * Human-readable description of what this file covers.
 * List the endpoints and their key security/business concerns.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

// === 1. DECLARE ALL vi.mock() CALLS BEFORE IMPORTS ===
vi.mock('@/services/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

vi.mock('@/lib/supabase/db', () => ({
  getUserById: vi.fn(),
  createPayment: vi.fn(),
  // list every DB function the route calls
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/services/payments/paddle', () => ({
  paddleService: {
    createVotePayment: vi.fn(),
    verifyWebhookSignature: vi.fn(),
  },
}));

// === 2. IMPORT MOCKED MODULES (after vi.mock declarations) ===
import { getSessionFromRequest } from '@/services/auth/session';
import { getUserById, createPayment } from '@/lib/supabase/db';
import { paddleService } from '@/services/payments/paddle';

// Import the route handler — static import is fine when env is irrelevant
import { POST } from '@/app/api/payments/create/route';

// === 3. SHARED FIXTURES ===
const mockSession = {
  userId: 'user-123',
  email: 'test@example.com',
  did: 'did:sync:' + 'a'.repeat(43),
  expiresAt: Date.now() + 86400000,
};

const mockUser = {
  id: 'user-123',
  identity_score: 60,
  verification_status: 'verified',
  municipality_id: 'tel-aviv',
};

// === 4. DESCRIBE BLOCK ===
describe('POST /api/payments/create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default mock returns (happy path)
    (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
    (getUserById as Mock).mockResolvedValue(mockUser);
  });

  it('returns 401 when not authenticated', async () => {
    (getSessionFromRequest as Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/payments/create', {
      method: 'POST',
      body: JSON.stringify({ type: 'vote_participation', voteId: 'vote-1' }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('creates checkout successfully', async () => {
    (paddleService.createVotePayment as Mock).mockResolvedValue({
      paymentUrl: 'https://checkout.paddle.com/txn_123',
    });

    const request = new NextRequest('http://localhost/api/payments/create', {
      method: 'POST',
      body: JSON.stringify({ type: 'vote_participation', voteId: 'vote-1' }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(paddleService.createVotePayment).toHaveBeenCalled();
  });
});
```

## Dynamic Import Pattern (for env-sensitive routes)

When a route reads environment variables at **module load time** (e.g. inside `isAuthentic()`), you must re-import it after changing `process.env`:

```ts
describe('POST /api/merch/webhook', () => {
  let POST: typeof import('@/app/api/merch/webhook/route').POST;
  const ORIGINAL = process.env.GREENINVOICE_WEBHOOK_SECRET;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();                                          // ← flush module cache
    process.env.GREENINVOICE_WEBHOOK_SECRET = 'test-secret';
    POST = (await import('@/app/api/merch/webhook/route')).POST; // ← fresh import
  });

  afterEach(() => {
    process.env.GREENINVOICE_WEBHOOK_SECRET = ORIGINAL;        // ← restore
  });

  it('fails CLOSED in production with no secret', async () => {
    process.env.GREENINVOICE_WEBHOOK_SECRET = '';
    // @ts-expect-error override read-only NODE_ENV for this test
    process.env.NODE_ENV = 'production';
    vi.resetModules();
    const route = await import('@/app/api/merch/webhook/route');
    const res = await route.POST(post('http://localhost/api/merch/webhook', {}));
    expect(res.status).toBe(401);
    // @ts-expect-error restore
    process.env.NODE_ENV = 'test';
  });
});
```

Reference: `apps/web/src/__tests__/api/merch-webhook.test.ts` and `apps/web/src/__tests__/api/auth-callback.test.ts`.

## Webhook Test Template

Tests for every webhook handler must cover this matrix (see `apps/web/src/__tests__/api/merch-webhook.test.ts` as the canonical template):

```ts
// Helper to build a Request (not NextRequest — webhooks use raw Request)
function post(url: string, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('authentication', () => {
  it('rejects a POST with no token (401)');
  it('rejects a POST with a wrong token (401)');
  it('accepts the secret via query param (?token=)');
  it('accepts the secret via x-{provider}-token header');
  it('runs OPEN (accepts, 200) when no secret is configured in dev');
  it('fails CLOSED (401) when the secret is unset in production');
});

describe('business logic', () => {
  it('acks 200 without touching DB when required field is missing');
  it('acks 200 idempotently when the atomic update is a no-op (already settled)');
  it('returns 500 (so provider retries) on a transient DB error');
  it('marks the record correctly on the happy path');
});
```

## Mocking Approach

**What to always mock:**

| Target | Mock shape |
|--------|------------|
| `@/lib/supabase/db` | `{ funcName: vi.fn() }` — list every function the route calls |
| `@/services/auth/session` | `{ getSessionFromRequest: vi.fn() }` |
| `@/lib/logger` | `{ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }` or named child loggers |
| External services (Paddle, Qubik, email, GreenInvoice) | `{ serviceName: { methodName: vi.fn() } }` |
| `@sync/shared` (DID utils) | `{ generateEncryptedDID: vi.fn(), ... }` |

**Cast to `Mock` for per-test overrides:**
```ts
import { type Mock } from 'vitest';
import { getSessionFromRequest } from '@/services/auth/session';

(getSessionFromRequest as Mock).mockResolvedValue(mockSession);   // happy path
(getSessionFromRequest as Mock).mockResolvedValue(null);          // unauthenticated
(getSessionFromRequest as Mock).mockRejectedValue(new Error()); // crash
```

**Result type mocking** — match the tagged union exactly:
```ts
// MarkPaidResult: { kind: 'updated'; row: ... } | { kind: 'noop' } | { kind: 'error' }
(markMerchOrderPaid as Mock).mockResolvedValue({ kind: 'updated', row: pendingOrder }); // success
(markMerchOrderPaid as Mock).mockResolvedValue({ kind: 'noop' });   // idempotent / lost race
(markMerchOrderPaid as Mock).mockResolvedValue({ kind: 'error' });  // transient DB failure → 500

// RefundRequestResult: string literals
(requestPaymentRefund as Mock).mockResolvedValue('ok');
(requestPaymentRefund as Mock).mockResolvedValue('not_refundable');
(requestPaymentRefund as Mock).mockResolvedValue('already_requested');
```

**Atomic claim is null-return (payments):**
```ts
// markPaymentCompleted returns Payment | null (null = already processed)
(markPaymentCompleted as Mock).mockResolvedValue(mockPayment); // this delivery wins
(markPaymentCompleted as Mock).mockResolvedValue(null);        // lost the race → idempotent
```

**What NOT to mock:**
- Pure utility functions (`formatCurrency`, `secureEqual`, `calculateIdentityScore`) — let them run
- Zod schemas and contract types — let them validate
- `jose` JWT library — used directly in integration tests
- `@sync/shared` utility logic (DID validation, identity scoring) — tested in integration tests

## Fixtures and Shared Data

Fixtures are defined inline at the top of each test file, not in a shared factory. Keep fixtures minimal — only fields the route under test actually reads:

```ts
const mockSession = {
  userId: 'user-123',
  email: 'test@example.com',
  did: 'did:sync:' + 'a'.repeat(43),
  expiresAt: Date.now() + 86400000,
};

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  identity_score: 60,
  verification_status: 'verified',
  municipality_id: 'tel-aviv',
  qubik_wallet_address: 'wallet-123',
};

// Spread + override for variant cases:
(getUserById as Mock).mockResolvedValue({ ...mockUser, identity_score: 30 }); // low score
```

## Integration Tests

Located in `apps/web/src/__tests__/integration/`. These tests run real library code (no mocking of `jose`, shared utils, etc.) but stub the network boundary with `vi.stubEnv` and `global.fetch`:

```ts
// auth.test.ts
vi.stubEnv('AUTH0_DOMAIN', 'test-tenant.eu.auth0.com');
vi.stubEnv('JWT_SECRET', 'test-jwt-secret-at-least-32-chars-long');

const mockFetch = vi.fn();
global.fetch = mockFetch;

mockFetch.mockResolvedValueOnce({
  ok: true,
  json: async () => ({ access_token: 'mock-token' }),
});
```

Use integration tests for:
- JWT signing/verification logic (real `jose` calls)
- DID format validation (real `@sync/shared` logic)
- Identity score calculations (real `calculateIdentityScore`)

## Service Tests

Located in `apps/web/src/__tests__/services/`. Test service modules directly, without the HTTP layer. Network/external calls are stubbed via `vi.stubGlobal('fetch', vi.fn(...))`:

```ts
// otp.test.ts — captures the OTP from the outgoing SMS to verify round-trips
vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
  const body = JSON.parse(init.body);
  sentMessages.push(body.text); // capture the sent SMS text
  return { ok: true, text: async () => '' };
}));

const otp = await import('@/services/sms/otp');
await otp.sendVerificationCode('+972500000001');
// Extract code from the captured message
const code = sentMessages[0].match(/(\d{6})/)[1];
const result = await otp.checkVerificationCode('+972500000001', code);
expect(result.verified).toBe(true);
```

## Green Invoice Payment Test Template

For a new Green Invoice token-charge route, model after `apps/web/src/__tests__/api/payments-refund.test.ts` and `apps/web/src/__tests__/api/merch-webhook.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/auth/session', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/supabase/db', () => ({
  getPaymentById: vi.fn(),
  createGreenInvoiceCharge: vi.fn(), // new DB function
  // ...
}));
vi.mock('@/services/greenInvoice', () => ({
  isGreenInvoiceConfigured: vi.fn(() => true),
  createPaymentForm: vi.fn(),        // or the relevant GI method
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { getSessionFromRequest } from '@/services/auth/session';
import { createGreenInvoiceCharge } from '@/lib/supabase/db';
import { createPaymentForm } from '@/services/greenInvoice';

const SESSION = { userId: 'user-1', email: 'u@test.com' };

function req(body: unknown) {
  return new NextRequest('http://localhost/api/payments/gi-charge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/payments/gi-charge', () => {
  let POST: typeof import('@/app/api/payments/gi-charge/route').POST;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    (getSessionFromRequest as Mock).mockResolvedValue(SESSION);
    POST = (await import('@/app/api/payments/gi-charge/route')).POST;
  });

  it('401 without session');
  it('400 on invalid body');
  it('409 when already charged (idempotent)');
  it('200 on success with payment URL');
  it('500 on GI API failure');
});
```

**For the webhook side**, use `apps/web/src/__tests__/api/merch-webhook.test.ts` verbatim as the template — it already covers the full authentication + idempotency matrix for Green Invoice webhooks.

## Test Types

**Unit tests (`__tests__/api/`):**
- Scope: single API route handler function
- All external I/O mocked
- Fast — no network, no DB

**Integration tests (`__tests__/integration/`):**
- Scope: multi-layer logic (auth flow, session lifecycle)
- Uses real library code; stubs only network boundary
- Still in-process, no running server needed

**Service tests (`__tests__/services/`):**
- Scope: service module logic (OTP, Pinata, notifications)
- Stubs network via `vi.stubGlobal('fetch', ...)`

**E2E (`__tests__/e2e/`):**
- Currently Vitest-based stubs (not real Playwright browser tests)
- Real Playwright E2E runs separately: `pnpm test:e2e`

## Coverage

No enforced threshold. Run coverage with:

```bash
npx vitest run --coverage
# Reports: text (terminal), json (coverage/coverage-final.json), html (coverage/index.html)
```

Coverage exclusions (from `vitest.config.ts`):
- `node_modules/`, `tests/`, `**/*.d.ts`, `**/*.config.*`, `**/types/`

---

*Testing analysis: 2026-06-28*
