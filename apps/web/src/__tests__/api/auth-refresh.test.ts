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

// Mock external services (the canonical profile mapper reads the token balance)
vi.mock('@/services/qubik', () => ({
  qubikService: {
    getTokenBalance: vi.fn(),
    createWallet: vi.fn(),
  },
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
import { qubikService } from '@/services/qubik';

describe('Auth Session Refresh API Routes', () => {
  let POST: typeof import('@/app/api/auth/session/refresh/route').POST;

  const mockUser = {
    id: 'user-123',
    google_id: 'google-123',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    phone: null,
    did: 'did:sync:' + 'a'.repeat(43),
    avatar_url: 'https://example.com/photo.jpg',
    identity_score: 50,
    verification_status: 'pending',
    municipality_id: 'tel-aviv',
    city: null,
    notification_settings: null,
    // No wallet: `getTokenBalanceSafe` short-circuits, so the balance is a
    // deterministic 0 and this suite never depends on the Qubik mock surviving
    // the `vi.resetModules()` in beforeEach.
    qubik_wallet_address: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  };

  const mockSocialProofs = [
    {
      provider: 'google',
      provider_id: 'google-123',
      provider_name: 'Test User',
      provider_email: 'test@example.com',
      provider_avatar: null,
      connected_at: '2025-01-01T00:00:00Z',
    },
    {
      provider: 'facebook',
      provider_id: 'facebook-456',
      provider_name: 'Test FB',
      provider_email: null,
      provider_avatar: null,
      connected_at: '2025-01-02T00:00:00Z',
    },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    (qubikService.getTokenBalance as Mock).mockResolvedValue(0);
    const routeModule = await import('@/app/api/auth/session/refresh/route');
    POST = routeModule.POST;
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
      (getSocialProofsByUserId as Mock).mockResolvedValue(mockSocialProofs);
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
      expect(data.expiresAt).toBeDefined();
      expect(setSessionCookies).toHaveBeenCalledWith('new-session-token', 'new-refresh-token');
    });

    it('should return the same canonical profile shape as the other auth routes', async () => {
      (getRefreshTokenFromCookies as Mock).mockResolvedValue('valid-token');
      (verifyRefreshToken as Mock).mockResolvedValue('user-123');
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getSocialProofsByUserId as Mock).mockResolvedValue(mockSocialProofs);
      (createSessionToken as Mock).mockResolvedValue('new-session-token');
      (createRefreshToken as Mock).mockResolvedValue('new-refresh-token');
      (setSessionCookies as Mock).mockResolvedValue(undefined);

      const data = await (await POST()).json();

      // Objects, not raw DB scalars.
      expect(typeof data.user.verificationStatus).toBe('object');
      expect(data.user.verificationStatus.phase).toBe('in_progress');
      expect(typeof data.user.identityScore).toBe('object');
      expect(data.user.identityScore.total).toBe(50); // google 40 + facebook 10
      expect(data.user.identityScore.level).toBe('basic');

      // Social proofs are full objects, not a bare provider-name array.
      expect(data.user.socialProofs).toHaveLength(2);
      expect(data.user.socialProofs[0].platform).toBe('google');

      // Fields the old hand-rolled mapping dropped.
      expect(data.user.syncTokenBalance).toBe(0);
      expect(data.user.municipality).toBe('tel-aviv');
      expect(data.user.city).toBeNull();
      expect(data.user.phone).toBeNull();
      expect(data.user.createdAt).toBe('2025-01-01T00:00:00Z');
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
