/**
 * Supabase access-token minter (RLS-01).
 *
 * These tests pin the properties the RLS transport's safety rests on: the token
 * is verifiable by Supabase and only by Supabase, it says who the user is and
 * nothing else, and it expires in minutes. A regression in any one of them
 * either breaks RLS entirely or hands PostgREST a long-lived session credential.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { jwtVerify, decodeProtectedHeader, decodeJwt } from 'jose';
import {
  mintSupabaseAccessToken,
  getSupabaseJwtSecret,
  SUPABASE_TOKEN_TTL_SECONDS,
} from './user-token';

const SUPABASE_SECRET = 'supabase-test-jwt-secret-at-least-32-chars';
const SESSION_SECRET = 'session-test-jwt-secret-at-least-32-characters';
const USER_ID = '11111111-1111-4111-8111-111111111111';

function stubSecrets(): void {
  vi.stubEnv('SUPABASE_JWT_SECRET', SUPABASE_SECRET);
  vi.stubEnv('JWT_SECRET', SESSION_SECRET);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('mintSupabaseAccessToken', () => {
  it('signs with HS256', async () => {
    stubSecrets();
    const token = await mintSupabaseAccessToken(USER_ID);

    expect(decodeProtectedHeader(token).alg).toBe('HS256');
  });

  it('verifies against the Supabase secret and carries sub/role/aud', async () => {
    stubSecrets();
    const token = await mintSupabaseAccessToken(USER_ID);

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(SUPABASE_SECRET),
      { audience: 'authenticated' }
    );

    expect(payload.sub).toBe(USER_ID);
    expect(payload.role).toBe('authenticated');
    expect(payload.aud).toBe('authenticated');
  });

  it('does NOT verify against the session secret because the two are independent', async () => {
    // If these ever became the same value, a stolen `sync-session` cookie would
    // be a valid database credential.
    stubSecrets();
    const token = await mintSupabaseAccessToken(USER_ID);

    await expect(
      jwtVerify(token, new TextEncoder().encode(SESSION_SECRET))
    ).rejects.toThrow();
  });

  it('expires in five minutes by default', async () => {
    stubSecrets();
    const payload = decodeJwt(await mintSupabaseAccessToken(USER_ID));

    expect(payload.exp! - payload.iat!).toBe(SUPABASE_TOKEN_TTL_SECONDS);
    expect(SUPABASE_TOKEN_TTL_SECONDS).toBe(300);
  });

  it('honours an explicit ttlSeconds', async () => {
    stubSecrets();
    const payload = decodeJwt(await mintSupabaseAccessToken(USER_ID, { ttlSeconds: 60 }));

    expect(payload.exp! - payload.iat!).toBe(60);
  });

  it('leaks nothing from the session into the database credential', async () => {
    stubSecrets();
    const payload = decodeJwt(await mintSupabaseAccessToken(USER_ID));

    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('googleId');
    expect(payload).not.toHaveProperty('did');
    // Positive statement of the same rule: exactly these claims, no others.
    expect(Object.keys(payload).sort()).toEqual(['aud', 'exp', 'iat', 'role', 'sub']);
  });

  it('rejects a userId that is not a uuid', async () => {
    stubSecrets();
    // public.user_id() casts the claim to UUID; a non-uuid sub makes every
    // policy silently match zero rows instead of failing loudly.
    await expect(mintSupabaseAccessToken('not-a-uuid')).rejects.toThrow(/uuid/);
  });
});

describe('getSupabaseJwtSecret', () => {
  it('throws a named error when the secret is unset', () => {
    vi.stubEnv('SUPABASE_JWT_SECRET', '');

    expect(() => getSupabaseJwtSecret()).toThrow(
      'Missing SUPABASE_JWT_SECRET environment variable'
    );
  });
});
