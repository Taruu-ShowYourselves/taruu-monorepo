/**
 * User Verify Location API Route Tests
 *
 * Tests for the /api/user/verify-location endpoint:
 * - POST /api/user/verify-location - Verify user's GPS location against municipality
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

// Mock session service
vi.mock('@/services/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  getUserByGoogleId: vi.fn(),
}));

// Mock municipality service
vi.mock('@/services/verification/municipality', () => ({
  verifyLocationInMunicipality: vi.fn(),
  findMunicipalityByCoordinates: vi.fn(),
  getMunicipalityBounds: vi.fn(),
}));

// Import mocked modules
import { getSessionFromRequest } from '@/services/auth/session';
import { getUserByGoogleId } from '@/lib/supabase/db';
import {
  verifyLocationInMunicipality,
  findMunicipalityByCoordinates,
  getMunicipalityBounds,
} from '@/services/verification/municipality';

describe('User Verify Location API Routes', () => {
  let POST: typeof import('@/app/api/user/verify-location/route').POST;

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
    email: 'test@example.com',
    municipality_id: 'tel-aviv',
  };

  const mockMunicipalityBounds = {
    id: 'tel-aviv',
    nameHe: 'תל אביב-יפו',
    nameEn: 'Tel Aviv-Yafo',
    center: { lat: 32.0853, lng: 34.7818 },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const module = await import('@/app/api/user/verify-location/route');
    POST = module.POST;
  });

  describe('POST /api/user/verify-location', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/verify-location', {
        method: 'POST',
        body: JSON.stringify({ latitude: 32.0853, longitude: 34.7818 }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 when coordinates are invalid', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/user/verify-location', {
        method: 'POST',
        body: JSON.stringify({ latitude: 'invalid', longitude: 34.7818 }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid coordinates');
    });

    it('should return 400 when latitude is missing', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/user/verify-location', {
        method: 'POST',
        body: JSON.stringify({ longitude: 34.7818 }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid coordinates');
    });

    it('should return 400 when longitude is missing', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/user/verify-location', {
        method: 'POST',
        body: JSON.stringify({ latitude: 32.0853 }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid coordinates');
    });

    it('should return 400 when latitude is out of range', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/user/verify-location', {
        method: 'POST',
        body: JSON.stringify({ latitude: 91, longitude: 34.7818 }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Coordinates out of range');
    });

    it('should return 400 when longitude is out of range', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/user/verify-location', {
        method: 'POST',
        body: JSON.stringify({ latitude: 32.0853, longitude: 181 }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Coordinates out of range');
    });

    it('should return 404 when user not found', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/verify-location', {
        method: 'POST',
        body: JSON.stringify({ latitude: 32.0853, longitude: 34.7818 }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });

    it('should verify location within registered municipality', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);
      (verifyLocationInMunicipality as Mock).mockReturnValue({
        isInside: true,
        distanceFromCenter: 500,
      });
      (getMunicipalityBounds as Mock).mockReturnValue(mockMunicipalityBounds);

      const request = new NextRequest('http://localhost:3000/api/user/verify-location', {
        method: 'POST',
        body: JSON.stringify({ latitude: 32.0853, longitude: 34.7818 }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verified).toBe(true);
      expect(data.municipality).toBe('תל אביב-יפו');
      expect(data.municipalityId).toBe('tel-aviv');
      expect(data.distanceFromCenter).toBe(500);
    });

    it('should return unverified when outside registered municipality', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue(mockUser);
      (verifyLocationInMunicipality as Mock).mockReturnValue({
        isInside: false,
        distanceFromCenter: 15000,
      });
      (getMunicipalityBounds as Mock).mockReturnValue(mockMunicipalityBounds);

      const request = new NextRequest('http://localhost:3000/api/user/verify-location', {
        method: 'POST',
        body: JSON.stringify({ latitude: 32.2, longitude: 34.9 }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verified).toBe(false);
      expect(data.distanceFromCenter).toBe(15000);
    });

    it('should detect municipality when user has none registered', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue({ ...mockUser, municipality_id: null });
      (findMunicipalityByCoordinates as Mock).mockReturnValue('tel-aviv');
      (getMunicipalityBounds as Mock).mockReturnValue(mockMunicipalityBounds);

      const request = new NextRequest('http://localhost:3000/api/user/verify-location', {
        method: 'POST',
        body: JSON.stringify({ latitude: 32.0853, longitude: 34.7818 }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verified).toBe(true);
      expect(data.municipality).toBe('תל אביב-יפו');
      expect(data.municipalityId).toBe('tel-aviv');
    });

    it('should return no municipality when detection fails', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockResolvedValue({ ...mockUser, municipality_id: null });
      (findMunicipalityByCoordinates as Mock).mockReturnValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/verify-location', {
        method: 'POST',
        body: JSON.stringify({ latitude: 40.0, longitude: 40.0 }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verified).toBe(false);
      expect(data.municipality).toBeUndefined();
    });

    it('should handle database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserByGoogleId as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/user/verify-location', {
        method: 'POST',
        body: JSON.stringify({ latitude: 32.0853, longitude: 34.7818 }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to verify location');
    });
  });
});
