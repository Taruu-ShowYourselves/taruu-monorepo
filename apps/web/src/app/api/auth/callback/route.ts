/**
 * Google OIDC Callback API Route
 *
 * The SPA (AuthProvider on the sign-in page) receives Google's redirect with
 * ?code&state, verifies state client-side, and POSTs the code here. This
 * route exchanges it for tokens, creates or updates the user, and generates
 * a DID if new. The Google `sub` is the external identity key, persisted on
 * `users.google_id` / `session.googleId`.
 */

import { NextResponse } from 'next/server';
import {
  exchangeCodeForTokens,
  getGoogleUserInfo,
  GOOGLE_REDIRECT_PATH,
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
  getSocialProofsByUserId,
} from '@/lib/supabase/db';
import { buildUserProfile } from '@/services/user/profile';

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

    // Exchange code for tokens. The redirect_uri must byte-match the one the
    // authorize request used - the sign-in page, never this API route.
    const redirectUri = `${(process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')}${GOOGLE_REDIRECT_PATH}`;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientSecret) {
      return NextResponse.json(
        { error: 'Server configuration error', code: 'CONFIG_ERROR' },
        { status: 500 }
      );
    }

    const tokens = await exchangeCodeForTokens(code, redirectUri, clientSecret);

    // Get user info from Google (OIDC userinfo)
    const googleUser = await getGoogleUserInfo(tokens.accessToken);

    // The Google `sub` is the external identity key, stored on
    // `users.google_id` and looked up via getUserByGoogleId. (Any rows
    // written during the Auth0 era hold `google-oauth2|<sub>` values - auth
    // never completed in that era, so no real accounts carry them.)
    const externalSubject = googleUser.sub;

    // Check if user exists in Supabase
    let user = await getUserByGoogleId(externalSubject);
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
        google_id: externalSubject,
        avatar_url: googleUser.picture || null,
        did: didData.did,
        did_public_key: JSON.stringify(didData.publicKey),
        did_encrypted_private_key: didData.encryptedPrivateKey,
        identity_score: 40, // Google = 40 points
        verification_status: 'none',
      });

      // Create Google social proof in Supabase; provider_id is the sub.
      await upsertSocialProof({
        user_id: user.id,
        provider: 'google',
        provider_id: externalSubject,
        provider_email: googleUser.email,
        provider_name: googleUser.name,
        provider_avatar: googleUser.picture || null,
      });
    } else {
      // Existing user - update last login. Keep the row the update returns so
      // the profile we map below is the FINAL persisted state (otherwise the
      // response would carry a pre-update `updatedAt`). Falls back to the row
      // we already hold if the update failed, matching prior behaviour.
      user = (await updateUser(user.id, {
        updated_at: new Date().toISOString(),
      })) ?? user;
    }

    // Create session tokens
    const sessionToken = await createSessionToken({
      userId: user.id,
      googleId: externalSubject,
      did: user.did || '',
      email: user.email,
    });

    const refreshToken = await createRefreshToken(user.id);

    // Set session cookies
    await setSessionCookies(sessionToken, refreshToken);

    // Canonical profile shape - shared with /api/user/profile and the other
    // auth routes so the client only ever sees one user shape.
    const proofs = await getSocialProofsByUserId(user.id);
    const userResponse = await buildUserProfile(user, proofs);

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
