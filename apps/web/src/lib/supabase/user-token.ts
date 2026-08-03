/**
 * Supabase access-token minter (RLS-01).
 *
 * Issues a SHORT-LIVED token, signed with the Supabase project's JWT secret,
 * from a session this server has ALREADY verified. PostgREST verifies it and
 * exposes `sub` as `request.jwt.claims->>'sub'`, which is exactly what
 * `public.user_id()` reads — so per-user RLS policies finally match rows.
 *
 * Three deliberate properties:
 *
 *   1. The `sync-session` cookie is NEVER sent to PostgREST. It is signed with a
 *      different secret, lives for 7 days, and carries claims the database has
 *      no business seeing. It is a session credential, not a database credential.
 *   2. Minutes, not days. The token is minted per request and thrown away; a
 *      leaked one is useless almost immediately.
 *   3. Nothing but `sub`/`role`/`aud`/`iat`/`exp` is claimed. Extra claims are
 *      extra attack surface and extra things a policy might accidentally trust.
 */

import { SignJWT } from 'jose';

/** Five minutes. Long enough for one request, short enough to be worthless if it leaks. */
export const SUPABASE_TOKEN_TTL_SECONDS = 300;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * The Supabase project's JWT secret. Distinct from the session secret by
 * design — see the module header. Throws rather than silently minting a token
 * no database will accept.
 */
export function getSupabaseJwtSecret(): Uint8Array {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error('Missing SUPABASE_JWT_SECRET environment variable');
  }
  return new TextEncoder().encode(secret);
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
 * @param userId `users.id` — a UUID, which is also the shape `public.user_id()` casts to.
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

  return new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setAudience('authenticated')
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ttl)
    .sign(getSupabaseJwtSecret());
}
