/**
 * Votes API Tests
 *
 * Tests for voting operations including listing, creation,
 * participation, and location verification.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { votesApi } from '../votes';
import { initializeApiClient } from '../client';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('votesApi', () => {
  const baseUrl = 'https://api.test.com';

  beforeEach(() => {
    mockFetch.mockReset();
    initializeApiClient({ baseUrl });
  });

  describe('getVotes', () => {
    const mockVotes = [
      {
        id: 'vote-1',
        title: 'Test Vote 1',
        description: 'Description 1',
        municipality: 'kiryat-tivon',
        status: 'active',
        createdAt: '2025-01-15T00:00:00Z',
        endDate: '2025-01-30T00:00:00Z',
        options: [
          { id: 'opt-1', text: 'Option A', voteCount: 10 },
          { id: 'opt-2', text: 'Option B', voteCount: 5 },
        ],
      },
    ];

    it('should get all votes without filters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ votes: mockVotes }),
      });

      const result = await votesApi.getVotes();

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/api/votes`, {
        method: 'GET',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      });
      expect(result).toEqual(mockVotes);
    });

    it('should filter by municipality', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ votes: mockVotes }),
      });

      await votesApi.getVotes({ municipality: 'kiryat-tivon' });

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/api/votes?municipality=kiryat-tivon`,
        expect.any(Object)
      );
    });

    it('should filter by status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ votes: mockVotes }),
      });

      await votesApi.getVotes({ status: 'active' });

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/api/votes?status=active`,
        expect.any(Object)
      );
    });

    it('should filter by both municipality and status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ votes: mockVotes }),
      });

      await votesApi.getVotes({ municipality: 'haifa', status: 'ended' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/votes\?.*municipality=haifa.*status=ended|status=ended.*municipality=haifa/),
        expect.any(Object)
      );
    });

    it('should return empty array when no votes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ votes: [] }),
      });

      const result = await votesApi.getVotes();

      expect(result).toEqual([]);
    });
  });

  describe('getActiveVotes', () => {
    it('should get active votes for a municipality', async () => {
      const mockVotes = [{ id: 'vote-1', status: 'active' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ votes: mockVotes }),
      });

      const result = await votesApi.getActiveVotes('tel-aviv');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/municipality=tel-aviv.*status=active|status=active.*municipality=tel-aviv/),
        expect.any(Object)
      );
      expect(result).toEqual(mockVotes);
    });

    it('should get all active votes when no municipality specified', async () => {
      const mockVotes = [{ id: 'vote-1', status: 'active' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ votes: mockVotes }),
      });

      await votesApi.getActiveVotes();

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/api/votes?status=active`,
        expect.any(Object)
      );
    });
  });

  describe('getVote', () => {
    const mockVote = {
      id: 'vote-123',
      title: 'Test Vote',
      description: 'Vote description',
      municipality: 'kiryat-tivon',
      status: 'active',
      options: [
        { id: 'opt-1', text: 'Yes', voteCount: 100 },
        { id: 'opt-2', text: 'No', voteCount: 50 },
      ],
    };

    it('should get single vote by ID', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ vote: mockVote }),
      });

      const result = await votesApi.getVote('vote-123');

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/api/votes/vote-123`, {
        method: 'GET',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      });
      expect(result).toEqual(mockVote);
    });
  });

  describe('createVote', () => {
    it('should submit a new proposal with no payment reference', async () => {
      const input = {
        title: 'New Vote',
        description: 'Vote description',
        municipality: 'kiryat-tivon',
        options: [{ label: 'Option A' }, { label: 'Option B', description: 'Second option' }],
        startDate: new Date('2025-01-16T00:00:00Z'),
        endDate: new Date('2025-02-15T00:00:00Z'),
      };

      const mockResponse = {
        vote: {
          id: 'new-vote-id',
          title: input.title,
          description: input.description,
          municipality: input.municipality,
          status: 'active',
          createdAt: '2025-01-16T00:00:00Z',
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await votesApi.createVote(input);

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/api/votes`, {
        method: 'POST',
        body: JSON.stringify(input),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      });
      expect(result.id).toBe('new-vote-id');
    });
  });

  describe('participate', () => {
    it('should participate in a vote', async () => {
      const input = {
        voteId: 'vote-123',
        optionId: 'option-1',
      };

      const mockResponse = {
        success: true,
        participation: {
          id: 'participation-123',
          voteId: 'vote-123',
          userId: 'user-123',
          optionId: 'option-1',
          createdAt: '2025-01-16T00:00:00Z',
        },
        alreadyRecorded: false,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await votesApi.participate(input);

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/api/votes/${input.voteId}/participate`, {
        method: 'POST',
        body: JSON.stringify({ optionId: input.optionId }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      });
      expect(result.success).toBe(true);
      expect(result.alreadyRecorded).toBe(false);
    });

    it('reports an already-recorded ballot as success', async () => {
      const input = {
        voteId: 'vote-123',
        optionId: 'option-1',
      };

      const mockResponse = {
        success: true,
        participation: {
          id: 'participation-123',
          voteId: 'vote-123',
          userId: 'user-123',
          optionId: 'option-1',
          createdAt: '2025-01-16T00:00:00Z',
        },
        alreadyRecorded: true,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await votesApi.participate(input);

      expect(result.success).toBe(true);
      expect(result.alreadyRecorded).toBe(true);
    });
  });

  describe('getUserParticipations', () => {
    it('should get user participation history', async () => {
      const mockParticipations = [
        {
          id: 'part-1',
          voteId: 'vote-1',
          optionId: 'opt-1',
          createdAt: '2025-01-10T00:00:00Z',
        },
        {
          id: 'part-2',
          voteId: 'vote-2',
          optionId: 'opt-3',
          createdAt: '2025-01-12T00:00:00Z',
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ participations: mockParticipations }),
      });

      const result = await votesApi.getUserParticipations();

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/api/user/participations`, {
        method: 'GET',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      });
      expect(result).toHaveLength(2);
      expect(result[0].voteId).toBe('vote-1');
    });
  });

  describe('hasParticipated', () => {
    it('should return true when user has participated', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ participated: true }),
      });

      const result = await votesApi.hasParticipated('vote-123');

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/api/votes/vote-123/participated`, {
        method: 'GET',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      });
      expect(result).toBe(true);
    });

    it('should return false when user has not participated', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ participated: false }),
      });

      const result = await votesApi.hasParticipated('vote-456');

      expect(result).toBe(false);
    });
  });

  describe('verifyLocation', () => {
    it('should verify location successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          verified: true,
          municipality: 'kiryat-tivon',
        }),
      });

      const result = await votesApi.verifyLocation({
        voteId: 'vote-123',
        latitude: 32.7128,
        longitude: 35.1196,
      });

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/api/votes/vote-123/verify-location`, {
        method: 'POST',
        body: JSON.stringify({
          latitude: 32.7128,
          longitude: 35.1196,
        }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      });
      expect(result).toBe(true);
    });

    it('should return false when location verification fails', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          verified: false,
        }),
      });

      const result = await votesApi.verifyLocation({
        voteId: 'vote-123',
        latitude: 40.7128, // Wrong location
        longitude: -74.0060,
      });

      expect(result).toBe(false);
    });
  });
});
