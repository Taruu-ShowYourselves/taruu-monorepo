/**
 * Treasury Transactions API Route Tests
 *
 * Tests for the /api/treasury/[municipality]/transactions endpoint:
 * - GET /api/treasury/[municipality]/transactions - Get treasury transaction history
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/treasury/[municipality]/transactions/route';

// Mock session service
vi.mock('@/services/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  getTreasuryByMunicipality: vi.fn(),
  getTreasuryTransactions: vi.fn(),
}));

// Import mocked modules
import { getSessionFromRequest } from '@/services/auth/session';
import { getTreasuryByMunicipality, getTreasuryTransactions } from '@/lib/supabase/db';

describe('Treasury Transactions API Routes', () => {
  const mockSession = {
    userId: 'user-123',
    googleId: 'google-123',
    email: 'test@example.com',
    did: 'did:sync:' + 'a'.repeat(43),
    expiresAt: Date.now() + 86400000,
  };

  const mockTreasury = {
    id: 'treasury-123',
    municipality_id: 'tel-aviv',
    wallet_address: 'TreasuryWallet123',
    balance_ils: 50000,
    balance_sol: 2.5,
  };

  const mockTransactions = [
    {
      id: 'tx-1',
      type: 'deposit',
      vote_id: 'vote-1',
      user_id: 'user-1',
      payment_id: 'payment-1',
      amount_ils: 1000,
      amount_sol: null,
      description: 'Vote participation',
      bags_tx_hash: null,
      status: 'completed',
      metadata: null,
      created_at: '2025-01-15T10:00:00Z',
    },
    {
      id: 'tx-2',
      type: 'token_purchase',
      vote_id: 'vote-1',
      user_id: 'user-2',
      payment_id: 'payment-2',
      amount_ils: 500,
      amount_sol: 0.05,
      description: 'Issue Coin purchase',
      bags_tx_hash: 'BagsTx123',
      status: 'completed',
      metadata: { tokenAmount: '50000000' },
      created_at: '2025-01-15T11:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/treasury/[municipality]/transactions', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/treasury/tel-aviv/transactions');
      const response = await GET(request, { params: Promise.resolve({ municipality: 'tel-aviv' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 when municipality is empty', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/treasury//transactions');
      const response = await GET(request, { params: Promise.resolve({ municipality: '' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Municipality is required');
    });

    it('should return empty list when treasury does not exist', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getTreasuryByMunicipality as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/treasury/new-city/transactions');
      const response = await GET(request, { params: Promise.resolve({ municipality: 'new-city' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.transactions).toEqual([]);
      expect(data.pagination.total).toBe(0);
    });

    it('should return transactions with default pagination', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getTreasuryByMunicipality as Mock).mockResolvedValue(mockTreasury);
      (getTreasuryTransactions as Mock).mockResolvedValue(mockTransactions);

      const request = new NextRequest('http://localhost:3000/api/treasury/tel-aviv/transactions');
      const response = await GET(request, { params: Promise.resolve({ municipality: 'tel-aviv' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.transactions).toHaveLength(2);
      expect(data.pagination.limit).toBe(50);
      expect(data.pagination.offset).toBe(0);
      expect(getTreasuryTransactions).toHaveBeenCalledWith(mockTreasury.id, {
        limit: 50,
        offset: 0,
        type: undefined,
      });
    });

    it('should transform transaction fields correctly', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getTreasuryByMunicipality as Mock).mockResolvedValue(mockTreasury);
      (getTreasuryTransactions as Mock).mockResolvedValue(mockTransactions);

      const request = new NextRequest('http://localhost:3000/api/treasury/tel-aviv/transactions');
      const response = await GET(request, { params: Promise.resolve({ municipality: 'tel-aviv' }) });
      const data = await response.json();

      expect(data.transactions[0]).toEqual({
        id: 'tx-1',
        type: 'deposit',
        voteId: 'vote-1',
        userId: 'user-1',
        paymentId: 'payment-1',
        amountILS: 1000,
        amountSOL: null,
        description: 'Vote participation',
        bagsTxHash: null,
        status: 'completed',
        metadata: null,
        createdAt: '2025-01-15T10:00:00Z',
      });
    });

    it('should respect limit parameter', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getTreasuryByMunicipality as Mock).mockResolvedValue(mockTreasury);
      (getTreasuryTransactions as Mock).mockResolvedValue([mockTransactions[0]]);

      const request = new NextRequest('http://localhost:3000/api/treasury/tel-aviv/transactions?limit=1');
      const response = await GET(request, { params: Promise.resolve({ municipality: 'tel-aviv' }) });
      const data = await response.json();

      expect(data.pagination.limit).toBe(1);
      expect(getTreasuryTransactions).toHaveBeenCalledWith(mockTreasury.id, {
        limit: 1,
        offset: 0,
        type: undefined,
      });
    });

    it('should cap limit at 100', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getTreasuryByMunicipality as Mock).mockResolvedValue(mockTreasury);
      (getTreasuryTransactions as Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/treasury/tel-aviv/transactions?limit=500');
      const response = await GET(request, { params: Promise.resolve({ municipality: 'tel-aviv' }) });
      const data = await response.json();

      expect(data.pagination.limit).toBe(100);
    });

    it('should respect offset parameter', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getTreasuryByMunicipality as Mock).mockResolvedValue(mockTreasury);
      (getTreasuryTransactions as Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/treasury/tel-aviv/transactions?offset=10');
      const response = await GET(request, { params: Promise.resolve({ municipality: 'tel-aviv' }) });
      const data = await response.json();

      expect(data.pagination.offset).toBe(10);
      expect(getTreasuryTransactions).toHaveBeenCalledWith(mockTreasury.id, {
        limit: 50,
        offset: 10,
        type: undefined,
      });
    });

    it('should filter by transaction type', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getTreasuryByMunicipality as Mock).mockResolvedValue(mockTreasury);
      (getTreasuryTransactions as Mock).mockResolvedValue([mockTransactions[0]]);

      const request = new NextRequest('http://localhost:3000/api/treasury/tel-aviv/transactions?type=deposit');
      const response = await GET(request, { params: Promise.resolve({ municipality: 'tel-aviv' }) });

      expect(response.status).toBe(200);
      expect(getTreasuryTransactions).toHaveBeenCalledWith(mockTreasury.id, {
        limit: 50,
        offset: 0,
        type: 'deposit',
      });
    });

    it('should return 400 for invalid transaction type', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getTreasuryByMunicipality as Mock).mockResolvedValue(mockTreasury);

      const request = new NextRequest('http://localhost:3000/api/treasury/tel-aviv/transactions?type=invalid');
      const response = await GET(request, { params: Promise.resolve({ municipality: 'tel-aviv' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid transaction type');
    });

    it('should accept all valid transaction types', async () => {
      const validTypes = ['deposit', 'allocation', 'withdrawal', 'fee_claim', 'token_purchase', 'nft_mint'];

      for (const type of validTypes) {
        vi.clearAllMocks();
        (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
        (getTreasuryByMunicipality as Mock).mockResolvedValue(mockTreasury);
        (getTreasuryTransactions as Mock).mockResolvedValue([]);

        const request = new NextRequest(`http://localhost:3000/api/treasury/tel-aviv/transactions?type=${type}`);
        const response = await GET(request, { params: Promise.resolve({ municipality: 'tel-aviv' }) });

        expect(response.status).toBe(200);
        expect(getTreasuryTransactions).toHaveBeenCalledWith(mockTreasury.id, {
          limit: 50,
          offset: 0,
          type,
        });
      }
    });

    it('should handle Hebrew municipality names', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getTreasuryByMunicipality as Mock).mockResolvedValue({ ...mockTreasury, municipality_id: 'תל אביב-יפו' });
      (getTreasuryTransactions as Mock).mockResolvedValue([]);

      const request = new NextRequest(`http://localhost:3000/api/treasury/${encodeURIComponent('תל אביב-יפו')}/transactions`);
      const response = await GET(request, { params: Promise.resolve({ municipality: 'תל אביב-יפו' }) });

      expect(response.status).toBe(200);
      expect(getTreasuryByMunicipality).toHaveBeenCalledWith('תל אביב-יפו');
    });

    it('should handle database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getTreasuryByMunicipality as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/treasury/tel-aviv/transactions');
      const response = await GET(request, { params: Promise.resolve({ municipality: 'tel-aviv' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch treasury transactions');
    });
  });
});
