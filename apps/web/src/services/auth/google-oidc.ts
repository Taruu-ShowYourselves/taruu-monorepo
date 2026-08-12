/**
 * Local Google id_token verification (canonical §4.3 steps 2-4, requirement
 * #71-M1-07).
 *
 * The verified `sub` becomes the identity authority for the callback -
 * `/v1/userinfo` (`getGoogleUserInfo`) is enrichment only from here on and
 * can never override the subject or the email.
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';
import { secureEqual } from '@/lib/secureCompare';

const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
/** Google issues id_tokens with either form of its own issuer string. */
const ACCEPTED_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

// Module level so `jose` caches the fetched keys across requests instead of
// refetching Google's JWKS on every login.
const googleJWKS = createRemoteJWKSet(new URL(GOOGLE_JWKS_URI));

export interface VerifiedGoogleIdentity {
  subject: string;
  email: string;
  emailVerified: true;
  givenName?: string;
  familyName?: string;
  picture?: string;
}

export type GoogleIdTokenVerificationCategory =
  | 'signature'
  | 'issuer'
  | 'audience'
  | 'expired'
  | 'email_not_verified'
  | 'nonce_missing'
  | 'nonce_mismatch'
  | 'malformed'
  | 'config';

export class GoogleIdTokenVerificationError extends Error {
  constructor(
    public readonly category: GoogleIdTokenVerificationCategory,
    message: string
  ) {
    super(message);
    this.name = 'GoogleIdTokenVerificationError';
  }
}

/**
 * Verifies `idToken` via Google's JWKS: signature, issuer (either accepted
 * form), audience (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`), and expiry come from
 * `jwtVerify` itself. Three checks the library does not perform are applied
 * after: `email_verified` must be strictly `true`; a `nonce` claim must
 * exist; and its SHA-256 hex digest must equal `nonceHash`, compared
 * constant-time. Throws a typed `GoogleIdTokenVerificationError` naming the
 * failed check category on any failure - never logs the id_token, the nonce,
 * or any claim value.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  { nonceHash }: { nonceHash: string }
): Promise<VerifiedGoogleIdentity> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new GoogleIdTokenVerificationError('config', 'Google client id is not configured');
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, googleJWKS, {
      issuer: ACCEPTED_ISSUERS,
      audience: clientId,
    }));
  } catch (err) {
    const code = (err as { code?: string } | undefined)?.code;
    const claim = (err as { claim?: string } | undefined)?.claim;

    if (code === 'ERR_JWT_EXPIRED') {
      throw new GoogleIdTokenVerificationError('expired', 'Google id_token has expired');
    }
    if (claim === 'iss') {
      throw new GoogleIdTokenVerificationError('issuer', 'Google id_token has an unrecognized issuer');
    }
    if (claim === 'aud') {
      throw new GoogleIdTokenVerificationError(
        'audience',
        'Google id_token was not issued for this application'
      );
    }
    throw new GoogleIdTokenVerificationError(
      'signature',
      'Google id_token failed signature verification'
    );
  }

  if (payload.email_verified !== true) {
    throw new GoogleIdTokenVerificationError(
      'email_not_verified',
      'Google account email is not verified'
    );
  }

  const nonce = payload.nonce;
  if (typeof nonce !== 'string' || nonce.length === 0) {
    throw new GoogleIdTokenVerificationError(
      'nonce_missing',
      'Google id_token is missing a nonce claim'
    );
  }

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce));
  const nonceDigestHex = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');

  if (!secureEqual(nonceDigestHex, nonceHash)) {
    throw new GoogleIdTokenVerificationError(
      'nonce_mismatch',
      'Google id_token nonce does not match the signed OAuth state'
    );
  }

  const subject = payload.sub;
  const email = payload.email;
  if (typeof subject !== 'string' || typeof email !== 'string') {
    throw new GoogleIdTokenVerificationError(
      'malformed',
      'Google id_token is missing sub or email'
    );
  }

  return {
    subject,
    email,
    emailVerified: true,
    givenName: typeof payload.given_name === 'string' ? payload.given_name : undefined,
    familyName: typeof payload.family_name === 'string' ? payload.family_name : undefined,
    picture: typeof payload.picture === 'string' ? payload.picture : undefined,
  };
}
