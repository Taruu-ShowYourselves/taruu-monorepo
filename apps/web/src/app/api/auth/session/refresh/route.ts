/**
 * Session Refresh API Route
 *
 * POST: exchange a refresh token for a fresh 1-hour session plus a rotated
 * refresh token (specs/mfa-engineering-model.md §5.1e, canonical §4.5).
 *
 * Contract:
 * - Only `refresh.v1` tokens are accepted (`verifyRefreshToken`); a session
 *   token presented here fails verification - purpose typing closes the
 *   audited session/refresh interchangeability defect.
 * - The token is read from the `sync-refresh` cookie, or - because the mobile
 *   client has no cookie jar - from a JSON body `refreshToken` field or an
 *   `Authorization: Bearer` header. The body is read defensively: the web
 *   client sends none.
 * - The stored `users.session_version` must strictly equal the token's `sv`;
 *   a mismatch means the account was revoked since mint - 401, cookies
 *   cleared, full re-login.
 * - `getRequiredAssurance` is re-derived from the DB on every call and the
 *   token's `asr` must satisfy it. In M1 this can never fire (every account
 *   requires single-factor); it exists so that when MFA lands, only
 *   `getRequiredAssurance`'s body changes - an `sf` refresh token for an
 *   account that now requires `mf` answers 401 `MFA_REQUIRED` here, and the
 *   client restarts login.
 * - The new session and refresh tokens carry the *stored* `sv` and the
 *   *presented* token's `amr`/`asr` - refresh never upgrades assurance and
 *   never invents claims the presented token did not have.
 *
 * Rotation here is NOT refresh-token reuse detection: there is no durable
 * record of issued refresh tokens, so a stolen-and-replayed old token is not
 * detectable and remains valid until its own expiry. The revocation guarantee
 * rests entirely on `session_version` (Model B) plus the one-hour session
 * lifetime. Canonical §17 defers reuse detection deliberately - do not imply
 * this code provides it.
 */

import { NextResponse } from 'next/server';
import {
  verifyRefreshToken,
  getRefreshTokenFromCookies,
  createSessionToken,
  createRefreshToken,
  setSessionCookies,
  clearSessionCookies,
  SESSION_TTL_SECONDS,
} from '@/services/auth/session';
import { getRequiredAssurance, assuranceMeets } from '@/services/auth/assurance';
import { getUserById, getSocialProofsByUserId } from '@/lib/supabase/db';
import { buildUserProfile } from '@/services/user/profile';

/**
 * Cookie first (the web client's only channel), then body, then bearer.
 * The body read must never throw the request away - web sends no body at all.
 */
async function extractRefreshToken(request: Request): Promise<string | null> {
  const fromCookie = await getRefreshTokenFromCookies();
  if (fromCookie) return fromCookie;

  try {
    const body = await request.json();
    if (body && typeof body.refreshToken === 'string' && body.refreshToken) {
      return body.refreshToken;
    }
  } catch {
    // No body / invalid JSON - fall through to the header.
  }

  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const bearer = authHeader.slice('Bearer '.length).trim();
    if (bearer) return bearer;
  }

  return null;
}

/**
 * POST /api/auth/session/refresh
 */
export async function POST(request: Request) {
  try {
    const refreshToken = await extractRefreshToken(request);

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token found', code: 'NO_REFRESH_TOKEN' },
        { status: 401 }
      );
    }

    const claims = await verifyRefreshToken(refreshToken);

    if (!claims) {
      return NextResponse.json(
        { error: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' },
        { status: 401 }
      );
    }

    const user = await getUserById(claims.userId);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Model B: the stored version is the authority. A stale sv means the
    // account was revoked (MFA change, operator reset, sign-out-everywhere)
    // after this token was minted.
    if (user.session_version !== claims.sv) {
      await clearSessionCookies();
      return NextResponse.json(
        { error: 'Session revoked', code: 'SESSION_REVOKED' },
        { status: 401 }
      );
    }

    // Refresh-bypass fix: re-derive the account's required assurance on every
    // call. A no-op in M1 (always 'sf'); the M2 seam.
    const required = await getRequiredAssurance(user.id);
    if (!assuranceMeets(claims.asr, required)) {
      await clearSessionCookies();
      return NextResponse.json(
        { error: 'Multi-factor authentication required', code: 'MFA_REQUIRED' },
        { status: 401 }
      );
    }

    // Mint both tokens with the stored sv and the presented token's amr/asr.
    const newSessionToken = await createSessionToken({
      userId: user.id,
      googleId: user.google_id || '',
      did: user.did || '',
      email: user.email,
      sv: user.session_version,
      amr: [...claims.amr],
      asr: claims.asr,
    });

    const newRefreshToken = await createRefreshToken({
      userId: user.id,
      sv: user.session_version,
      amr: [...claims.amr],
      asr: claims.asr,
    });

    await setSessionCookies(newSessionToken, newRefreshToken);

    const proofs = await getSocialProofsByUserId(user.id);

    // Canonical profile shape - shared with /api/user/profile and the other
    // auth routes so the client only ever sees one user shape.
    const userResponse = await buildUserProfile(user, proofs);

    return NextResponse.json({
      accessToken: newSessionToken,
      // Mobile alias: apps/mobile/src/lib/auth.ts reads `sessionToken`.
      sessionToken: newSessionToken,
      refreshToken: newRefreshToken,
      user: userResponse,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString(),
    });
  } catch (error) {
    console.error('Session refresh error:', error);
    return NextResponse.json(
      { error: 'Session refresh failed', code: 'REFRESH_FAILED' },
      { status: 500 }
    );
  }
}
