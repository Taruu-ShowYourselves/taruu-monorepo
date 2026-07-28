/**
 * Cron Knesset Agenda API Route Tests
 *
 * Tests for the /api/cron/knesset-agenda endpoint:
 * - POST /api/cron/knesset-agenda - Mirror the plenum day order into votes
 * - GET /api/cron/knesset-agenda - Health check
 */

import { describe, it, expect, beforeEach, vi, type Mock, afterAll } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the Knesset sync service
vi.mock('@/services/knesset', () => ({
  syncKnessetAgenda: vi.fn(),
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
import { syncKnessetAgenda } from '@/services/knesset';
import { cronLogger as log } from '@/lib/logger';

describe('Cron Knesset Agenda API Routes', () => {
  const originalEnv = process.env;
  let POST: typeof import('@/app/api/cron/knesset-agenda/route').POST;
  let GET: typeof import('@/app/api/cron/knesset-agenda/route').GET;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      CRON_SECRET: 'test-cron-secret',
    };
    vi.resetModules();
    const routeModule = await import('@/app/api/cron/knesset-agenda/route');
    POST = routeModule.POST;
    GET = routeModule.GET;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('GET /api/cron/knesset-agenda', () => {
    it('should return health check status', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.endpoint).toBe('knesset-agenda');
      expect(data.description).toBeDefined();
    });
  });

  describe('POST /api/cron/knesset-agenda', () => {
    it('should return 503 when CRON_SECRET is not configured', async () => {
      delete process.env.CRON_SECRET;
      vi.resetModules();
      const { POST: POST2 } = await import('@/app/api/cron/knesset-agenda/route');

      const request = new NextRequest('http://localhost:3000/api/cron/knesset-agenda', {
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
      const request = new NextRequest('http://localhost:3000/api/cron/knesset-agenda', {
        method: 'POST',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when authorization header is invalid', async () => {
      const request = new NextRequest('http://localhost:3000/api/cron/knesset-agenda', {
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

    it('should sync and report results', async () => {
      (syncKnessetAgenda as Mock).mockResolvedValue({
        sessionsScanned: 2,
        itemsSeen: 12,
        created: 5,
        refreshed: 7,
        skippedTitleDup: 0,
        errors: [],
      });

      const request = new NextRequest('http://localhost:3000/api/cron/knesset-agenda', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results.sessionsScanned).toBe(2);
      expect(data.results.created).toBe(5);
      expect(data.results.refreshed).toBe(7);
      expect(log.info).toHaveBeenCalledWith(
        'Knesset agenda cron completed',
        expect.objectContaining({ created: 5, errors: 0 })
      );
    });

    it('should surface partial errors while still succeeding', async () => {
      (syncKnessetAgenda as Mock).mockResolvedValue({
        sessionsScanned: 1,
        itemsSeen: 3,
        created: 2,
        refreshed: 0,
        skippedTitleDup: 1,
        errors: ['item 42: boom'],
      });

      const request = new NextRequest('http://localhost:3000/api/cron/knesset-agenda', {
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
      expect(data.results.skippedTitleDup).toBe(1);
    });

    it('should return 500 when the sync throws', async () => {
      (syncKnessetAgenda as Mock).mockRejectedValue(
        new Error('Knesset OData 503 for KNS_PlenumSession')
      );

      const request = new NextRequest('http://localhost:3000/api/cron/knesset-agenda', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(data.message).toContain('Knesset OData 503');
    });
  });
});
