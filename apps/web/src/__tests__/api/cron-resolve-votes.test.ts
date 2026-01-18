/**
 * Cron Resolve Votes API Route Tests
 *
 * Tests for the /api/cron/resolve-votes endpoint:
 * - POST /api/cron/resolve-votes - Process ended votes and mint NFTs
 * - GET /api/cron/resolve-votes - Health check
 */

import { describe, it, expect, beforeEach, vi, type Mock, afterAll } from 'vitest';
import { NextRequest } from 'next/server';

// Mock NFT service
vi.mock('@/services/nft', () => ({
  processVoteResolutions: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  cronLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import mocked modules
import { processVoteResolutions } from '@/services/nft';
import { cronLogger as log } from '@/lib/logger';

describe('Cron Resolve Votes API Routes', () => {
  const originalEnv = process.env;
  let POST: typeof import('@/app/api/cron/resolve-votes/route').POST;
  let GET: typeof import('@/app/api/cron/resolve-votes/route').GET;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      CRON_SECRET: 'test-cron-secret',
    };
    vi.resetModules();
    const module = await import('@/app/api/cron/resolve-votes/route');
    POST = module.POST;
    GET = module.GET;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('GET /api/cron/resolve-votes', () => {
    it('should return health check status', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.endpoint).toBe('resolve-votes');
      expect(data.description).toBeDefined();
    });
  });

  describe('POST /api/cron/resolve-votes', () => {
    it('should return 503 when CRON_SECRET is not configured', async () => {
      delete process.env.CRON_SECRET;
      vi.resetModules();
      const { POST: POST2 } = await import('@/app/api/cron/resolve-votes/route');

      const request = new NextRequest('http://localhost:3000/api/cron/resolve-votes', {
        method: 'POST',
        headers: {
          authorization: 'Bearer some-token',
        },
      });
      const response = await POST2(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('Cron endpoint not configured');
    });

    it('should return 401 when authorization header is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/cron/resolve-votes', {
        method: 'POST',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when authorization header is invalid', async () => {
      const request = new NextRequest('http://localhost:3000/api/cron/resolve-votes', {
        method: 'POST',
        headers: {
          authorization: 'Bearer wrong-secret',
        },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should process successfully with no votes needing resolution', async () => {
      (processVoteResolutions as Mock).mockResolvedValue({
        resolved: 0,
        votes: [],
        errors: [],
      });

      const request = new NextRequest('http://localhost:3000/api/cron/resolve-votes', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results.resolved).toBe(0);
      expect(data.results.votes).toHaveLength(0);
    });

    it('should resolve votes and mint NFTs', async () => {
      (processVoteResolutions as Mock).mockResolvedValue({
        resolved: 2,
        votes: [
          { voteId: 'vote-1', title: 'Vote 1', nftsMinted: 5 },
          { voteId: 'vote-2', title: 'Vote 2', nftsMinted: 3 },
        ],
        errors: [],
      });

      const request = new NextRequest('http://localhost:3000/api/cron/resolve-votes', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results.resolved).toBe(2);
      expect(data.results.votes).toHaveLength(2);
      expect(data.results.votes[0].id).toBe('vote-1');
      expect(data.results.votes[0].nftsMinted).toBe(5);
    });

    it('should handle partial failures and continue processing', async () => {
      (processVoteResolutions as Mock).mockResolvedValue({
        resolved: 2,
        votes: [
          { voteId: 'vote-2', title: 'Vote 2', nftsMinted: 3 },
        ],
        errors: ['Error processing vote-1: Database error'],
      });

      const request = new NextRequest('http://localhost:3000/api/cron/resolve-votes', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results.resolved).toBe(2);
      expect(data.results.errors).toHaveLength(1);
      expect(data.results.errors[0]).toContain('vote-1');
    });

    it('should handle Bags.fm freeze errors', async () => {
      (processVoteResolutions as Mock).mockResolvedValue({
        resolved: 1,
        votes: [],
        errors: ['Error freezing Issue Coin for vote-123: Bags.fm unavailable'],
      });

      const request = new NextRequest('http://localhost:3000/api/cron/resolve-votes', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results.errors).toHaveLength(1);
    });

    it('should handle processVoteResolutions errors', async () => {
      (processVoteResolutions as Mock).mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/cron/resolve-votes', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(data.message).toBe('Database connection failed');
    });

    it('should log cron execution', async () => {
      (processVoteResolutions as Mock).mockResolvedValue({
        resolved: 1,
        votes: [{ voteId: 'vote-1', title: 'Test Vote', nftsMinted: 2 }],
        errors: [],
      });

      const request = new NextRequest('http://localhost:3000/api/cron/resolve-votes', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });
      await POST(request);

      expect(log.info).toHaveBeenCalledWith(
        'Vote resolution cron completed',
        expect.objectContaining({
          resolved: 1,
          votes: ['vote-1'],
          errors: 0,
        })
      );
    });
  });
});
