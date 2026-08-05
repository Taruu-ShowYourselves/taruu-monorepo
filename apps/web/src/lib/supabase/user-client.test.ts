/**
 * User-scoped Supabase client (RLS-02).
 *
 * The single property that makes RLS real: this client is built on the ANON
 * key, so the database enforces policies against it. If it ever picks up the
 * service-role key, every policy in the schema silently stops applying and
 * nothing fails, which is why the key assertion here is negative as well as
 * positive.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify, generateKeyPair, exportJWK, importJWK, type JWK } from 'jose';
import { createUserScopedClient } from './user-client';

vi.mock('@supabase/supabase-js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@supabase/supabase-js')>();
  return { ...actual, createClient: vi.fn(() => ({}) as never) };
});

const SERVICE_ROLE_KEY = 'test-service-role-key';
const ANON_KEY = 'test-anon-key';
const USER_ID = '11111111-1111-4111-8111-111111111111';

// Generated per run so nothing key-shaped is committed.
let privateJwk: JWK;
let publicKey: Awaited<ReturnType<typeof importJWK>>;

beforeAll(async () => {
  const { privateKey } = await generateKeyPair('ES256', { extractable: true });
  privateJwk = {
    ...(await exportJWK(privateKey)),
    kid: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    alg: 'ES256',
    use: 'sig',
  };
  const pub: JWK = { ...privateJwk };
  delete pub.d;
  publicKey = await importJWK(pub, 'ES256');
});

type CapturedOptions = { accessToken?: () => Promise<string> };

/** The options object supabase-js was actually constructed with. */
function capturedOptions(): CapturedOptions {
  return vi.mocked(createClient).mock.calls[0][2] as CapturedOptions;
}

beforeEach(() => {
  vi.mocked(createClient).mockClear();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', ANON_KEY);
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', SERVICE_ROLE_KEY);
  vi.stubEnv('SUPABASE_TP_PRIVATE_JWK', JSON.stringify(privateJwk));
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://taruu.co.il');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createUserScopedClient', () => {
  it('is built on the anon key, never the service-role key', () => {
    createUserScopedClient(USER_ID);

    const [url, key] = vi.mocked(createClient).mock.calls[0];
    expect(url).toBe('http://127.0.0.1:54321');
    expect(key).toBe(ANON_KEY);
    // The whole point: service-role bypasses RLS, so this must never be it.
    expect(key).not.toBe(SERVICE_ROLE_KEY);
  });

  it('passes an accessToken callback through to supabase-js', () => {
    createUserScopedClient(USER_ID);

    expect(typeof capturedOptions().accessToken).toBe('function');
  });

  it('the callback resolves to a token whose sub is the given user', async () => {
    createUserScopedClient(USER_ID);

    const token = await capturedOptions().accessToken!();
    const { payload } = await jwtVerify(
      token,
      publicKey
    );

    expect(payload.sub).toBe(USER_ID);
    expect(payload.role).toBe('authenticated');
  });

  it('memoizes the token instead of re-signing on every query', async () => {
    createUserScopedClient(USER_ID);
    const { accessToken } = capturedOptions();

    expect(await accessToken!()).toBe(await accessToken!());
  });

  it('gives each client its own token so one user cannot inherit another', async () => {
    const OTHER_ID = '22222222-2222-4222-8222-222222222222';

    createUserScopedClient(USER_ID);
    const first = capturedOptions().accessToken!;
    createUserScopedClient(OTHER_ID);
    const second = vi.mocked(createClient).mock.calls[1][2] as CapturedOptions;

    const { payload: a } = await jwtVerify(
      await first(),
      publicKey
    );
    const { payload: b } = await jwtVerify(
      await second.accessToken!(),
      publicKey
    );

    expect(a.sub).toBe(USER_ID);
    expect(b.sub).toBe(OTHER_ID);
  });

  it('fails clearly without NEXT_PUBLIC_SUPABASE_URL', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');

    expect(() => createUserScopedClient(USER_ID)).toThrow(
      'Missing NEXT_PUBLIC_SUPABASE_URL environment variable'
    );
  });

  it('fails clearly without NEXT_PUBLIC_SUPABASE_ANON_KEY', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');

    expect(() => createUserScopedClient(USER_ID)).toThrow(
      'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable'
    );
  });
});
