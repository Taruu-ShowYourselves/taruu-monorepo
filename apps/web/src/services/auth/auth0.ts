/**
 * Auth0 OIDC Service
 *
 * Handles the primary login flow via Auth0 Universal Login
 * (OIDC Authorization Code flow). Replaces the previous custom Google OAuth
 * service as the primary identity provider for the SEL-DID system.
 *
 * NOTE: Auth0 federates the underlying social IdP (e.g. Google). The OIDC
 * `sub` it returns (e.g. "google-oauth2|123...") is the external subject we
 * persist as the identity key — see callback route + session for how it maps
 * onto the existing `users.google_id` column / `session.googleId` field.
 */

// CSRF state helpers are shared with the legacy google service to keep
// behaviour equivalent and avoid duplicating sessionStorage logic.
import {
  generateOAuthState,
  storeOAuthState,
} from './google';

// === Types ===

/**
 * Tokens returned by the Auth0 /oauth/token endpoint.
 * Mirrors the server-side token shape used by the callback route.
 */
export interface Auth0Tokens {
  accessToken: string;
  idToken: string;
  expiresAt: Date;
}

/**
 * Userinfo claims returned by the Auth0 /userinfo endpoint
 * (OIDC standard claims for scope "openid profile email").
 */
export interface Auth0UserInfo {
  sub: string; // Auth0 subject, e.g. "google-oauth2|123..." (the external identity key)
  email: string;
  email_verified: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  picture?: string;
}

// === Configuration ===

const AUTH0_DOMAIN = process.env.NEXT_PUBLIC_AUTH0_DOMAIN || '';
const AUTH0_CLIENT_ID = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID || '';
const AUTH0_REDIRECT_URI =
  process.env.NEXT_PUBLIC_APP_URL + '/api/auth/callback' || '';

// Scopes required for authentication (OIDC standard claims).
const SCOPES = ['openid', 'profile', 'email'].join(' ');

/**
 * Normalize the configured Auth0 domain into an https origin with no
 * trailing slash, so endpoint URLs concatenate cleanly.
 */
function auth0Origin(domain: string): string {
  const trimmed = domain.replace(/\/+$/, '');
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

// === Client-Side Functions ===

/**
 * Build the Auth0 Universal Login (/authorize) URL.
 * Generates and stores a CSRF state before returning the URL.
 */
export function buildAuth0AuthUrl(options?: {
  redirectUri?: string;
  state?: string;
}): string {
  const state = options?.state ?? generateOAuthState();
  storeOAuthState(state);

  const params = new URLSearchParams({
    client_id: AUTH0_CLIENT_ID,
    redirect_uri: options?.redirectUri || AUTH0_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    state,
  });

  return `${auth0Origin(AUTH0_DOMAIN)}/authorize?${params.toString()}`;
}

// === Server-Side Functions (for API routes) ===

/**
 * Exchange an authorization code for Auth0 tokens.
 * This should only be called from server-side API routes.
 *
 * The Auth0 domain is read from NEXT_PUBLIC_AUTH0_DOMAIN and the client id
 * from NEXT_PUBLIC_AUTH0_CLIENT_ID (consistent with the legacy google service,
 * which reads its client id from process.env directly).
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  clientSecret: string
): Promise<Auth0Tokens> {
  const response = await fetch(`${auth0Origin(AUTH0_DOMAIN)}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: AUTH0_CLIENT_ID,
      client_secret: clientSecret,
      code,
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
    idToken: data.id_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/**
 * Get user info from Auth0 using an access token.
 * This should only be called from server-side API routes.
 */
export async function getAuth0UserInfo(
  accessToken: string
): Promise<Auth0UserInfo> {
  const response = await fetch(`${auth0Origin(AUTH0_DOMAIN)}/userinfo`, {
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
