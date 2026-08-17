/**
 * Auth Session Refresh API Route Tests
 *
 * Tests for POST /api/auth/session/refresh after the Task 8 rewrite
 * (specs/mfa-engineering-model.md §5.1e): refresh-purpose-only acceptance,
 * intake from cookie OR JSON body OR bearer header (mobile has no cookie
 * jar), the stored-session_version check, the per-call assurance
 * re-derivation, rotation that preserves amr/asr without upgrading them,
 * and a response carrying both accessToken and the sessionToken alias with
 * an expiresAt derived from the real 1-hour session TTL.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

// Mock session service - keep the real TTL constants, mock the functions.
vi.mock('@/services/auth/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/auth/session')>()),
  getRefreshTokenFromCookies: vi.fn(),
  verifyRefreshToken: vi.fn(),
  createSessionToken: vi.fn(),
  createRefreshToken: vi.fn(),
  setSessionCookies: vi.fn(),
  clearSessionCookies: vi.fn(),
}));

vi.mock('@/services/auth/assurance', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/auth/assurance')>()),
  getRequiredAssurance: vi.fn(),
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
  clearSessionCookies,
  SESSION_TTL_SECONDS,
} from '@/services/auth/session';
import { getRequiredAssurance } from '@/services/auth/assurance';
import { getUserById, getSocialProofsByUserId } from '@/lib/supabase/db';
import { qubikService } from '@/services/qubik';

function refreshRequest(init?: { body?: unknown; bearer?: string }) {
  const headers: Record<string, string> = {};
  if (init?.bearer) headers['Authorization'] = `Bearer ${init.bearer}`;
  if (init?.body !== undefined) headers['Content-Type'] = 'application/json';
  return new NextRequest('http://localhost:3000/api/auth/session/refresh', {
    method: 'POST',
    headers,
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
}

describe('Auth Session Refresh API Routes', () => {
  let POST: typeof import('@/app/api/auth/session/refresh/route').POST;

  const mockClaims = {
    userId: 'user-123',
    sv: 3,
    amr: ['google'],
    asr: 'sf' as const,
    expiresAt: new Date('2026-09-01T00:00:00Z'),
  };

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
    session_version: 3,
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

  function primeHappyPath() {
    (getRefreshTokenFromCookies as Mock).mockResolvedValue('valid-token');
    (verifyRefreshToken as Mock).mockResolvedValue({ ...mockClaims });
    (getRequiredAssurance as Mock).mockResolvedValue('sf');
    (getUserById as Mock).mockResolvedValue(mockUser);
    (getSocialProofsByUserId as Mock).mockResolvedValue(mockSocialProofs);
    (createSessionToken as Mock).mockResolvedValue('new-session-token');
    (createRefreshToken as Mock).mockResolvedValue('new-refresh-token');
    (setSessionCookies as Mock).mockResolvedValue(undefined);
    (clearSessionCookies as Mock).mockResolvedValue(undefined);
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    (qubikService.getTokenBalance as Mock).mockResolvedValue(0);
    const routeModule = await import('@/app/api/auth/session/refresh/route');
    POST = routeModule.POST;
  });

  describe('POST /api/auth/session/refresh', () => {
    it('should return 401 when refresh token is missing everywhere', async () => {
      (getRefreshTokenFromCookies as Mock).mockResolvedValue(null);

      const response = await POST(refreshRequest());
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('No refresh token found');
      expect(data.code).toBe('NO_REFRESH_TOKEN');
    });

    it('should return 401 when refresh token is invalid', async () => {
      (getRefreshTokenFromCookies as Mock).mockResolvedValue('invalid-token');
      (verifyRefreshToken as Mock).mockResolvedValue(null);

      const response = await POST(refreshRequest());
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid refresh token');
      expect(data.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('refuses a session token presented as a refresh token', async () => {
      // Purpose typing makes verifyRefreshToken return null for a session
      // token; the route must go through that verifier and refuse.
      (getRefreshTokenFromCookies as Mock).mockResolvedValue('a-session-token');
      (verifyRefreshToken as Mock).mockResolvedValue(null);

      const response = await POST(refreshRequest());

      expect(response.status).toBe(401);
      expect(verifyRefreshToken).toHaveBeenCalledWith('a-session-token');
      expect(createSessionToken).not.toHaveBeenCalled();
    });

    it('accepts the refresh token from a JSON body when no cookie exists (mobile)', async () => {
      primeHappyPath();
      (getRefreshTokenFromCookies as Mock).mockResolvedValue(null);

      const response = await POST(refreshRequest({ body: { refreshToken: 'body-token' } }));

      expect(response.status).toBe(200);
      expect(verifyRefreshToken).toHaveBeenCalledWith('body-token');
    });

    it('accepts the refresh token from a bearer header when no cookie exists (mobile)', async () => {
      primeHappyPath();
      (getRefreshTokenFromCookies as Mock).mockResolvedValue(null);

      const response = await POST(refreshRequest({ bearer: 'bearer-token' }));

      expect(response.status).toBe(200);
      expect(verifyRefreshToken).toHaveBeenCalledWith('bearer-token');
    });

    it('returns 401 and clears cookies when the token sv is stale', async () => {
      primeHappyPath();
      (getUserById as Mock).mockResolvedValue({ ...mockUser, session_version: 4 });

      const response = await POST(refreshRequest());
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe('SESSION_REVOKED');
      expect(clearSessionCookies).toHaveBeenCalled();
      expect(createSessionToken).not.toHaveBeenCalled();
    });

    it('returns 401 MFA_REQUIRED when the token asr ranks below the account requirement', async () => {
      primeHappyPath();
      // The account now requires mf; the presented token is sf. In M1 this
      // branch can never fire (every account requires sf) - it exists so M2
      // changes only getRequiredAssurance's body, never this route.
      (getRequiredAssurance as Mock).mockResolvedValue('mf');

      const response = await POST(refreshRequest());
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe('MFA_REQUIRED');
      expect(clearSessionCookies).toHaveBeenCalled();
      expect(createSessionToken).not.toHaveBeenCalled();
    });

    it('rotates the refresh token, preserving amr/asr and stamping the stored sv', async () => {
      primeHappyPath();
      const mfClaims = { ...mockClaims, amr: ['google', 'totp'], asr: 'mf' as const };
      (verifyRefreshToken as Mock).mockResolvedValue(mfClaims);
      (getRequiredAssurance as Mock).mockResolvedValue('mf');

      const response = await POST(refreshRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      // Rotation: a fresh refresh token is minted and set alongside the session.
      expect(createRefreshToken).toHaveBeenCalledWith({
        userId: 'user-123',
        sv: 3,
        amr: ['google', 'totp'],
        asr: 'mf',
      });
      expect(createSessionToken).toHaveBeenCalledWith(
        expect.objectContaining({ sv: 3, amr: ['google', 'totp'], asr: 'mf' })
      );
      expect(data.refreshToken).toBe('new-refresh-token');
      expect(setSessionCookies).toHaveBeenCalledWith('new-session-token', 'new-refresh-token');
    });

    it('should return 404 when user not found', async () => {
      primeHappyPath();
      (getUserById as Mock).mockResolvedValue(null);

      const response = await POST(refreshRequest());
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });

    it('should successfully refresh session', async () => {
      primeHappyPath();

      const response = await POST(refreshRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.accessToken).toBe('new-session-token');
      // Mobile compatibility alias - same value under the name the mobile
      // store reads (apps/mobile/src/lib/auth.ts).
      expect(data.sessionToken).toBe('new-session-token');
      expect(data.refreshToken).toBe('new-refresh-token');
      expect(data.user).toBeDefined();
      expect(data.user.id).toBe('user-123');
      expect(setSessionCookies).toHaveBeenCalledWith('new-session-token', 'new-refresh-token');

      // expiresAt reflects the real 1h session TTL, not a hardcoded 7d.
      const deltaMs = new Date(data.expiresAt).getTime() - Date.now();
      expect(deltaMs).toBeGreaterThan((SESSION_TTL_SECONDS - 60) * 1000);
      expect(deltaMs).toBeLessThanOrEqual(SESSION_TTL_SECONDS * 1000);
    });

    it('should return the same canonical profile shape as the other auth routes', async () => {
      primeHappyPath();

      const data = await (await POST(refreshRequest())).json();

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
      primeHappyPath();
      (getUserById as Mock).mockRejectedValue(new Error('Database error'));

      const response = await POST(refreshRequest());
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Session refresh failed');
      expect(data.code).toBe('REFRESH_FAILED');
    });
  });
});
