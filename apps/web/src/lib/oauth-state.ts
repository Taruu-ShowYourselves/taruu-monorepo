/**
 * OAuth State Security Utility
 *
 * Provides cryptographic signing and verification of OAuth state parameters
 * to prevent CSRF attacks in the OAuth flow.
 *
 * Why this matters:
 * - OAuth state parameter is the primary CSRF protection mechanism
 * - Without cryptographic signing, an attacker can forge state values
 * - This allows account linking attacks and session fixation
 *
 * Two state families live here:
 *
 * 1. The Facebook/Instagram social-connect flows below (`createOAuthState` /
 *    `verifyOAuthState` / `verifyOAuthStatePlatform`) - unchanged, still
 *    signed with `JWT_SECRET`. Four live routes and two test suites depend
 *    on this exact behavior. Moving them onto the purpose-typed `oauth_state`
 *    key (canonical §4.1) is deliberate follow-up work, not an oversight -
 *    it just isn't this milestone's scope.
 * 2. The login flow moved to `services/auth/login-state.ts` - it signs with
 *    the kernel's purpose-key primitive, and the mint-path guard test forbids
 *    that import outside services/auth/.
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { randomBytes } from 'crypto';

// Use the same JWT_SECRET for consistency
const STATE_SECRET = process.env.JWT_SECRET || '';
const STATE_EXPIRY_MINUTES = 10;

interface OAuthStatePayload extends JWTPayload {
  userId: string;
  platform: 'facebook' | 'instagram' | 'google';
  nonce: string;
}

interface OAuthState {
  userId: string;
  platform: string;
  nonce: string;
}

/**
 * Get secret key for state operations
 */
function getSecretKey(): Uint8Array {
  if (!STATE_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(STATE_SECRET);
}

/**
 * Create a cryptographically signed OAuth state token
 *
 * @param userId - The user's ID initiating the OAuth flow
 * @param platform - The OAuth provider (facebook, instagram, google)
 * @returns Signed JWT state token
 */
export async function createOAuthState(
  userId: string,
  platform: 'facebook' | 'instagram' | 'google'
): Promise<string> {
  const nonce = randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + STATE_EXPIRY_MINUTES * 60 * 1000);

  const state = await new SignJWT({
    userId,
    platform,
    nonce,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .setSubject(userId)
    .sign(getSecretKey());

  return state;
}

/**
 * Verify and decode an OAuth state token
 *
 * Performs the following checks:
 * 1. JWT signature is valid (proves state wasn't tampered with)
 * 2. Token hasn't expired (limits replay window)
 * 3. Subject matches userId (prevents substitution attacks)
 *
 * @param state - The state parameter from OAuth callback
 * @param expectedUserId - The userId from current session (for additional validation)
 * @returns Decoded state payload or null if invalid
 */
export async function verifyOAuthState(
  state: string,
  expectedUserId?: string
): Promise<OAuthState | null> {
  try {
    const { payload } = await jwtVerify(state, getSecretKey());

    const statePayload = payload as OAuthStatePayload;

    // If we have an expected userId, verify it matches
    if (expectedUserId && statePayload.userId !== expectedUserId) {
      console.error('OAuth state userId mismatch - possible CSRF attack');
      return null;
    }

    return {
      userId: statePayload.userId,
      platform: statePayload.platform,
      nonce: statePayload.nonce,
    };
  } catch (error) {
    // JWT verification failed (invalid signature, expired, etc.)
    console.error('OAuth state verification failed:', error);
    return null;
  }
}

/**
 * Verify OAuth state matches expected platform
 *
 * Additional security check to ensure state from one platform
 * isn't being used for another.
 *
 * @param state - The decoded state from verifyOAuthState
 * @param expectedPlatform - The platform handling the callback
 * @returns true if platform matches
 */
export function verifyOAuthStatePlatform(
  state: OAuthState,
  expectedPlatform: 'facebook' | 'instagram' | 'google'
): boolean {
  if (state.platform !== expectedPlatform) {
    console.error(
      `OAuth state platform mismatch: expected ${expectedPlatform}, got ${state.platform}`
    );
    return false;
  }
  return true;
}
