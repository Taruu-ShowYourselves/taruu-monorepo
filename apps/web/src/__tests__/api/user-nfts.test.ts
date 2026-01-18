/**
 * User NFTs API Route Tests
 *
 * Tests for the /api/user/nfts endpoint:
 * - GET /api/user/nfts - Get user's NFT collection
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/user/nfts/route';

// Mock session service
vi.mock('@/services/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  getUserByGoogleId: vi.fn(),
}));

// Mock Supabase admin client
const mockRange = vi.fn();
const mockOrder = vi.fn(() => ({ range: mockRange }));
const mockEq = vi.fn(() => ({ eq: mockEq, order: mockOrder }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockIn = vi.fn(() => Promise.resolve({ data: [], error: null }));
const mockFrom = vi.fn(() => ({ select: mockSelect, in: mockIn }));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: (table: string) => mockFrom(table),
  },
}));

// Import mocked modules
import { getSessionFromRequest } from '@/services/auth/session';
import { getUserByGoogleId } from '@/lib/supabase/db';

describe('User NFTs API Routes', () => {
  const mockSession = {
    userId: 'user-123',
    googleId: 'google-123',
    email: 'test@example.com',
    did: 'did:sync:' + 'a'.repeat(43),
    expiresAt: Date.now() + 86400000,
  };

  const mockUser = {
    id: 'user-123',
    google_id: 'google-123',
    email: 'test@example.com',
  };

  const mockNfts = [
    {
      id: 'nft-1',
      vote_id: 'vote-1',
      type: 'verified_voter',
      mint_address: 'MintAddress123',
      metadata: { image: 'https://example.com/nft1.png', name: 'Custom Name' },
      minted_at: '2025-01-15T10:00:00Z',
    },
    {
      id: 'nft-2',
      vote_id: 'vote-2',
      type: 'civic_patron',
      mint_address: 'MintAddress456',
      metadata: null,
      minted_at: '2025-01-16T10:00:00Z',
    },
  ];

  const mockVotes = [
    { id: 'vote-1', title: 'Test Vote 1', municipality_id: 'tel-aviv' },
    { id: 'vote-2', title: 'Test Vote 2', municipality_id: 'jerusalem' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockRange.mockReset();
    mockOrder.mockReset().mockImplementation(() => ({ range: mockRange }));
    mockEq.mockReset().mockImplementation(() => ({ eq: mockEq, order: mockOrder }));
    mockSelect.mockReset().mockImplementation(() => ({ eq: mockEq }));
    mockFrom.mockReset();
  });

  describe('GET /api/user/nfts', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/nfts');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when user not found', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/nfts');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });

    it('should return NFTs with vote details', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);

      mockFrom.mockImplementation((table: string) => {
        if (table === 'vote_nfts') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    range: () => Promise.resolve({ data: mockNfts, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'votes') {
          return {
            select: () => ({
              in: () => Promise.resolve({ data: mockVotes, error: null }),
            }),
          };
        }
        // For count query
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ count: 2, error: null }),
            }),
          }),
        };
      });

      const request = new NextRequest('http://localhost:3000/api/user/nfts');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.nfts).toHaveLength(2);
      expect(data.nfts[0]).toMatchObject({
        id: 'nft-1',
        type: 'verified_voter',
        voteId: 'vote-1',
        voteTitle: 'Test Vote 1',
        municipality: 'tel-aviv',
        mintAddress: 'MintAddress123',
        imageUrl: 'https://example.com/nft1.png',
        displayName: 'Custom Name',
      });
    });

    it('should use CDN fallback for missing image', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);

      mockFrom.mockImplementation((table: string) => {
        if (table === 'vote_nfts') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    range: () => Promise.resolve({ data: [mockNfts[1]], error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'votes') {
          return {
            select: () => ({
              in: () => Promise.resolve({ data: mockVotes, error: null }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ count: 1, error: null }),
            }),
          }),
        };
      });

      const request = new NextRequest('http://localhost:3000/api/user/nfts');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.nfts[0].imageUrl).toBe('https://cdn.taruu.co.il/nfts/vote-2/civic_patron.png');
    });

    it('should return 400 for invalid limit parameter', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/user/nfts?limit=999');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid parameters');
    });

    it('should return 400 for invalid offset parameter', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/user/nfts?offset=-1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid parameters');
    });

    it('should return 400 for invalid type parameter', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/user/nfts?type=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid parameters');
    });

    it('should filter by type parameter', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);

      // Create a chainable query mock that is also thenable (Promise-like)
      // This allows both chaining and awaiting at any point
      const createChainableQuery = (data: unknown) => {
        const queryBuilder: Record<string, unknown> = {
          // Make it thenable - can be awaited at any point in the chain
          then: (resolve: (value: { data: unknown; error: null }) => void) => {
            resolve({ data, error: null });
          },
        };
        // All methods return the same builder for chaining
        queryBuilder.eq = () => queryBuilder;
        queryBuilder.order = () => queryBuilder;
        queryBuilder.range = () => queryBuilder;
        return queryBuilder;
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'vote_nfts') {
          return {
            select: () => createChainableQuery([mockNfts[0]]),
          };
        }
        if (table === 'votes') {
          return {
            select: () => ({
              in: () => Promise.resolve({ data: mockVotes, error: null }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ count: 1, error: null }),
            }),
          }),
        };
      });

      const request = new NextRequest('http://localhost:3000/api/user/nfts?type=verified_voter');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should filter by municipality parameter', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);

      mockFrom.mockImplementation((table: string) => {
        if (table === 'vote_nfts') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    range: () => Promise.resolve({ data: mockNfts, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'votes') {
          return {
            select: () => ({
              in: () => Promise.resolve({ data: mockVotes, error: null }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ count: 2, error: null }),
            }),
          }),
        };
      });

      const request = new NextRequest('http://localhost:3000/api/user/nfts?municipality=tel-aviv');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should filter to only Tel Aviv NFTs
      expect(data.nfts.every((nft: { municipality: string }) => nft.municipality === 'tel-aviv')).toBe(true);
    });

    it('should return empty array when user has no NFTs', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);

      mockFrom.mockImplementation((table: string) => {
        if (table === 'vote_nfts') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    range: () => Promise.resolve({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ count: 0, error: null }),
            }),
          }),
        };
      });

      const request = new NextRequest('http://localhost:3000/api/user/nfts');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.nfts).toEqual([]);
      expect(data.total).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);

      mockFrom.mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                range: () => Promise.resolve({ data: null, error: { message: 'Database error' } }),
              }),
            }),
          }),
        }),
      }));

      const request = new NextRequest('http://localhost:3000/api/user/nfts');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});
