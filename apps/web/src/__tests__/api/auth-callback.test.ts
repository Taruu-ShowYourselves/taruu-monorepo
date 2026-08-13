/**
 * Auth Callback API Route Tests
 *
 * Tests for POST /api/auth/callback after the Task 7 hardening
 * (specs/mfa-engineering-model.md §5.2): the ordered gate sequence
 * (code → state → state cookie → double submit → signed-state verify →
 * config → id_token present → id_token verified), single-use state cookie,
 * verified-id_token subject as the identity authority with userinfo demoted
 * to non-fatal enrichment, and session/refresh mint carrying sv/amr/asr.
 */

import { describe, it, expect, beforeEach, vi, type Mock, afterAll } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/auth/google', () => ({
  exchangeCodeForTokens: vi.fn(),
  getGoogleUserInfo: vi.fn(),
  GOOGLE_REDIRECT_PATH: '/he/sign-in',
}));

// Keep the real GoogleIdTokenVerificationError class so the route's
// instanceof/category branching is exercised; mock only the verifier.
vi.mock('@/services/auth/google-oidc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/auth/google-oidc')>()),
  verifyGoogleIdToken: vi.fn(),
}));

vi.mock('@/services/auth/login-state', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/auth/login-state')>()),
  verifyLoginOAuthState: vi.fn(),
}));

vi.mock('@/services/auth/session', () => ({
  createSessionToken: vi.fn(),
  createRefreshToken: vi.fn(),
  setSessionCookies: vi.fn(),
}));

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

// Mock DID utils only - the rest of @sync/shared must stay real, because the
// canonical profile mapper computes the identity score with it.
vi.mock('@sync/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sync/shared')>()),
  generateEncryptedDID: vi.fn(),
}));

// Import mocked modules
import { exchangeCodeForTokens, getGoogleUserInfo } from '@/services/auth/google';
import { verifyGoogleIdToken, GoogleIdTokenVerificationError } from '@/services/auth/google-oidc';
import { verifyLoginOAuthState } from '@/services/auth/login-state';
import { createSessionToken, createRefreshToken, setSessionCookies } from '@/services/auth/session';
import {
  getUserByGoogleId,
  createUser,
  updateUser,
  upsertSocialProof,
  getSocialProofsByUserId,
} from '@/lib/supabase/db';
import { generateEncryptedDID } from '@sync/shared';

const STATE = 'signed-state-token';

/** Request whose state param and sync-oauth-state cookie agree (the happy double submit). */
function callbackRequest(body: Record<string, unknown>, cookieState: string | null = STATE) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookieState !== null) headers['Cookie'] = `sync-oauth-state=${cookieState}`;
  return new NextRequest('http://localhost:3000/api/auth/callback', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  });
}

describe('Auth Callback API Routes', () => {
  let POST: typeof import('@/app/api/auth/callback/route').POST;
  const originalEnv = process.env;

  const mockIdentity = {
    subject: 'google-123',
    email: 'test@example.com',
    emailVerified: true as const,
    givenName: 'Test',
    familyName: 'User',
    picture: 'https://example.com/photo.jpg',
  };

  // Userinfo enrichment shape (names/picture only from here on).
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
    session_version: 3,
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

  /** Wire every mock for a successful existing-user login; tests override what they need. */
  function primeHappyPath() {
    (verifyLoginOAuthState as Mock).mockResolvedValue({ nonceHash: 'n'.repeat(64), flow: 'login' });
    (exchangeCodeForTokens as Mock).mockResolvedValue({
      accessToken: 'google-access-token',
      idToken: 'google-id-token',
    });
    (verifyGoogleIdToken as Mock).mockResolvedValue(mockIdentity);
    (getGoogleUserInfo as Mock).mockResolvedValue(mockGoogleUser);
    (getUserByGoogleId as Mock).mockResolvedValue(mockDbUser);
    (updateUser as Mock).mockResolvedValue(mockDbUser);
    (createSessionToken as Mock).mockResolvedValue('session-token');
    (createRefreshToken as Mock).mockResolvedValue('refresh-token');
    (setSessionCookies as Mock).mockResolvedValue(undefined);
  }

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

  describe('gate sequence (all before any side effect)', () => {
    it('returns 400 MISSING_CODE when code is missing', async () => {
      const response = await POST(callbackRequest({ state: STATE }));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('MISSING_CODE');
    });

    it('returns 400 MISSING_STATE when state is missing', async () => {
      const response = await POST(callbackRequest({ code: 'valid-code' }));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('MISSING_STATE');
    });

    it('returns 400 MISSING_STATE_COOKIE without the double-submit cookie', async () => {
      const response = await POST(callbackRequest({ code: 'valid-code', state: STATE }, null));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('MISSING_STATE_COOKIE');
    });

    it('returns 400 STATE_MISMATCH when param and cookie disagree', async () => {
      const response = await POST(
        callbackRequest({ code: 'valid-code', state: STATE }, 'a-different-state')
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('STATE_MISMATCH');
      // No identity work may have started.
      expect(exchangeCodeForTokens).not.toHaveBeenCalled();
    });

    it('returns 400 INVALID_STATE when the signed state does not verify', async () => {
      (verifyLoginOAuthState as Mock).mockResolvedValue(null);

      const response = await POST(callbackRequest({ code: 'valid-code', state: STATE }));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('INVALID_STATE');
      expect(exchangeCodeForTokens).not.toHaveBeenCalled();
    });

    it('returns 500 CONFIG_ERROR when GOOGLE_CLIENT_SECRET is not set', async () => {
      delete process.env.GOOGLE_CLIENT_SECRET;
      vi.resetModules();
      const { POST: POST2 } = await import('@/app/api/auth/callback/route');
      (verifyLoginOAuthState as Mock).mockResolvedValue({ nonceHash: 'n'.repeat(64), flow: 'login' });

      const response = await POST2(callbackRequest({ code: 'valid-code', state: STATE }));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe('CONFIG_ERROR');
    });

    it('returns 401 MISSING_ID_TOKEN when Google omits the id_token', async () => {
      primeHappyPath();
      (exchangeCodeForTokens as Mock).mockResolvedValue({ accessToken: 'google-access-token' });

      const response = await POST(callbackRequest({ code: 'valid-code', state: STATE }));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe('MISSING_ID_TOKEN');
      expect(getUserByGoogleId).not.toHaveBeenCalled();
    });

    it('returns 401 with a generic code when id_token verification fails', async () => {
      primeHappyPath();
      (verifyGoogleIdToken as Mock).mockRejectedValue(
        new GoogleIdTokenVerificationError('nonce_mismatch', 'nonce mismatch')
      );

      const response = await POST(callbackRequest({ code: 'valid-code', state: STATE }));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe('ID_TOKEN_VERIFICATION_FAILED');
      // The oracle stays closed: the body never says which check failed.
      expect(JSON.stringify(data)).not.toContain('nonce');
      expect(getUserByGoogleId).not.toHaveBeenCalled();
    });

    it('returns 403 for an unverified Google email', async () => {
      primeHappyPath();
      (verifyGoogleIdToken as Mock).mockRejectedValue(
        new GoogleIdTokenVerificationError('email_not_verified', 'email not verified')
      );

      const response = await POST(callbackRequest({ code: 'valid-code', state: STATE }));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe('ID_TOKEN_VERIFICATION_FAILED');
    });
  });

  describe('POST /api/auth/callback', () => {
    it('deletes the state cookie on every response (single use)', async () => {
      primeHappyPath();

      const success = await POST(callbackRequest({ code: 'valid-code', state: STATE }));
      expect(success.cookies.get('sync-oauth-state')?.value).toBe('');

      (verifyLoginOAuthState as Mock).mockResolvedValue(null);
      const failure = await POST(callbackRequest({ code: 'valid-code', state: STATE }));
      expect(failure.cookies.get('sync-oauth-state')?.value).toBe('');
    });

    it('should create new user on first login', async () => {
      const mockDIDData = {
        did: 'did:sync:' + 'b'.repeat(43),
        publicKey: { x: 'pub-x', y: 'pub-y' },
        encryptedPrivateKey: 'encrypted-key',
        salt: 'salt',
        iv: 'iv',
      };

      primeHappyPath();
      (getUserByGoogleId as Mock).mockResolvedValue(null);
      (generateEncryptedDID as Mock).mockResolvedValue(mockDIDData);
      (createUser as Mock).mockResolvedValue({
        ...mockDbUser,
        did: mockDIDData.did,
        session_version: 1,
      });
      (upsertSocialProof as Mock).mockResolvedValue({ id: 'proof-1' });

      const response = await POST(callbackRequest({ code: 'valid-code', state: STATE }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.accessToken).toBe('session-token');
      expect(data.refreshToken).toBe('refresh-token');
      expect(data.isNewUser).toBe(true);
      expect(createUser).toHaveBeenCalled();
      expect(generateEncryptedDID).toHaveBeenCalled();
      // Identity comes from the verified id_token subject, not from userinfo.
      expect(getUserByGoogleId).toHaveBeenCalledWith(mockIdentity.subject);
      // Mint carries the row's sv and the M1 login defaults.
      expect(createSessionToken).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123', sv: 1, amr: ['google'], asr: 'sf' })
      );
      expect(createRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123', sv: 1, amr: ['google'], asr: 'sf' })
      );
    });

    it('should update existing user on subsequent login', async () => {
      primeHappyPath();

      const response = await POST(callbackRequest({ code: 'valid-code', state: STATE }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.isNewUser).toBe(false);
      expect(createUser).not.toHaveBeenCalled();
      expect(updateUser).toHaveBeenCalledWith('user-123', expect.any(Object));
      // sv is the stored row's value - never a literal at the call site.
      expect(createSessionToken).toHaveBeenCalledWith(expect.objectContaining({ sv: 3 }));
    });

    it('userinfo enrichment failure does not fail the login', async () => {
      primeHappyPath();
      (getGoogleUserInfo as Mock).mockRejectedValue(new Error('userinfo down'));

      const response = await POST(callbackRequest({ code: 'valid-code', state: STATE }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return the same canonical profile shape as the other auth routes', async () => {
      primeHappyPath();

      const data = await (await POST(callbackRequest({ code: 'valid-code', state: STATE }))).json();

      // Objects, not raw DB scalars - the OAuth callback is the very first
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
      primeHappyPath();
      // The update returns the fresh row - including a municipality set on
      // another device since this row was last read.
      (updateUser as Mock).mockResolvedValue({
        ...mockDbUser,
        municipality_id: 'haifa',
        updated_at: '2025-06-06T00:00:00Z',
      });

      const data = await (await POST(callbackRequest({ code: 'valid-code', state: STATE }))).json();

      expect(data.user.municipality).toBe('haifa');
      expect(data.user.updatedAt).toBe('2025-06-06T00:00:00Z');
    });

    it('falls back to the known row when the login update fails', async () => {
      primeHappyPath();
      (updateUser as Mock).mockResolvedValue(null);

      const response = await POST(callbackRequest({ code: 'valid-code', state: STATE }));
      const data = await response.json();

      // Sign-in still succeeds rather than 500-ing on a failed touch.
      expect(response.status).toBe(200);
      expect(data.user.id).toBe('user-123');
      expect(data.user.updatedAt).toBe('2025-01-01T00:00:00Z');
    });

    it('should handle Google token exchange errors', async () => {
      primeHappyPath();
      (exchangeCodeForTokens as Mock).mockRejectedValue(new Error('Invalid code'));

      const response = await POST(callbackRequest({ code: 'invalid-code', state: STATE }));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Authentication failed');
      expect(data.code).toBe('AUTH_FAILED');
      // Generic to the client - no internals echoed.
      expect(data.details).toBeUndefined();
    });

    it('should handle database errors gracefully', async () => {
      primeHappyPath();
      (getUserByGoogleId as Mock).mockRejectedValue(new Error('Database connection failed'));

      const response = await POST(callbackRequest({ code: 'valid-code', state: STATE }));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Authentication failed');
    });
  });
});
