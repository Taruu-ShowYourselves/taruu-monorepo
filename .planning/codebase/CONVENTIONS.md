# Coding Conventions

**Analysis Date:** 2026-06-28

## Naming Patterns

**Files:**
- React components: PascalCase — `VoteCard.tsx`, `Button.tsx`
- Hooks: camelCase with `use` prefix — `useVotes.ts`, `useLocation.ts`
- Utilities: camelCase — `formatCurrency.ts`, `secureCompare.ts`
- API routes: always `route.ts` in Next.js App Router directory
- Service modules: `index.ts` barrel inside a named directory — `services/greenInvoice/index.ts`
- Test files: `*.test.ts` (no `.spec.` in web app; mobile uses both)

**Functions and variables:**
- Functions: camelCase — `createMerchOrder`, `markMerchOrderPaid`
- DB row types (internal): snake_case columns mirroring Postgres — `user_id`, `created_at`
- API response shapes (public): camelCase — `userId`, `createdAt`
- Constants: SCREAMING_SNAKE — `MERCH_MAX_QTY_PER_LINE`, `MERCH_SHIPPING_FLAT_ILS`
- Error codes in API responses: SCREAMING_SNAKE string — `'MISSING_CODE'`, `'INVALID_REASON'`

**Types and schemas:**
- Zod schemas: PascalCase suffixed `Schema` — `CreatePaymentRequestSchema`, `MarkPaidResult`
- Inferred types: same name without suffix — `type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>`
- Tagged union result types: `type FooResult = { kind: 'updated'; row: T } | { kind: 'noop' } | { kind: 'error' }`
- Simpler string-union results: `type RefundRequestResult = 'ok' | 'not_found' | 'not_refundable' | 'already_requested' | 'error'`

## Code Style

**Formatting:** No Prettier configured; ESLint with flat config at `apps/web/eslint.config.mjs`.

**TypeScript:** Strict mode enabled (`apps/web/tsconfig.json`). `@typescript-eslint/no-explicit-any` is turned OFF — avoid `any` by convention, not by enforcement. Use proper types or `unknown`.

**Linting:** `next/core-web-vitals` + `@typescript-eslint` rules. Run: `pnpm lint`.

## Import Organization

**Web (`apps/web`):**
```tsx
// 1. Node built-ins (if needed)
import { timingSafeEqual } from 'node:crypto';

// 2. React / framework
import { NextRequest, NextResponse } from 'next/server';

// 3. External packages
import { z } from 'zod';

// 4. Workspace packages
import type { MerchOrder } from '@sync/shared';
import { MERCH_MAX_QTY_PER_LINE } from '@sync/shared';

// 5. Internal aliases (@/...)
import { getSessionFromRequest } from '@/services/auth/session';
import { createMerchOrder } from '@/lib/supabase/db';
import { logger } from '@/lib/logger';

// 6. CSS modules (components only)
import styles from './Component.module.css';
```

**Path aliases (configured in `apps/web/tsconfig.json`):**
- `@/*` → `./src/*`
- `@/components/*`, `@/lib/*`, `@/hooks/*`, `@/styles/*`, `@/types/*`, `@/services/*`

## Environment Variable Access

**Always go through `@/lib/env.ts`** for validated server-side env. Never read raw `process.env` in route handlers for critical secrets.

```ts
// Correct — validated, cached, throws on missing
import { getServerEnv } from '@/lib/env';
const { PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET } = getServerEnv();

// Also acceptable in service config objects (module-level, fails at startup)
const config = {
  apiKeyId: process.env.GREENINVOICE_API_KEY_ID || '',
  // ...
};

// Avoid in route handlers — silent empty string on missing
const key = process.env.SOME_SECRET; // ❌ in route handlers
```

**Adding a new secret to `env.ts`:**
1. Add Zod field to `serverEnvSchema` in `apps/web/src/lib/env.ts`
2. Add to `apps/web/.dev.vars.example` and root `.env.example`
3. Do not add to `clientEnvSchema` unless it must be browser-visible (`NEXT_PUBLIC_*`)

## API Route Structure

**Every route handler follows this shape:**

```ts
export async function POST(request: NextRequest) {
  try {
    // 1. Auth check — always first
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse + validate body
    const body = await request.json();
    if (!body.field) {
      return NextResponse.json(
        { error: 'Human-readable message', code: 'SCREAMING_SNAKE' },
        { status: 400 }
      );
    }

    // 3. Business logic via DB functions and services
    const result = await doSomething(...);

    // 4. Map Result type to HTTP
    if (result.kind === 'error') {
      return NextResponse.json({ error: '...' }, { status: 500 });
    }

    // 5. Success
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error('Route failed', { error: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Response shapes:**
- Success: `{ success: true, ...payload }` or `{ received: true }` (webhooks)
- Error: `{ error: 'Human message', code: 'MACHINE_CODE' }` with appropriate status
- Webhook ack (always 200 unless the error requires a retry): `{ received: true }`

## Webhook Secret Verification

**The canonical pattern** lives in `apps/web/src/lib/secureCompare.ts` and is used in every webhook handler:

```ts
import { timingSafeEqual } from 'node:crypto';

// Reusable — import from @/lib/secureCompare
export function secureEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
```

**Fail-closed in production, fail-open in dev** (see `apps/web/src/app/api/merch/webhook/route.ts`):

```ts
function isAuthentic(request: Request): boolean {
  const secret = process.env.GREENINVOICE_WEBHOOK_SECRET || '';
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('Webhook: secret unset in production — rejecting');
      return false;           // ← CLOSED: prod with missing secret is a 401
    }
    logger.warn('Webhook: secret unset — UNAUTHENTICATED (dev only)');
    return true;              // ← OPEN: local mock checkout still works
  }
  const provided =
    new URL(request.url).searchParams.get('token') ||   // query param
    request.headers.get('x-greeninvoice-token') ||      // header fallback
    '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b); // timing-safe
}
```

**Rules for new webhook routes:**
- Always use `timingSafeEqual` (or `secureEqual` from `@/lib/secureCompare`) — never `===`
- Length-guard before calling `timingSafeEqual` (it throws on length mismatch)
- Fail CLOSED in production when the secret env var is unset
- Accept the secret via both query param and header (matching provider conventions)
- Log rejection at `warn`; log missing secret in prod at `error`

## Database Access

**All DB lives in `apps/web/src/lib/supabase/db.ts`** — pure async functions, no business logic, no HTTP concerns. Routes call these functions; they never query Supabase directly.

**Client selection:**
- Server routes: `supabaseAdmin` from `@/lib/supabase/server` (service role, bypasses RLS where needed)
- Client components: `supabaseClient` from `@/lib/supabase/client` (anon key, respects RLS)

**Read pattern — return null on miss, never throw:**
```ts
export async function getUserById(userId: string): Promise<User | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data;
}
```

**Write pattern — throw on failure (caller decides how to surface it):**
```ts
export async function createUser(userData: InsertTables<'users'>): Promise<User> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .insert(userData)
    .select()
    .single();

  if (error) throw new Error(`Failed to create user: ${error.message}`);
  return data;
}
```

**Atomic transition pattern** (idempotent, race-safe — use for state machine changes):
```ts
// pending → paid guard is IN the same .update() statement
const { data, error } = await supabaseAdmin
  .from('merch_orders')
  .update({ status: 'paid', payment_id: paymentId })
  .eq('id', id)
  .eq('status', 'pending')   // ← only one concurrent delivery wins
  .select()
  .maybeSingle();             // ← 0 rows = noop (already settled), not an error

if (error) return { kind: 'error' };
return data ? { kind: 'updated', row: data } : { kind: 'noop' };
```

**`maybeSingle()` vs `single()`:**
- `maybeSingle()` — when 0 rows is a valid outcome (atomic transitions, existence checks)
- `single()` — when exactly one row is expected and zero is a bug

**Result types for complex DB operations:**
```ts
// Tagged union (when caller needs to distinguish between no-op and error)
export type MarkPaidResult =
  | { kind: 'updated'; row: MerchOrderRow }
  | { kind: 'noop' }   // already settled / lost the race
  | { kind: 'error' }; // transient DB failure

// String literal union (simpler outcome mapping)
export type RefundRequestResult =
  | 'ok'
  | 'not_found'
  | 'not_refundable'
  | 'already_requested'
  | 'error';
```

Route handlers `switch` or `if`-chain on result values to produce HTTP responses.

## Logging

**Import the shared logger from `@/lib/logger`:**

```ts
import { logger } from '@/lib/logger';
// Or use a pre-wired child logger for a component:
import { webhookLogger, paymentLogger, authLogger, cronLogger } from '@/lib/logger';
```

**Usage:**
```ts
logger.info('Merch order marked paid', { orderId });
logger.warn('Merch webhook: no order id in payload');
logger.error('Merch webhook: paid transition failed', { orderId, error: String(err) });
```

**Rules:**
- Always pass structured context as the second argument (never interpolate into the message)
- Never log PII (email, phone, address) or full payloads in production — log keys only
- Use `logger.child({ component: 'webhook' })` for scoped loggers in new services
- Production output is JSON (log aggregator friendly); dev output is coloured text

## Shared Types and Contracts

**`packages/shared/src/types/`** — pure TypeScript interfaces and type aliases used across web and mobile. No Zod, no business logic.

**`packages/shared/src/contracts/`** — Zod schemas for API request/response shapes (used in route validation and client-side parsing).

**Convention for adding a new domain:**
1. Create `packages/shared/src/types/newdomain.ts` with interfaces and type aliases
2. Create `packages/shared/src/contracts/newdomain.ts` with Zod schemas + inferred types
3. Re-export everything from `packages/shared/src/types/index.ts` and `packages/shared/src/contracts/index.ts`
4. Re-export from `packages/shared/src/index.ts`

**Zod contract pattern:**
```ts
// contracts/payment.ts
import { z } from 'zod';

export const CreatePaymentRequestSchema = z.object({
  type: z.enum(['vote_participation', 'vote_creation']),
  voteId: z.string().uuid().optional(),
});

export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>;

export const CreatePaymentResponseSchema = z.object({
  success: z.literal(true),
  payment: z.object({ id: z.string().uuid(), amount: z.number() }),
});

export type CreatePaymentResponse = z.infer<typeof CreatePaymentResponseSchema>;
```

## Idempotency Pattern

Two mechanisms are used together in payment and webhook flows:

**1. Idempotency key on creation** (client-supplied or generated):
```ts
const paymentIdempotencyKey = idempotencyKey || `${userId}-${type}-${voteId}-${Date.now()}`;
const existing = await getPaymentByIdempotencyKey(paymentIdempotencyKey);
if (existing) return NextResponse.json({ success: true, idempotent: true, payment: existing });
```

**2. Atomic state-machine claim** (wins only once):
```ts
// Returns null if already processed — caller must gate all downstream side-effects
const claimed = await markPaymentCompleted(paymentId, providerId);
if (!claimed) {
  return NextResponse.json({ received: true, idempotent: true });
}
// Only the winner runs treasury, mint, email, etc.
```

**Webhook event deduplication** — before processing, look up by `event_id`:
```ts
const existing = await getWebhookEventByEventId(eventId);
if (existing?.status === 'processed') {
  return NextResponse.json({ received: true, idempotent: true, replay: true });
}
```

## Module Design

**Services** — singleton object exported from `index.ts`:
```ts
// services/payments/paddle.ts
class PaddleService { ... }
export const paddleService = new PaddleService();
```

**DB layer** — named function exports, no classes:
```ts
export async function getUserById(...): Promise<User | null> { ... }
export async function createUser(...): Promise<User> { ... }
```

**Barrel files** — every `src/` subdirectory has an `index.ts` that re-exports public API; internal helpers are not re-exported.

---

*Convention analysis: 2026-06-28*
