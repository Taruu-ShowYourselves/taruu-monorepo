/**
 * Auth Callback API Route Tests
 *
 * Tests for the /api/auth/callback endpoint:
 * - POST /api/auth/callback - Handle Google OAuth callback
 */

import { describe, it, expect, beforeEach, vi, type Mock, afterAll } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Google OAuth service
vi.mock('@/services/auth/google', () => ({
  exchangeCodeForTokens: vi.fn(),
  getGoogleUserInfo: vi.fn(),
}));

// Mock session service
vi.mock('@/services/auth/session', () => ({
  createSessionToken: vi.fn(),
  createRefreshToken: vi.fn(),
  setSessionCookies: vi.fn(),
}));

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  getUserByGoogleId: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  upsertSocialProof: vi.fn(),
}));

// Mock DID utils
vi.mock('@sync/shared', () => ({
  generateEncryptedDID: vi.fn(),
}));

// Import mocked modules
import { exchangeCodeForTokens, getGoogleUserInfo } from '@/services/auth/google';
import { createSessionToken, createRefreshToken, setSessionCookies } from '@/services/auth/session';
import { getUserByGoogleId, createUser, updateUser, upsertSocialProof } from '@/lib/supabase/db';
import { generateEncryptedDID } from '@sync/shared';

describe('Auth Callback API Routes', () => {
  let POST: typeof import('@/app/api/auth/callback/route').POST;
  const originalEnv = process.env;

  const mockGoogleUser = {
    id: 'google-123',
    email: 'test@example.com',
    name: 'Test User',
    given_name: 'Test',
    family_name: 'User',
    picture: 'https://example.com/photo.jpg',
    verified_email: true,
  };

  const mockDbUser = {
    id: 'user-123',
    google_id: 'google-123',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    did: 'did:sync:' + 'a'.repeat(43),
    identity_score: 40,
    verification_status: 'none',
    avatar_url: 'https://example.com/photo.jpg',
    municipality_id: null,
    created_at: '2025-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: 'https://taruu.co.il',
      GOOGLE_CLIENT_SECRET: 'google-secret',
    };
    vi.resetModules();
    const module = await import('@/app/api/auth/callback/route');
    POST = module.POST;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('POST /api/auth/callback', () => {
    it('should return 400 when code is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/callback', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Authorization code required');
      expect(data.code).toBe('MISSING_CODE');
    });

    it('should return 500 when GOOGLE_CLIENT_SECRET is not set', async () => {
      delete process.env.GOOGLE_CLIENT_SECRET;
      vi.resetModules();
      const { POST: POST2 } = await import('@/app/api/auth/callback/route');

      const request = new NextRequest('http://localhost:3000/api/auth/callback', {
        method: 'POST',
        body: JSON.stringify({ code: 'valid-code' }),
      });
      const response = await POST2(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Server configuration error');
    });

    it('should create new user on first login', async () => {
      const mockDIDData = {
        did: 'did:sync:' + 'b'.repeat(43),
        publicKey: { x: 'pub-x', y: 'pub-y' },
        encryptedPrivateKey: 'encrypted-key',
        salt: 'salt',
        iv: 'iv',
      };

      (exchangeCodeForTokens as Mock).mockResolvedValue({
        accessToken: 'google-access-token',
        idToken: 'google-id-token',
      });
      (getGoogleUserInfo as Mock).mockResolvedValue(mockGoogleUser);
      (getUserByGoogleId as Mock).mockResolvedValue(null);
      (generateEncryptedDID as Mock).mockResolvedValue(mockDIDData);
      (createUser as Mock).mockResolvedValue({
        ...mockDbUser,
        did: mockDIDData.did,
      });
      (upsertSocialProof as Mock).mockResolvedValue({ id: 'proof-1' });
      (createSessionToken as Mock).mockResolvedValue('session-token');
      (createRefreshToken as Mock).mockResolvedValue('refresh-token');
      (setSessionCookies as Mock).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/auth/callback', {
        method: 'POST',
        body: JSON.stringify({ code: 'valid-code' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.accessToken).toBe('session-token');
      expect(data.refreshToken).toBe('refresh-token');
      expect(data.isNewUser).toBe(true);
      expect(createUser).toHaveBeenCalled();
      expect(generateEncryptedDID).toHaveBeenCalled();
    });

    it('should update existing user on subsequent login', async () => {
      (exchangeCodeForTokens as Mock).mockResolvedValue({
        accessToken: 'google-access-token',
        idToken: 'google-id-token',
      });
      (getGoogleUserInfo as Mock).mockResolvedValue(mockGoogleUser);
      (getUserByGoogleId as Mock).mockResolvedValue(mockDbUser);
      (updateUser as Mock).mockResolvedValue(mockDbUser);
      (createSessionToken as Mock).mockResolvedValue('session-token');
      (createRefreshToken as Mock).mockResolvedValue('refresh-token');
      (setSessionCookies as Mock).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/auth/callback', {
        method: 'POST',
        body: JSON.stringify({ code: 'valid-code' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.isNewUser).toBe(false);
      expect(createUser).not.toHaveBeenCalled();
      expect(updateUser).toHaveBeenCalledWith('user-123', expect.any(Object));
    });

    it('should handle Google token exchange errors', async () => {
      (exchangeCodeForTokens as Mock).mockRejectedValue(new Error('Invalid code'));

      const request = new NextRequest('http://localhost:3000/api/auth/callback', {
        method: 'POST',
        body: JSON.stringify({ code: 'invalid-code' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Authentication failed');
      expect(data.code).toBe('AUTH_FAILED');
    });

    it('should handle database errors gracefully', async () => {
      (exchangeCodeForTokens as Mock).mockResolvedValue({
        accessToken: 'google-access-token',
        idToken: 'google-id-token',
      });
      (getGoogleUserInfo as Mock).mockResolvedValue(mockGoogleUser);
      (getUserByGoogleId as Mock).mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/auth/callback', {
        method: 'POST',
        body: JSON.stringify({ code: 'valid-code' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Authentication failed');
    });
  });
});
