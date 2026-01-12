/**
 * Auth Services Index
 *
 * Re-exports all authentication-related services
 */

// Session management
export * from './session';

// Google OAuth (primary auth)
export {
  buildGoogleAuthUrl,
  redirectToGoogleAuth,
  exchangeCodeForTokens as exchangeGoogleCodeForTokens,
  getGoogleUserInfo,
  verifyIdToken,
  refreshAccessToken,
  generateOAuthState,
  storeOAuthState,
  verifyOAuthState,
} from './google';

// Facebook OAuth (social proof)
export {
  buildFacebookAuthUrl,
  redirectToFacebookAuth,
  exchangeCodeForTokens as exchangeFacebookCodeForTokens,
  getLongLivedToken as getFacebookLongLivedToken,
  getFacebookUserInfo,
  verifyAccessToken as verifyFacebookAccessToken,
} from './facebook';

// Instagram OAuth (social proof)
export {
  buildInstagramAuthUrl,
  redirectToInstagramAuth,
  exchangeCodeForTokens as exchangeInstagramCodeForTokens,
  getLongLivedToken as getInstagramLongLivedToken,
  refreshLongLivedToken,
  getInstagramUserInfo,
  verifyAccessToken as verifyInstagramAccessToken,
} from './instagram';

// Re-export types
export type { FacebookTokens, FacebookUserInfo } from './facebook';
export type { InstagramTokens, InstagramUserInfo, InstagramLongLivedToken } from './instagram';
