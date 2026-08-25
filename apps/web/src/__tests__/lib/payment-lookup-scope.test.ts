/**
 * `getPaymentByIdempotencyKey` cannot return a payment the caller does not own.
 *
 * The hole this pins shut: `payments.idempotency_key` is UNIQUE across the
 * whole table, and the keys are guessable. `POST /api/payments/create` accepts
 * a caller-supplied `idempotencyKey` verbatim, and the key generated elsewhere
 * in this codebase is `{userId}:{type}:{voteId}` - every component knowable. An
 * unscoped lookup therefore answered "what is payment <key>?" for any
 * authenticated caller, and the route hands the row's id, status, amount and
 * currency straight back in its idempotent response.
 *
 * The proof runs the REAL repository function against a mocked Supabase client,
 * because what is being asserted is the query it builds. A test that stubbed
 * the function would assert nothing: the ownership filter IS the implementation.
 *
 * Two assertions, not one. That the filter is applied (section 1) and that a
 * non-owner gets null rather than an error (section 2) - a thrown error would
 * still be an oracle telling the caller the key exists.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: (table: string) => mockFrom(table) },
}));

import { getPaymentByIdempotencyKey } from '@/lib/supabase/db';

const OWNER = '00000000-0000-4000-8000-00000000own1';
const STRANGER = '00000000-0000-4000-8000-0000000000e2';
const KEY = 'guessable-key';

/**
 * A stand-in for PostgREST's builder that RECORDS the filters instead of
 * assuming their order. `.eq()` chains, so asserting on a fixed call sequence
 * would break on a harmless reordering while proving nothing extra.
 */
interface RecordingBuilder {
  filters: Record<string, unknown>;
  select: (columns: string) => RecordingBuilder;
  eq: (column: string, value: unknown) => RecordingBuilder;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  single: () => Promise<{ data: unknown; error: unknown }>;
}

function chain(result: { data: unknown; error: unknown }): RecordingBuilder {
  const filters: Record<string, unknown> = {};
  const builder: RecordingBuilder = {
    filters,
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      filters[column] = value;
      return builder;
    }),
    maybeSingle: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
  };
  return builder;
}

describe('getPaymentByIdempotencyKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters on the owner as well as the key', async () => {
    const builder = chain({ data: { id: 'payment-1' }, error: null });
    mockFrom.mockReturnValue(builder);

    await getPaymentByIdempotencyKey(KEY, OWNER);

    expect(mockFrom).toHaveBeenCalledWith('payments');
    expect(builder.filters).toEqual({
      idempotency_key: KEY,
      user_id: OWNER,
    });
  });

  it('returns null for a key that belongs to somebody else', async () => {
    // What the database does when the row exists but fails the owner filter:
    // no row, no error. `maybeSingle` is what makes that the shape rather than
    // PGRST116, which `.single()` would have raised.
    const builder = chain({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    const found = await getPaymentByIdempotencyKey(KEY, STRANGER);

    expect(found).toBeNull();
    expect(builder.filters.user_id).toBe(STRANGER);
  });

  // A query failure is not an absent row, and must not be reported as one.
  // `maybeSingle` already renders "no such row" as data:null with no error, so
  // a non-null error means the query did not run. Answering null there would
  // tell the caller the key is free during an outage and send it on to an
  // insert - turning an infrastructure failure into a uniqueness error, or a
  // second payment.
  it('throws when the query itself fails rather than reporting absence', async () => {
    const builder = chain({ data: null, error: { message: 'connection reset' } });
    mockFrom.mockReturnValue(builder);

    await expect(
      getPaymentByIdempotencyKey(KEY, OWNER)
    ).rejects.toThrow(/connection reset/);
  });

  it('still finds the owner their own payment', async () => {
    const row = { id: 'payment-1', user_id: OWNER, status: 'pending' };
    const builder = chain({ data: row, error: null });
    mockFrom.mockReturnValue(builder);

    await expect(getPaymentByIdempotencyKey(KEY, OWNER)).resolves.toEqual(row);
  });
});
