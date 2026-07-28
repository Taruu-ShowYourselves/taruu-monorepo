/**
 * Treasury Transaction Scoping Tests (DB layer)
 *
 * `getUserTreasuryTransactions` is the only supported way to build a user's
 * personal contribution ledger. Its guarantee is that ownership is enforced by
 * the query itself:
 *
 *   .eq('user_id', userId)
 *
 * Because SQL equality never matches NULL, this also means rows with a NULL
 * `user_id` — treasury movements that belong to nobody, e.g. platform-side
 * allocations — can never be attributed to the caller. The dashboard used to
 * get this wrong by filtering in the browser with
 * `!t.userId || t.userId === user.id`, which counted every ownerless row as the
 * reader's own contribution.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const eq = vi.fn();
const order = vi.fn();
const range = vi.fn();
const select = vi.fn();
const from = vi.fn();

// Chainable PostgREST query-builder stub that records the calls made on it and
// finally resolves to `{ data, error }`.
function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const chain = (spy: ReturnType<typeof vi.fn>) => (...args: unknown[]) => {
    spy(...args);
    return builder;
  };

  builder.select = chain(select);
  builder.eq = chain(eq);
  builder.order = chain(order);
  builder.range = chain(range);
  // Awaiting the builder resolves the query.
  builder.then = (resolve: (value: unknown) => unknown) => resolve(result);

  return builder;
}

let queryResult: { data: unknown; error: unknown } = { data: [], error: null };

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      from(table);
      return makeQueryBuilder(queryResult);
    },
  },
}));

import {
  getUserTreasuryTransactions,
  getTreasuryTransactions,
} from '@/lib/supabase/db';

describe('getUserTreasuryTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResult = { data: [], error: null };
  });

  it('filters on user_id so another user\'s rows are excluded in SQL', async () => {
    await getUserTreasuryTransactions('user-123');

    expect(from).toHaveBeenCalledWith('treasury_transactions');
    expect(eq).toHaveBeenCalledWith('user_id', 'user-123');
  });

  it('never filters by treasury/municipality, so nothing can be enumerated', async () => {
    await getUserTreasuryTransactions('user-123');

    const filteredColumns = eq.mock.calls.map(([column]) => column);
    expect(filteredColumns).toEqual(['user_id']);
    expect(filteredColumns).not.toContain('treasury_id');
  });

  it('applies the type filter in addition to — never instead of — the owner filter', async () => {
    await getUserTreasuryTransactions('user-123', { type: 'deposit' });

    expect(eq).toHaveBeenCalledWith('user_id', 'user-123');
    expect(eq).toHaveBeenCalledWith('type', 'deposit');
  });

  it('returns an empty list rather than null when the user has no contributions', async () => {
    queryResult = { data: null, error: null };

    await expect(getUserTreasuryTransactions('user-123')).resolves.toEqual([]);
  });

  it('propagates query errors instead of silently returning rows', async () => {
    queryResult = { data: null, error: new Error('boom') };

    await expect(getUserTreasuryTransactions('user-123')).rejects.toBeTruthy();
  });
});

describe('getTreasuryTransactions (municipality-wide ledger)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResult = { data: [], error: null };
  });

  it('scopes to the treasury and deliberately does NOT filter by user', async () => {
    await getTreasuryTransactions('treasury-123');

    const filteredColumns = eq.mock.calls.map(([column]) => column);
    expect(filteredColumns).toEqual(['treasury_id']);
    expect(filteredColumns).not.toContain('user_id');
  });
});
