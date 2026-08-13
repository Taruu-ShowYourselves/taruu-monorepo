/**
 * Supabase access-token minter (RLS-01).
 *
 * Issues a SHORT-LIVED token, signed with Taruu's own EC P-256 key, from a
 * session this server has ALREADY verified. Supabase fetches our published JWKS
 * (see ./signing-key.ts), verifies the signature, and exposes `sub` as
 * `request.jwt.claims->>'sub'` - which is exactly what `public.user_id()` reads,
 * so per-user RLS policies finally match rows.
 *
 * ES256, not HS256: this Supabase project signs asymmetrically and its legacy
 * shared secret is retired. See ./signing-key.ts for the full reasoning.
 *
 * Three deliberate properties:
 *
 *   1. The `sync-session` cookie is NEVER sent to PostgREST. It is signed with a
 *      different key, lives for 1 hour, and carries claims the database has no
 *      business seeing. It is a session credential, not a database credential.
 *   2. Minutes, not days. The token is minted per request and thrown away; a
 *      leaked one is useless almost immediately.
 *   3. Nothing but iss/sub/role/aud/iat/exp is claimed. Extra claims are extra
 *      attack surface and extra things a policy might accidentally trust.
 */

import { SignJWT } from 'jose';
import { getSigningKey, SIGNING_ALG } from './signing-key';

/** Five minutes. Long enough for one request, short enough to be worthless if it leaks. */
export const SUPABASE_TOKEN_TTL_SECONDS = 300;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * The `iss` we claim, and the origin whose /.well-known/jwks.json Supabase is
 * registered against. These must agree: a token whose issuer does not match the
 * registered integration is rejected.
 */
export function getTokenIssuer(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error('Missing NEXT_PUBLIC_APP_URL environment variable');
  }
  return appUrl.replace(/\/+$/, '');
}

export interface MintOptions {
  /** Override the default TTL. Tests use this; production should not. */
  ttlSeconds?: number;
  /** Injectable clock for deterministic tests. */
  now?: () => Date;
}

/**
 * Mint a Supabase access token for an already-authenticated user.
 *
 * @param userId `users.id` - a UUID, which is also the shape `public.user_id()` casts to.
 */
export async function mintSupabaseAccessToken(
  userId: string,
  options: MintOptions = {}
): Promise<string> {
  if (!UUID_RE.test(userId)) {
    throw new Error(`mintSupabaseAccessToken: userId must be a uuid, got "${userId}"`);
  }

  const ttl = options.ttlSeconds ?? SUPABASE_TOKEN_TTL_SECONDS;
  const issuedAt = Math.floor((options.now?.() ?? new Date()).getTime() / 1000);
  const { key, kid } = await getSigningKey();

  return new SignJWT({ role: 'authenticated' })
    // `kid` is REQUIRED: Supabase uses it to select the verification key from
    // our JWKS. A token without it is rejected outright.
    .setProtectedHeader({ alg: SIGNING_ALG, kid, typ: 'JWT' })
    .setIssuer(getTokenIssuer())
    .setSubject(userId)
    .setAudience('authenticated')
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ttl)
    .sign(key);
}
