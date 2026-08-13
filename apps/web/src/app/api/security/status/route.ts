/**
 * Security status read for the settings/security surface (engineering model
 * §9.1/§10.1).
 *
 * GET -> { enrolled, pendingEnrollment, recoveryCodesRemaining,
 *          enforcementEnabled, enrollmentAvailable, securityScore, amr,
 *          events[] }
 *
 * Read-only; requireAuth only. Not behind the enrollment flag - a user with
 * an active factor must still see their security state after the enrollment
 * surface is switched off (the flag governs `enrollmentAvailable`, which the
 * UI uses to show or hide the enroll entry).
 */

import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import { isMfaEnrollmentEnabled } from '@/lib/features/mfa-enrollment';
import {
  getActiveFactor,
  getPendingFactor,
  countUnusedRecoveryCodes,
  getSecuritySettings,
} from '@/lib/supabase/mfa';
import { listOwnSecurityEvents } from '@/server/infra/supabase/security-events.repo';
import { getUserById } from '@/lib/supabase/db';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const [factor, pending, remaining, settings, user, events] = await Promise.all([
      getActiveFactor(session.userId),
      getPendingFactor(session.userId),
      countUnusedRecoveryCodes(session.userId),
      getSecuritySettings(),
      getUserById(session.userId),
      listOwnSecurityEvents(session.userId, 20),
    ]);

    return NextResponse.json({
      enrolled: factor !== null,
      enrolledAt: factor?.confirmed_at ?? null,
      pendingEnrollment: pending !== null,
      recoveryCodesRemaining: remaining ?? 0,
      enforcementEnabled: settings?.mfa_enforcement_enabled ?? false,
      enrollmentAvailable: isMfaEnrollmentEnabled(),
      securityScore: user?.security_score ?? 0,
      amr: session.amr,
      events: (events ?? []).map((e) => ({
        eventType: e.event_type,
        createdAt: e.created_at,
        metadata: e.metadata,
      })),
    });
  } catch (error) {
    console.error('Security status error:', error);
    return NextResponse.json({ error: 'Status failed', code: 'STATUS_FAILED' }, { status: 500 });
  }
}
