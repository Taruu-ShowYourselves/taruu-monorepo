/**
 * Vote Participated API Route Tests
 *
 * Tests for the /api/votes/[id]/participated endpoint:
 * - GET /api/votes/[id]/participated - Check if user participated in vote
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

// Mock session service
vi.mock('@/services/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  hasUserParticipated: vi.fn(),
}));

// Import mocked modules
import { getSessionFromRequest } from '@/services/auth/session';
import { hasUserParticipated } from '@/lib/supabase/db';

describe('Vote Participated API Routes', () => {
  let GET: typeof import('@/app/api/votes/[id]/participated/route').GET;

  const mockSession = {
    userId: 'user-123',
    googleId: 'google-123',
    email: 'test@example.com',
    did: 'did:sync:' + 'a'.repeat(43),
    expiresAt: Date.now() + 86400000,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const module = await import('@/app/api/votes/[id]/participated/route');
    GET = module.GET;
  });

  describe('GET /api/votes/[id]/participated', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/participated', {
        method: 'GET',
      });
      const response = await GET(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 when vote ID is missing', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/votes//participated', {
        method: 'GET',
      });
      const response = await GET(request, { params: Promise.resolve({ id: '' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Vote ID is required');
    });

    it('should return participated=true when user has voted', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (hasUserParticipated as Mock).mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/participated', {
        method: 'GET',
      });
      const response = await GET(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.participated).toBe(true);
      expect(hasUserParticipated).toHaveBeenCalledWith('user-123', 'vote-123');
    });

    it('should return participated=false when user has not voted', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (hasUserParticipated as Mock).mockResolvedValue(false);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/participated', {
        method: 'GET',
      });
      const response = await GET(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.participated).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (hasUserParticipated as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/participated', {
        method: 'GET',
      });
      const response = await GET(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to check participation status');
    });
  });
});
