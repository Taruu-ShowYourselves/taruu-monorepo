/**
 * Google OIDC Callback API Route
 *
 * The SPA (AuthProvider on the sign-in page) receives Google's redirect with
 * ?code&state and POSTs them here. This route:
 *   1. Validates the server-minted signed OAuth state against the
 *      sync-oauth-state cookie (double submit, requirement #71-M1-08).
 *   2. Exchanges the code for tokens.
 *   3. Verifies the id_token locally via Google's JWKS, bound to the state's
 *      nonce hash (requirement #71-M1-07) - the verified `sub` is the
 *      identity authority; `getGoogleUserInfo` is enrichment only.
 *   4. Mints the session/refresh pair with the M1 assurance defaults and the
 *      account's current `session_version`.
 *
 * Refuses before any side effect: no user row is created or touched, and no
 * session is minted, until state and id_token both verify.
 */

import { NextResponse } from 'next/server';
import {
  exchangeCodeForTokens,
  getGoogleUserInfo,
  GOOGLE_REDIRECT_PATH,
  type GoogleUserInfo,
} from '@/services/auth/google';
import { verifyGoogleIdToken, GoogleIdTokenVerificationError } from '@/services/auth/google-oidc';
import { verifyLoginOAuthState } from '@/services/auth/login-state';
import { resolveOrigin } from '@/services/auth/origin';
import { secureEqual } from '@/lib/secureCompare';
import {
  createSessionToken,
  createRefreshToken,
  setSessionCookies,
} from '@/services/auth/session';
import { DEFAULT_LOGIN_AMR, DEFAULT_LOGIN_ASR } from '@/services/auth/assurance';
import { mintPendingChallenge, setPendingChallengeCookie } from '@/services/auth/mfa-challenge';
import { userRequiresMfa } from '@/lib/supabase/mfa';
import { generateEncryptedDID } from '@sync/shared';
import {
  getUserByGoogleId,
  createUser,
  updateUser,
  upsertSocialProof,
  getSocialProofsByUserId,
} from '@/lib/supabase/db';
import { buildUserProfile } from '@/services/user/profile';

const OAUTH_STATE_COOKIE = 'sync-oauth-state';

function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;

  const cookiesMap = Object.fromEntries(
    cookieHeader
      .split('; ')
      .filter(Boolean)
      .map((c) => {
        const [key, ...rest] = c.split('=');
        return [key, rest.join('=')];
      })
  );
  return cookiesMap[name] ?? null;
}

/** State is single-use: this clears the cookie on every response once we've read it, success or failure. */
function clearingStateCookie(response: NextResponse): NextResponse {
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, state } = body;

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code required', code: 'MISSING_CODE' },
        { status: 400 }
      );
    }

    if (!state) {
      return NextResponse.json(
        { error: 'State parameter required', code: 'MISSING_STATE' },
        { status: 400 }
      );
    }

    const stateCookie = readCookie(request, OAUTH_STATE_COOKIE);
    if (!stateCookie) {
      return NextResponse.json(
        { error: 'Missing OAuth state cookie', code: 'MISSING_STATE_COOKIE' },
        { status: 400 }
      );
    }

    // Double submit: the state parameter must byte-equal the cookie.
    if (!secureEqual(state, stateCookie)) {
      return clearingStateCookie(
        NextResponse.json(
          { error: 'OAuth state mismatch', code: 'STATE_MISMATCH' },
          { status: 400 }
        )
      );
    }

    const loginState = await verifyLoginOAuthState(state);
    if (!loginState) {
      return clearingStateCookie(
        NextResponse.json(
          { error: 'Invalid or expired OAuth state', code: 'INVALID_STATE' },
          { status: 400 }
        )
      );
    }

    // Exchange code for tokens. The redirect_uri must byte-match the one the
    // authorize request used - /api/auth/google/start, never this route.
    const redirectUri = `${resolveOrigin(request)}${GOOGLE_REDIRECT_PATH}`;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientSecret) {
      return clearingStateCookie(
        NextResponse.json(
          { error: 'Server configuration error', code: 'CONFIG_ERROR' },
          { status: 500 }
        )
      );
    }

    const tokens = await exchangeCodeForTokens(code, redirectUri, clientSecret);

    if (!tokens.idToken) {
      return clearingStateCookie(
        NextResponse.json(
          { error: 'Google did not return an id_token', code: 'MISSING_ID_TOKEN' },
          { status: 401 }
        )
      );
    }

    let identity;
    try {
      identity = await verifyGoogleIdToken(tokens.idToken, { nonceHash: loginState.nonceHash });
    } catch (verifyError) {
      const status =
        verifyError instanceof GoogleIdTokenVerificationError &&
        verifyError.category === 'email_not_verified'
          ? 403
          : 401;
      return clearingStateCookie(
        NextResponse.json(
          { error: 'Google identity verification failed', code: 'ID_TOKEN_VERIFICATION_FAILED' },
          { status }
        )
      );
    }

    // The verified id_token subject is the identity authority (requirement
    // #71-M1-07), stored on users.google_id / session.googleId. (Any rows
    // written during the Auth0 era hold `google-oauth2|<sub>` values - auth
    // never completed in that era, so no real accounts carry them.)
    const externalSubject = identity.subject;

    // Profile enrichment only - picture and names. A failure degrades the
    // profile rather than failing the login, and never overrides the
    // verified subject or email.
    let enrichment: Partial<GoogleUserInfo> = {};
    try {
      enrichment = await getGoogleUserInfo(tokens.accessToken);
    } catch (enrichError) {
      console.error('Google profile enrichment failed (non-fatal):', enrichError);
    }

    let user = await getUserByGoogleId(externalSubject);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;

      const didData = await generateEncryptedDID(tokens.accessToken);

      user = await createUser({
        email: identity.email,
        first_name: identity.givenName || enrichment.given_name || null,
        last_name: identity.familyName || enrichment.family_name || null,
        google_id: externalSubject,
        avatar_url: identity.picture || enrichment.picture || null,
        did: didData.did,
        did_public_key: JSON.stringify(didData.publicKey),
        did_encrypted_private_key: didData.encryptedPrivateKey,
        // identity_score is database-owned: the social_proofs trigger sets it
        // to the Google weight when the proof row lands below.
        verification_status: 'none',
      });

      await upsertSocialProof({
        user_id: user.id,
        provider: 'google',
        provider_id: externalSubject,
        provider_email: identity.email,
        provider_name: enrichment.name,
        provider_avatar: identity.picture || enrichment.picture || null,
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

    // Login-challenge branch (engineering model §5.2 case 3): when the
    // account has an active factor AND global enforcement is on, no session
    // and no refresh token exist - only the pending challenge (DB row =
    // authority, cookie/body token = locator). A null derivation throws:
    // enforcement state is never guessed.
    const requiresMfa = await userRequiresMfa(user.id);
    if (requiresMfa === null) {
      throw new Error('required-assurance derivation failed during login');
    }
    if (requiresMfa) {
      const challenge = await mintPendingChallenge(user.id, request);
      if (challenge === 'rate_limited') {
        return clearingStateCookie(
          NextResponse.json(
            { error: 'Too many attempts', code: 'RATE_LIMITED' },
            { status: 429 }
          )
        );
      }
      if (!challenge) {
        throw new Error('pending-challenge mint failed');
      }
      await setPendingChallengeCookie(challenge.token);
      return clearingStateCookie(
        NextResponse.json({
          success: false,
          mfaRequired: true,
          code: 'MFA_REQUIRED',
          // The locator is also returned in the body for cookie-less clients;
          // it is worthless without completing the challenge.
          pendingToken: challenge.token,
          expiresInSeconds: challenge.expiresInSeconds,
        })
      );
    }

    // sv comes from the row we just read/created - never a literal at the
    // call site, so a caller can't mint a token stamped with a version it
    // did not verify.
    const sv = user.session_version;

    const sessionToken = await createSessionToken({
      userId: user.id,
      googleId: externalSubject,
      did: user.did || '',
      email: identity.email,
      sv,
      amr: [...DEFAULT_LOGIN_AMR],
      asr: DEFAULT_LOGIN_ASR,
    });

    const refreshToken = await createRefreshToken({
      userId: user.id,
      sv,
      amr: [...DEFAULT_LOGIN_AMR],
      asr: DEFAULT_LOGIN_ASR,
    });

    // Set session cookies
    await setSessionCookies(sessionToken, refreshToken);

    // Canonical profile shape - shared with /api/user/profile and the other
    // auth routes so the client only ever sees one user shape.
    const proofs = await getSocialProofsByUserId(user.id);
    const userResponse = await buildUserProfile(user, proofs);

    return clearingStateCookie(
      NextResponse.json({
        success: true,
        user: userResponse,
        accessToken: sessionToken,
        refreshToken,
        isNewUser,
      })
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    // Generic to the client - never echo verification internals here. Clear
    // the state cookie on this path too: it is single-use once read, and an
    // exception after state validation (an escaped enrichment error, a DB
    // failure, the pending-mint throw) must not leave sync-oauth-state alive
    // for the rest of its TTL.
    return clearingStateCookie(
      NextResponse.json({ error: 'Authentication failed', code: 'AUTH_FAILED' }, { status: 500 })
    );
  }
}
