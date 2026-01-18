/**
 * Tests for GET /api/stats/network endpoint
 *
 * This endpoint returns network-wide statistics for the economics dashboard.
 * Public endpoint - no authentication required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase server with a simpler pattern
const mockFrom = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: (table: string) => mockFrom(table),
  },
}));

// Import after mocking
import { GET } from '@/app/api/stats/network/route';

describe('Network Stats API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create the default mock that handles all query patterns
  const setupDefaultMocks = (overrides: {
    treasuryData?: { total_collected_ils: number | null }[];
    activeVotesCount?: number;
    totalVotersCount?: number;
    municipalitiesData?: { municipality_id: string }[];
    weeklyVotersCount?: number;
    prevWeekVotersCount?: number;
  } = {}) => {
    const {
      treasuryData = [],
      activeVotesCount = 0,
      totalVotersCount = 0,
      municipalitiesData = [],
      weeklyVotersCount = 0,
      prevWeekVotersCount = 0,
    } = overrides;

    let userVotesCallCount = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'treasury') {
        return {
          select: vi.fn().mockResolvedValue({
            data: treasuryData,
            error: null,
          }),
        };
      }

      if (table === 'votes') {
        // Need to differentiate between the two votes queries
        return {
          select: vi.fn().mockImplementation((fields: string, options?: { count?: string; head?: boolean }) => {
            if (options?.count === 'exact') {
              // Active votes count query
              return {
                eq: vi.fn().mockResolvedValue({
                  count: activeVotesCount,
                  error: null,
                }),
              };
            }
            // Municipality_id select query
            return Promise.resolve({
              data: municipalitiesData,
              error: null,
            });
          }),
        };
      }

      if (table === 'user_votes') {
        userVotesCallCount++;
        const currentCall = userVotesCallCount;

        return {
          select: vi.fn().mockImplementation((fields: string, options?: { count?: string; head?: boolean }) => {
            if (currentCall === 1) {
              // First call: total voters count
              return Promise.resolve({
                count: totalVotersCount,
                error: null,
              });
            }
            if (currentCall === 2) {
              // Second call: weekly voters (has .gte)
              return {
                gte: vi.fn().mockResolvedValue({
                  count: weeklyVotersCount,
                  error: null,
                }),
              };
            }
            // Third call: prev week voters (has .gte and .lt)
            return {
              gte: vi.fn().mockReturnValue({
                lt: vi.fn().mockResolvedValue({
                  count: prevWeekVotersCount,
                  error: null,
                }),
              }),
            };
          }),
        };
      }

      return {
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    });
  };

  describe('GET /api/stats/network', () => {
    it('should return network statistics', async () => {
      setupDefaultMocks({
        treasuryData: [
          { total_collected_ils: 5000000 }, // 50,000 ILS
          { total_collected_ils: 3000000 }, // 30,000 ILS
        ],
        activeVotesCount: 12,
        totalVotersCount: 3847,
        municipalitiesData: [
          { municipality_id: 'kiryat-tivon' },
          { municipality_id: 'yokneam' },
          { municipality_id: 'zichron' },
        ],
        weeklyVotersCount: 150,
        prevWeekVotersCount: 100,
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats).toBeDefined();
      expect(data.stats.updatedAt).toBeDefined();
      expect(data.stats.totalRaised).toBe(80000); // 8,000,000 agorot / 100
      expect(data.stats.activeVotes).toBe(12);
      expect(data.stats.totalVoters).toBe(3847);
      expect(data.stats.municipalities).toBe(3);
    });

    it('should calculate totalRaised in ILS', async () => {
      setupDefaultMocks({
        treasuryData: [
          { total_collected_ils: 1000000 }, // 10,000 ILS
          { total_collected_ils: 500000 }, // 5,000 ILS
        ],
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats.totalRaised).toBe(15000); // 15,000 ILS (converted from agorot)
    });

    it('should count unique municipalities', async () => {
      setupDefaultMocks({
        municipalitiesData: [
          { municipality_id: 'city-a' },
          { municipality_id: 'city-b' },
          { municipality_id: 'city-a' }, // Duplicate
          { municipality_id: 'city-c' },
        ],
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats.municipalities).toBe(3); // 3 unique municipalities
    });

    it('should return zeros when no data exists', async () => {
      setupDefaultMocks();

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats.totalRaised).toBe(0);
      expect(data.stats.activeVotes).toBe(0);
      expect(data.stats.totalVoters).toBe(0);
      expect(data.stats.municipalities).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch network statistics');
    });

    it('should calculate weekly growth correctly', async () => {
      setupDefaultMocks({
        weeklyVotersCount: 150,
        prevWeekVotersCount: 100,
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      // weeklyGrowth = (150 - 100) / 100 = 0.5
      expect(data.stats.weeklyGrowth).toBe(0.5);
    });

    it('should return 1 (100%) growth when no previous week data', async () => {
      setupDefaultMocks({
        weeklyVotersCount: 50,
        prevWeekVotersCount: 0,
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats.weeklyGrowth).toBe(1); // 100% growth
    });

    it('should handle null values in treasury data', async () => {
      setupDefaultMocks({
        treasuryData: [
          { total_collected_ils: null },
          { total_collected_ils: 1000000 },
        ],
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats.totalRaised).toBe(10000); // Only the non-null value
    });
  });
});
