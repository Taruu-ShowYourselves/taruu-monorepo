/**
 * Vote Resolution API Route Tests
 *
 * Tests for the /api/votes/[id]/resolution endpoint:
 * - GET /api/votes/[id]/resolution - Get vote resolution status
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/votes/[id]/resolution/route';

// Mock Supabase admin client
const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: (table: string) => mockFrom(table),
  },
}));

describe('Vote Resolution API Routes', () => {
  const mockVote = {
    id: 'vote-123',
    title: 'Test Vote',
    status: 'resolved',
    resolution_status: 'resolved',
    resolved_at: '2025-01-20T12:00:00Z',
  };

  const mockIssueCoin = {
    id: 'coin-456',
    vote_id: 'vote-123',
    is_frozen: true,
    frozen_at: '2025-01-20T11:00:00Z',
  };

  const mockNfts = [
    { type: 'verified_voter', status: 'minted' },
    { type: 'verified_voter', status: 'minted' },
    { type: 'verified_voter', status: 'pending' },
    { type: 'civic_patron', status: 'minted' },
    { type: 'civic_patron', status: 'failed' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock chain
    mockSingle.mockReset();
    mockEq.mockReset().mockImplementation(() => ({ single: mockSingle }));
    mockSelect.mockReset().mockImplementation(() => ({ eq: mockEq }));
    mockFrom.mockReset().mockImplementation(() => ({ select: mockSelect }));
  });

  describe('GET /api/votes/[id]/resolution', () => {
    it('should return full resolution status for resolved vote', async () => {
      // Setup mock chain for votes table
      mockFrom.mockImplementation((table: string) => {
        if (table === 'votes') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: mockVote, error: null }),
              }),
            }),
          };
        }
        if (table === 'issue_coins') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: mockIssueCoin, error: null }),
              }),
            }),
          };
        }
        if (table === 'vote_nfts') {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: mockNfts, error: null }),
            }),
          };
        }
        return { select: mockSelect };
      });

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/resolution');
      const response = await GET(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('resolved');
      expect(data.resolvedAt).toBe('2025-01-20T12:00:00Z');
      expect(data.issueCoin).toBeDefined();
      expect(data.issueCoin.frozen).toBe(true);
      expect(data.issueCoin.frozenAt).toBe('2025-01-20T11:00:00Z');
      expect(data.nfts).toEqual({
        verifiedVoters: 3,
        civicPatrons: 2,
        total: 5,
        minted: 3,
        pending: 1,
        failed: 1,
      });
    });

    it('should return pending status for unresolved vote', async () => {
      const pendingVote = {
        ...mockVote,
        status: 'active',
        resolution_status: null,
        resolved_at: null,
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'votes') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: pendingVote, error: null }),
              }),
            }),
          };
        }
        if (table === 'issue_coins') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          };
        }
        if (table === 'vote_nfts') {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: [], error: null }),
            }),
          };
        }
        return { select: mockSelect };
      });

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/resolution');
      const response = await GET(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('pending');
      expect(data.resolvedAt).toBeUndefined();
      expect(data.issueCoin).toBeUndefined();
      expect(data.nfts.total).toBe(0);
    });

    it('should return 404 when vote not found', async () => {
      mockFrom.mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: { code: 'PGRST116' } }),
          }),
        }),
      }));

      const request = new NextRequest('http://localhost:3000/api/votes/nonexistent/resolution');
      const response = await GET(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Vote not found');
    });

    it('should handle vote without Issue Coin', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'votes') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: mockVote, error: null }),
              }),
            }),
          };
        }
        if (table === 'issue_coins') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          };
        }
        if (table === 'vote_nfts') {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: mockNfts.slice(0, 3), error: null }),
            }),
          };
        }
        return { select: mockSelect };
      });

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/resolution');
      const response = await GET(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.issueCoin).toBeUndefined();
    });

    it('should handle resolving status', async () => {
      const resolvingVote = {
        ...mockVote,
        status: 'resolving',
        resolution_status: 'resolving',
        resolved_at: null,
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'votes') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: resolvingVote, error: null }),
              }),
            }),
          };
        }
        if (table === 'issue_coins') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { ...mockIssueCoin, is_frozen: false, frozen_at: null }, error: null }),
              }),
            }),
          };
        }
        if (table === 'vote_nfts') {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: [{ type: 'verified_voter', status: 'pending' }], error: null }),
            }),
          };
        }
        return { select: mockSelect };
      });

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/resolution');
      const response = await GET(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('resolving');
      expect(data.nfts.pending).toBe(1);
    });

    it('should handle failed resolution status', async () => {
      const failedVote = {
        ...mockVote,
        status: 'failed',
        resolution_status: 'failed',
        resolved_at: '2025-01-20T12:00:00Z',
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'votes') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: failedVote, error: null }),
              }),
            }),
          };
        }
        if (table === 'issue_coins') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: mockIssueCoin, error: null }),
              }),
            }),
          };
        }
        if (table === 'vote_nfts') {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: mockNfts.filter(n => n.status === 'failed'), error: null }),
            }),
          };
        }
        return { select: mockSelect };
      });

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/resolution');
      const response = await GET(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('failed');
    });

    it('should handle NFT query errors gracefully', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'votes') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: mockVote, error: null }),
              }),
            }),
          };
        }
        if (table === 'issue_coins') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: mockIssueCoin, error: null }),
              }),
            }),
          };
        }
        if (table === 'vote_nfts') {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: null, error: { message: 'Query failed' } }),
            }),
          };
        }
        return { select: mockSelect };
      });

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/resolution');
      const response = await GET(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      // Should still return 200 with zero NFT counts
      expect(response.status).toBe(200);
      expect(data.nfts.total).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      mockFrom.mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: { code: 'CONNECTION_ERROR', message: 'Database unavailable' } }),
          }),
        }),
      }));

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/resolution');
      const response = await GET(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('should not require authentication (public endpoint)', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'votes') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: mockVote, error: null }),
              }),
            }),
          };
        }
        if (table === 'issue_coins') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          };
        }
        if (table === 'vote_nfts') {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: [], error: null }),
            }),
          };
        }
        return { select: mockSelect };
      });

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/resolution');
      const response = await GET(request, { params: Promise.resolve({ id: 'vote-123' }) });

      expect(response.status).toBe(200);
    });
  });
});
