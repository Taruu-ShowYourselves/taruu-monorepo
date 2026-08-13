/**
 * Security-admin authorization (canonical §7.3).
 *
 * Reuses the platform-admin predicate exactly - a live `super_admin` role
 * grant OR `users.is_platform_admin` (requirePilotAdmin) - no new operator
 * table, no env allowlist. Layered on top: once global enforcement is live,
 * an operator with an active factor can only be holding an `mf` session
 * anyway (required_asr), and this helper asserts it explicitly - defense in
 * depth. The assertion is conditional on enforcement because of M8
 * ordering: operator reset goes live one step before global enforcement,
 * during which enrolled operators still hold `sf` sessions; the
 * always-required TOTP-only reauth ticket covers that window.
 */

import { getSessionFromRequest, type Session } from './session';
import { requirePilotAdmin } from '@/server/app/pilot/authorize';
import { getActiveFactor, getSecuritySettings } from '@/lib/supabase/mfa';

export type SecurityAdminFailure = 'unauthorized' | 'forbidden' | 'mfa_session_required' | 'error';

export async function requireSecurityAdmin(
  request: Request
): Promise<{ session: Session } | { failure: SecurityAdminFailure }> {
  const session = await getSessionFromRequest(request);
  if (!session) return { failure: 'unauthorized' };

  const roleResult = await requirePilotAdmin(session);
  if (roleResult.isErr()) {
    const kind = roleResult.error.kind;
    if (kind === 'UNAUTHORIZED') return { failure: 'unauthorized' };
    if (kind === 'FORBIDDEN') return { failure: 'forbidden' };
    return { failure: 'error' };
  }

  const [factor, settings] = await Promise.all([
    getActiveFactor(session.userId),
    getSecuritySettings(),
  ]);
  if (settings === null) return { failure: 'error' };
  if (factor && settings.mfa_enforcement_enabled && session.asr !== 'mf') {
    return { failure: 'mfa_session_required' };
  }

  return { session };
}
