/**
 * Issue Coin API Route Tests
 *
 * Tests for the /api/votes/[id]/issue-coin endpoints:
 * - GET /api/votes/[id]/issue-coin - Get Issue Coin details
 * - GET /api/votes/[id]/issue-coin/holders - Get Issue Coin holders
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getIssueCoin } from '@/app/api/votes/[id]/issue-coin/route';
import { GET as getHolders } from '@/app/api/votes/[id]/issue-coin/holders/route';

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  getVoteById: vi.fn(),
  getIssueCoinByVoteId: vi.fn(),
  countIssueCoinHolders: vi.fn(),
  getIssueCoinHolders: vi.fn(),
}));

// Import mocked modules
import {
  getVoteById,
  getIssueCoinByVoteId,
  countIssueCoinHolders,
  getIssueCoinHolders,
} from '@/lib/supabase/db';

describe('Issue Coin API Routes', () => {
  const mockVote = {
    id: 'vote-123',
    title: 'Test Vote',
    status: 'active',
  };

  const mockIssueCoin = {
    id: 'coin-456',
    vote_id: 'vote-123',
    token_mint: 'So1AnAT0kEnMiNtAdDrEsS123456789',
    token_name: 'Test Vote Token',
    token_symbol: 'TVT',
    token_decimals: 9,
    total_supply: '1000000000000',
    total_purchased: '500000000000',
    total_value_ils: 25000,
    trading_enabled: true,
    is_frozen: false,
    frozen_at: null,
    launch_tx_hash: 'Tx123456789',
    fee_share_configured: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-15T00:00:00Z',
  };

  const mockHolders = [
    {
      id: 'holder-1',
      wallet_address: 'SoLaNaWaLLeT123456789AbCdEfGhIj',
      token_amount: '100000000',
      invested_ils: 500,
      is_local_resident: true,
      nft_minted: false,
      first_purchase_at: '2025-01-05T00:00:00Z',
      last_purchase_at: '2025-01-10T00:00:00Z',
      users: null,
    },
    {
      id: 'holder-2',
      wallet_address: null,
      token_amount: '200000000',
      invested_ils: 1000,
      is_local_resident: true,
      nft_minted: true,
      first_purchase_at: '2025-01-02T00:00:00Z',
      last_purchase_at: '2025-01-08T00:00:00Z',
      users: { first_name: 'John', last_name: 'Doe' },
    },
    {
      id: 'holder-3',
      wallet_address: null,
      token_amount: '50000000',
      invested_ils: 250,
      is_local_resident: false,
      nft_minted: false,
      first_purchase_at: '2025-01-12T00:00:00Z',
      last_purchase_at: '2025-01-12T00:00:00Z',
      users: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/votes/[id]/issue-coin', () => {
    it('should return Issue Coin details successfully', async () => {
      (getVoteById as Mock).mockResolvedValue(mockVote);
      (getIssueCoinByVoteId as Mock).mockResolvedValue(mockIssueCoin);
      (countIssueCoinHolders as Mock).mockResolvedValue(15);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/issue-coin');
      const response = await getIssueCoin(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.issueCoin).toBeDefined();
      expect(data.issueCoin.id).toBe('coin-456');
      expect(data.issueCoin.voteId).toBe('vote-123');
      expect(data.issueCoin.tokenMint).toBe('So1AnAT0kEnMiNtAdDrEsS123456789');
      expect(data.issueCoin.tokenName).toBe('Test Vote Token');
      expect(data.issueCoin.tokenSymbol).toBe('TVT');
      expect(data.issueCoin.tokenDecimals).toBe(9);
      expect(data.issueCoin.totalSupply).toBe('1000000000000');
      expect(data.issueCoin.totalPurchased).toBe('500000000000');
      expect(data.issueCoin.totalValueILS).toBe(25000);
      expect(data.issueCoin.tradingEnabled).toBe(true);
      expect(data.issueCoin.isFrozen).toBe(false);
      expect(data.issueCoin.holderCount).toBe(15);
    });

    it('should return null when no Issue Coin exists', async () => {
      (getVoteById as Mock).mockResolvedValue(mockVote);
      (getIssueCoinByVoteId as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/issue-coin');
      const response = await getIssueCoin(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.issueCoin).toBeNull();
      expect(data.message).toBe('No Issue Coin has been created for this vote');
    });

    it('should return 404 when vote not found', async () => {
      (getVoteById as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/votes/nonexistent/issue-coin');
      const response = await getIssueCoin(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Vote not found');
    });

    it('should handle frozen Issue Coin', async () => {
      const frozenCoin = {
        ...mockIssueCoin,
        is_frozen: true,
        frozen_at: '2025-01-20T12:00:00Z',
      };
      (getVoteById as Mock).mockResolvedValue(mockVote);
      (getIssueCoinByVoteId as Mock).mockResolvedValue(frozenCoin);
      (countIssueCoinHolders as Mock).mockResolvedValue(10);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/issue-coin');
      const response = await getIssueCoin(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.issueCoin.isFrozen).toBe(true);
      expect(data.issueCoin.frozenAt).toBe('2025-01-20T12:00:00Z');
    });

    it('should handle database errors gracefully', async () => {
      (getVoteById as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/issue-coin');
      const response = await getIssueCoin(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch Issue Coin');
    });

    it('should not require authentication (public endpoint)', async () => {
      (getVoteById as Mock).mockResolvedValue(mockVote);
      (getIssueCoinByVoteId as Mock).mockResolvedValue(mockIssueCoin);
      (countIssueCoinHolders as Mock).mockResolvedValue(5);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/issue-coin');
      const response = await getIssueCoin(request, { params: Promise.resolve({ id: 'vote-123' }) });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/votes/[id]/issue-coin/holders', () => {
    it('should return paginated holders list', async () => {
      (getVoteById as Mock).mockResolvedValue(mockVote);
      (getIssueCoinByVoteId as Mock).mockResolvedValue(mockIssueCoin);
      (getIssueCoinHolders as Mock).mockResolvedValue(mockHolders);
      (countIssueCoinHolders as Mock).mockResolvedValue(3);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/issue-coin/holders');
      const response = await getHolders(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.holders).toHaveLength(3);
      expect(data.issueCoin).toBeDefined();
      expect(data.pagination.total).toBe(3);
      expect(data.pagination.limit).toBe(100);
      expect(data.pagination.offset).toBe(0);
      expect(data.pagination.hasMore).toBe(false);
    });

    it('should anonymize wallet addresses', async () => {
      (getVoteById as Mock).mockResolvedValue(mockVote);
      (getIssueCoinByVoteId as Mock).mockResolvedValue(mockIssueCoin);
      (getIssueCoinHolders as Mock).mockResolvedValue(mockHolders);
      (countIssueCoinHolders as Mock).mockResolvedValue(3);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/issue-coin/holders');
      const response = await getHolders(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      // External wallet - truncated (first 4 + last 4 chars)
      expect(data.holders[0].displayName).toBe('SoLa...GhIj');
      // Internal user with name - initials
      expect(data.holders[1].displayName).toBe('J. D.');
      // No wallet, no user - Anonymous
      expect(data.holders[2].displayName).toBe('Anonymous');
    });

    it('should respect limit parameter', async () => {
      (getVoteById as Mock).mockResolvedValue(mockVote);
      (getIssueCoinByVoteId as Mock).mockResolvedValue(mockIssueCoin);
      (getIssueCoinHolders as Mock).mockResolvedValue(mockHolders.slice(0, 2));
      (countIssueCoinHolders as Mock).mockResolvedValue(10);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/issue-coin/holders?limit=2');
      const response = await getHolders(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(data.pagination.limit).toBe(2);
      expect(data.pagination.hasMore).toBe(true);
      expect(getIssueCoinHolders).toHaveBeenCalledWith(mockIssueCoin.id, {
        limit: 2,
        offset: 0,
        residentsOnly: false,
      });
    });

    it('should cap limit at 500', async () => {
      (getVoteById as Mock).mockResolvedValue(mockVote);
      (getIssueCoinByVoteId as Mock).mockResolvedValue(mockIssueCoin);
      (getIssueCoinHolders as Mock).mockResolvedValue([]);
      (countIssueCoinHolders as Mock).mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/issue-coin/holders?limit=1000');
      const response = await getHolders(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(data.pagination.limit).toBe(500);
    });

    it('should respect offset parameter', async () => {
      (getVoteById as Mock).mockResolvedValue(mockVote);
      (getIssueCoinByVoteId as Mock).mockResolvedValue(mockIssueCoin);
      (getIssueCoinHolders as Mock).mockResolvedValue([mockHolders[2]]);
      (countIssueCoinHolders as Mock).mockResolvedValue(10);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/issue-coin/holders?offset=5');
      const response = await getHolders(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(data.pagination.offset).toBe(5);
      expect(getIssueCoinHolders).toHaveBeenCalledWith(mockIssueCoin.id, {
        limit: 100,
        offset: 5,
        residentsOnly: false,
      });
    });

    it('should filter by residents only', async () => {
      (getVoteById as Mock).mockResolvedValue(mockVote);
      (getIssueCoinByVoteId as Mock).mockResolvedValue(mockIssueCoin);
      (getIssueCoinHolders as Mock).mockResolvedValue(mockHolders.filter(h => h.is_local_resident));
      (countIssueCoinHolders as Mock).mockResolvedValue(3);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/issue-coin/holders?residentsOnly=true');
      const response = await getHolders(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(getIssueCoinHolders).toHaveBeenCalledWith(mockIssueCoin.id, {
        limit: 100,
        offset: 0,
        residentsOnly: true,
      });
    });

    it('should return empty list when no Issue Coin exists', async () => {
      (getVoteById as Mock).mockResolvedValue(mockVote);
      (getIssueCoinByVoteId as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/issue-coin/holders');
      const response = await getHolders(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.holders).toEqual([]);
      expect(data.pagination.total).toBe(0);
      expect(data.message).toBe('No Issue Coin has been created for this vote');
    });

    it('should return 404 when vote not found', async () => {
      (getVoteById as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/votes/nonexistent/issue-coin/holders');
      const response = await getHolders(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Vote not found');
    });

    it('should include Issue Coin summary in response', async () => {
      (getVoteById as Mock).mockResolvedValue(mockVote);
      (getIssueCoinByVoteId as Mock).mockResolvedValue(mockIssueCoin);
      (getIssueCoinHolders as Mock).mockResolvedValue(mockHolders);
      (countIssueCoinHolders as Mock).mockResolvedValue(3);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/issue-coin/holders');
      const response = await getHolders(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(data.issueCoin).toEqual({
        id: 'coin-456',
        tokenName: 'Test Vote Token',
        tokenSymbol: 'TVT',
        totalPurchased: '500000000000',
        totalValueILS: 25000,
      });
    });

    it('should handle database errors gracefully', async () => {
      (getVoteById as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/issue-coin/holders');
      const response = await getHolders(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch Issue Coin holders');
    });

    it('should not require authentication (public endpoint)', async () => {
      (getVoteById as Mock).mockResolvedValue(mockVote);
      (getIssueCoinByVoteId as Mock).mockResolvedValue(mockIssueCoin);
      (getIssueCoinHolders as Mock).mockResolvedValue([]);
      (countIssueCoinHolders as Mock).mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/issue-coin/holders');
      const response = await getHolders(request, { params: Promise.resolve({ id: 'vote-123' }) });

      expect(response.status).toBe(200);
    });
  });
});
