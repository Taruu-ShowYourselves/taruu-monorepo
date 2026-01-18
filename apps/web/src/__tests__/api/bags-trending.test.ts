/**
 * Tests for GET /api/bags/trending endpoint
 *
 * This endpoint returns trending Issue Coins for the economics dashboard.
 * Public endpoint - no authentication required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase server with a simpler pattern
const mockFrom = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: () => mockFrom(),
  },
}));

// Import after mocking
import { GET } from '@/app/api/bags/trending/route';

describe('Bags Trending API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/bags/trending', () => {
    it('should return trending Issue Coins successfully', async () => {
      const mockIssueCoins = [
        {
          id: 'ic-1',
          vote_id: 'vote-1',
          token_mint: 'mint-address-1',
          token_name: 'Park Renovation',
          token_symbol: 'TARU-001',
          total_value_ils: 4523000, // in agorot
          created_at: '2025-01-15T10:00:00Z',
          votes: {
            title: 'Park Renovation',
            municipality_id: 'kiryat-tivon',
            thumbnail_url: 'https://example.com/park.jpg',
          },
        },
      ];

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: mockIssueCoins,
                error: null,
              }),
            }),
          }),
        }),
      });

      const request = new Request('http://localhost:3000/api/bags/trending');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.coins).toBeDefined();
      expect(Array.isArray(data.coins)).toBe(true);
      expect(data.coins.length).toBe(1);
      expect(data.coins[0].voteTitle).toBe('Park Renovation');
      expect(data.coins[0].municipality).toBe('kiryat-tivon');
      expect(data.coins[0].totalRaised).toBe(45230); // Converted from agorot to ILS
      expect(data.updatedAt).toBeDefined();
    });

    it('should return empty array when no trending coins exist', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      });

      const request = new Request('http://localhost:3000/api/bags/trending');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.coins).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
              }),
            }),
          }),
        }),
      });

      const request = new Request('http://localhost:3000/api/bags/trending');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch trending coins');
    });

    it('should respect limit parameter', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      });

      const request = new Request('http://localhost:3000/api/bags/trending?limit=5');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should filter by municipality when provided', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const request = new Request(
        'http://localhost:3000/api/bags/trending?municipality=kiryat-tivon'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should cap limit at 50 maximum', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      });

      // Requesting 100 should be capped at 50
      const request = new Request('http://localhost:3000/api/bags/trending?limit=100');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should handle null values gracefully', async () => {
      const mockIssueCoins = [
        {
          id: 'ic-1',
          vote_id: 'vote-1',
          token_mint: 'mint-address-1',
          token_name: 'Test Vote',
          token_symbol: 'TEST',
          total_value_ils: null, // null value
          created_at: '2025-01-15T10:00:00Z',
          votes: {
            title: 'Test Vote',
            municipality_id: 'test-city',
            thumbnail_url: null,
          },
        },
      ];

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: mockIssueCoins,
                error: null,
              }),
            }),
          }),
        }),
      });

      const request = new Request('http://localhost:3000/api/bags/trending');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.coins[0].totalRaised).toBe(0); // Should default to 0
      expect(data.coins[0].imageUrl).toBeNull(); // Should allow null
    });
  });
});
