/**
 * Vote Detail API Route Tests
 *
 * Tests for the /api/votes/[id] endpoint:
 * - GET /api/votes/[id] - Get vote details
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/votes/[id]/route';

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  getVoteWithOptions: vi.fn(),
}));

// Import mocked modules
import { getVoteWithOptions } from '@/lib/supabase/db';

describe('Vote Detail API Routes', () => {
  const mockVoteWithOptions = {
    id: 'vote-123',
    title: 'Test Vote',
    description: 'A test vote description',
    municipality_id: 'tel-aviv',
    creator_id: 'user-456',
    status: 'active',
    start_date: '2025-01-01T00:00:00Z',
    end_date: '2025-01-31T23:59:59Z',
    participant_count: 42,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-15T12:00:00Z',
    options: [
      { id: 'opt-1', text: 'Option A', votes: 25 },
      { id: 'opt-2', text: 'Option B', votes: 17 },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/votes/[id]', () => {
    it('should return vote details successfully', async () => {
      (getVoteWithOptions as Mock).mockResolvedValue(mockVoteWithOptions);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.vote).toBeDefined();
      expect(data.vote.id).toBe('vote-123');
      expect(data.vote.title).toBe('Test Vote');
      expect(data.vote.description).toBe('A test vote description');
      expect(data.vote.municipality).toBe('tel-aviv');
      expect(data.vote.creatorId).toBe('user-456');
      expect(data.vote.status).toBe('active');
      expect(data.vote.participantCount).toBe(42);
      expect(getVoteWithOptions).toHaveBeenCalledWith('vote-123');
    });

    it('should transform options correctly', async () => {
      (getVoteWithOptions as Mock).mockResolvedValue(mockVoteWithOptions);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(data.vote.options).toHaveLength(2);
      expect(data.vote.options[0]).toEqual({
        id: 'opt-1',
        label: 'Option A',
        voteCount: 25,
      });
      expect(data.vote.options[1]).toEqual({
        id: 'opt-2',
        label: 'Option B',
        voteCount: 17,
      });
    });

    it('should transform date fields correctly', async () => {
      (getVoteWithOptions as Mock).mockResolvedValue(mockVoteWithOptions);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(data.vote.startDate).toBe('2025-01-01T00:00:00Z');
      expect(data.vote.endDate).toBe('2025-01-31T23:59:59Z');
      expect(data.vote.createdAt).toBe('2025-01-01T00:00:00Z');
      expect(data.vote.updatedAt).toBe('2025-01-15T12:00:00Z');
    });

    it('should return 404 when vote not found', async () => {
      (getVoteWithOptions as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/votes/nonexistent');
      const response = await GET(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Vote not found');
    });

    it('should handle votes with no options', async () => {
      const voteWithNoOptions = { ...mockVoteWithOptions, options: [] };
      (getVoteWithOptions as Mock).mockResolvedValue(voteWithNoOptions);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.vote.options).toEqual([]);
    });

    it('should handle votes with different statuses', async () => {
      const statuses = ['pending', 'active', 'ended', 'resolving', 'resolved', 'failed'];

      for (const status of statuses) {
        const voteWithStatus = { ...mockVoteWithOptions, status };
        (getVoteWithOptions as Mock).mockResolvedValue(voteWithStatus);

        const request = new NextRequest('http://localhost:3000/api/votes/vote-123');
        const response = await GET(request, { params: Promise.resolve({ id: 'vote-123' }) });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.vote.status).toBe(status);
      }
    });

    it('should handle database errors gracefully', async () => {
      (getVoteWithOptions as Mock).mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch vote');
    });

    it('should not require authentication (public endpoint)', async () => {
      (getVoteWithOptions as Mock).mockResolvedValue(mockVoteWithOptions);

      // No auth headers or cookies
      const request = new NextRequest('http://localhost:3000/api/votes/vote-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'vote-123' }) });

      expect(response.status).toBe(200);
    });

    it('should handle Hebrew municipality IDs', async () => {
      const hebrewVote = { ...mockVoteWithOptions, municipality_id: 'תל אביב-יפו' };
      (getVoteWithOptions as Mock).mockResolvedValue(hebrewVote);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.vote.municipality).toBe('תל אביב-יפו');
    });

    it('should handle zero participant count', async () => {
      const newVote = { ...mockVoteWithOptions, participant_count: 0 };
      (getVoteWithOptions as Mock).mockResolvedValue(newVote);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.vote.participantCount).toBe(0);
    });
  });
});
