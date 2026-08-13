/**
 * Operator MFA reset (canonical §7.3, engineering model §5.6b).
 *
 * POST { targetUserId, reason } + X-Reauth-Ticket (purpose 'operator_reset',
 * method TOTP ONLY - recovery codes never qualify for privileged operator
 * actions) -> { success }
 *
 * Behind OPERATOR_RESET_ENABLED (default OFF => 404). Authorization =
 * requireSecurityAdmin (super_admin grant or is_platform_admin) AND the
 * always-required TOTP reauth ticket - every reset is individually
 * MFA-proven regardless of global enforcement state.
 *
 * Target semantics, one DB transaction (`mfa_disable_factor` with reason
 * 'operator_reset'): factor disabled with the reason recorded, unused
 * recovery codes deleted, session_version bumped - every target session and
 * refresh token dies at its next request. The score trigger recomputes to 0.
 * The target lands in case-1 login and may re-enroll normally.
 *
 * Evidence: mfa_reset_by_operator (user_id = target, actor_user_id =
 * operator, mandatory 10-2000 char reason - also CHECK-enforced in the DB)
 * plus session_version_revoked, both append-only. The target is emailed,
 * always. Durable ceiling: 10 resets per operator per day.
 */

import { NextResponse } from 'next/server';
import { isOperatorResetEnabled } from '@/lib/features/operator-reset';
import { requireSecurityAdmin } from '@/services/auth/require-security-admin';
import { requireReauth } from '@/services/auth/reauth';
import { disableFactor } from '@/lib/supabase/mfa';
import { getUserById } from '@/lib/supabase/db';
import {
  recordSecurityEvent,
  countActorEventsSince,
} from '@/server/infra/supabase/security-events.repo';
import {
  windowStartIso,
  overLimit,
  rateLimitedResponse,
  DAY_MS,
} from '@/services/auth/durable-limits';
import { sendMfaResetByOperatorEmail } from '@/services/email/security';

const MAX_RESETS_PER_OPERATOR_PER_DAY = 10;
const REASON_MIN = 10;
const REASON_MAX = 2000;

export async function POST(request: Request) {
  if (!isOperatorResetEnabled()) {
    return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  try {
    const authz = await requireSecurityAdmin(request);
    if ('failure' in authz) {
      if (authz.failure === 'unauthorized') {
        return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
      }
      if (authz.failure === 'forbidden' || authz.failure === 'mfa_session_required') {
        return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
      }
      return NextResponse.json({ error: 'Authorization failed', code: 'AUTHZ_FAILED' }, { status: 500 });
    }

    // The operator's own MFA proof - TOTP only, single-use, purpose-bound.
    const reauthed = await requireReauth(request, 'operator_reset');
    if (!reauthed) {
      return NextResponse.json(
        { error: 'Reauthentication required', code: 'REAUTH_REQUIRED' },
        { status: 403 }
      );
    }
    const operator = reauthed;

    const body = await request.json().catch(() => ({}));
    const targetUserId = typeof body?.targetUserId === 'string' ? body.targetUserId : '';
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';

    if (!targetUserId) {
      return NextResponse.json({ error: 'Target required', code: 'MISSING_TARGET' }, { status: 400 });
    }
    if (reason.length < REASON_MIN || reason.length > REASON_MAX) {
      return NextResponse.json(
        { error: `Reason must be ${REASON_MIN}-${REASON_MAX} characters`, code: 'INVALID_REASON' },
        { status: 400 }
      );
    }

    const resets = await countActorEventsSince(
      operator.userId,
      'mfa_reset_by_operator',
      windowStartIso(DAY_MS)
    );
    if (overLimit(resets, MAX_RESETS_PER_OPERATOR_PER_DAY)) {
      return rateLimitedResponse(24 * 60 * 60);
    }

    const target = await getUserById(targetUserId);
    if (!target) {
      return NextResponse.json({ error: 'Target not found', code: 'TARGET_NOT_FOUND' }, { status: 404 });
    }

    const disabled = await disableFactor(targetUserId, 'operator_reset');
    if (!disabled) {
      return NextResponse.json(
        { error: 'Target has no active factor', code: 'NO_ACTIVE_FACTOR' },
        { status: 404 }
      );
    }

    await recordSecurityEvent({
      userId: targetUserId,
      actorUserId: operator.userId,
      eventType: 'mfa_reset_by_operator',
      request,
      reason,
    });
    await recordSecurityEvent({
      userId: targetUserId,
      actorUserId: operator.userId,
      eventType: 'session_version_revoked',
      request,
      metadata: { trigger: 'operator_reset' },
    });

    void sendMfaResetByOperatorEmail({ to: target.email, firstName: target.first_name });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Operator MFA reset error:', error);
    return NextResponse.json({ error: 'Reset failed', code: 'RESET_FAILED' }, { status: 500 });
  }
}
