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
import { signPurposeToken, verifyPurposeToken, decodeTokenTypeUnverified } from './tokens';
import { isLegacyWindowOpen, verifyLegacySessionToken } from './legacy-token';

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

/** The only `asr` values a token may carry - mirrors the Assurance union. */
function isAssurance(value: unknown): value is Assurance {
  return value === 'sf' || value === 'mf';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Verifies a session token against the session purpose only. Does NOT check
 * `session_version` - that happens in `assertLiveSessionVersion`, called only
 * from the two session entry points below.
 *
 * Claims are runtime shape-validated, never cast (PR #120 review, finding 8):
 * a token that verifies cryptographically but carries a malformed claim set
 * (`sv` not a finite number, `asr` outside the Assurance union, ...) is
 * rejected through the existing null path so downstream code can never
 * compare against `undefined` or trust a fabricated assurance value.
 */
export async function verifySessionToken(token: string): Promise<Session | null> {
  const claims = await verifyPurposeToken('session', token);
  if (!claims) return null;

  if (
    typeof claims.userId !== 'string' ||
    typeof claims.googleId !== 'string' ||
    typeof claims.did !== 'string' ||
    typeof claims.email !== 'string' ||
    !isFiniteNumber(claims.sv) ||
    !isStringArray(claims.amr) ||
    !isAssurance(claims.asr) ||
    !isFiniteNumber(claims.exp)
  ) {
    return null;
  }

  return {
    userId: claims.userId,
    googleId: claims.googleId,
    did: claims.did,
    email: claims.email,
    sv: claims.sv,
    amr: claims.amr,
    asr: claims.asr,
    expiresAt: new Date(claims.exp * 1000),
  };
}

/**
 * Verifies a refresh token against the refresh purpose only, returning the
 * full claim set (not just a userId string) - the refresh route needs `sv`,
 * `amr` and `asr`. Same runtime shape validation as `verifySessionToken`
 * (PR #120 review, finding 8) - reject, never cast.
 */
export async function verifyRefreshToken(token: string): Promise<RefreshClaims | null> {
  const claims = await verifyPurposeToken('refresh', token);
  if (!claims) return null;

  if (
    typeof claims.userId !== 'string' ||
    !isFiniteNumber(claims.sv) ||
    !isStringArray(claims.amr) ||
    !isAssurance(claims.asr) ||
    !isFiniteNumber(claims.exp)
  ) {
    return null;
  }

  return {
    userId: claims.userId,
    sv: claims.sv,
    amr: claims.amr,
    asr: claims.asr,
    expiresAt: new Date(claims.exp * 1000),
  };
}

/**
 * The session-path verification helper (canonical §4.6, T-M1-06). Tries the
 * modern verify first; only when that fails AND the token carries no
 * recognized `typ` claim does it fall through to the bounded legacy window -
 * a token with a recognized type claim failed a REAL check and must never be
 * retried as legacy, which is exactly the "strip the signature to reach the
 * weak path" downgrade attack this guards against.
 */
async function resolveSessionPathClaims(token: string): Promise<Session | null> {
  const modern = await verifySessionToken(token);
  if (modern) return modern;

  if (decodeTokenTypeUnverified(token) !== null) {
    return null;
  }

  return verifyLegacySessionToken(token);
}

// === Model B: the central revocation check ===

/**
 * Re-reads `users.session_version` by primary key and returns the session
 * only when it strictly equals the token's `sv`. On mismatch, missing row, or
 * read failure, attempts to clear the session cookies (best-effort - `cookies()`
 * is mutable inside route handlers but throws in a React Server Component
 * render, so the auth result must not depend on which context called it) and
 * returns null either way.
 *
 * Schema-transition tolerance (PR #120 review, finding 1). CONSTRAINT: when
 * the read reports `unavailable` - the deployed database predates migration
 * 20260901000001, so `users.session_version` does not exist (Postgres 42703)
 * or the row lacks the field - the revocation check CANNOT run at all. While
 * the bounded AUTH_LEGACY_UNTIL window is open this passes (pre-M1 legacy
 * behavior: no version check existed), so a deploy that races the migration
 * degrades to yesterday's semantics instead of killing every authenticated
 * request. The moment the window closes, `unavailable` fails closed exactly
 * like any other failure - a permanently missing column is an operator
 * error, never a silent bypass of Model B revocation.
 */
async function assertLiveSessionVersion(session: Session): Promise<Session | null> {
  const read = await getUserSessionVersion(session.userId);

  if (read.kind === 'unavailable' && isLegacyWindowOpen()) {
    // Version check unavailable inside the transition window - pass, and do
    // NOT clear cookies: the session is not revoked, merely unverifiable.
    return session;
  }
  if (read.kind === 'version' && read.version === session.sv) {
    return session;
  }

  try {
    await clearSessionCookies();
  } catch {
    // RSC render context, or no request scope - nothing to clear from here.
  }
  return null;
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
