/**
 * Recovery-code regeneration (canonical §6.2, engineering model §5.4).
 *
 * POST + X-Reauth-Ticket (purpose 'recovery_regenerate', method
 * totp|recovery - never google) -> { recoveryCodes }
 *
 * One database transaction (`mfa_regenerate_recovery_codes`): the prior
 * batch is deleted entirely (its history lives in security_events) and the
 * new batch inserted. Codes appear ONCE, in this response. Behind
 * MFA_ENROLLMENT_ENABLED per canonical §12.
 */

import { NextResponse } from 'next/server';
import { isMfaEnrollmentEnabled } from '@/lib/features/mfa-enrollment';
import { requireReauth } from '@/services/auth/reauth';
import { generateRecoveryCodes, hashRecoveryCode, RECOVERY_CODE_COUNT } from '@/services/auth/recovery-codes';
import { getActiveFactor, regenerateRecoveryCodes } from '@/lib/supabase/mfa';
import { recordSecurityEvent } from '@/server/infra/supabase/security-events.repo';

export async function POST(request: Request) {
  if (!isMfaEnrollmentEnabled()) {
    return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  try {
    const session = await requireReauth(request, 'recovery_regenerate');
    if (!session) {
      return NextResponse.json(
        { error: 'Reauthentication required', code: 'REAUTH_REQUIRED' },
        { status: 403 }
      );
    }

    const factor = await getActiveFactor(session.userId);
    if (!factor) {
      return NextResponse.json(
        { error: 'No active factor', code: 'NO_ACTIVE_FACTOR' },
        { status: 404 }
      );
    }

    const recoveryCodes = generateRecoveryCodes();
    const codeHashes = await Promise.all(recoveryCodes.map(hashRecoveryCode));
    const batchId = crypto.randomUUID();

    const previousUnused = await regenerateRecoveryCodes(session.userId, batchId, codeHashes);
    if (previousUnused === null) {
      return NextResponse.json(
        { error: 'Regeneration failed', code: 'REGENERATION_FAILED' },
        { status: 500 }
      );
    }

    await recordSecurityEvent({
      userId: session.userId,
      eventType: 'recovery_codes_regenerated',
      request,
      metadata: {
        batch_id: batchId,
        previous_unused_count: previousUnused,
        count: RECOVERY_CODE_COUNT,
      },
    });

    return NextResponse.json({ success: true, recoveryCodes });
  } catch (error) {
    console.error('Recovery regeneration error:', error);
    return NextResponse.json(
      { error: 'Regeneration failed', code: 'REGENERATION_FAILED' },
      { status: 500 }
    );
  }
}
