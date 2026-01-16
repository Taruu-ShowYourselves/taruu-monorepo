/**
 * Social Proofs API Route Tests
 *
 * Tests for the /api/social/proofs endpoints:
 * - GET /api/social/proofs - Get user's social proofs and identity score
 * - DELETE /api/social/proofs - Disconnect a social platform
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, DELETE } from '@/app/api/social/proofs/route';

// Mock session service
vi.mock('@/services/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  getUserById: vi.fn(),
  getSocialProofsByUserId: vi.fn(),
  deleteSocialProof: vi.fn(),
}));

// Import mocked modules
import { getSessionFromRequest } from '@/services/auth/session';
import {
  getUserById,
  getSocialProofsByUserId,
  deleteSocialProof,
} from '@/lib/supabase/db';

describe('Social Proofs API Routes', () => {
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
    identity_score: 70,
    verification_status: 'verified',
    municipality_id: 'tel-aviv',
  };

  const mockSocialProofs = [
    {
      provider: 'google',
      provider_id: 'google-123',
      provider_name: 'Test User',
      provider_avatar: 'https://example.com/avatar.jpg',
      provider_email: 'test@gmail.com',
      connected_at: '2025-01-01T00:00:00Z',
    },
    {
      provider: 'facebook',
      provider_id: 'facebook-456',
      provider_name: 'Test User FB',
      provider_avatar: 'https://facebook.com/avatar.jpg',
      provider_email: 'test@facebook.com',
      connected_at: '2025-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/social/proofs', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/social/proofs', {
        method: 'GET',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when user not found', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/social/proofs', {
        method: 'GET',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });

    it('should return social proofs and identity score', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getSocialProofsByUserId as Mock).mockResolvedValue(mockSocialProofs);

      const request = new NextRequest('http://localhost:3000/api/social/proofs', {
        method: 'GET',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.socialProofs).toHaveLength(2);
      expect(data.socialProofs[0].platform).toBe('google');
      expect(data.socialProofs[0].providerId).toBe('google-123');
      expect(data.socialProofs[1].platform).toBe('facebook');
      expect(data.identityScore).toBeDefined();
      expect(data.identityScore.total).toBe(70);
      expect(data.identityScore.breakdown).toEqual({
        google: 40,
        facebook: 30,
        instagram: 0,
      });
      expect(data.identityScore.level).toBe('verified');
    });

    it('should return basic level for score under 70', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue({ ...mockUser, identity_score: 40 });
      (getSocialProofsByUserId as Mock).mockResolvedValue([mockSocialProofs[0]]);

      const request = new NextRequest('http://localhost:3000/api/social/proofs', {
        method: 'GET',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.identityScore.level).toBe('basic');
    });

    it('should return trusted level for score 100', async () => {
      const trustedProofs = [
        ...mockSocialProofs,
        {
          provider: 'instagram',
          provider_id: 'instagram-789',
          provider_name: 'Test Insta',
          provider_avatar: 'https://instagram.com/avatar.jpg',
          provider_email: null,
          connected_at: '2025-01-03T00:00:00Z',
        },
      ];
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue({ ...mockUser, identity_score: 100 });
      (getSocialProofsByUserId as Mock).mockResolvedValue(trustedProofs);

      const request = new NextRequest('http://localhost:3000/api/social/proofs', {
        method: 'GET',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.identityScore.total).toBe(100);
      expect(data.identityScore.level).toBe('trusted');
      expect(data.identityScore.breakdown).toEqual({
        google: 40,
        facebook: 30,
        instagram: 30,
      });
    });

    it('should handle database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/social/proofs', {
        method: 'GET',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch social proofs');
    });
  });

  describe('DELETE /api/social/proofs', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/social/proofs?platform=facebook',
        { method: 'DELETE' }
      );
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 when platform is missing', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/social/proofs', {
        method: 'DELETE',
      });
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid platform. Must be facebook or instagram.');
    });

    it('should return 400 when trying to disconnect Google', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest(
        'http://localhost:3000/api/social/proofs?platform=google',
        { method: 'DELETE' }
      );
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid platform. Must be facebook or instagram.');
    });

    it('should return 400 for invalid platform', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest(
        'http://localhost:3000/api/social/proofs?platform=twitter',
        { method: 'DELETE' }
      );
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
    });

    it('should return 404 when user not found', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/social/proofs?platform=facebook',
        { method: 'DELETE' }
      );
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });

    it('should disconnect Facebook successfully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock)
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce({ ...mockUser, identity_score: 40 });
      (deleteSocialProof as Mock).mockResolvedValue(undefined);
      (getSocialProofsByUserId as Mock).mockResolvedValue([mockSocialProofs[0]]);

      const request = new NextRequest(
        'http://localhost:3000/api/social/proofs?platform=facebook',
        { method: 'DELETE' }
      );
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.socialProofs).toHaveLength(1);
      expect(data.identityScore.total).toBe(40);
      expect(deleteSocialProof).toHaveBeenCalledWith('user-123', 'facebook');
    });

    it('should disconnect Instagram successfully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock)
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce({ ...mockUser, identity_score: 70 });
      (deleteSocialProof as Mock).mockResolvedValue(undefined);
      (getSocialProofsByUserId as Mock).mockResolvedValue(mockSocialProofs);

      const request = new NextRequest(
        'http://localhost:3000/api/social/proofs?platform=instagram',
        { method: 'DELETE' }
      );
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(deleteSocialProof).toHaveBeenCalledWith('user-123', 'instagram');
    });

    it('should handle database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (deleteSocialProof as Mock).mockRejectedValue(new Error('Delete failed'));

      const request = new NextRequest(
        'http://localhost:3000/api/social/proofs?platform=facebook',
        { method: 'DELETE' }
      );
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to disconnect platform');
    });
  });
});
