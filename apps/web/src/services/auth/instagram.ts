/**
 * Instagram OAuth Service
 *
 * Handles Instagram Basic Display API OAuth for social proof verification.
 * Users connect Instagram to increase their identity score by 30 points.
 *
 * Note: Instagram uses Facebook's infrastructure, requires Facebook App.
 */

// === Configuration ===

const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID || '';
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET || '';
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/callback/instagram`;

// === Types ===

export interface InstagramTokens {
  access_token: string;
  user_id: number;
}

export interface InstagramLongLivedToken {
  access_token: string;
  token_type: string;
  expires_in: number; // 60 days in seconds
}

export interface InstagramUserInfo {
  id: string;
  username: string;
  account_type?: 'BUSINESS' | 'MEDIA_CREATOR' | 'PERSONAL';
  media_count?: number;
}

// === Client-Side Functions ===

/**
 * Build Instagram OAuth URL
 */
export function buildInstagramAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: INSTAGRAM_APP_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'user_profile,user_media',
    state,
  });

  return `https://api.instagram.com/oauth/authorize?${params.toString()}`;
}

/**
 * Redirect to Instagram OAuth (client-side)
 */
export function redirectToInstagramAuth(userId: string): void {
  // Create state with user ID for callback verification
  const state = JSON.stringify({
    userId,
    timestamp: Date.now(),
    nonce: Math.random().toString(36).substring(2),
  });

  // Store state in sessionStorage for verification
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('instagram_oauth_state', state);
  }

  const authUrl = buildInstagramAuthUrl(encodeURIComponent(state));
  window.location.href = authUrl;
}

// === Server-Side Functions ===

/**
 * Exchange authorization code for short-lived access token
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<InstagramTokens> {
  const formData = new URLSearchParams({
    client_id: INSTAGRAM_APP_ID,
    client_secret: INSTAGRAM_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
    code,
  });

  const response = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.error_message || 'Failed to exchange code for tokens'
    );
  }

  return response.json();
}

/**
 * Exchange short-lived token for long-lived token (60 days)
 */
export async function getLongLivedToken(
  shortLivedToken: string
): Promise<InstagramLongLivedToken> {
  const params = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: INSTAGRAM_APP_SECRET,
    access_token: shortLivedToken,
  });

  const response = await fetch(
    `https://graph.instagram.com/access_token?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to get long-lived token');
  }

  return response.json();
}

/**
 * Refresh long-lived token (must be done before expiry)
 */
export async function refreshLongLivedToken(
  longLivedToken: string
): Promise<InstagramLongLivedToken> {
  const params = new URLSearchParams({
    grant_type: 'ig_refresh_token',
    access_token: longLivedToken,
  });

  const response = await fetch(
    `https://graph.instagram.com/refresh_access_token?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to refresh token');
  }

  return response.json();
}

/**
 * Get Instagram user info
 */
export async function getInstagramUserInfo(
  accessToken: string
): Promise<InstagramUserInfo> {
  const fields = 'id,username,account_type,media_count';
  const response = await fetch(
    `https://graph.instagram.com/me?fields=${fields}&access_token=${accessToken}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to get user info');
  }

  return response.json();
}

/**
 * Verify Instagram access token is valid
 */
export async function verifyAccessToken(
  accessToken: string
): Promise<{ isValid: boolean; userId?: string }> {
  try {
    const userInfo = await getInstagramUserInfo(accessToken);
    return {
      isValid: true,
      userId: userInfo.id,
    };
  } catch {
    return { isValid: false };
  }
}
