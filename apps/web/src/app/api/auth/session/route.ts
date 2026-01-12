/**
 * Session API Route
 *
 * POST: Validate session and get current user
 * DELETE: Sign out and clear session
 */

import { NextResponse } from 'next/server';
import {
  getSessionFromRequest,
  clearSessionCookies,
} from '@/services/auth/session';
import { getUserById, getSocialProofsByUserId } from '@/lib/supabase/db';

/**
 * POST /api/auth/session
 * Validate session and return current user
 */
export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json(
        { error: 'Invalid session', code: 'INVALID_SESSION' },
        { status: 401 }
      );
    }

    // Get user from Supabase
    const user = await getUserById(session.userId);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get social proofs to calculate identity score
    const proofs = await getSocialProofsByUserId(user.id);
    const providers = proofs.map(p => p.provider);

    // Map Supabase user to API response format
    const userResponse = {
      id: user.id,
      did: user.did,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      avatarUrl: user.avatar_url,
      identityScore: user.identity_score,
      verificationStatus: user.verification_status,
      municipality: user.municipality_id,
      socialProofs: providers,
    };

    return NextResponse.json({
      valid: true,
      user: userResponse,
      session: {
        userId: session.userId,
        did: session.did,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    console.error('Session validation error:', error);
    return NextResponse.json(
      { error: 'Session validation failed', code: 'VALIDATION_FAILED' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/session
 * Sign out - clear session cookies
 */
export async function DELETE() {
  try {
    await clearSessionCookies();

    return NextResponse.json({
      success: true,
      message: 'Signed out successfully',
    });
  } catch (error) {
    console.error('Sign out error:', error);
    return NextResponse.json(
      { error: 'Sign out failed', code: 'SIGNOUT_FAILED' },
      { status: 500 }
    );
  }
}
