/**
 * User Participations API Route Tests
 *
 * Tests for the /api/user/participations endpoint:
 * - GET /api/user/participations - Get user's vote participation history
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/user/participations/route';

// Mock session service
vi.mock('@/services/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  getUserVotesWithDetails: vi.fn(),
}));

// Import mocked modules
import { getSessionFromRequest } from '@/services/auth/session';
import { getUserVotesWithDetails } from '@/lib/supabase/db';

describe('User Participations API Routes', () => {
  const mockSession = {
    userId: 'user-123',
    googleId: 'google-123',
    email: 'test@example.com',
    did: 'did:sync:' + 'a'.repeat(43),
    expiresAt: Date.now() + 86400000,
  };

  const mockVotesWithDetails = [
    {
      id: 'participation-1',
      vote_id: 'vote-1',
      user_id: 'user-123',
      option_id: 'option-1',
      payment_id: 'payment-123',
      created_at: '2025-01-15T10:00:00Z',
      vote: {
        id: 'vote-1',
        title: 'Test Vote 1',
        description: 'Description 1',
        status: 'active',
        end_date: '2025-02-15T23:59:59Z',
      },
      option: {
        id: 'option-1',
        text: 'Option A',
      },
    },
    {
      id: 'participation-2',
      vote_id: 'vote-2',
      user_id: 'user-123',
      option_id: 'option-3',
      payment_id: null,
      created_at: '2025-01-10T14:30:00Z',
      vote: {
        id: 'vote-2',
        title: 'Test Vote 2',
        description: 'Description 2',
        status: 'ended',
        end_date: '2025-01-14T23:59:59Z',
      },
      option: {
        id: 'option-3',
        text: 'Option B',
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/user/participations', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/participations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return participations with vote details', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserVotesWithDetails as Mock).mockResolvedValue(mockVotesWithDetails);

      const request = new NextRequest('http://localhost:3000/api/user/participations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.participations).toHaveLength(2);
      expect(getUserVotesWithDetails).toHaveBeenCalledWith(mockSession.userId);
    });

    it('should transform participation fields correctly', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserVotesWithDetails as Mock).mockResolvedValue(mockVotesWithDetails);

      const request = new NextRequest('http://localhost:3000/api/user/participations');
      const response = await GET(request);
      const data = await response.json();

      const firstParticipation = data.participations[0];
      expect(firstParticipation.id).toBe('participation-1');
      expect(firstParticipation.voteId).toBe('vote-1');
      expect(firstParticipation.userId).toBe('user-123');
      expect(firstParticipation.optionId).toBe('option-1');
      expect(firstParticipation.paymentTxId).toBe('payment-123');
      expect(firstParticipation.qubikTxHash).toBe('');
    });

    it('should include GPS coordinates placeholder', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserVotesWithDetails as Mock).mockResolvedValue(mockVotesWithDetails);

      const request = new NextRequest('http://localhost:3000/api/user/participations');
      const response = await GET(request);
      const data = await response.json();

      const firstParticipation = data.participations[0];
      expect(firstParticipation.gpsCoordinates).toBeDefined();
      expect(firstParticipation.gpsCoordinates.latitude).toBe(0);
      expect(firstParticipation.gpsCoordinates.longitude).toBe(0);
      expect(firstParticipation.gpsCoordinates.timestamp).toBeDefined();
    });

    it('should include vote details', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserVotesWithDetails as Mock).mockResolvedValue(mockVotesWithDetails);

      const request = new NextRequest('http://localhost:3000/api/user/participations');
      const response = await GET(request);
      const data = await response.json();

      const firstParticipation = data.participations[0];
      expect(firstParticipation.vote).toEqual({
        id: 'vote-1',
        title: 'Test Vote 1',
        description: 'Description 1',
        status: 'active',
        endDate: '2025-02-15T23:59:59Z',
      });
    });

    it('should include option details', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserVotesWithDetails as Mock).mockResolvedValue(mockVotesWithDetails);

      const request = new NextRequest('http://localhost:3000/api/user/participations');
      const response = await GET(request);
      const data = await response.json();

      const firstParticipation = data.participations[0];
      expect(firstParticipation.option).toEqual({
        id: 'option-1',
        text: 'Option A',
      });
    });

    it('should handle null payment_id', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserVotesWithDetails as Mock).mockResolvedValue(mockVotesWithDetails);

      const request = new NextRequest('http://localhost:3000/api/user/participations');
      const response = await GET(request);
      const data = await response.json();

      const secondParticipation = data.participations[1];
      expect(secondParticipation.paymentTxId).toBe('');
    });

    it('should handle missing vote details', async () => {
      const participationWithoutVote = [{
        ...mockVotesWithDetails[0],
        vote: null,
      }];
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserVotesWithDetails as Mock).mockResolvedValue(participationWithoutVote);

      const request = new NextRequest('http://localhost:3000/api/user/participations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.participations[0].vote).toBeNull();
    });

    it('should handle missing option details', async () => {
      const participationWithoutOption = [{
        ...mockVotesWithDetails[0],
        option: null,
      }];
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserVotesWithDetails as Mock).mockResolvedValue(participationWithoutOption);

      const request = new NextRequest('http://localhost:3000/api/user/participations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.participations[0].option).toBeNull();
    });

    it('should return empty array when user has no participations', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserVotesWithDetails as Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/user/participations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.participations).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserVotesWithDetails as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/user/participations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch participations');
    });

    it('should handle participations with different vote statuses', async () => {
      const participationsWithStatuses = [
        { ...mockVotesWithDetails[0], vote: { ...mockVotesWithDetails[0].vote, status: 'pending' } },
        { ...mockVotesWithDetails[1], vote: { ...mockVotesWithDetails[1].vote, status: 'resolved' } },
      ];
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserVotesWithDetails as Mock).mockResolvedValue(participationsWithStatuses);

      const request = new NextRequest('http://localhost:3000/api/user/participations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.participations[0].vote.status).toBe('pending');
      expect(data.participations[1].vote.status).toBe('resolved');
    });
  });
});
