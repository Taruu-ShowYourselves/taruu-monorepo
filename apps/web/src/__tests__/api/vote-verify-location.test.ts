/**
 * Vote Verify Location API Route Tests
 *
 * Tests for the /api/votes/[id]/verify-location endpoint:
 * - POST /api/votes/[id]/verify-location - Verify location for voting
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

// Mock session service
vi.mock('@/services/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  getVoteById: vi.fn(),
  getUserById: vi.fn(),
}));

// Mock municipality service
vi.mock('@/services/verification/municipality', () => ({
  verifyLocationInMunicipality: vi.fn(),
  findMunicipalityByCoordinates: vi.fn(),
}));

// Import mocked modules
import { getSessionFromRequest } from '@/services/auth/session';
import { getVoteById, getUserById } from '@/lib/supabase/db';
import {
  verifyLocationInMunicipality,
  findMunicipalityByCoordinates,
} from '@/services/verification/municipality';

describe('Vote Verify Location API Routes', () => {
  let POST: typeof import('@/app/api/votes/[id]/verify-location/route').POST;

  const mockSession = {
    userId: 'user-123',
    googleId: 'google-123',
    email: 'test@example.com',
    did: 'did:sync:' + 'a'.repeat(43),
    expiresAt: Date.now() + 86400000,
  };

  const mockVote = {
    id: 'vote-123',
    title: 'Test Vote',
    municipality_id: 'tel-aviv',
    status: 'active',
    created_at: '2025-01-01T00:00:00Z',
    ended_at: null,
  };

  const mockUser = {
    id: 'user-123',
    google_id: 'google-123',
    email: 'test@example.com',
    municipality_id: 'tel-aviv',
    identity_score: 50,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const module = await import('@/app/api/votes/[id]/verify-location/route');
    POST = module.POST;
  });

  describe('POST /api/votes/[id]/verify-location', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/verify-location', {
        method: 'POST',
        body: JSON.stringify({ latitude: 32.0853, longitude: 34.7818 }),
      });
      const response = await POST(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 when vote ID is missing', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/votes//verify-location', {
        method: 'POST',
        body: JSON.stringify({ latitude: 32.0853, longitude: 34.7818 }),
      });
      const response = await POST(request, { params: Promise.resolve({ id: '' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Vote ID is required');
    });

    it('should return 400 when coordinates are missing', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/verify-location', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Latitude and longitude are required');
    });

    it('should return 400 when latitude is missing', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/verify-location', {
        method: 'POST',
        body: JSON.stringify({ longitude: 34.7818 }),
      });
      const response = await POST(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Latitude and longitude are required');
    });

    it('should return 400 when longitude is missing', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/verify-location', {
        method: 'POST',
        body: JSON.stringify({ latitude: 32.0853 }),
      });
      const response = await POST(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Latitude and longitude are required');
    });

    it('should return 404 when vote not found', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getVoteById as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/verify-location', {
        method: 'POST',
        body: JSON.stringify({ latitude: 32.0853, longitude: 34.7818 }),
      });
      const response = await POST(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Vote not found');
    });

    it('should verify location successfully when in vote municipality', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getVoteById as Mock).mockResolvedValue(mockVote);
      (verifyLocationInMunicipality as Mock).mockReturnValue({
        isInside: true,
        municipality: { name: 'תל אביב-יפו' },
        distanceFromCenter: 500,
      });

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/verify-location', {
        method: 'POST',
        body: JSON.stringify({ latitude: 32.0853, longitude: 34.7818 }),
      });
      const response = await POST(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verified).toBe(true);
      expect(data.municipality).toBe('תל אביב-יפו');
      expect(data.distanceFromCenter).toBe(500);
    });

    it('should return unverified when outside vote municipality', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getVoteById as Mock).mockResolvedValue(mockVote);
      (verifyLocationInMunicipality as Mock).mockReturnValue({
        isInside: false,
        municipality: { name: 'תל אביב-יפו' },
        distanceFromCenter: 15000,
      });

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/verify-location', {
        method: 'POST',
        body: JSON.stringify({ latitude: 32.2, longitude: 34.9 }),
      });
      const response = await POST(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verified).toBe(false);
    });

    it('should use user municipality when vote has none', async () => {
      const voteWithoutMunicipality = { ...mockVote, municipality_id: null };
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getVoteById as Mock).mockResolvedValue(voteWithoutMunicipality);
      (findMunicipalityByCoordinates as Mock).mockReturnValue('tel-aviv');
      (getUserById as Mock).mockResolvedValue(mockUser);
      (verifyLocationInMunicipality as Mock).mockReturnValue({
        isInside: true,
        municipality: { name: 'תל אביב-יפו' },
        distanceFromCenter: 300,
      });

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/verify-location', {
        method: 'POST',
        body: JSON.stringify({ latitude: 32.0853, longitude: 34.7818 }),
      });
      const response = await POST(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verified).toBe(true);
    });

    it('should detect municipality when vote and user have none', async () => {
      const voteWithoutMunicipality = { ...mockVote, municipality_id: null };
      const userWithoutMunicipality = { ...mockUser, municipality_id: null };

      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getVoteById as Mock).mockResolvedValue(voteWithoutMunicipality);
      (getUserById as Mock).mockResolvedValue(userWithoutMunicipality);
      (findMunicipalityByCoordinates as Mock).mockReturnValue('tel-aviv');

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/verify-location', {
        method: 'POST',
        body: JSON.stringify({ latitude: 32.0853, longitude: 34.7818 }),
      });
      const response = await POST(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verified).toBe(true);
      expect(data.municipality).toBe('tel-aviv');
    });

    it('should handle database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getVoteById as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/votes/vote-123/verify-location', {
        method: 'POST',
        body: JSON.stringify({ latitude: 32.0853, longitude: 34.7818 }),
      });
      const response = await POST(request, { params: Promise.resolve({ id: 'vote-123' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to verify location');
    });
  });
});
