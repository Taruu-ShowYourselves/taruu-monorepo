/**
 * Auth Callback API Route Tests
 *
 * Tests for the /api/auth/callback endpoint:
 * - POST /api/auth/callback - Handle Auth0 OIDC callback (federates Google)
 */

import { describe, it, expect, beforeEach, vi, type Mock, afterAll } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Auth0 OIDC service (primary login)
vi.mock('@/services/auth/google', () => ({
  exchangeCodeForTokens: vi.fn(),
  getGoogleUserInfo: vi.fn(),
  GOOGLE_REDIRECT_PATH: '/he/sign-in',
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
  getSocialProofsByUserId: vi.fn(),
}));

// Mock external services (the canonical profile mapper reads the token balance)
vi.mock('@/services/qubik', () => ({
  qubikService: {
    getTokenBalance: vi.fn(),
    createWallet: vi.fn(),
  },
}));

// Mock DID utils only — the rest of @sync/shared must stay real, because the
// canonical profile mapper computes the identity score with it.
vi.mock('@sync/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sync/shared')>()),
  generateEncryptedDID: vi.fn(),
}));

// Import mocked modules
import { exchangeCodeForTokens, getGoogleUserInfo } from '@/services/auth/google';
import { createSessionToken, createRefreshToken, setSessionCookies } from '@/services/auth/session';
import {
  getUserByGoogleId,
  createUser,
  updateUser,
  upsertSocialProof,
  getSocialProofsByUserId,
} from '@/lib/supabase/db';
import { generateEncryptedDID } from '@sync/shared';

describe('Auth Callback API Routes', () => {
  let POST: typeof import('@/app/api/auth/callback/route').POST;
  const originalEnv = process.env;

  // Auth0 OIDC /userinfo shape. `sub` is the external identity key
  // (federated Google subject) persisted on users.google_id / session.googleId.
  const mockGoogleUser = {
    sub: 'google-123',
    email: 'test@example.com',
    name: 'Test User',
    given_name: 'Test',
    family_name: 'User',
    picture: 'https://example.com/photo.jpg',
    email_verified: true,
  };

  const mockDbUser = {
    id: 'user-123',
    google_id: 'google-123',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    phone: null,
    did: 'did:sync:' + 'a'.repeat(43),
    identity_score: 40,
    verification_status: 'none',
    avatar_url: 'https://example.com/photo.jpg',
    municipality_id: null,
    city: null,
    notification_settings: null,
    // No wallet: the balance lookup short-circuits, so this suite never
    // depends on the Qubik mock surviving the `vi.resetModules()` below.
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
      provider_avatar: 'https://example.com/photo.jpg',
      connected_at: '2025-01-01T00:00:00Z',
    },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    (getSocialProofsByUserId as Mock).mockResolvedValue(mockSocialProofs);
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: 'https://taruu.co.il',
      GOOGLE_CLIENT_SECRET: 'google-secret',
    };
    vi.resetModules();
    const routeModule = await import('@/app/api/auth/callback/route');
    POST = routeModule.POST;
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

    it('should return the same canonical profile shape as the other auth routes', async () => {
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
      const data = await (await POST(request)).json();

      // Objects, not raw DB scalars — the OAuth callback is the very first
      // response the browser stores, so it must already be canonical.
      expect(typeof data.user.verificationStatus).toBe('object');
      expect(data.user.verificationStatus.phase).toBe('not_started');
      expect(typeof data.user.identityScore).toBe('object');
      expect(data.user.identityScore.total).toBe(40); // google only
      expect(data.user.identityScore.level).toBe('basic');

      // Fields the old hand-rolled mapping dropped entirely.
      expect(data.user.socialProofs).toHaveLength(1);
      expect(data.user.socialProofs[0].platform).toBe('google');
      expect(data.user.syncTokenBalance).toBe(0);
      expect(data.user.city).toBeNull();
      expect(data.user.phone).toBeNull();
      expect(data.user.createdAt).toBe('2025-01-01T00:00:00Z');
      expect(getSocialProofsByUserId).toHaveBeenCalledWith('user-123');
    });

    it('maps the row persisted by the login update, not the pre-update row', async () => {
      (exchangeCodeForTokens as Mock).mockResolvedValue({
        accessToken: 'google-access-token',
        idToken: 'google-id-token',
      });
      (getGoogleUserInfo as Mock).mockResolvedValue(mockGoogleUser);
      (getUserByGoogleId as Mock).mockResolvedValue(mockDbUser);
      // The update returns the fresh row — including a municipality set on
      // another device since this row was last read.
      (updateUser as Mock).mockResolvedValue({
        ...mockDbUser,
        municipality_id: 'haifa',
        updated_at: '2025-06-06T00:00:00Z',
      });
      (createSessionToken as Mock).mockResolvedValue('session-token');
      (createRefreshToken as Mock).mockResolvedValue('refresh-token');
      (setSessionCookies as Mock).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/auth/callback', {
        method: 'POST',
        body: JSON.stringify({ code: 'valid-code' }),
      });
      const data = await (await POST(request)).json();

      expect(data.user.municipality).toBe('haifa');
      expect(data.user.updatedAt).toBe('2025-06-06T00:00:00Z');
    });

    it('falls back to the known row when the login update fails', async () => {
      (exchangeCodeForTokens as Mock).mockResolvedValue({
        accessToken: 'google-access-token',
        idToken: 'google-id-token',
      });
      (getGoogleUserInfo as Mock).mockResolvedValue(mockGoogleUser);
      (getUserByGoogleId as Mock).mockResolvedValue(mockDbUser);
      (updateUser as Mock).mockResolvedValue(null);
      (createSessionToken as Mock).mockResolvedValue('session-token');
      (createRefreshToken as Mock).mockResolvedValue('refresh-token');
      (setSessionCookies as Mock).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/auth/callback', {
        method: 'POST',
        body: JSON.stringify({ code: 'valid-code' }),
      });
      const response = await POST(request);
      const data = await response.json();

      // Sign-in still succeeds rather than 500-ing on a failed touch.
      expect(response.status).toBe(200);
      expect(data.user.id).toBe('user-123');
      expect(data.user.updatedAt).toBe('2025-01-01T00:00:00Z');
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
