/**
 * MFA login-challenge plumbing (canonical §6.4, engineering model §5.5).
 *
 * The pending state between "Google identity verified" and "session minted":
 * a `mfa_pending_tokens` row (THE authority - single-use, 5 minutes, 5
 * attempts) plus a `mfa_pending.v1` JWT that is nothing but a signed locator
 * for that row. While a challenge is unsatisfied, NO application session or
 * refresh token exists anywhere.
 */

import { cookies } from 'next/headers';
import { signPurposeToken, verifyPurposeToken } from './tokens';
import {
  insertPendingToken,
  deleteExpiredPendingTokens,
  countPendingTokensSince,
  PENDING_TOKEN_TTL_SECONDS,
} from '@/lib/supabase/mfa';
import { hashClientIp } from '@/server/infra/supabase/security-events.repo';
import { windowStartIso, overLimit, HOUR_MS } from './durable-limits';

export const MFA_PENDING_COOKIE = 'sync-mfa-pending';
/** Durable mint ceiling (§9): pending challenges per account per hour. */
const MAX_PENDING_MINTS_PER_HOUR = 10;

const USER_AGENT_MAX_CHARS = 256;

export interface PendingChallenge {
  token: string;
  expiresInSeconds: number;
}

/**
 * Mints the pending state: DB row first (the authority), then the locator
 * JWT. Returns null when the durable mint ceiling refuses or the insert
 * fails - the caller answers 429/500, and no challenge exists.
 */
export async function mintPendingChallenge(
  userId: string,
  request: Request
): Promise<PendingChallenge | 'rate_limited' | null> {
  // Opportunistic cleanup - rows a day past expiry have no forensic value.
  await deleteExpiredPendingTokens();

  const minted = await countPendingTokensSince(userId, windowStartIso(HOUR_MS));
  if (overLimit(minted, MAX_PENDING_MINTS_PER_HOUR)) {
    return 'rate_limited';
  }

  const id = crypto.randomUUID();
  const row = await insertPendingToken({
    id,
    user_id: userId,
    ip_hash: await hashClientIp(request),
    user_agent: request.headers.get('user-agent')?.slice(0, USER_AGENT_MAX_CHARS) ?? null,
  });
  if (!row) return null;

  const token = await signPurposeToken(
    'mfa_pending',
    { userId, jti_row: id },
    PENDING_TOKEN_TTL_SECONDS
  );
  return { token, expiresInSeconds: PENDING_TOKEN_TTL_SECONDS };
}

export async function setPendingChallengeCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(MFA_PENDING_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: PENDING_TOKEN_TTL_SECONDS,
  });
}

export async function clearPendingChallengeCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(MFA_PENDING_COOKIE);
}

export interface PendingChallengeClaims {
  userId: string;
  rowId: string;
}

/**
 * Verifies the locator only - purpose key, expiry, claim shape. The row is
 * the authority; the caller classifies and consumes it separately.
 */
export async function verifyPendingChallengeToken(
  token: string
): Promise<PendingChallengeClaims | null> {
  const claims = await verifyPurposeToken('mfa_pending', token);
  if (!claims) return null;
  if (typeof claims.userId !== 'string' || typeof claims.jti_row !== 'string') return null;
  return { userId: claims.userId, rowId: claims.jti_row };
}
