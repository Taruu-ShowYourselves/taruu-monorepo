/**
 * JWT Session Service
 *
 * Handles session management with JWT tokens.
 * Replaces Clerk session management.
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';

// === Configuration ===

const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
const COOKIE_NAME = 'sync-session';
const COOKIE_REFRESH_NAME = 'sync-refresh';

// === Types ===

export interface SessionPayload extends JWTPayload {
  userId: string;
  googleId: string;
  did: string;
  email: string;
}

export interface Session {
  userId: string;
  googleId: string;
  did: string;
  email: string;
  expiresAt: Date;
}

// === Helper Functions ===

/**
 * Get secret key for JWT operations
 */
function getSecretKey(): Uint8Array {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(JWT_SECRET);
}

/**
 * Parse duration string to milliseconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhdw])$/);
  if (!match) {
    // Default to 7 days
    return 7 * 24 * 60 * 60 * 1000;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };

  return value * (multipliers[unit] || multipliers['d']);
}

// === Server-Side Functions ===

/**
 * Create a new session token
 */
export async function createSessionToken(payload: {
  userId: string;
  googleId: string;
  did: string;
  email: string;
}): Promise<string> {
  const expiresIn = parseDuration(JWT_EXPIRY);
  const expiresAt = new Date(Date.now() + expiresIn);

  const token = await new SignJWT({
    userId: payload.userId,
    googleId: payload.googleId,
    did: payload.did,
    email: payload.email,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .setSubject(payload.userId)
    .sign(getSecretKey());

  return token;
}

/**
 * Create a refresh token (longer lived)
 */
export async function createRefreshToken(userId: string): Promise<string> {
  // Refresh tokens last 30 days
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .setSubject(userId)
    .sign(getSecretKey());

  return token;
}

/**
 * Verify and decode a session token
 */
export async function verifySessionToken(
  token: string
): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());

    const sessionPayload = payload as SessionPayload;

    return {
      userId: sessionPayload.userId,
      googleId: sessionPayload.googleId,
      did: sessionPayload.did,
      email: sessionPayload.email,
      expiresAt: new Date((payload.exp || 0) * 1000),
    };
  } catch {
    return null;
  }
}

/**
 * Verify a refresh token and get userId
 */
export async function verifyRefreshToken(
  token: string
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload.sub || null;
  } catch {
    return null;
  }
}

/**
 * Set session cookies (server action)
 */
export async function setSessionCookies(
  sessionToken: string,
  refreshToken?: string
): Promise<void> {
  const cookieStore = await cookies();
  const expiresIn = parseDuration(JWT_EXPIRY);

  cookieStore.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: expiresIn / 1000,
  });

  if (refreshToken) {
    cookieStore.set(COOKIE_REFRESH_NAME, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
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

  return verifySessionToken(token);
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

/**
 * Get session from request headers
 * For use in API routes
 */
export async function getSessionFromRequest(
  request: Request
): Promise<Session | null> {
  // First try Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    return verifySessionToken(token);
  }

  // Fall back to cookies
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split('; ').map((c) => {
        const [key, ...rest] = c.split('=');
        return [key, rest.join('=')];
      })
    );
    const token = cookies[COOKIE_NAME];
    if (token) {
      return verifySessionToken(token);
    }
  }

  return null;
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
