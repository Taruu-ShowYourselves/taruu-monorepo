/**
 * Session Refresh API Route
 *
 * POST: Refresh the session using refresh token from cookies
 * Returns new access token and user data
 */

import { NextResponse } from 'next/server';
import {
  verifyRefreshToken,
  getRefreshTokenFromCookies,
  createSessionToken,
  createRefreshToken,
  setSessionCookies,
} from '@/services/auth/session';
import { getUserById, getSocialProofsByUserId } from '@/lib/supabase/db';
import { buildUserProfile } from '@/services/user/profile';

/**
 * POST /api/auth/session/refresh
 * Refresh session using refresh token
 */
export async function POST() {
  try {
    // Get refresh token from cookies
    const refreshToken = await getRefreshTokenFromCookies();

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token found', code: 'NO_REFRESH_TOKEN' },
        { status: 401 }
      );
    }

    // Verify refresh token and get userId
    const userId = await verifyRefreshToken(refreshToken);

    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await getUserById(userId);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Create new session token
    const newSessionToken = await createSessionToken({
      userId: user.id,
      googleId: user.google_id || '',
      did: user.did || '',
      email: user.email,
    });

    // Optionally rotate refresh token for better security
    const newRefreshToken = await createRefreshToken(user.id);

    // Set new cookies
    await setSessionCookies(newSessionToken, newRefreshToken);

    // Get social proofs for response
    const proofs = await getSocialProofsByUserId(user.id);

    // Canonical profile shape — shared with /api/user/profile and the other
    // auth routes so the client only ever sees one user shape.
    const userResponse = await buildUserProfile(user, proofs);

    return NextResponse.json({
      accessToken: newSessionToken,
      refreshToken: newRefreshToken,
      user: userResponse,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    console.error('Session refresh error:', error);
    return NextResponse.json(
      { error: 'Session refresh failed', code: 'REFRESH_FAILED' },
      { status: 500 }
    );
  }
}
