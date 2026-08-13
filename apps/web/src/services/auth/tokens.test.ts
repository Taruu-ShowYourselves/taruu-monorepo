/**
 * Purpose-typed token mint/verify tests (canonical §4.2, requirement #71-M1-03).
 *
 * The cross-purpose matrix is the load-bearing test: a token minted for one
 * purpose must never verify for another, in either direction.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SignJWT } from 'jose';
import { resetDerivedKeyCache, deriveAuthKey } from './keys';
import type { SigningPurpose } from './tokens';

// Every signing purpose in the catalog - the cross-purpose matrix below
// covers all ordered pairs, so it grows automatically with this list.
const PURPOSES: SigningPurpose[] = ['session', 'refresh', 'oauth_state', 'mfa_pending', 'reauth'];
const VALID_MASTER_KEY = 'a'.repeat(32);

describe('tokens: signPurposeToken / verifyPurposeToken', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_MASTER_KEY', VALID_MASTER_KEY);
    resetDerivedKeyCache();
  });

  it('mints a token for a purpose that verifies for that same purpose and returns its claims', async () => {
    const { signPurposeToken, verifyPurposeToken } = await import('./tokens');

    const token = await signPurposeToken('session', { userId: 'user-1' }, 3600);
    const claims = await verifyPurposeToken('session', token);

    expect(claims).not.toBeNull();
    expect(claims?.userId).toBe('user-1');
  });

  it('fails verification for every ordered cross-purpose pair (all ordered pairs)', async () => {
    const { signPurposeToken, verifyPurposeToken } = await import('./tokens');

    for (const mintPurpose of PURPOSES) {
      for (const verifyPurpose of PURPOSES) {
        if (mintPurpose === verifyPurpose) continue;

        const token = await signPurposeToken(mintPurpose, { userId: 'user-1' }, 3600);
        const claims = await verifyPurposeToken(verifyPurpose, token);

        expect(claims).toBeNull();
      }
    }
  });

  it('fails verification when the type claim is stripped, even signed with the right key', async () => {
    const { verifyPurposeToken } = await import('./tokens');

    const key = await deriveAuthKey('session');
    const tampered = await new SignJWT({ userId: 'user-1' }) // no `typ` claim at all
      .setProtectedHeader({ alg: 'HS256', kid: 'v1' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .setJti(crypto.randomUUID())
      .sign(key);

    const claims = await verifyPurposeToken('session', tampered);
    expect(claims).toBeNull();
  });

  it('fails verification when the type claim is altered to another purpose value', async () => {
    const { verifyPurposeToken } = await import('./tokens');

    const key = await deriveAuthKey('session');
    const tampered = await new SignJWT({ userId: 'user-1', typ: 'refresh.v1' })
      .setProtectedHeader({ alg: 'HS256', kid: 'v1' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .setJti(crypto.randomUUID())
      .sign(key);

    const claims = await verifyPurposeToken('session', tampered);
    expect(claims).toBeNull();
  });

  it('fails verification for an expired token', async () => {
    const { signPurposeToken, verifyPurposeToken } = await import('./tokens');

    const token = await signPurposeToken('session', { userId: 'user-1' }, -10);
    const claims = await verifyPurposeToken('session', token);

    expect(claims).toBeNull();
  });

  it('fails verification for a token signed with the raw master key rather than a derived key', async () => {
    const { verifyPurposeToken } = await import('./tokens');

    const rawKey = new TextEncoder().encode(VALID_MASTER_KEY);
    const token = await new SignJWT({ userId: 'user-1', typ: 'session.v1' })
      .setProtectedHeader({ alg: 'HS256', kid: 'v1' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .setJti(crypto.randomUUID())
      .sign(rawKey);

    const claims = await verifyPurposeToken('session', token);
    expect(claims).toBeNull();
  });

  it('verification never throws to the caller, even on garbage input', async () => {
    const { verifyPurposeToken } = await import('./tokens');

    await expect(verifyPurposeToken('session', 'not-a-jwt')).resolves.toBeNull();
    await expect(verifyPurposeToken('session', '')).resolves.toBeNull();
  });

  it('rejects minting when AUTH_MASTER_KEY is not set', async () => {
    vi.stubEnv('AUTH_MASTER_KEY', '');
    resetDerivedKeyCache();
    const { signPurposeToken } = await import('./tokens');

    await expect(signPurposeToken('session', { userId: 'user-1' }, 3600)).rejects.toThrow();
  });

  it('decodeTokenTypeUnverified reads the typ claim without verifying', async () => {
    const { signPurposeToken, decodeTokenTypeUnverified } = await import('./tokens');

    const token = await signPurposeToken('refresh', { userId: 'user-1' }, 3600);
    expect(decodeTokenTypeUnverified(token)).toBe('refresh.v1');
    expect(decodeTokenTypeUnverified('not-a-jwt')).toBeNull();
  });
});
