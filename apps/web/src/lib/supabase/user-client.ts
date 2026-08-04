/**
 * User-scoped Supabase client (RLS-02).
 *
 * Built on the ANON key plus a short-lived, server-minted access token, fed
 * through supabase-js's `accessToken` callback (`@supabase/supabase-js@2.90.1`,
 * the canonical third-party-JWT pattern). PostgREST verifies the token, exposes
 * `sub` as `request.jwt.claims->>'sub'`, and `public.user_id()` finally returns
 * a real id, so per-user RLS policies enforce instead of silently matching
 * nothing.
 *
 * Contrast with `supabaseAdmin` (./server.ts), which uses the SERVICE-ROLE key
 * and therefore bypasses RLS entirely. That client is explicitly privileged and
 * stays the transport for the rest of the app; migrating the existing tables and
 * `db.ts` exports onto this one is Phase 7 (MIG-01..04).
 *
 * NOTE: when `accessToken` is supplied, supabase-js disables its own auth
 * methods. `client.auth.*` throws. That is correct here: this project sets
 * `[auth] enabled = false` in supabase/config.toml and has no Supabase Auth
 * session to manage.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { mintSupabaseAccessToken, SUPABASE_TOKEN_TTL_SECONDS } from './user-token';

/** Re-mint this many seconds before expiry so no request races the boundary. */
const REFRESH_SKEW_SECONDS = 30;

/**
 * A Supabase client that acts AS `userId` and is subject to RLS.
 *
 * Create one per request. Do not hoist it to module scope because it closes over a
 * single user's identity, and a shared instance would hand one user's token to
 * another user's request.
 */
export function createUserScopedClient(userId: string): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }
  if (!supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
  }

  // supabase-js calls accessToken() on every request; signing per query is
  // pointless work. Memoize for the token's lifetime minus a skew.
  let cached: { token: string; expiresAtMs: number } | null = null;

  const accessToken = async (): Promise<string> => {
    const nowMs = Date.now();
    if (cached && cached.expiresAtMs > nowMs) return cached.token;
    const token = await mintSupabaseAccessToken(userId);
    cached = {
      token,
      expiresAtMs: nowMs + (SUPABASE_TOKEN_TTL_SECONDS - REFRESH_SKEW_SECONDS) * 1000,
    };
    return token;
  };

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    accessToken,
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
