/**
 * Auth Services Index
 *
 * Re-exports all authentication-related services
 */

// Session types only (session functions use cookies() which is server-only)
// Import session functions directly from '@/services/auth/session' in server components
export type { SessionPayload, Session } from './session';

// Google OAuth (primary auth). Identity authority is the locally verified
// id_token subject (./google-oidc.ts), not this module - see google.ts's
// header. State/nonce minting lives server-side in /api/auth/google/start.
export {
  exchangeCodeForTokens as exchangeGoogleCodeForTokens,
  getGoogleUserInfo,
  refreshAccessToken,
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
