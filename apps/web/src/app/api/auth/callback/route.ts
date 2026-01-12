/**
 * Google OAuth Callback API Route
 *
 * Handles the OAuth callback from Google, exchanges code for tokens,
 * creates or updates user, generates DID if new user.
 */

import { NextResponse } from 'next/server';
import {
  exchangeCodeForTokens,
  getGoogleUserInfo,
} from '@/services/auth/google';
import {
  createSessionToken,
  createRefreshToken,
  setSessionCookies,
} from '@/services/auth/session';
import { generateEncryptedDID } from '@sync/shared';
import {
  getUserByGoogleId,
  createUser,
  updateUser,
  upsertSocialProof,
} from '@/lib/supabase/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code required', code: 'MISSING_CODE' },
        { status: 400 }
      );
    }

    // Exchange code for tokens
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientSecret) {
      return NextResponse.json(
        { error: 'Server configuration error', code: 'CONFIG_ERROR' },
        { status: 500 }
      );
    }

    const tokens = await exchangeCodeForTokens(code, redirectUri, clientSecret);

    // Get user info from Google
    const googleUser = await getGoogleUserInfo(tokens.accessToken);

    // Check if user exists in Supabase
    let user = await getUserByGoogleId(googleUser.id);
    let isNewUser = false;

    if (!user) {
      // New user - generate DID
      isNewUser = true;

      const didData = await generateEncryptedDID(tokens.accessToken);

      // Create user in Supabase
      user = await createUser({
        email: googleUser.email,
        first_name: googleUser.given_name || null,
        last_name: googleUser.family_name || null,
        google_id: googleUser.id,
        avatar_url: googleUser.picture || null,
        did: didData.did,
        did_public_key: JSON.stringify(didData.publicKey),
        did_encrypted_private_key: didData.encryptedPrivateKey,
        identity_score: 40, // Google = 40 points
        verification_status: 'none',
      });

      // Create Google social proof in Supabase
      await upsertSocialProof({
        user_id: user.id,
        provider: 'google',
        provider_id: googleUser.id,
        provider_email: googleUser.email,
        provider_name: googleUser.name,
        provider_avatar: googleUser.picture || null,
      });
    } else {
      // Existing user - update last login
      await updateUser(user.id, {
        updated_at: new Date().toISOString(),
      });
    }

    // Create session tokens
    const sessionToken = await createSessionToken({
      userId: user.id,
      googleId: googleUser.id,
      did: user.did || '',
      email: user.email,
    });

    const refreshToken = await createRefreshToken(user.id);

    // Set session cookies
    await setSessionCookies(sessionToken, refreshToken);

    // Map Supabase user to API response format
    const userResponse = {
      id: user.id,
      did: user.did,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      identityScore: user.identity_score,
      verificationStatus: user.verification_status,
      avatarUrl: user.avatar_url,
      municipality: user.municipality_id,
    };

    // Return response
    return NextResponse.json({
      success: true,
      user: userResponse,
      accessToken: sessionToken,
      refreshToken,
      isNewUser,
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.json(
      {
        error: 'Authentication failed',
        code: 'AUTH_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
