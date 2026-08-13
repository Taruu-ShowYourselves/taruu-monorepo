/**
 * Google OAuth Service
 *
 * Handles Google OAuth authentication flow for web.
 * Primary authentication method for SEL-DID system.
 *
 * Identity authority: the Google `sub` used by the callback route comes from
 * a locally JWKS-verified id_token (`services/auth/google-oidc.ts`,
 * requirement #71-M1-07), not from the `getGoogleUserInfo` call below - that
 * call is profile enrichment only (picture, names) from here on. State and
 * the authorize URL are minted server-side by `/api/auth/google/start`
 * (requirement #71-M1-08); this module no longer builds the authorize URL or
 * generates/stores OAuth state client-side.
 */

import type { GoogleOAuthTokens } from '@sync/shared';

/**
 * OIDC standard claims from Google's v3 userinfo endpoint (scope
 * "openid profile email"). `sub` is the stable external identity key -
 * unlike the legacy v2 endpoint's `id` shape in @sync/shared.
 */
export interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  picture?: string;
}

// === Configuration ===

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

/**
 * Where Google sends the browser back. MUST be an app page, never an API
 * route: /api/auth/callback only exports POST, so a provider GET redirect
 * there 405s and the login can never complete (the historical "auth never
 * works" bug). The AuthProvider mounted on the sign-in page picks up
 * ?code&state and POSTs them to /api/auth/callback itself.
 * Must appear verbatim under "Authorized redirect URIs" on the OAuth client.
 */
export const GOOGLE_REDIRECT_PATH = '/he/sign-in';

// Google OAuth endpoints
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

// === Server-Side Functions (for API routes) ===

/**
 * Exchange authorization code for tokens
 * This should only be called from server-side API routes
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  clientSecret: string
): Promise<GoogleOAuthTokens> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    idToken: data.id_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/**
 * Get user info from Google using access token
 * This should only be called from server-side API routes
 *
 * Enrichment only (picture, names) - never the identity authority. See the
 * module header.
 */
export async function getGoogleUserInfo(
  accessToken: string
): Promise<GoogleUserInfo> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get user info: ${error}`);
  }

  return response.json();
}

/**
 * Refresh access token using refresh token
 * This should only be called from server-side API routes
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientSecret: string
): Promise<Omit<GoogleOAuthTokens, 'refreshToken'>> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh access token: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    idToken: data.id_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}
