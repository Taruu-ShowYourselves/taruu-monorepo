/**
 * Facebook OAuth Service
 *
 * Handles Facebook OAuth for social proof verification.
 * Users connect Facebook to increase their identity score by 30 points.
 */

// === Configuration ===

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || '';
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || '';
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/callback/facebook`;

// === Types ===

export interface FacebookTokens {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface FacebookUserInfo {
  id: string;
  name: string;
  email?: string;
  picture?: {
    data: {
      url: string;
      width: number;
      height: number;
    };
  };
}

// === Client-Side Functions ===

/**
 * Build Facebook OAuth URL
 */
export function buildFacebookAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: FACEBOOK_APP_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'email,public_profile',
    state,
  });

  return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
}

/**
 * Redirect to Facebook OAuth (client-side)
 */
export function redirectToFacebookAuth(userId: string): void {
  // Create state with user ID for callback verification
  const state = JSON.stringify({
    userId,
    timestamp: Date.now(),
    nonce: Math.random().toString(36).substring(2),
  });

  // Store state in sessionStorage for verification
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('facebook_oauth_state', state);
  }

  const authUrl = buildFacebookAuthUrl(encodeURIComponent(state));
  window.location.href = authUrl;
}

// === Server-Side Functions ===

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<FacebookTokens> {
  const params = new URLSearchParams({
    client_id: FACEBOOK_APP_ID,
    client_secret: FACEBOOK_APP_SECRET,
    redirect_uri: REDIRECT_URI,
    code,
  });

  const response = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?${params.toString()}`,
    { method: 'GET' }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to exchange code for tokens');
  }

  return response.json();
}

/**
 * Get Facebook user info
 */
export async function getFacebookUserInfo(
  accessToken: string
): Promise<FacebookUserInfo> {
  const fields = 'id,name,email,picture.width(200).height(200)';
  const response = await fetch(
    `https://graph.facebook.com/v18.0/me?fields=${fields}&access_token=${accessToken}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to get user info');
  }

  return response.json();
}

/**
 * Verify Facebook access token is valid
 */
export async function verifyAccessToken(
  accessToken: string
): Promise<{ isValid: boolean; userId?: string }> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}`
    );

    if (!response.ok) {
      return { isValid: false };
    }

    const data = await response.json();
    return {
      isValid: data.data?.is_valid === true,
      userId: data.data?.user_id,
    };
  } catch {
    return { isValid: false };
  }
}

/**
 * Get long-lived access token (60 days instead of 2 hours)
 */
export async function getLongLivedToken(
  shortLivedToken: string
): Promise<FacebookTokens> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: FACEBOOK_APP_ID,
    client_secret: FACEBOOK_APP_SECRET,
    fb_exchange_token: shortLivedToken,
  });

  const response = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to get long-lived token');
  }

  return response.json();
}
