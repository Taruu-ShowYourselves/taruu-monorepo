/**
 * Treasury API Route Tests
 *
 * Tests for the /api/treasury endpoints:
 * - GET /api/treasury/[municipality] - Get treasury balance
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/treasury/[municipality]/route';

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  getTreasuryByMunicipality: vi.fn(),
}));

// Import mocked modules
import { getTreasuryByMunicipality } from '@/lib/supabase/db';

describe('Treasury API Routes', () => {
  const mockTreasury = {
    id: 'treasury-123',
    municipality_id: 'tel-aviv',
    wallet_address: 'SoLANAWaLLetAdDreSs123',
    balance_ils: 50000,
    balance_sol: 2.5,
    total_collected_ils: 75000,
    total_withdrawn_ils: 25000,
    total_fees_claimed_sol: 1.2,
    active_votes_count: 5,
    last_sync_at: '2025-01-15T12:00:00Z',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-15T12:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/treasury/[municipality]', () => {
    it('should return treasury balance for existing municipality', async () => {
      (getTreasuryByMunicipality as Mock).mockResolvedValue(mockTreasury);

      const request = new NextRequest('http://localhost:3000/api/treasury/tel-aviv', {
        method: 'GET',
      });
      const response = await GET(request, { params: Promise.resolve({ municipality: 'tel-aviv' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.treasury).toBeDefined();
      expect(data.treasury.id).toBe('treasury-123');
      expect(data.treasury.municipalityId).toBe('tel-aviv');
      expect(data.treasury.walletAddress).toBe('SoLANAWaLLetAdDreSs123');
      expect(data.treasury.balanceILS).toBe(50000);
      expect(data.treasury.balanceSOL).toBe(2.5);
      expect(data.treasury.totalCollectedILS).toBe(75000);
      expect(data.treasury.totalWithdrawnILS).toBe(25000);
      expect(data.treasury.totalFeesClaimedSOL).toBe(1.2);
      expect(data.treasury.activeVotesCount).toBe(5);
    });

    it('should return empty treasury for new municipality', async () => {
      (getTreasuryByMunicipality as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/treasury/haifa', {
        method: 'GET',
      });
      const response = await GET(request, { params: Promise.resolve({ municipality: 'haifa' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.treasury).toBeDefined();
      expect(data.treasury.municipalityId).toBe('haifa');
      expect(data.treasury.balanceILS).toBe(0);
      expect(data.treasury.balanceSOL).toBe(0);
      expect(data.treasury.totalCollectedILS).toBe(0);
      expect(data.treasury.totalWithdrawnILS).toBe(0);
      expect(data.treasury.activeVotesCount).toBe(0);
      expect(data.treasury.lastSyncAt).toBeNull();
    });

    it('should work with Hebrew municipality names', async () => {
      (getTreasuryByMunicipality as Mock).mockResolvedValue({
        ...mockTreasury,
        municipality_id: 'תל אביב-יפו',
      });

      const request = new NextRequest(
        `http://localhost:3000/api/treasury/${encodeURIComponent('תל אביב-יפו')}`,
        { method: 'GET' }
      );
      const response = await GET(request, {
        params: Promise.resolve({ municipality: 'תל אביב-יפו' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.treasury.municipalityId).toBe('תל אביב-יפו');
    });

    it('should return 400 when municipality is empty', async () => {
      const request = new NextRequest('http://localhost:3000/api/treasury/', {
        method: 'GET',
      });
      const response = await GET(request, { params: Promise.resolve({ municipality: '' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Municipality is required');
    });

    it('should handle database errors gracefully', async () => {
      (getTreasuryByMunicipality as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/treasury/tel-aviv', {
        method: 'GET',
      });
      const response = await GET(request, { params: Promise.resolve({ municipality: 'tel-aviv' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch treasury');
    });

    it('should not require authentication (public data)', async () => {
      // No session mock needed - treasury is public
      (getTreasuryByMunicipality as Mock).mockResolvedValue(mockTreasury);

      const request = new NextRequest('http://localhost:3000/api/treasury/tel-aviv', {
        method: 'GET',
        // No cookies or auth headers
      });
      const response = await GET(request, { params: Promise.resolve({ municipality: 'tel-aviv' }) });

      expect(response.status).toBe(200);
    });
  });
});
