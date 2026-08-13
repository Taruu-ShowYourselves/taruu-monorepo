/**
 * Bounded legacy-token acceptance window (canonical §4.6, requirement #71-M1-09).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { SignJWT } from 'jose';
import { resetDerivedKeyCache } from './keys';

const { cookieStore } = vi.hoisted(() => ({ cookieStore: new Map<string, string>() }));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { name, value: cookieStore.get(name)! } : undefined,
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  }),
}));

vi.mock('@/lib/supabase/db', () => ({
  getUserSessionVersion: vi.fn(),
}));

import { getUserSessionVersion } from '@/lib/supabase/db';

const LEGACY_SECRET = 'legacy-secret-at-least-32-chars-long';
const AUTH_MASTER_KEY = 'a'.repeat(32);

async function signLegacyToken(
  claims: Record<string, unknown>,
  opts: { expiresIn?: string; alg?: string } = {}
): Promise<string> {
  const key = new TextEncoder().encode(LEGACY_SECRET);
  return new SignJWT(claims)
    .setProtectedHeader({ alg: opts.alg ?? 'HS256' })
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? '7d')
    .sign(key);
}

function bearerRequest(token: string): Request {
  return new Request('http://localhost/api/x', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function futureIso(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

describe('legacy-token.ts', () => {
  beforeEach(() => {
    resetDerivedKeyCache();
    cookieStore.clear();
    vi.clearAllMocks();
    vi.stubEnv('AUTH_MASTER_KEY', AUTH_MASTER_KEY);
    vi.stubEnv('JWT_SECRET', LEGACY_SECRET);
  });

  describe('isLegacyWindowOpen', () => {
    it('is open only while AUTH_LEGACY_UNTIL parses and is in the future', async () => {
      const { isLegacyWindowOpen } = await import('./legacy-token');

      vi.stubEnv('AUTH_LEGACY_UNTIL', futureIso(24));
      expect(isLegacyWindowOpen()).toBe(true);
    });

    it('is closed when AUTH_LEGACY_UNTIL is unset', async () => {
      vi.stubEnv('AUTH_LEGACY_UNTIL', '');
      const { isLegacyWindowOpen } = await import('./legacy-token');
      expect(isLegacyWindowOpen()).toBe(false);
    });

    it('is closed when AUTH_LEGACY_UNTIL is unparseable', async () => {
      vi.stubEnv('AUTH_LEGACY_UNTIL', 'not-a-date');
      const { isLegacyWindowOpen } = await import('./legacy-token');
      expect(isLegacyWindowOpen()).toBe(false);
    });

    it('is closed once the deadline has passed', async () => {
      vi.stubEnv('AUTH_LEGACY_UNTIL', new Date(Date.now() - 60_000).toISOString());
      const { isLegacyWindowOpen } = await import('./legacy-token');
      expect(isLegacyWindowOpen()).toBe(false);
    });
  });

  describe('verifyLegacySessionToken', () => {
    it('authenticates a pre-M1 HS256 token inside the window as asr sf, amr [google], sv 1', async () => {
      vi.stubEnv('AUTH_LEGACY_UNTIL', futureIso(24));
      const { verifyLegacySessionToken } = await import('./legacy-token');

      const token = await signLegacyToken({
        userId: 'user-1',
        googleId: 'google-1',
        did: 'did:sync:x',
        email: 'a@b.com',
      });

      const claims = await verifyLegacySessionToken(token);
      expect(claims).not.toBeNull();
      expect(claims?.userId).toBe('user-1');
      expect(claims?.googleId).toBe('google-1');
      expect(claims?.did).toBe('did:sync:x');
      expect(claims?.email).toBe('a@b.com');
      expect(claims?.sv).toBe(1);
      expect(claims?.amr).toEqual(['google']);
      expect(claims?.asr).toBe('sf');
    });

    it('returns null past AUTH_LEGACY_UNTIL', async () => {
      vi.stubEnv('AUTH_LEGACY_UNTIL', new Date(Date.now() - 60_000).toISOString());
      const { verifyLegacySessionToken } = await import('./legacy-token');

      const token = await signLegacyToken({ userId: 'user-1', googleId: 'g', did: 'd', email: 'e' });
      expect(await verifyLegacySessionToken(token)).toBeNull();
    });

    it('returns null when AUTH_LEGACY_UNTIL is unset', async () => {
      vi.stubEnv('AUTH_LEGACY_UNTIL', '');
      const { verifyLegacySessionToken } = await import('./legacy-token');

      const token = await signLegacyToken({ userId: 'user-1', googleId: 'g', did: 'd', email: 'e' });
      expect(await verifyLegacySessionToken(token)).toBeNull();
    });

    it('rejects an expired legacy token even inside the window', async () => {
      vi.stubEnv('AUTH_LEGACY_UNTIL', futureIso(24));
      const { verifyLegacySessionToken } = await import('./legacy-token');

      const token = await signLegacyToken(
        { userId: 'user-1', googleId: 'g', did: 'd', email: 'e' },
        { expiresIn: '-10s' }
      );
      expect(await verifyLegacySessionToken(token)).toBeNull();
    });

    it('throws loudly when JWT_SECRET is missing while the window is open', async () => {
      vi.stubEnv('AUTH_LEGACY_UNTIL', futureIso(24));
      vi.stubEnv('JWT_SECRET', '');
      const { verifyLegacySessionToken } = await import('./legacy-token');

      const token = await signLegacyToken({ userId: 'user-1', googleId: 'g', did: 'd', email: 'e' });
      await expect(verifyLegacySessionToken(token)).rejects.toThrow();
    });

    // The secret signed more than session tokens. These two impostors carry a
    // userId but are NOT sessions; accepting either would be the critical
    // interchangeability defect. They must be rejected by the shape check.
    it('rejects a social-connect OAuth state token (userId + platform + nonce)', async () => {
      vi.stubEnv('AUTH_LEGACY_UNTIL', futureIso(24));
      const { verifyLegacySessionToken } = await import('./legacy-token');

      const stateToken = await signLegacyToken({
        userId: 'victim-1',
        platform: 'facebook',
        nonce: 'abc123',
      });
      expect(await verifyLegacySessionToken(stateToken)).toBeNull();
    });

    it('rejects a bare pre-M1 refresh token (userId only, no googleId/email)', async () => {
      vi.stubEnv('AUTH_LEGACY_UNTIL', futureIso(24));
      const { verifyLegacySessionToken } = await import('./legacy-token');

      const refreshLike = await signLegacyToken({ userId: 'victim-2' });
      expect(await verifyLegacySessionToken(refreshLike)).toBeNull();
    });

    it('still accepts a genuine pre-M1 session token (userId + googleId + email)', async () => {
      vi.stubEnv('AUTH_LEGACY_UNTIL', futureIso(24));
      const { verifyLegacySessionToken } = await import('./legacy-token');

      const session = await signLegacyToken({
        userId: 'user-1',
        googleId: 'g-1',
        did: 'did:sync:x',
        email: 'u@example.com',
      });
      const claims = await verifyLegacySessionToken(session);
      expect(claims?.userId).toBe('user-1');
      expect(claims?.asr).toBe('sf');
    });
  });

  describe('session.ts integration', () => {
    it('a legacy token authenticates through getSessionFromRequest inside the window', async () => {
      vi.stubEnv('AUTH_LEGACY_UNTIL', futureIso(24));
      const { getSessionFromRequest } = await import('./session');

      const token = await signLegacyToken({ userId: 'user-1', googleId: 'g', did: 'd', email: 'e' });
      (getUserSessionVersion as Mock).mockResolvedValue(1);

      const session = await getSessionFromRequest(bearerRequest(token));
      expect(session?.userId).toBe('user-1');
      expect(session?.asr).toBe('sf');
      expect(session?.amr).toEqual(['google']);
      expect(session?.sv).toBe(1);
    });

    it('a legacy token is rejected when the stored session_version is greater than 1', async () => {
      vi.stubEnv('AUTH_LEGACY_UNTIL', futureIso(24));
      const { getSessionFromRequest } = await import('./session');

      const token = await signLegacyToken({ userId: 'user-1', googleId: 'g', did: 'd', email: 'e' });
      (getUserSessionVersion as Mock).mockResolvedValue(2);

      expect(await getSessionFromRequest(bearerRequest(token))).toBeNull();
    });

    it('a legacy token is rejected on the refresh path, window open or not', async () => {
      vi.stubEnv('AUTH_LEGACY_UNTIL', futureIso(24));
      const { verifyRefreshToken } = await import('./session');

      const token = await signLegacyToken({ userId: 'user-1', googleId: 'g', did: 'd', email: 'e' });
      expect(await verifyRefreshToken(token)).toBeNull();
    });

    it('a token carrying a recognized type claim is never retried as legacy, even if it would verify against JWT_SECRET', async () => {
      vi.stubEnv('AUTH_LEGACY_UNTIL', futureIso(24));
      const { getSessionFromRequest } = await import('./session');
      (getUserSessionVersion as Mock).mockResolvedValue(1);

      // Adversarial: signed with the legacy secret (which alone WOULD verify)
      // but carries a recognized `typ` claim, simulating a stripped/tampered
      // modern token. The typ claim must short-circuit before legacy is ever
      // attempted.
      const adversarial = await signLegacyToken({
        userId: 'user-1',
        googleId: 'g',
        did: 'd',
        email: 'e',
        typ: 'session.v1',
      });

      expect(await getSessionFromRequest(bearerRequest(adversarial))).toBeNull();
    });

    it('the refresh route source never imports the legacy-token module', () => {
      const source = readFileSync(
        path.join(process.cwd(), 'src/app/api/auth/session/refresh/route.ts'),
        'utf-8'
      );
      expect(source).not.toMatch(/legacy-token/);
    });
  });
});
