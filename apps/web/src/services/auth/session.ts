/**
 * JWT Session Service
 *
 * Typed session/refresh tokens on HKDF-derived per-purpose keys (canonical
 * §4.2), plus the central `session_version` revocation check - Model B
 * (canonical §4.4). The stored-version check lives in exactly one private
 * helper, `assertLiveSessionVersion`, called only from `getSessionFromCookies`
 * and `getSessionFromRequest` - never from `requireAuth` (which already
 * delegates to `getSessionFromRequest`, so a second call would double the
 * per-request read) and never from the mint functions.
 */

import { cookies } from 'next/headers';
import { getUserSessionVersion } from '@/lib/supabase/db';
import type { Assurance } from './assurance';
import { signPurposeToken, verifyPurposeToken } from './tokens';

// === Configuration ===

const COOKIE_NAME = 'sync-session';
const COOKIE_REFRESH_NAME = 'sync-refresh';

/** Session TTL, seconds. A code constant now - JWT_EXPIRY no longer governs it. */
export const SESSION_TTL_SECONDS = 60 * 60; // 1 hour
/** Refresh TTL, seconds. */
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

// === Types ===

export interface SessionPayload {
  userId: string;
  googleId: string;
  did: string;
  email: string;
  sv: number;
  amr: string[];
  asr: Assurance;
}

export interface Session {
  userId: string;
  googleId: string;
  did: string;
  email: string;
  sv: number;
  amr: string[];
  asr: Assurance;
  expiresAt: Date;
}

export interface RefreshPayload {
  userId: string;
  sv: number;
  amr: string[];
  asr: Assurance;
}

export interface RefreshClaims {
  userId: string;
  sv: number;
  amr: string[];
  asr: Assurance;
  expiresAt: Date;
}

// === Mint ===

/**
 * Mints a session token. Callers pass `sv` explicitly - this function never
 * reads the database itself, so a caller cannot accidentally mint a token
 * stamped with a version it did not verify.
 */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return signPurposeToken(
    'session',
    {
      userId: payload.userId,
      googleId: payload.googleId,
      did: payload.did,
      email: payload.email,
      sv: payload.sv,
      amr: payload.amr,
      asr: payload.asr,
    },
    SESSION_TTL_SECONDS
  );
}

/**
 * Mints a refresh token. Carries no `did`/`email` - the refresh path never
 * needs identity display fields, only enough to re-mint a session.
 */
export async function createRefreshToken(payload: RefreshPayload): Promise<string> {
  return signPurposeToken(
    'refresh',
    {
      userId: payload.userId,
      sv: payload.sv,
      amr: payload.amr,
      asr: payload.asr,
    },
    REFRESH_TTL_SECONDS
  );
}

// === Verify (pure - no DB read, no revocation check) ===

/**
 * Verifies a session token against the session purpose only. Does NOT check
 * `session_version` - that happens in `assertLiveSessionVersion`, called only
 * from the two session entry points below.
 */
export async function verifySessionToken(token: string): Promise<Session | null> {
  const claims = await verifyPurposeToken('session', token);
  if (!claims) return null;

  return {
    userId: claims.userId as string,
    googleId: claims.googleId as string,
    did: claims.did as string,
    email: claims.email as string,
    sv: claims.sv as number,
    amr: (claims.amr as string[]) ?? [],
    asr: claims.asr as Assurance,
    expiresAt: new Date((claims.exp ?? 0) * 1000),
  };
}

/**
 * Verifies a refresh token against the refresh purpose only, returning the
 * full claim set (not just a userId string) - the refresh route needs `sv`,
 * `amr` and `asr`.
 */
export async function verifyRefreshToken(token: string): Promise<RefreshClaims | null> {
  const claims = await verifyPurposeToken('refresh', token);
  if (!claims) return null;

  return {
    userId: claims.userId as string,
    sv: claims.sv as number,
    amr: (claims.amr as string[]) ?? [],
    asr: claims.asr as Assurance,
    expiresAt: new Date((claims.exp ?? 0) * 1000),
  };
}

/**
 * The session-path verification helper. Task 5 (legacy window) extends this,
 * after a null `verifySessionToken`, with a bounded legacy-token fallback -
 * this is the one place that wiring happens.
 */
async function resolveSessionPathClaims(token: string): Promise<Session | null> {
  return verifySessionToken(token);
}

// === Model B: the central revocation check ===

/**
 * Re-reads `users.session_version` by primary key and returns the session
 * only when it strictly equals the token's `sv`. On mismatch, missing row, or
 * read failure, attempts to clear the session cookies (best-effort - `cookies()`
 * is mutable inside route handlers but throws in a React Server Component
 * render, so the auth result must not depend on which context called it) and
 * returns null either way.
 */
async function assertLiveSessionVersion(session: Session): Promise<Session | null> {
  const storedVersion = await getUserSessionVersion(session.userId);
  if (storedVersion === null || storedVersion !== session.sv) {
    try {
      await clearSessionCookies();
    } catch {
      // RSC render context, or no request scope - nothing to clear from here.
    }
    return null;
  }
  return session;
}

// === Cookie management ===

/**
 * Set session cookies (server action)
 */
export async function setSessionCookies(
  sessionToken: string,
  refreshToken?: string
): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });

  if (refreshToken) {
    cookieStore.set(COOKIE_REFRESH_NAME, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: REFRESH_TTL_SECONDS,
    });
  }
}

/**
 * Get session from cookies (server action)
 */
export async function getSessionFromCookies(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const claims = await resolveSessionPathClaims(token);
  if (!claims) return null;

  return assertLiveSessionVersion(claims);
}

/**
 * Get refresh token from cookies
 */
export async function getRefreshTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_REFRESH_NAME)?.value || null;
}

/**
 * Clear session cookies (server action)
 */
export async function clearSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  cookieStore.delete(COOKIE_REFRESH_NAME);
}

/**
 * Check if session is about to expire (within 1 hour)
 */
export function isSessionExpiringSoon(session: Session): boolean {
  const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
  return session.expiresAt < oneHourFromNow;
}

// === API Route Helpers ===

function extractSessionTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const parsedCookies = Object.fromEntries(
      cookieHeader.split('; ').map((c) => {
        const [key, ...rest] = c.split('=');
        return [key, rest.join('=')];
      })
    );
    return parsedCookies[COOKIE_NAME] || null;
  }

  return null;
}

/**
 * Get session from request headers
 * For use in API routes
 */
export async function getSessionFromRequest(request: Request): Promise<Session | null> {
  const token = extractSessionTokenFromRequest(request);
  if (!token) return null;

  const claims = await resolveSessionPathClaims(token);
  if (!claims) return null;

  return assertLiveSessionVersion(claims);
}

/**
 * Require authentication for API route
 * Returns session or throws error
 */
export async function requireAuth(request: Request): Promise<Session> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}
