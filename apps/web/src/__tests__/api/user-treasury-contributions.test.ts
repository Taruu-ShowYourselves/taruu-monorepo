/**
 * User Treasury Contributions API Route Tests
 *
 * Tests for GET /api/user/treasury-contributions — the private, session-scoped
 * replacement for the dashboard's old "fetch the whole municipality ledger and
 * filter it in the browser" flow.
 *
 * The security contract under test:
 * - ownership is enforced in SQL, never by the caller;
 * - there is no municipality parameter, so nothing can be enumerated;
 * - rows with a NULL user_id belong to nobody and can never be attributed;
 * - the response carries no user or payment identifiers.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/user/treasury-contributions/route';

// Mock session service
vi.mock('@/services/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  getUserTreasuryTransactions: vi.fn(),
}));

// Import mocked modules
import { getSessionFromRequest } from '@/services/auth/session';
import { getUserTreasuryTransactions } from '@/lib/supabase/db';

describe('GET /api/user/treasury-contributions', () => {
  const mockSession = {
    userId: 'user-123',
    googleId: 'google-123',
    email: 'test@example.com',
    did: 'did:sync:' + 'a'.repeat(43),
    expiresAt: Date.now() + 86400000,
  };

  const ownTransactions = [
    {
      id: 'tx-1',
      type: 'deposit',
      treasury_id: 'treasury-123',
      vote_id: 'vote-1',
      user_id: 'user-123',
      payment_id: 'payment-1',
      amount_ils: 200,
      amount_sol: null,
      description: 'ניתוב לקרן',
      bags_tx_hash: null,
      status: 'confirmed',
      metadata: null,
      created_at: '2025-01-15T10:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated access', async () => {
    (getSessionFromRequest as Mock).mockResolvedValue(null);

    const request = new NextRequest(
      'http://localhost:3000/api/user/treasury-contributions'
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(getUserTreasuryTransactions).not.toHaveBeenCalled();
  });

  it('scopes the query to the session user, not to anything caller-supplied', async () => {
    (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
    (getUserTreasuryTransactions as Mock).mockResolvedValue(ownTransactions);

    // A caller trying to smuggle in another identity or municipality.
    const request = new NextRequest(
      'http://localhost:3000/api/user/treasury-contributions?userId=user-999&municipality=haifa'
    );
    await GET(request);

    expect(getUserTreasuryTransactions).toHaveBeenCalledTimes(1);
    expect(getUserTreasuryTransactions).toHaveBeenCalledWith('user-123', {
      limit: 50,
      offset: 0,
      type: undefined,
    });
  });

  it('User A cannot see User B\'s transactions', async () => {
    (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
    // The DB helper filters by user_id; simulate that it returns nothing for a
    // user with no contributions of their own.
    (getUserTreasuryTransactions as Mock).mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost:3000/api/user/treasury-contributions'
    );
    const data = await (await GET(request)).json();

    expect(data.transactions).toEqual([]);
    // The user id passed to the query is the session's, so User B's rows are
    // excluded in SQL rather than in the response mapping.
    expect(getUserTreasuryTransactions).toHaveBeenCalledWith(
      'user-123',
      expect.any(Object)
    );
  });

  it('cannot be pointed at another municipality', async () => {
    (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
    (getUserTreasuryTransactions as Mock).mockResolvedValue(ownTransactions);

    const request = new NextRequest(
      'http://localhost:3000/api/user/treasury-contributions?municipality=jerusalem'
    );
    await GET(request);

    // Only the user id reaches the query — there is no municipality argument at
    // all, so there is no municipality to enumerate.
    const [, options] = (getUserTreasuryTransactions as Mock).mock.calls[0];
    expect(options).not.toHaveProperty('municipality');
    expect(Object.keys(options).sort()).toEqual(['limit', 'offset', 'type']);
  });

  it('does not expose user or payment identifiers', async () => {
    (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
    (getUserTreasuryTransactions as Mock).mockResolvedValue(ownTransactions);

    const request = new NextRequest(
      'http://localhost:3000/api/user/treasury-contributions'
    );
    const data = await (await GET(request)).json();

    expect(data.transactions[0]).toEqual({
      id: 'tx-1',
      type: 'deposit',
      voteId: 'vote-1',
      amountILS: 200,
      amountSOL: null,
      description: 'ניתוב לקרן',
      status: 'confirmed',
      createdAt: '2025-01-15T10:00:00Z',
    });

    const body = JSON.stringify(data);
    expect(body).not.toContain('payment-1');
    expect(body).not.toContain('treasury-123');
  });

  it('still returns the caller\'s own contributions for the dashboard', async () => {
    (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
    (getUserTreasuryTransactions as Mock).mockResolvedValue(ownTransactions);

    const request = new NextRequest(
      'http://localhost:3000/api/user/treasury-contributions?type=deposit&limit=50'
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.transactions).toHaveLength(1);
    expect(data.transactions[0].amountILS).toBe(200);
    expect(getUserTreasuryTransactions).toHaveBeenCalledWith('user-123', {
      limit: 50,
      offset: 0,
      type: 'deposit',
    });
  });

  it('rejects an invalid transaction type', async () => {
    (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

    const request = new NextRequest(
      'http://localhost:3000/api/user/treasury-contributions?type=invalid'
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid transaction type');
    expect(getUserTreasuryTransactions).not.toHaveBeenCalled();
  });

  it('clamps limit and offset', async () => {
    (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
    (getUserTreasuryTransactions as Mock).mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost:3000/api/user/treasury-contributions?limit=5000&offset=-10'
    );
    const data = await (await GET(request)).json();

    expect(data.pagination.limit).toBe(100);
    expect(data.pagination.offset).toBe(0);
  });

  describe('hostile pagination parameters', () => {
    // Each case must end up with a finite limit in [1, 100] and offset >= 0,
    // and must never affect which user's rows are queried.
    const cases: { name: string; query: string }[] = [
      { name: 'NaN limit', query: 'limit=abc' },
      { name: 'NaN offset', query: 'offset=abc' },
      { name: 'negative limit', query: 'limit=-5' },
      { name: 'negative offset', query: 'offset=-999' },
      { name: 'zero limit', query: 'limit=0' },
      { name: 'fractional limit', query: 'limit=1.9' },
      { name: 'exponential limit', query: 'limit=1e999' },
      { name: 'excessively large limit', query: 'limit=99999999999999999999' },
      { name: 'excessively large offset', query: 'offset=99999999999999999999' },
      { name: 'repeated limit', query: 'limit=1&limit=5000' },
      { name: 'empty limit', query: 'limit=' },
      { name: 'whitespace limit', query: 'limit=%20%20' },
      { name: 'Infinity limit', query: 'limit=Infinity' },
      { name: 'hex limit', query: 'limit=0x64' },
    ];

    for (const { name, query } of cases) {
      it(`neutralises ${name} without affecting ownership`, async () => {
        (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
        (getUserTreasuryTransactions as Mock).mockResolvedValue([]);

        const request = new NextRequest(
          `http://localhost:3000/api/user/treasury-contributions?${query}`
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);

        const [userId, options] = (getUserTreasuryTransactions as Mock).mock.calls[0];

        // Ownership is untouched by any query parameter.
        expect(userId).toBe('user-123');

        // Limits stay finite and bounded.
        expect(Number.isFinite(options.limit)).toBe(true);
        expect(Number.isInteger(options.limit)).toBe(true);
        expect(options.limit).toBeGreaterThanOrEqual(1);
        expect(options.limit).toBeLessThanOrEqual(100);

        expect(Number.isFinite(options.offset)).toBe(true);
        expect(Number.isInteger(options.offset)).toBe(true);
        expect(options.offset).toBeGreaterThanOrEqual(0);

        // And the response echoes the clamped values, not the caller's.
        expect(data.pagination.limit).toBe(options.limit);
        expect(data.pagination.offset).toBe(options.offset);
      });
    }
  });

  it('handles database errors gracefully', async () => {
    (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
    (getUserTreasuryTransactions as Mock).mockRejectedValue(new Error('Database error'));

    const request = new NextRequest(
      'http://localhost:3000/api/user/treasury-contributions'
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch treasury contributions');
  });
});
