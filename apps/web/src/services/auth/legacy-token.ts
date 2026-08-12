/**
 * Bounded legacy-token acceptance window (canonical §4.6, requirement #71-M1-09).
 *
 * Own file so the end of the window is a file deletion plus one import
 * removal in session.ts. When AUTH_LEGACY_UNTIL passes, delete this whole
 * module AND the JWT_SECRET env var together - nothing else in the auth
 * kernel reads JWT_SECRET.
 *
 * Session path only. The refresh endpoint never imports this module -
 * legacy tokens can authenticate an ordinary request but can never mint a
 * fresh session/refresh pair.
 */

import { jwtVerify } from 'jose';
import { DEFAULT_LOGIN_AMR, DEFAULT_LOGIN_ASR, type Assurance } from './assurance';

export interface LegacySessionClaims {
  userId: string;
  googleId: string;
  did: string;
  email: string;
  sv: number;
  amr: string[];
  asr: Assurance;
  expiresAt: Date;
}

/**
 * True only while `AUTH_LEGACY_UNTIL` parses as an ISO-8601 instant still in
 * the future. Unset, empty, or unparseable = closed.
 *
 * This is a deliberate fail-closed choice: an operator who forgets the
 * variable signs users out once at deploy, whereas a fail-open default would
 * silently keep the weakest verification path alive forever.
 */
export function isLegacyWindowOpen(now: Date = new Date()): boolean {
  const raw = process.env.AUTH_LEGACY_UNTIL;
  if (!raw) return false;

  const deadline = new Date(raw);
  if (Number.isNaN(deadline.getTime())) return false;

  return deadline.getTime() > now.getTime();
}

/**
 * Verifies a pre-M1 HS256 session token signed with `JWT_SECRET` and maps
 * its old payload shape onto the current one: `sv` fixed at 1, `amr`/`asr`
 * from the M1 login defaults. Returns null immediately when the window is
 * closed - the HS256 verify is never attempted in that case.
 *
 * Throws (does not return null) when `JWT_SECRET` is missing while the
 * window is open - that is an operator misconfiguration, not "not a legacy
 * token", and must surface loudly rather than silently fail auth.
 */
export async function verifyLegacySessionToken(token: string): Promise<LegacySessionClaims | null> {
  if (!isLegacyWindowOpen()) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET is not set while the legacy acceptance window (AUTH_LEGACY_UNTIL) is open. ' +
        'Set JWT_SECRET, or unset AUTH_LEGACY_UNTIL to close the window.'
    );
  }
  const key = new TextEncoder().encode(secret);

  try {
    const { payload } = await jwtVerify(token, key);
    return {
      userId: payload.userId as string,
      googleId: payload.googleId as string,
      did: payload.did as string,
      email: payload.email as string,
      sv: 1,
      amr: [...DEFAULT_LOGIN_AMR],
      asr: DEFAULT_LOGIN_ASR,
      expiresAt: new Date((payload.exp ?? 0) * 1000),
    };
  } catch {
    return null;
  }
}
