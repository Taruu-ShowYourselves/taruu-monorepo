/**
 * Purpose-typed token mint and verify (canonical §4.2, requirement #71-M1-03).
 *
 * This module owns the `jose` signing and verification primitives. Nothing
 * outside `services/auth/` may import it - the only way to obtain a session
 * or refresh token is through the mint functions in `session.ts` (enforced
 * by the guard test in Task 9).
 *
 * Two independent defences make purposes non-interchangeable at once: a
 * distinct HKDF-derived key per purpose (keys.ts), and an exact `typ` claim
 * match. A bug in either one alone cannot make two token kinds interchangeable.
 */

import { SignJWT, jwtVerify, decodeJwt, type JWTPayload } from 'jose';
import { deriveAuthKey, getAuthMasterKey, JWT_KEY_ID, type TokenPurpose } from './keys';

/**
 * Purposes that sign tokens. `mfa_secret_enc` is excluded on purpose: it is
 * an encryption-key derivation label (services/auth/mfa-secret.ts), and using
 * it to sign must be a compile error, not a runtime surprise.
 */
export type SigningPurpose = Exclude<TokenPurpose, 'mfa_secret_enc'>;

/**
 * The `typ` **claim in the payload** for each purpose - not the JWT protected
 * header's media type, which stays the ordinary `JWT` (plus `alg: HS256` and
 * `kid` from keys.ts's key-version constant).
 */
export const PURPOSE_TYPE_CLAIMS: Readonly<Record<SigningPurpose, string>> = Object.freeze({
  session: 'session.v1',
  refresh: 'refresh.v1',
  oauth_state: 'oauth_state.v1',
  mfa_pending: 'mfa_pending.v1',
  reauth: 'reauth.v1',
});

export type PurposeTokenClaims = JWTPayload & Record<string, unknown>;

/**
 * Signs a token for `purpose` carrying `claims` plus the purpose's type
 * claim, expiring in `ttlSeconds`. Throws the loud AUTH_MASTER_KEY error from
 * keys.ts when the master key is absent - never swallowed here.
 */
export async function signPurposeToken(
  purpose: SigningPurpose,
  claims: Record<string, unknown>,
  ttlSeconds: number
): Promise<string> {
  // Fail loudly before any Web Crypto work if the master key is missing -
  // deriveAuthKey would throw the same error, but calling it here up front
  // keeps the failure mode obvious and synchronous-feeling for callers.
  getAuthMasterKey();

  const key = await deriveAuthKey(purpose);
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    ...claims,
    typ: PURPOSE_TYPE_CLAIMS[purpose],
  })
    .setProtectedHeader({ alg: 'HS256', kid: JWT_KEY_ID, typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .setJti(crypto.randomUUID())
    .sign(key);
}

/**
 * Verifies `token` against `purpose`'s derived key and requires the payload's
 * type claim to equal that purpose's expected value. Returns the payload on
 * success, `null` on any failure - never throws to the caller. Never logs the
 * token, any claim value, or key material; the caller decides what to report.
 */
export async function verifyPurposeToken(
  purpose: SigningPurpose,
  token: string
): Promise<PurposeTokenClaims | null> {
  try {
    const key = await deriveAuthKey(purpose);
    const { payload } = await jwtVerify(token, key);

    if (payload.typ !== PURPOSE_TYPE_CLAIMS[purpose]) {
      return null;
    }

    return payload as PurposeTokenClaims;
  } catch {
    return null;
  }
}

/**
 * Returns the payload's `typ` claim (or null) via `jose`'s unverified decode.
 * Used only to distinguish "a new-format token that failed verification"
 * from "an old-format token" (Task 5) - MUST NEVER be used to make an
 * authorization decision on its own.
 */
export function decodeTokenTypeUnverified(token: string): string | null {
  try {
    const payload = decodeJwt(token);
    return typeof payload.typ === 'string' ? payload.typ : null;
  } catch {
    return null;
  }
}
