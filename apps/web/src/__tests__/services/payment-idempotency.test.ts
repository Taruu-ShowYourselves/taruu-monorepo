/**
 * Unit proof for server-derived payment idempotency (SEC-04, plan 03-08).
 *
 * The requirement is short - "generated server-side and deterministically,
 * never using a millisecond timestamp, so retries dedupe" - but the
 * interesting property is the one it does not state: determinism must not
 * become a one-vote-per-lifetime lock. A creation request has no voteId and no
 * optionId (the vote does not exist until the payment settles), so the key is
 * scoped by the draft title. Two identical drafts by one user therefore collide
 * BY DESIGN on the first attempt - which is what makes a double-click dedupe -
 * and the spent-key chain is what stops that collision outliving the payment.
 *
 * `resolveIdempotencyKey` takes its lookup as an argument, so every branch here
 * runs the real implementation against an injected `vi.fn()` rather than a
 * database. The last describe asserts against the ROUTE SOURCE: this repo has no
 * component/route render harness, and "a clock or a client key came back" is
 * exactly the kind of regression a source assertion catches.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Payment } from '@/lib/supabase/types';
import {
  derivePaymentIdempotencyKey,
  deriveRetryKey,
  resolveIdempotencyKey,
  MAX_IDEMPOTENCY_CHAIN,
  type IdempotencyInput,
} from '@/services/payments/idempotency';

const BASE_INPUT: IdempotencyInput = {
  userId: 'u1',
  type: 'vote_creation',
  voteTitle: 'תקציב',
};

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'payment-1',
    user_id: 'u1',
    type: 'vote_creation',
    amount: 5000,
    currency: 'ILS',
    status: 'pending',
    provider: 'green_invoice',
    provider_id: null,
    idempotency_key: 'u1:vote_creation:seed',
    vote_id: null,
    option_id: null,
    metadata: null,
    created_at: '2026-08-04T00:00:00.000Z',
    updated_at: '2026-08-04T00:00:00.000Z',
    ...overrides,
  };
}

describe('derivePaymentIdempotencyKey', () => {
  it('returns the identical string for identical input', () => {
    expect(derivePaymentIdempotencyKey(BASE_INPUT)).toBe(
      derivePaymentIdempotencyKey(BASE_INPUT)
    );
  });

  it('is unchanged when called again a tick later - it reads no clock', async () => {
    const first = derivePaymentIdempotencyKey(BASE_INPUT);
    await new Promise((resolve) => setImmediate(resolve));
    expect(derivePaymentIdempotencyKey(BASE_INPUT)).toBe(first);
  });

  it('gives a different key to a different draft title', () => {
    expect(derivePaymentIdempotencyKey({ ...BASE_INPUT, voteTitle: 'חינוך' })).not.toBe(
      derivePaymentIdempotencyKey(BASE_INPUT)
    );
  });

  it('is greppable: it starts with the user and the payment type', () => {
    expect(derivePaymentIdempotencyKey(BASE_INPUT).startsWith('u1:vote_creation:')).toBe(true);
  });

  it('matches the SEC-04 shape exactly, so a reintroduced timestamp fails the pattern', () => {
    expect(derivePaymentIdempotencyKey(BASE_INPUT)).toMatch(
      /^u1:vote_creation:[0-9a-f]{16}$/
    );
  });

  it('scopes on the voteId when the flow has one, per the requirement text', () => {
    expect(
      derivePaymentIdempotencyKey({ ...BASE_INPUT, voteId: 'vote-9' })
    ).toBe('u1:vote_creation:vote-9');
  });

  it('still produces a well-formed key for a draft with no title', () => {
    expect(derivePaymentIdempotencyKey({ userId: 'u1', type: 'vote_creation' })).toMatch(
      /^u1:vote_creation:[0-9a-f]{16}$/
    );
  });

  it('separates two users submitting the same draft title', () => {
    expect(derivePaymentIdempotencyKey({ ...BASE_INPUT, userId: 'u2' })).not.toBe(
      derivePaymentIdempotencyKey(BASE_INPUT)
    );
  });
});

describe('deriveRetryKey', () => {
  const base = derivePaymentIdempotencyKey(BASE_INPUT);

  it('is stable for the same spent payment', () => {
    expect(deriveRetryKey(base, 'payment-1')).toBe(deriveRetryKey(base, 'payment-1'));
  });

  it('differs from the key it replaces', () => {
    expect(deriveRetryKey(base, 'payment-1')).not.toBe(base);
  });

  it('differs between two distinct spent payments', () => {
    expect(deriveRetryKey(base, 'payment-1')).not.toBe(deriveRetryKey(base, 'payment-2'));
  });

  it('keeps the base as its prefix, so a chained key is still diagnosable', () => {
    expect(deriveRetryKey(base, 'payment-1').startsWith(`${base}:r`)).toBe(true);
  });
});

describe('resolveIdempotencyKey', () => {
  const base = derivePaymentIdempotencyKey(BASE_INPUT);

  it('returns the base key untouched when nothing has used it', async () => {
    const lookup = vi.fn().mockResolvedValue(null);

    const result = await resolveIdempotencyKey(lookup, BASE_INPUT);

    expect(result).toEqual({ kind: 'fresh', key: base });
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith(base);
  });

  it('reuses a pending payment instead of opening a second one', async () => {
    const pending = payment({ id: 'pending-1', status: 'pending' });
    const lookup = vi.fn().mockResolvedValue(pending);

    const result = await resolveIdempotencyKey(lookup, BASE_INPUT);

    expect(result).toEqual({ kind: 'reuse', key: base, existing: pending });
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('walks past a completed payment so the user is not locked out of a second vote', async () => {
    const completed = payment({ id: 'completed-1', status: 'completed' });
    const lookup = vi
      .fn()
      .mockResolvedValueOnce(completed)
      .mockResolvedValueOnce(null);

    const result = await resolveIdempotencyKey(lookup, BASE_INPUT);

    expect(result).toEqual({ kind: 'fresh', key: deriveRetryKey(base, 'completed-1') });
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it('treats a failed payment as spent, exactly like a completed one', async () => {
    const failed = payment({ id: 'failed-1', status: 'failed' });
    const lookup = vi.fn().mockResolvedValueOnce(failed).mockResolvedValueOnce(null);

    const result = await resolveIdempotencyKey(lookup, BASE_INPUT);

    expect(result).toEqual({ kind: 'fresh', key: deriveRetryKey(base, 'failed-1') });
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it('treats a refunded payment as spent too', async () => {
    const refunded = payment({ id: 'refunded-1', status: 'refunded' });
    const lookup = vi.fn().mockResolvedValueOnce(refunded).mockResolvedValueOnce(null);

    const result = await resolveIdempotencyKey(lookup, BASE_INPUT);

    expect(result).toEqual({ kind: 'fresh', key: deriveRetryKey(base, 'refunded-1') });
  });

  it('gives up rather than looping when every key in the chain is spent', async () => {
    let hop = 0;
    const lookup = vi.fn(async () => payment({ id: `spent-${hop++}`, status: 'completed' }));

    const result = await resolveIdempotencyKey(lookup, BASE_INPUT);

    expect(result).toEqual({ kind: 'exhausted' });
    expect(lookup).toHaveBeenCalledTimes(MAX_IDEMPOTENCY_CHAIN);
  });

  it('is deterministic across two independent resolutions of the same spent state', async () => {
    const completed = payment({ id: 'completed-1', status: 'completed' });
    const makeLookup = () =>
      vi.fn().mockResolvedValueOnce(completed).mockResolvedValueOnce(null);

    const first = await resolveIdempotencyKey(makeLookup(), BASE_INPUT);
    const second = await resolveIdempotencyKey(makeLookup(), BASE_INPUT);

    expect(first).toEqual(second);
  });
});

/** Strip // and block comments so prose about the change is not read as live code. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

describe('the route no longer trusts the clock or the client', () => {
  const routeCode = code(
    readFileSync(join(process.cwd(), 'src/app/api/payments/create/route.ts'), 'utf8')
  );

  it('reads no clock when building the key', () => {
    expect(routeCode).not.toContain('Date.now(');
  });

  it('accepts no client-supplied idempotency key', () => {
    expect(routeCode).not.toContain('body.idempotencyKey');
    expect(routeCode).not.toMatch(/\bidempotencyKey\b/);
  });

  it('delegates the decision to the derivation module', () => {
    expect(routeCode).toContain('resolveIdempotencyKey');
  });

  it('answers an exhausted chain with a 409 rather than a 500', () => {
    expect(routeCode).toContain('409');
  });
});
