/**
 * Supabase access-token minter (RLS-01).
 *
 * These tests pin the properties the RLS transport's safety rests on: the token
 * verifies against the key we publish and only that key, it says who the user
 * is and nothing else, it carries the `kid` Supabase needs to select a
 * verification key, and it expires in minutes.
 *
 * The signing key here is generated per run rather than fixtured, so nothing
 * key-shaped is ever committed to the repo.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { jwtVerify, decodeProtectedHeader, decodeJwt, generateKeyPair, exportJWK, importJWK } from 'jose';
import type { JWK } from 'jose';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const APP_URL = 'https://taruu.co.il';
const KID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';

let privateJwk: JWK;
let publicKey: Awaited<ReturnType<typeof importJWK>>;

beforeAll(async () => {
  const { privateKey } = await generateKeyPair('ES256', { extractable: true });
  privateJwk = { ...(await exportJWK(privateKey)), kid: KID, alg: 'ES256', use: 'sig' };

  const pub: JWK = { ...privateJwk };
  delete pub.d;
  publicKey = await importJWK(pub, 'ES256');
});

/** Fresh module per test: signing-key.ts memoizes the imported key. */
async function loadMinter() {
  vi.resetModules();
  vi.stubEnv('SUPABASE_TP_PRIVATE_JWK', JSON.stringify(privateJwk));
  vi.stubEnv('NEXT_PUBLIC_APP_URL', APP_URL);
  return import('./user-token');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('mintSupabaseAccessToken', () => {
  it('signs with ES256 and carries the kid Supabase selects on', async () => {
    const { mintSupabaseAccessToken } = await loadMinter();
    const header = decodeProtectedHeader(await mintSupabaseAccessToken(USER_ID));

    expect(header.alg).toBe('ES256');
    // Without kid, Supabase cannot pick a key from our JWKS and rejects outright.
    expect(header.kid).toBe(KID);
  });

  it('verifies against the published public key, with the expected claims', async () => {
    const { mintSupabaseAccessToken } = await loadMinter();

    const { payload } = await jwtVerify(await mintSupabaseAccessToken(USER_ID), publicKey, {
      audience: 'authenticated',
      issuer: APP_URL,
    });

    expect(payload.sub).toBe(USER_ID);
    expect(payload.role).toBe('authenticated');
    expect(payload.aud).toBe('authenticated');
    expect(payload.iss).toBe(APP_URL);
  });

  it('does NOT verify against an unrelated key', async () => {
    const { mintSupabaseAccessToken } = await loadMinter();
    const { publicKey: strangerKey } = await generateKeyPair('ES256', { extractable: true });

    await expect(
      jwtVerify(await mintSupabaseAccessToken(USER_ID), strangerKey)
    ).rejects.toThrow();
  });

  it('expires in five minutes by default', async () => {
    const { mintSupabaseAccessToken, SUPABASE_TOKEN_TTL_SECONDS } = await loadMinter();
    const payload = decodeJwt(await mintSupabaseAccessToken(USER_ID));

    expect(payload.exp! - payload.iat!).toBe(SUPABASE_TOKEN_TTL_SECONDS);
    expect(SUPABASE_TOKEN_TTL_SECONDS).toBe(300);
  });

  it('honours an explicit ttlSeconds', async () => {
    const { mintSupabaseAccessToken } = await loadMinter();
    const payload = decodeJwt(await mintSupabaseAccessToken(USER_ID, { ttlSeconds: 60 }));

    expect(payload.exp! - payload.iat!).toBe(60);
  });

  it('leaks nothing from the session into the database credential', async () => {
    const { mintSupabaseAccessToken } = await loadMinter();
    const payload = decodeJwt(await mintSupabaseAccessToken(USER_ID));

    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('googleId');
    expect(payload).not.toHaveProperty('did');
    expect(Object.keys(payload).sort()).toEqual(['aud', 'exp', 'iat', 'iss', 'role', 'sub']);
  });

  it('carries no assurance or method claims - the database never sees them', async () => {
    // Canonical §4.7: assurance (asr) and method (amr) are application
    // concerns enforced in route handlers; RLS never needs them. This is a
    // standing invariant for every MFA milestone.
    const { mintSupabaseAccessToken } = await loadMinter();
    const payload = decodeJwt(await mintSupabaseAccessToken(USER_ID));

    expect(payload).not.toHaveProperty('amr');
    expect(payload).not.toHaveProperty('asr');
    expect(payload).not.toHaveProperty('aal');
    expect(Object.keys(payload).sort()).toEqual(['aud', 'exp', 'iat', 'iss', 'role', 'sub']);

    // Source-level guard: the assurance claim names must not appear in the
    // minter at all, so they cannot be added without tripping this test.
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('./user-token.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/['"](amr|asr|aal)['"]/);
  });

  it('rejects a userId that is not a uuid', async () => {
    const { mintSupabaseAccessToken } = await loadMinter();

    // public.user_id() casts the claim to UUID; a non-uuid sub makes every
    // policy silently match zero rows instead of failing loudly.
    await expect(mintSupabaseAccessToken('not-a-uuid')).rejects.toThrow(/uuid/);
  });
});

describe('signing key configuration', () => {
  it('refuses a public JWK, which cannot sign', async () => {
    vi.resetModules();
    const pub: JWK = { ...privateJwk };
    delete pub.d;
    vi.stubEnv('SUPABASE_TP_PRIVATE_JWK', JSON.stringify(pub));

    const { getSigningKey } = await import('./signing-key');
    await expect(getSigningKey()).rejects.toThrow(/public key, not a private one/);
  });

  it('refuses a private JWK with no kid', async () => {
    vi.resetModules();
    const noKid: JWK = { ...privateJwk };
    delete noKid.kid;
    vi.stubEnv('SUPABASE_TP_PRIVATE_JWK', JSON.stringify(noKid));

    const { getSigningKey } = await import('./signing-key');
    await expect(getSigningKey()).rejects.toThrow(/kid/);
  });

  it('throws a named error when unset', async () => {
    vi.resetModules();
    vi.stubEnv('SUPABASE_TP_PRIVATE_JWK', '');

    const { getSigningKey } = await import('./signing-key');
    await expect(getSigningKey()).rejects.toThrow(
      'Missing SUPABASE_TP_PRIVATE_JWK environment variable'
    );
  });

  it('publishes the public half only - never the signing key', async () => {
    vi.resetModules();
    vi.stubEnv('SUPABASE_TP_PRIVATE_JWK', JSON.stringify(privateJwk));

    const { getPublicJwks } = await import('./signing-key');
    const jwks = await getPublicJwks();

    expect(jwks.keys).toHaveLength(1);
    // The one assertion that matters: `d` is the private scalar. Publishing it
    // would hand every reader the ability to mint tokens as any user.
    expect(jwks.keys[0]).not.toHaveProperty('d');
    expect(jwks.keys[0].kid).toBe(KID);
    expect(jwks.keys[0].alg).toBe('ES256');
    expect(jwks.keys[0].kty).toBe('EC');
    expect(jwks.keys[0].crv).toBe('P-256');
  });
});
