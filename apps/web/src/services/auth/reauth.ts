/**
 * Reauthentication tickets (canonical §7, specs/mfa-engineering-model.md
 * §5.6) - reusable step-up for sensitive actions.
 *
 * A ticket is a DB row (the authority: single-use, purpose-bound, 5-minute
 * expiry, consumed by the atomic `reauth_consume_ticket` RPC) plus a
 * `reauth.v1` JWT locator returned in the challenge response and replayed by
 * the client as the `X-Reauth-Ticket` header on the guarded call.
 *
 * Sessions never carry "recently reauthed" state - reauthentication is not
 * an `asr` level (canonical §4.5).
 *
 * The §7.2 policy matrix is derived SERVER-SIDE here; the client never
 * chooses a weaker method than the account permits. The governing rule: for
 * an account with an active TOTP factor, `google` never satisfies
 * reauthentication - a fresh Google round-trip is exactly what an attacker
 * holding a hijacked Google account can do.
 */

import { signPurposeToken, verifyPurposeToken } from './tokens';
import { getSessionFromRequest, type Session } from './session';
import { getActiveFactor, insertReauthTicket, consumeReauthTicket, REAUTH_TICKET_TTL_SECONDS } from '@/lib/supabase/mfa';
import type { ReauthPurpose, ReauthMethod } from '@/lib/supabase/types';

export const REAUTH_TICKET_HEADER = 'X-Reauth-Ticket';

/**
 * The §7.2 matrix, derived from the account's factor state.
 *
 * - Active factor: TOTP or recovery for user-facing purposes; `operator_reset`
 *   is TOTP-only (recovery codes never qualify for privileged operator
 *   actions). Never `google`.
 * - No active factor: only the future `security_settings` purpose would use a
 *   fresh Google round-trip; every Issue #71 purpose requires a factor, so
 *   the list is empty and the challenge endpoint refuses.
 */
export async function derivePermittedReauthMethods(
  userId: string,
  purpose: ReauthPurpose
): Promise<ReauthMethod[]> {
  const factor = await getActiveFactor(userId);
  if (!factor) {
    // mfa_disable / recovery_regenerate: nothing to act on without a factor.
    // operator_reset: operators must be enrolled before the flag turns on.
    // security_settings (future): would be ['google'] - not reachable in #71.
    return [];
  }
  if (purpose === 'operator_reset') return ['totp'];
  return ['totp', 'recovery'];
}

/**
 * Mints a ticket after the caller has verified the chosen method: inserts the
 * authoritative row, then signs the locator. The JWT carries only
 * {userId, purpose} plus the row id as `jti`.
 */
export async function mintReauthTicket(
  userId: string,
  purpose: ReauthPurpose,
  method: ReauthMethod
): Promise<{ ticket: string; expiresAt: Date } | null> {
  const id = crypto.randomUUID();
  const row = await insertReauthTicket({ id, user_id: userId, purpose, method });
  if (!row) return null;

  const ticket = await signPurposeToken(
    'reauth',
    { userId, purpose, jti_row: id },
    REAUTH_TICKET_TTL_SECONDS
  );
  return { ticket, expiresAt: new Date(row.expires_at) };
}

/**
 * The guard helper for reauth-protected routes (lives beside requireAuth).
 * Verifies the caller's session (sv-checked via the central path), verifies
 * the ticket JWT, binds it to (session user, purpose), and consumes the DB
 * row atomically - the row is the authority, so a valid JWT with a spent or
 * expired row is refused. Returns the session on success, null otherwise;
 * the route answers 403 REAUTH_REQUIRED on null.
 */
export async function requireReauth(
  request: Request,
  purpose: ReauthPurpose
): Promise<Session | null> {
  const session = await getSessionFromRequest(request);
  if (!session) return null;

  const ticket = request.headers.get(REAUTH_TICKET_HEADER);
  if (!ticket) return null;

  const claims = await verifyPurposeToken('reauth', ticket);
  if (!claims) return null;
  if (claims.userId !== session.userId) return null;
  if (claims.purpose !== purpose) return null;
  if (typeof claims.jti_row !== 'string') return null;

  // Bind the method at consume too (§7.2 defence in depth): operator_reset
  // accepts only a TOTP-minted ticket; the user-facing purposes accept
  // whatever the mint-time matrix already permitted.
  const allowedMethods = purpose === 'operator_reset' ? (['totp'] as const) : undefined;
  const consumed = await consumeReauthTicket(
    claims.jti_row,
    session.userId,
    purpose,
    allowedMethods ? [...allowedMethods] : undefined
  );
  if (!consumed) return null;

  return session;
}
