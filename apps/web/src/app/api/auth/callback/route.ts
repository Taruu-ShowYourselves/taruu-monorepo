/**
 * Auth0 OIDC Callback API Route
 *
 * Handles the OAuth callback from Auth0 Universal Login, exchanges the code
 * for tokens, creates or updates the user, and generates a DID if new.
 *
 * Auth0 federates the underlying social IdP (Google). The OIDC `sub` it
 * returns is the external identity key — persisted on the existing
 * `users.google_id` column and `session.googleId` field (names unchanged).
 */

import { NextResponse } from 'next/server';
import {
  exchangeCodeForTokens,
  getAuth0UserInfo,
} from '@/services/auth/auth0';
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
    const clientSecret = process.env.AUTH0_CLIENT_SECRET;

    if (!clientSecret) {
      return NextResponse.json(
        { error: 'Server configuration error', code: 'CONFIG_ERROR' },
        { status: 500 }
      );
    }

    const tokens = await exchangeCodeForTokens(code, redirectUri, clientSecret);

    // Get user info from Auth0 (OIDC /userinfo)
    const auth0User = await getAuth0UserInfo(tokens.accessToken);

    // The Auth0 OIDC `sub` (e.g. "google-oauth2|123...") is the external
    // identity key. We store it in the existing `users.google_id` column and
    // look users up with getUserByGoogleId — these names predate Auth0 and are
    // kept so every consumer route/test that reads `session.googleId` works
    // unchanged; the value is now an Auth0 subject, not a raw Google id.
    const externalSubject = auth0User.sub;

    // Check if user exists in Supabase
    let user = await getUserByGoogleId(externalSubject);
    let isNewUser = false;

    if (!user) {
      // New user - generate DID
      isNewUser = true;

      const didData = await generateEncryptedDID(tokens.accessToken);

      // Create user in Supabase
      user = await createUser({
        email: auth0User.email,
        first_name: auth0User.given_name || null,
        last_name: auth0User.family_name || null,
        // google_id now holds the Auth0 subject (not a raw Google id).
        google_id: externalSubject,
        avatar_url: auth0User.picture || null,
        did: didData.did,
        did_public_key: JSON.stringify(didData.publicKey),
        did_encrypted_private_key: didData.encryptedPrivateKey,
        identity_score: 40, // Google (via Auth0) = 40 points
        verification_status: 'none',
      });

      // Create Google social proof in Supabase. The social_proof enum only has
      // google/facebook/instagram and the user logs in via Google federated
      // through Auth0, so the provider stays 'google'; provider_id is the sub.
      await upsertSocialProof({
        user_id: user.id,
        provider: 'google',
        provider_id: externalSubject,
        provider_email: auth0User.email,
        provider_name: auth0User.name,
        provider_avatar: auth0User.picture || null,
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
      // session.googleId now carries the Auth0 subject (field name unchanged).
      googleId: externalSubject,
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
