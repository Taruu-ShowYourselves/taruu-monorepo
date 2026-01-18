/**
 * Auth Session Refresh API Route Tests
 *
 * Tests for the /api/auth/session/refresh endpoint:
 * - POST /api/auth/session/refresh - Refresh session token
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

// Mock session service
vi.mock('@/services/auth/session', () => ({
  getRefreshTokenFromCookies: vi.fn(),
  verifyRefreshToken: vi.fn(),
  createSessionToken: vi.fn(),
  createRefreshToken: vi.fn(),
  setSessionCookies: vi.fn(),
}));

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  getUserById: vi.fn(),
  getSocialProofsByUserId: vi.fn(),
}));

// Import mocked modules
import {
  getRefreshTokenFromCookies,
  verifyRefreshToken,
  createSessionToken,
  createRefreshToken,
  setSessionCookies,
} from '@/services/auth/session';
import { getUserById, getSocialProofsByUserId } from '@/lib/supabase/db';

describe('Auth Session Refresh API Routes', () => {
  let POST: typeof import('@/app/api/auth/session/refresh/route').POST;

  const mockUser = {
    id: 'user-123',
    google_id: 'google-123',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    did: 'did:sync:' + 'a'.repeat(43),
    avatar_url: 'https://example.com/photo.jpg',
    identity_score: 50,
    verification_status: 'basic',
    municipality_id: 'tel-aviv',
    created_at: '2025-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const module = await import('@/app/api/auth/session/refresh/route');
    POST = module.POST;
  });

  describe('POST /api/auth/session/refresh', () => {
    it('should return 401 when refresh token is missing', async () => {
      (getRefreshTokenFromCookies as Mock).mockResolvedValue(null);

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('No refresh token found');
      expect(data.code).toBe('NO_REFRESH_TOKEN');
    });

    it('should return 401 when refresh token is invalid', async () => {
      (getRefreshTokenFromCookies as Mock).mockResolvedValue('invalid-token');
      (verifyRefreshToken as Mock).mockResolvedValue(null);

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid refresh token');
      expect(data.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('should return 404 when user not found', async () => {
      (getRefreshTokenFromCookies as Mock).mockResolvedValue('valid-token');
      (verifyRefreshToken as Mock).mockResolvedValue('user-123');
      (getUserById as Mock).mockResolvedValue(null);

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });

    it('should successfully refresh session', async () => {
      (getRefreshTokenFromCookies as Mock).mockResolvedValue('valid-token');
      (verifyRefreshToken as Mock).mockResolvedValue('user-123');
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getSocialProofsByUserId as Mock).mockResolvedValue([
        { provider: 'google' },
        { provider: 'facebook' },
      ]);
      (createSessionToken as Mock).mockResolvedValue('new-session-token');
      (createRefreshToken as Mock).mockResolvedValue('new-refresh-token');
      (setSessionCookies as Mock).mockResolvedValue(undefined);

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.accessToken).toBe('new-session-token');
      expect(data.refreshToken).toBe('new-refresh-token');
      expect(data.user).toBeDefined();
      expect(data.user.id).toBe('user-123');
      expect(data.user.socialProofs).toEqual(['google', 'facebook']);
      expect(data.expiresAt).toBeDefined();
      expect(setSessionCookies).toHaveBeenCalledWith('new-session-token', 'new-refresh-token');
    });

    it('should handle database errors gracefully', async () => {
      (getRefreshTokenFromCookies as Mock).mockResolvedValue('valid-token');
      (verifyRefreshToken as Mock).mockResolvedValue('user-123');
      (getUserById as Mock).mockRejectedValue(new Error('Database error'));

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Session refresh failed');
      expect(data.code).toBe('REFRESH_FAILED');
    });
  });
});
