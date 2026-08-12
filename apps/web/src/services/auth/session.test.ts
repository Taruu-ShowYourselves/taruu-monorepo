/**
 * Session/refresh mint + the central session_version (Model B) check
 * (canonical §4.2, §4.4, §4.5; requirements #71-M1-04, #71-M1-06).
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

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
import { resetDerivedKeyCache } from './keys';

function bearerRequest(token: string): Request {
  return new Request('http://localhost/api/x', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

describe('session.ts', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_MASTER_KEY', 'a'.repeat(32));
    resetDerivedKeyCache();
    cookieStore.clear();
    vi.clearAllMocks();
  });

  it('mints a session token with userId/googleId/did/email/sv/amr/asr, 1h TTL, typ session.v1', async () => {
    const { createSessionToken, verifySessionToken } = await import('./session');
    const { decodeTokenTypeUnverified } = await import('./tokens');

    const token = await createSessionToken({
      userId: 'user-1',
      googleId: 'google-1',
      did: 'did:sync:x',
      email: 'a@b.com',
      sv: 1,
      amr: ['google'],
      asr: 'sf',
    });

    expect(decodeTokenTypeUnverified(token)).toBe('session.v1');

    const session = await verifySessionToken(token);
    expect(session).not.toBeNull();
    expect(session?.userId).toBe('user-1');
    expect(session?.googleId).toBe('google-1');
    expect(session?.did).toBe('did:sync:x');
    expect(session?.email).toBe('a@b.com');
    expect(session?.sv).toBe(1);
    expect(session?.amr).toEqual(['google']);
    expect(session?.asr).toBe('sf');

    const ttlSeconds = Math.round(((session?.expiresAt.getTime() ?? 0) - Date.now()) / 1000);
    expect(ttlSeconds).toBeGreaterThan(3500);
    expect(ttlSeconds).toBeLessThanOrEqual(3600);
  });

  it('mints a refresh token with userId/sv/amr/asr, 30d TTL, typ refresh.v1, no did/email', async () => {
    const { createRefreshToken } = await import('./session');
    const { decodeTokenTypeUnverified, verifyPurposeToken } = await import('./tokens');

    const token = await createRefreshToken({
      userId: 'user-1',
      sv: 2,
      amr: ['google'],
      asr: 'sf',
    });

    expect(decodeTokenTypeUnverified(token)).toBe('refresh.v1');

    const claims = await verifyPurposeToken('refresh', token);
    expect(claims?.userId).toBe('user-1');
    expect(claims?.sv).toBe(2);
    expect(claims?.amr).toEqual(['google']);
    expect(claims?.asr).toBe('sf');
    expect(claims?.did).toBeUndefined();
    expect(claims?.email).toBeUndefined();

    const ttlSeconds = (claims?.exp as number) - (claims?.iat as number);
    expect(ttlSeconds).toBe(30 * 24 * 60 * 60);
  });

  it('getSessionFromRequest returns the session when sv equals the stored version', async () => {
    const { createSessionToken, getSessionFromRequest } = await import('./session');
    const token = await createSessionToken({
      userId: 'user-1',
      googleId: 'g',
      did: 'd',
      email: 'e',
      sv: 1,
      amr: ['google'],
      asr: 'sf',
    });
    (getUserSessionVersion as Mock).mockResolvedValue(1);

    const session = await getSessionFromRequest(bearerRequest(token));
    expect(session?.userId).toBe('user-1');
  });

  it('getSessionFromRequest returns null when sv is lower than the stored version', async () => {
    const { createSessionToken, getSessionFromRequest } = await import('./session');
    const token = await createSessionToken({
      userId: 'user-1',
      googleId: 'g',
      did: 'd',
      email: 'e',
      sv: 1,
      amr: ['google'],
      asr: 'sf',
    });
    (getUserSessionVersion as Mock).mockResolvedValue(2);

    const session = await getSessionFromRequest(bearerRequest(token));
    expect(session).toBeNull();
  });

  it('revocation immediacy: accept, bump the stored version, reject the same token instance', async () => {
    const { createSessionToken, getSessionFromRequest } = await import('./session');
    const token = await createSessionToken({
      userId: 'user-1',
      googleId: 'g',
      did: 'd',
      email: 'e',
      sv: 1,
      amr: ['google'],
      asr: 'sf',
    });

    (getUserSessionVersion as Mock).mockResolvedValue(1);
    expect(await getSessionFromRequest(bearerRequest(token))).not.toBeNull();

    (getUserSessionVersion as Mock).mockResolvedValue(2);
    expect(await getSessionFromRequest(bearerRequest(token))).toBeNull();
  });

  it('getSessionFromRequest returns null when the user row is missing or the version read fails', async () => {
    const { createSessionToken, getSessionFromRequest } = await import('./session');
    const token = await createSessionToken({
      userId: 'user-1',
      googleId: 'g',
      did: 'd',
      email: 'e',
      sv: 1,
      amr: ['google'],
      asr: 'sf',
    });
    (getUserSessionVersion as Mock).mockResolvedValue(null);

    expect(await getSessionFromRequest(bearerRequest(token))).toBeNull();
  });

  it('a refresh token presented to getSessionFromRequest returns null', async () => {
    const { createRefreshToken, getSessionFromRequest } = await import('./session');
    const token = await createRefreshToken({
      userId: 'user-1',
      sv: 1,
      amr: ['google'],
      asr: 'sf',
    });

    expect(await getSessionFromRequest(bearerRequest(token))).toBeNull();
    expect(getUserSessionVersion).not.toHaveBeenCalled();
  });

  it('getSessionFromCookies enforces the same version check', async () => {
    const { createSessionToken, getSessionFromCookies } = await import('./session');
    const token = await createSessionToken({
      userId: 'user-1',
      googleId: 'g',
      did: 'd',
      email: 'e',
      sv: 1,
      amr: ['google'],
      asr: 'sf',
    });
    cookieStore.set('sync-session', token);

    (getUserSessionVersion as Mock).mockResolvedValue(2);
    expect(await getSessionFromCookies()).toBeNull();

    (getUserSessionVersion as Mock).mockResolvedValue(1);
    expect(await getSessionFromCookies()).not.toBeNull();
  });
});
