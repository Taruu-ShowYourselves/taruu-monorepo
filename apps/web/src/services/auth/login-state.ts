/**
 * Login OAuth state (requirement #71-M1-08, canonical §4.3 step 1).
 *
 * Server-minted CSRF/nonce carrier for the Google login flow: a purpose-typed
 * `oauth_state.v1` token (HKDF-derived key), 10-minute lifetime, carrying only
 * the nonce hash and the flow discriminator. No `userId` - the state is
 * minted before any identity is known. Deliberately NO redirect claim: a
 * post-login redirect target inside a signed token is an open redirect the
 * moment a caller wires it up; add it only together with its allowlist.
 *
 * Lives inside services/auth/ because it signs with the kernel's purpose-key
 * primitive; the mint-path guard test forbids that import anywhere else. The
 * social-connect state family (JWT_SECRET-signed) stays in lib/oauth-state.ts
 * until its own migration.
 */

import { signPurposeToken, verifyPurposeToken } from './tokens';

const LOGIN_OAUTH_STATE_TTL_SECONDS = 10 * 60;

/** M1 declares exactly one flow value; reauth (M2+) adds to this union. */
export type LoginOAuthStateFlow = 'login';

export interface LoginOAuthStatePayload {
  /** SHA-256 hex digest of the raw nonce - the raw nonce itself never enters this token. */
  nonceHash: string;
}

export interface LoginOAuthState {
  nonceHash: string;
  flow: LoginOAuthStateFlow;
}

/** Mints the server-side login OAuth state token. */
export async function createLoginOAuthState(payload: LoginOAuthStatePayload): Promise<string> {
  return signPurposeToken(
    'oauth_state',
    {
      nonce_hash: payload.nonceHash,
      flow: 'login' satisfies LoginOAuthStateFlow,
    },
    LOGIN_OAUTH_STATE_TTL_SECONDS
  );
}

/**
 * Verifies a login OAuth state token. Returns null on any failure - expired,
 * wrong purpose/key, wrong flow, or a missing/malformed nonce hash.
 */
export async function verifyLoginOAuthState(state: string): Promise<LoginOAuthState | null> {
  const claims = await verifyPurposeToken('oauth_state', state);
  if (!claims) return null;
  if (claims.flow !== 'login') return null;
  if (typeof claims.nonce_hash !== 'string') return null;

  return {
    nonceHash: claims.nonce_hash,
    flow: 'login',
  };
}
