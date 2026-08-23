/**
 * Google OIDC Login Start (requirement #71-M1-08, canonical §4.3 step 1)
 *
 * Replaces the browser-generated, browser-checked OAuth state. This route
 * mints the state and the nonce server-side: the state is a signed
 * `oauth_state.v1` token set as an httpOnly cookie AND returned as the
 * `state` query parameter on the authorize URL (double submit), and the
 * nonce's SHA-256 digest is bound into that same state token so the callback
 * can verify the id_token's `nonce` claim against it (Task 7).
 *
 * The raw nonce leaves the server only inside the authorize URL - it is
 * never stored, never returned in the JSON body, and never logged.
 */

import { NextResponse } from 'next/server';
import { GOOGLE_REDIRECT_PATH } from '@/services/auth/google';
import { resolveOrigin } from '@/services/auth/origin';
import { createLoginOAuthState } from '@/services/auth/login-state';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const OAUTH_STATE_COOKIE = 'sync-oauth-state';
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;
const NONCE_BYTE_LENGTH = 32;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return toHex(new Uint8Array(digest));
}

export async function POST(request: Request) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: 'Server configuration error', code: 'CONFIG_ERROR' },
      { status: 500 }
    );
  }

  const rawNonceBytes = new Uint8Array(NONCE_BYTE_LENGTH);
  crypto.getRandomValues(rawNonceBytes);
  const rawNonce = toHex(rawNonceBytes);
  const nonceHash = await sha256Hex(rawNonce);

  const stateToken = await createLoginOAuthState({ nonceHash });

  // Byte-identical to the redirect_uri the callback's token exchange uses -
  // see services/auth/origin.ts.
  const redirectUri = `${resolveOrigin(request)}${GOOGLE_REDIRECT_PATH}`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    state: stateToken,
    nonce: rawNonce,
    prompt: 'select_account',
  });

  const response = NextResponse.json({
    url: `${GOOGLE_AUTH_URL}?${params.toString()}`,
  });

  response.cookies.set(OAUTH_STATE_COOKIE, stateToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  });

  return response;
}
