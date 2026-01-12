import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

// Keys for secure storage
const SESSION_TOKEN_KEY = 'sync-session-token';
const REFRESH_TOKEN_KEY = 'sync-refresh-token';
const USER_DATA_KEY = 'sync-user-data';

/**
 * Secure token storage
 */
export const tokenStorage = {
  async getSessionToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    } catch (error) {
      console.error('Error getting session token:', error);
      return null;
    }
  },

  async saveSessionToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
    } catch (error) {
      console.error('Error saving session token:', error);
    }
  },

  async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Error getting refresh token:', error);
      return null;
    }
  },

  async saveRefreshToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
    } catch (error) {
      console.error('Error saving refresh token:', error);
    }
  },

  async clearTokens(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_DATA_KEY);
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  },

  async getUserData(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(USER_DATA_KEY);
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  },

  async saveUserData(data: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(USER_DATA_KEY, data);
    } catch (error) {
      console.error('Error saving user data:', error);
    }
  },
};

/**
 * Google OAuth configuration
 */
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://sync.co.il';

/**
 * Build Google OAuth URL for mobile
 */
export function buildGoogleAuthUrl(isSignUp: boolean = false): string {
  const redirectUri = Linking.createURL('auth/callback');
  const state = JSON.stringify({
    isSignUp,
    redirectUri,
    platform: Platform.OS,
  });

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${API_URL}/api/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state: encodeURIComponent(state),
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Handle Google OAuth sign in
 */
export async function signInWithGoogle(isSignUp: boolean = false): Promise<{
  success: boolean;
  sessionToken?: string;
  refreshToken?: string;
  user?: Record<string, unknown>;
  error?: string;
}> {
  try {
    const authUrl = buildGoogleAuthUrl(isSignUp);
    const redirectUrl = Linking.createURL('auth/callback');

    // Open browser for OAuth
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

    if (result.type !== 'success') {
      return { success: false, error: 'Authentication cancelled' };
    }

    // Parse the callback URL
    const url = new URL(result.url);
    const sessionToken = url.searchParams.get('session_token');
    const refreshToken = url.searchParams.get('refresh_token');
    const userData = url.searchParams.get('user');
    const error = url.searchParams.get('error');

    if (error) {
      return { success: false, error: decodeURIComponent(error) };
    }

    if (!sessionToken) {
      return { success: false, error: 'No session token received' };
    }

    // Save tokens
    await tokenStorage.saveSessionToken(sessionToken);
    if (refreshToken) {
      await tokenStorage.saveRefreshToken(refreshToken);
    }

    // Parse and save user data
    let user: Record<string, unknown> | undefined;
    if (userData) {
      user = JSON.parse(decodeURIComponent(userData));
      await tokenStorage.saveUserData(JSON.stringify(user));
    }

    return {
      success: true,
      sessionToken,
      refreshToken: refreshToken || undefined,
      user,
    };
  } catch (error) {
    console.error('Google sign in error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
  try {
    // Call server to invalidate session
    const sessionToken = await tokenStorage.getSessionToken();
    if (sessionToken) {
      await fetch(`${API_URL}/api/auth/session`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
    }
  } catch (error) {
    console.error('Error signing out on server:', error);
  }

  // Always clear local tokens
  await tokenStorage.clearTokens();
}

/**
 * Validate current session
 */
export async function validateSession(): Promise<{
  valid: boolean;
  user?: Record<string, unknown>;
}> {
  try {
    const sessionToken = await tokenStorage.getSessionToken();
    if (!sessionToken) {
      return { valid: false };
    }

    const response = await fetch(`${API_URL}/api/auth/session`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Try to refresh token
      const refreshed = await refreshSession();
      return refreshed;
    }

    const data = await response.json();
    return { valid: true, user: data.user };
  } catch (error) {
    console.error('Session validation error:', error);
    return { valid: false };
  }
}

/**
 * Refresh session with refresh token
 */
export async function refreshSession(): Promise<{
  valid: boolean;
  user?: Record<string, unknown>;
}> {
  try {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (!refreshToken) {
      return { valid: false };
    }

    const response = await fetch(`${API_URL}/api/auth/session/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      await tokenStorage.clearTokens();
      return { valid: false };
    }

    const data = await response.json();

    // Save new tokens
    await tokenStorage.saveSessionToken(data.sessionToken);
    if (data.refreshToken) {
      await tokenStorage.saveRefreshToken(data.refreshToken);
    }
    if (data.user) {
      await tokenStorage.saveUserData(JSON.stringify(data.user));
    }

    return { valid: true, user: data.user };
  } catch (error) {
    console.error('Session refresh error:', error);
    await tokenStorage.clearTokens();
    return { valid: false };
  }
}

/**
 * Get auth token for API requests
 */
export async function getAuthToken(): Promise<string | null> {
  return tokenStorage.getSessionToken();
}

/**
 * Facebook OAuth configuration
 */
const FACEBOOK_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || '';

/**
 * Build Facebook OAuth URL for mobile
 */
export function buildFacebookAuthUrl(userId: string): string {
  const redirectUri = `${API_URL}/api/social/callback/facebook`;
  const state = JSON.stringify({
    userId,
    platform: Platform.OS,
    returnToMobile: true,
    mobileRedirectUrl: Linking.createURL('settings/social-callback'),
  });

  const params = new URLSearchParams({
    client_id: FACEBOOK_APP_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'email,public_profile',
    state: encodeURIComponent(state),
  });

  return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
}

/**
 * Connect Facebook account
 */
export async function connectFacebook(userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const authUrl = buildFacebookAuthUrl(userId);
    const redirectUrl = Linking.createURL('settings/social-callback');

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

    if (result.type !== 'success') {
      return { success: false, error: 'Facebook connection cancelled' };
    }

    // Parse the callback URL
    const url = new URL(result.url);
    const success = url.searchParams.get('success');
    const error = url.searchParams.get('error');

    if (error) {
      return { success: false, error: decodeURIComponent(error) };
    }

    return { success: success === 'facebook' };
  } catch (error) {
    console.error('Facebook connect error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Instagram OAuth configuration
 */
const INSTAGRAM_APP_ID = process.env.EXPO_PUBLIC_INSTAGRAM_APP_ID || '';

/**
 * Build Instagram OAuth URL for mobile
 */
export function buildInstagramAuthUrl(userId: string): string {
  const redirectUri = `${API_URL}/api/social/callback/instagram`;
  const state = JSON.stringify({
    userId,
    platform: Platform.OS,
    returnToMobile: true,
    mobileRedirectUrl: Linking.createURL('settings/social-callback'),
  });

  const params = new URLSearchParams({
    client_id: INSTAGRAM_APP_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'instagram_business_basic',
    state: encodeURIComponent(state),
  });

  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

/**
 * Connect Instagram account
 */
export async function connectInstagram(userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const authUrl = buildInstagramAuthUrl(userId);
    const redirectUrl = Linking.createURL('settings/social-callback');

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

    if (result.type !== 'success') {
      return { success: false, error: 'Instagram connection cancelled' };
    }

    // Parse the callback URL
    const url = new URL(result.url);
    const success = url.searchParams.get('success');
    const error = url.searchParams.get('error');

    if (error) {
      return { success: false, error: decodeURIComponent(error) };
    }

    return { success: success === 'instagram' };
  } catch (error) {
    console.error('Instagram connect error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Disconnect social platform
 */
export async function disconnectSocialPlatform(platform: 'facebook' | 'instagram'): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const sessionToken = await tokenStorage.getSessionToken();
    if (!sessionToken) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/api/social/proofs?platform=${platform}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.error || 'Failed to disconnect' };
    }

    return { success: true };
  } catch (error) {
    console.error('Disconnect social error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get social proofs data
 */
export async function getSocialProofs(): Promise<{
  success: boolean;
  socialProofs?: Array<{
    platform: string;
    username?: string;
    email?: string;
    verified: boolean;
    score: number;
  }>;
  identityScore?: {
    total: number;
    level: string;
    breakdown: Record<string, number>;
  };
  error?: string;
}> {
  try {
    const sessionToken = await tokenStorage.getSessionToken();
    if (!sessionToken) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/api/social/proofs`, {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.error || 'Failed to fetch social proofs' };
    }

    const data = await response.json();
    return {
      success: true,
      socialProofs: data.socialProofs,
      identityScore: data.identityScore,
    };
  } catch (error) {
    console.error('Get social proofs error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
