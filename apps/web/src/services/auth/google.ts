/**
 * Google OAuth Service
 *
 * Handles Google OAuth authentication flow for web.
 * Primary authentication method for SEL-DID system.
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
const GOOGLE_REDIRECT_URI =
  (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '') + GOOGLE_REDIRECT_PATH;

// Google OAuth endpoints
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

// Scopes required for authentication
const SCOPES = [
  'openid',
  'email',
  'profile',
].join(' ');

// === Client-Side Functions ===

/**
 * Generate OAuth state for CSRF protection
 */
export function generateOAuthState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Store OAuth state for verification
 */
export function storeOAuthState(state: string): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('oauth_state', state);
  }
}

/**
 * Verify OAuth state matches stored state
 */
export function verifyOAuthState(state: string): boolean {
  if (typeof window !== 'undefined') {
    const storedState = sessionStorage.getItem('oauth_state');
    sessionStorage.removeItem('oauth_state');
    return storedState === state;
  }
  return false;
}

/**
 * Build Google OAuth authorization URL
 */
export function buildGoogleAuthUrl(options?: {
  redirectUri?: string;
  prompt?: 'none' | 'consent' | 'select_account';
}): string {
  const state = generateOAuthState();
  storeOAuthState(state);

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: options?.redirectUri || GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    state,
    access_type: 'offline', // Get refresh token
    prompt: options?.prompt || 'consent',
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Redirect to Google OAuth page
 */
export function redirectToGoogleAuth(options?: {
  redirectUri?: string;
  prompt?: 'none' | 'consent' | 'select_account';
}): void {
  if (typeof window !== 'undefined') {
    window.location.href = buildGoogleAuthUrl(options);
  }
}

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

/**
 * Verify Google ID token
 * This should only be called from server-side API routes
 */
export async function verifyIdToken(idToken: string): Promise<{
  sub: string; // Google user ID
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
  given_name: string;
  family_name: string;
}> {
  // Google's tokeninfo endpoint for verification
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
  );

  if (!response.ok) {
    throw new Error('Invalid ID token');
  }

  const payload = await response.json();

  // Verify the token was issued for our client
  if (payload.aud !== GOOGLE_CLIENT_ID) {
    throw new Error('ID token was not issued for this application');
  }

  return payload;
}
