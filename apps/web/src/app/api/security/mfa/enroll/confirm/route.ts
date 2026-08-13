/**
 * TOTP enrollment confirm (canonical §6.1, engineering model §5.3).
 *
 * POST { code } -> { recoveryCodes }
 *
 * The submitted code is checked against the PENDING factor's secret within
 * the ±1-step window; success activates the factor and generates the first
 * recovery-code batch in ONE database transaction (`mfa_activate_factor`) -
 * status flips pending->active, confirmed_at is set exactly once, the
 * accepted step becomes the replay high-water mark, and the codes land. The
 * security_score trigger fires on the status change (and computes 0 until
 * global enforcement is live - posture is claimed only when enforced).
 *
 * Failures increment a durable per-factor counter; the 5th deletes the
 * pending row (event mfa_enrollment_failed) and the user restarts.
 * Recovery codes appear ONCE, in this response.
 */

import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import { isMfaEnrollmentEnabled } from '@/lib/features/mfa-enrollment';
import { findMatchingStep } from '@/services/auth/totp';
import { decryptTotpSecret, pgHexToBytes } from '@/services/auth/mfa-secret';
import { generateRecoveryCodes, hashRecoveryCode, RECOVERY_CODE_COUNT } from '@/services/auth/recovery-codes';
import {
  getPendingFactor,
  deletePendingFactor,
  incrementConfirmAttempts,
  activateFactor,
  PENDING_FACTOR_MAX_AGE_MINUTES,
} from '@/lib/supabase/mfa';
import { recordSecurityEvent } from '@/server/infra/supabase/security-events.repo';
import { sendMfaEnabledEmail } from '@/services/email/security';
import { getUserById } from '@/lib/supabase/db';

const MAX_CONFIRM_ATTEMPTS = 5;

export async function POST(request: Request) {
  if (!isMfaEnrollmentEnabled()) {
    return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const code = typeof body?.code === 'string' ? body.code : '';
    if (!code) {
      return NextResponse.json({ error: 'Code required', code: 'MISSING_CODE' }, { status: 400 });
    }

    const pending = await getPendingFactor(session.userId);
    const stale =
      pending &&
      Date.now() - new Date(pending.created_at).getTime() >
        PENDING_FACTOR_MAX_AGE_MINUTES * 60 * 1000;
    if (!pending || stale) {
      if (stale) await deletePendingFactor(session.userId);
      return NextResponse.json(
        { error: 'No enrollment in progress', code: 'NO_PENDING_ENROLLMENT' },
        { status: 404 }
      );
    }

    const blob = pgHexToBytes(pending.secret_enc);
    const secret = blob ? await decryptTotpSecret(blob, session.userId, pending.id) : null;
    if (!secret) {
      // An undecryptable pending secret is unrecoverable - restart.
      await deletePendingFactor(session.userId);
      return NextResponse.json(
        { error: 'Enrollment must be restarted', code: 'ENROLLMENT_RESTART_REQUIRED' },
        { status: 409 }
      );
    }

    const step = await findMatchingStep(secret, code);
    if (step === null) {
      const attempts = await incrementConfirmAttempts(pending.id, session.userId);
      if (attempts === null || attempts >= MAX_CONFIRM_ATTEMPTS) {
        await deletePendingFactor(session.userId);
        await recordSecurityEvent({
          userId: session.userId,
          eventType: 'mfa_enrollment_failed',
          request,
          metadata: { attempts: attempts ?? MAX_CONFIRM_ATTEMPTS },
        });
        return NextResponse.json(
          { error: 'Enrollment must be restarted', code: 'ENROLLMENT_RESTART_REQUIRED' },
          { status: 409 }
        );
      }
      // Generic - never distinguish wrong-code from replayed-step.
      return NextResponse.json({ error: 'Verification failed', code: 'INVALID_CODE' }, { status: 401 });
    }

    const recoveryCodes = generateRecoveryCodes();
    const codeHashes = await Promise.all(recoveryCodes.map(hashRecoveryCode));
    const batchId = crypto.randomUUID();

    const activated = await activateFactor(pending.id, session.userId, step, batchId, codeHashes);
    if (!activated) {
      // Lost a race (row consumed/activated concurrently) - restart cleanly.
      return NextResponse.json(
        { error: 'Enrollment must be restarted', code: 'ENROLLMENT_RESTART_REQUIRED' },
        { status: 409 }
      );
    }

    await recordSecurityEvent({
      userId: session.userId,
      eventType: 'mfa_enrollment_confirmed',
      request,
    });
    await recordSecurityEvent({
      userId: session.userId,
      eventType: 'recovery_codes_regenerated',
      request,
      metadata: { batch_id: batchId, previous_unused_count: 0, count: RECOVERY_CODE_COUNT },
    });

    // Notification failure never fails the enrollment.
    const user = await getUserById(session.userId);
    if (user) void sendMfaEnabledEmail({ to: user.email, firstName: user.first_name });

    return NextResponse.json({ success: true, recoveryCodes });
  } catch (error) {
    console.error('MFA enrollment confirm error:', error);
    return NextResponse.json(
      { error: 'Enrollment failed', code: 'ENROLLMENT_FAILED' },
      { status: 500 }
    );
  }
}
