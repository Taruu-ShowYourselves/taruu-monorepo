/**
 * User API Routes Tests
 *
 * Tests for additional user endpoints:
 * - GET /api/user/tokens - Get token balance
 * - GET /api/user/stats - Get vote statistics
 * - GET /api/user/votes - Get voting history
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getTokens } from '@/app/api/user/tokens/route';
import { GET as getStats } from '@/app/api/user/stats/route';
import { GET as getVotes } from '@/app/api/user/votes/route';

// Mock session service
vi.mock('@/services/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  getUserById: vi.fn(),
  getUserVoteStats: vi.fn(),
  getUserVotes: vi.fn(),
}));

// Mock Qubik service
vi.mock('@/services/qubik', () => ({
  qubikService: {
    getTokenBalance: vi.fn(),
  },
}));

// Import mocked modules
import { getSessionFromRequest } from '@/services/auth/session';
import {
  getUserById,
  getUserVoteStats,
  getUserVotes,
} from '@/lib/supabase/db';
import { qubikService } from '@/services/qubik';

describe('User API Routes', () => {
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
    first_name: 'Test',
    last_name: 'User',
    email: 'test@example.com',
    qubik_wallet_address: '0xabc123...',
    identity_score: 70,
    created_at: '2025-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/user/tokens', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/tokens', {
        method: 'GET',
      });
      const response = await getTokens(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when user not found', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/tokens', {
        method: 'GET',
      });
      const response = await getTokens(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });

    it('should return token balance with wallet address', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (qubikService.getTokenBalance as Mock).mockResolvedValue(150);

      const request = new NextRequest('http://localhost:3000/api/user/tokens', {
        method: 'GET',
      });
      const response = await getTokens(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.balance).toBe(150);
      expect(data.walletAddress).toBe('0xabc123...');
      expect(data.lastUpdated).toBeDefined();
    });

    it('should return 0 balance when user has no wallet', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue({
        ...mockUser,
        qubik_wallet_address: null,
      });

      const request = new NextRequest('http://localhost:3000/api/user/tokens', {
        method: 'GET',
      });
      const response = await getTokens(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.balance).toBe(0);
      expect(data.walletAddress).toBe('');
      expect(qubikService.getTokenBalance).not.toHaveBeenCalled();
    });

    it('should handle Qubik service errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (qubikService.getTokenBalance as Mock).mockRejectedValue(
        new Error('Blockchain unavailable')
      );

      const request = new NextRequest('http://localhost:3000/api/user/tokens', {
        method: 'GET',
      });
      const response = await getTokens(request);
      const data = await response.json();

      // Should still return 200 with 0 balance on Qubik failure
      expect(response.status).toBe(200);
      expect(data.balance).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/user/tokens', {
        method: 'GET',
      });
      const response = await getTokens(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch token balance');
    });
  });

  describe('GET /api/user/stats', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/stats', {
        method: 'GET',
      });
      const response = await getStats(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return vote statistics', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserVoteStats as Mock).mockResolvedValue({
        votesParticipated: 15,
        votesCreated: 3,
      });

      const request = new NextRequest('http://localhost:3000/api/user/stats', {
        method: 'GET',
      });
      const response = await getStats(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.votesParticipated).toBe(15);
      expect(data.votesCreated).toBe(3);
    });

    it('should return zero stats for new user', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserVoteStats as Mock).mockResolvedValue({
        votesParticipated: 0,
        votesCreated: 0,
      });

      const request = new NextRequest('http://localhost:3000/api/user/stats', {
        method: 'GET',
      });
      const response = await getStats(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.votesParticipated).toBe(0);
      expect(data.votesCreated).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserVoteStats as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/user/stats', {
        method: 'GET',
      });
      const response = await getStats(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch user stats');
    });
  });

  describe('GET /api/user/votes', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/votes', {
        method: 'GET',
      });
      const response = await getVotes(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return empty history for new user', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserVotes as Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/user/votes', {
        method: 'GET',
      });
      const response = await getVotes(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.history).toEqual([]);
    });

    it('should return voting history', async () => {
      const mockVotes = [
        {
          vote_id: 'vote-123',
          option_id: 'option-1',
          created_at: '2025-01-10T12:00:00Z',
        },
        {
          vote_id: 'vote-456',
          option_id: 'option-3',
          created_at: '2025-01-12T14:00:00Z',
        },
      ];
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserVotes as Mock).mockResolvedValue(mockVotes);

      const request = new NextRequest('http://localhost:3000/api/user/votes', {
        method: 'GET',
      });
      const response = await getVotes(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.history).toHaveLength(2);
      expect(data.history[0]).toEqual({
        voteId: 'vote-123',
        optionId: 'option-1',
        createdAt: '2025-01-10T12:00:00Z',
      });
      expect(data.history[1]).toEqual({
        voteId: 'vote-456',
        optionId: 'option-3',
        createdAt: '2025-01-12T14:00:00Z',
      });
    });

    it('should handle database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserVotes as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/user/votes', {
        method: 'GET',
      });
      const response = await getVotes(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch voting history');
    });
  });
});
