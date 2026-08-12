/**
 * Local Google id_token verification (canonical §4.3 steps 2-4, requirement
 * #71-M1-07). Verified against a locally generated key pair served through a
 * mocked `createRemoteJWKSet`.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { SignJWT, generateKeyPair, type KeyLike } from 'jose';

const { getPublicKey, setPublicKey } = vi.hoisted(() => {
  let publicKey: unknown = null;
  return {
    getPublicKey: () => publicKey,
    setPublicKey: (key: unknown) => {
      publicKey = key;
    },
  };
});

vi.mock('jose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jose')>();
  return {
    ...actual,
    // The real createRemoteJWKSet fetches over HTTP; this resolves to the
    // locally generated test key instead, regardless of the requested kid.
    createRemoteJWKSet: () => async () => getPublicKey(),
  };
});

const CLIENT_ID = 'test-client-id';
const GOOGLE_ISSUER = 'https://accounts.google.com';

let privateKey: KeyLike;

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function signIdToken(
  claims: Record<string, unknown>,
  opts: { expiresIn?: string } = {}
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? '1h')
    .sign(privateKey);
}

describe('google-oidc.ts', () => {
  beforeAll(async () => {
    const { publicKey, privateKey: pk } = await generateKeyPair('RS256');
    setPublicKey(publicKey);
    privateKey = pk;
  });

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', CLIENT_ID);
  });

  it('verifies a well-formed id_token bound to the state nonce and yields the subject', async () => {
    const { verifyGoogleIdToken } = await import('./google-oidc');
    const rawNonce = 'nonce-abc-123';
    const nonceHash = await sha256Hex(rawNonce);

    const idToken = await signIdToken({
      iss: GOOGLE_ISSUER,
      aud: CLIENT_ID,
      sub: 'google-sub-1',
      email: 'a@b.com',
      email_verified: true,
      nonce: rawNonce,
      given_name: 'A',
      family_name: 'B',
      picture: 'https://x/y.png',
    });

    const identity = await verifyGoogleIdToken(idToken, { nonceHash });
    expect(identity.subject).toBe('google-sub-1');
    expect(identity.email).toBe('a@b.com');
    expect(identity.emailVerified).toBe(true);
    expect(identity.givenName).toBe('A');
    expect(identity.familyName).toBe('B');
    expect(identity.picture).toBe('https://x/y.png');
  });

  it('rejects an issuer other than the two accepted Google issuers', async () => {
    const { verifyGoogleIdToken } = await import('./google-oidc');
    const nonceHash = await sha256Hex('n');
    const idToken = await signIdToken({
      iss: 'https://evil.example.com',
      aud: CLIENT_ID,
      sub: 's',
      email: 'a@b.com',
      email_verified: true,
      nonce: 'n',
    });

    await expect(verifyGoogleIdToken(idToken, { nonceHash })).rejects.toThrow();
  });

  it('accepts both canonical accepted issuer strings', async () => {
    const { verifyGoogleIdToken } = await import('./google-oidc');
    const rawNonce = 'n2';
    const nonceHash = await sha256Hex(rawNonce);

    const idToken = await signIdToken({
      iss: 'accounts.google.com',
      aud: CLIENT_ID,
      sub: 's2',
      email: 'a@b.com',
      email_verified: true,
      nonce: rawNonce,
    });

    const identity = await verifyGoogleIdToken(idToken, { nonceHash });
    expect(identity.subject).toBe('s2');
  });

  it('rejects an audience other than the configured client id', async () => {
    const { verifyGoogleIdToken } = await import('./google-oidc');
    const nonceHash = await sha256Hex('n');
    const idToken = await signIdToken({
      iss: GOOGLE_ISSUER,
      aud: 'someone-else',
      sub: 's',
      email: 'a@b.com',
      email_verified: true,
      nonce: 'n',
    });

    await expect(verifyGoogleIdToken(idToken, { nonceHash })).rejects.toThrow();
  });

  it('rejects an expired id_token', async () => {
    const { verifyGoogleIdToken } = await import('./google-oidc');
    const nonceHash = await sha256Hex('n');
    const idToken = await signIdToken(
      {
        iss: GOOGLE_ISSUER,
        aud: CLIENT_ID,
        sub: 's',
        email: 'a@b.com',
        email_verified: true,
        nonce: 'n',
      },
      { expiresIn: '-10s' }
    );

    await expect(verifyGoogleIdToken(idToken, { nonceHash })).rejects.toThrow();
  });

  it('rejects email_verified false', async () => {
    const { verifyGoogleIdToken, GoogleIdTokenVerificationError } = await import('./google-oidc');
    const rawNonce = 'n';
    const nonceHash = await sha256Hex(rawNonce);
    const idToken = await signIdToken({
      iss: GOOGLE_ISSUER,
      aud: CLIENT_ID,
      sub: 's',
      email: 'a@b.com',
      email_verified: false,
      nonce: rawNonce,
    });

    await expect(verifyGoogleIdToken(idToken, { nonceHash })).rejects.toThrow(
      GoogleIdTokenVerificationError
    );
  });

  it('rejects a nonce whose digest does not equal the state nonce hash', async () => {
    const { verifyGoogleIdToken } = await import('./google-oidc');
    const idToken = await signIdToken({
      iss: GOOGLE_ISSUER,
      aud: CLIENT_ID,
      sub: 's',
      email: 'a@b.com',
      email_verified: true,
      nonce: 'actual-nonce',
    });
    const wrongHash = await sha256Hex('a-completely-different-nonce');

    await expect(verifyGoogleIdToken(idToken, { nonceHash: wrongHash })).rejects.toThrow();
  });

  it('rejects a missing nonce claim', async () => {
    const { verifyGoogleIdToken } = await import('./google-oidc');
    const idToken = await signIdToken({
      iss: GOOGLE_ISSUER,
      aud: CLIENT_ID,
      sub: 's',
      email: 'a@b.com',
      email_verified: true,
    });
    const nonceHash = await sha256Hex('whatever');

    await expect(verifyGoogleIdToken(idToken, { nonceHash })).rejects.toThrow();
  });
});
