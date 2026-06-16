/**
 * Votes API Route Tests
 *
 * Tests for the /api/votes endpoints:
 * - GET /api/votes - List votes
 * - POST /api/votes - Create a new vote
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/votes/route';

// Mock session service
vi.mock('@/services/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  getActiveVotes: vi.fn(),
  getVotesByMunicipality: vi.fn(),
  createVote: vi.fn(),
  createVoteOptions: vi.fn(),
  verifyPaymentCompleted: vi.fn(),
  isPaymentAlreadyUsed: vi.fn(),
  getUserById: vi.fn(),
  getUsersByMunicipality: vi.fn(),
}));

// Import mocked modules for type-safe access
import { getSessionFromRequest } from '@/services/auth/session';
import {
  getActiveVotes,
  getVotesByMunicipality,
  createVote,
  createVoteOptions,
  verifyPaymentCompleted,
  isPaymentAlreadyUsed,
  getUserById,
  getUsersByMunicipality,
} from '@/lib/supabase/db';

describe('Votes API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // POST gate: a fully verified resident of tel-aviv by default.
    (getUserById as Mock).mockResolvedValue({
      id: 'user-123',
      verification_status: 'verified',
      municipality_id: 'tel-aviv',
      email: 'creator@example.com',
      first_name: 'יוצר',
    });
    (getUsersByMunicipality as Mock).mockResolvedValue([]);
  });

  describe('GET /api/votes', () => {
    const mockVotes = [
      {
        id: 'vote-1',
        title: 'Test Vote 1',
        description: 'Description 1',
        municipality_id: 'tel-aviv',
        creator_id: 'user-1',
        status: 'active',
        start_date: '2025-01-01T00:00:00Z',
        end_date: '2025-01-31T23:59:59Z',
        participant_count: 10,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
      {
        id: 'vote-2',
        title: 'Test Vote 2',
        description: 'Description 2',
        municipality_id: 'jerusalem',
        creator_id: 'user-2',
        status: 'active',
        start_date: '2025-01-15T00:00:00Z',
        end_date: '2025-02-15T23:59:59Z',
        participant_count: 5,
        created_at: '2025-01-15T00:00:00Z',
        updated_at: '2025-01-15T00:00:00Z',
      },
    ];

    it('should return active votes when no filters provided', async () => {
      (getActiveVotes as Mock).mockResolvedValue(mockVotes);

      const request = new NextRequest('http://localhost:3000/api/votes');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.votes).toHaveLength(2);
      expect(data.votes[0]).toMatchObject({
        id: 'vote-1',
        title: 'Test Vote 1',
        municipality: 'tel-aviv',
        status: 'active',
      });
      expect(getActiveVotes).toHaveBeenCalledTimes(1);
    });

    it('should filter votes by municipality', async () => {
      const telAvivVotes = mockVotes.filter(v => v.municipality_id === 'tel-aviv');
      (getVotesByMunicipality as Mock).mockResolvedValue(telAvivVotes);

      const request = new NextRequest('http://localhost:3000/api/votes?municipality=tel-aviv');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.votes).toHaveLength(1);
      expect(data.votes[0].municipality).toBe('tel-aviv');
      expect(getVotesByMunicipality).toHaveBeenCalledWith('tel-aviv');
    });

    it('should filter votes by municipality and status', async () => {
      (getVotesByMunicipality as Mock).mockResolvedValue(mockVotes.slice(0, 1));

      const request = new NextRequest('http://localhost:3000/api/votes?municipality=tel-aviv&status=active');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(getVotesByMunicipality).toHaveBeenCalledWith('tel-aviv', 'active');
    });

    it('should map cancelled status to ended for backwards compatibility', async () => {
      (getVotesByMunicipality as Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/votes?municipality=tel-aviv&status=cancelled');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(getVotesByMunicipality).toHaveBeenCalledWith('tel-aviv', 'ended');
    });

    it('should handle database errors gracefully', async () => {
      (getActiveVotes as Mock).mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/votes');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch votes');
    });
  });

  describe('POST /api/votes', () => {
    const mockSession = {
      userId: 'user-123',
      googleId: 'google-123',
      email: 'test@example.com',
      did: 'did:sync:' + 'a'.repeat(43),
      expiresAt: Date.now() + 86400000,
    };

    const validVoteData = {
      title: 'Test Vote',
      description: 'Test Description',
      municipality: 'tel-aviv',
      options: [
        { label: 'Option A', description: 'Description A' },
        { label: 'Option B', description: 'Description B' },
      ],
      startDate: '2025-02-01T00:00:00Z',
      endDate: '2025-02-28T23:59:59Z',
      paymentTxId: 'payment-123',
    };

    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/votes', {
        method: 'POST',
        body: JSON.stringify(validVoteData),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 when required fields are missing', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const incompleteData = { title: 'Test Vote' };
      const request = new NextRequest('http://localhost:3000/api/votes', {
        method: 'POST',
        body: JSON.stringify(incompleteData),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields');
    });

    it('should return 402 when paymentTxId is missing', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const dataWithoutPayment = { ...validVoteData, paymentTxId: undefined };
      const request = new NextRequest('http://localhost:3000/api/votes', {
        method: 'POST',
        body: JSON.stringify(dataWithoutPayment),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(402);
      expect(data.error).toBe('Payment required to create a vote');
    });

    it('should return 402 when payment verification fails', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (verifyPaymentCompleted as Mock).mockResolvedValue({
        valid: false,
        error: 'Payment not found',
      });

      const request = new NextRequest('http://localhost:3000/api/votes', {
        method: 'POST',
        body: JSON.stringify(validVoteData),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(402);
      expect(data.error).toContain('Payment verification failed');
    });

    it('should return 400 when payment has already been used', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (verifyPaymentCompleted as Mock).mockResolvedValue({ valid: true });
      (isPaymentAlreadyUsed as Mock).mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/votes', {
        method: 'POST',
        body: JSON.stringify(validVoteData),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Payment has already been used');
    });

    it('should create vote successfully with valid data', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (verifyPaymentCompleted as Mock).mockResolvedValue({ valid: true });
      (isPaymentAlreadyUsed as Mock).mockResolvedValue(false);
      (createVote as Mock).mockResolvedValue({
        id: 'new-vote-123',
        title: validVoteData.title,
        description: validVoteData.description,
        municipality_id: validVoteData.municipality,
        creator_id: mockSession.userId,
        status: 'pending',
        start_date: validVoteData.startDate,
        end_date: validVoteData.endDate,
        participant_count: 0,
        created_at: '2025-01-16T00:00:00Z',
        updated_at: '2025-01-16T00:00:00Z',
      });
      (createVoteOptions as Mock).mockResolvedValue([
        { id: 'opt-1', text: 'Option A', votes: 0 },
        { id: 'opt-2', text: 'Option B', votes: 0 },
      ]);

      const request = new NextRequest('http://localhost:3000/api/votes', {
        method: 'POST',
        body: JSON.stringify(validVoteData),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.vote).toBeDefined();
      expect(data.vote.id).toBe('new-vote-123');
      expect(data.vote.title).toBe('Test Vote');
      expect(data.vote.options).toHaveLength(2);
      expect(createVote).toHaveBeenCalledWith(
        expect.objectContaining({
          title: validVoteData.title,
          creator_id: mockSession.userId,
          municipality_id: validVoteData.municipality,
        })
      );
    });

    it('should set status to active when startDate is in the past', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (verifyPaymentCompleted as Mock).mockResolvedValue({ valid: true });
      (isPaymentAlreadyUsed as Mock).mockResolvedValue(false);
      (createVote as Mock).mockResolvedValue({
        id: 'vote-123',
        title: 'Test',
        description: 'Test',
        municipality_id: 'tel-aviv',
        creator_id: mockSession.userId,
        status: 'active',
        start_date: '2024-01-01T00:00:00Z', // Past date
        end_date: '2025-12-31T23:59:59Z',
        participant_count: 0,
        created_at: '2025-01-16T00:00:00Z',
        updated_at: '2025-01-16T00:00:00Z',
      });
      (createVoteOptions as Mock).mockResolvedValue([]);

      const pastStartData = {
        ...validVoteData,
        startDate: '2024-01-01T00:00:00Z', // Past date
        options: [],
      };

      const request = new NextRequest('http://localhost:3000/api/votes', {
        method: 'POST',
        body: JSON.stringify(pastStartData),
      });
      await POST(request);

      expect(createVote).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (verifyPaymentCompleted as Mock).mockResolvedValue({ valid: true });
      (isPaymentAlreadyUsed as Mock).mockResolvedValue(false);
      (createVote as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/votes', {
        method: 'POST',
        body: JSON.stringify(validVoteData),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create vote');
    });
  });
});
