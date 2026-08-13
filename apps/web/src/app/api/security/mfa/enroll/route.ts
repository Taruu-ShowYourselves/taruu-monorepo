/**
 * TOTP enrollment start (canonical §6.1, engineering model §5.3).
 *
 * POST -> { otpauthUri, secret, expiresInMinutes }
 *
 * Behind MFA_ENROLLMENT_ENABLED (default OFF => 404). requireAuth only - the
 * FIRST enrollment deliberately needs no reauthentication; there is no
 * weaker factor state to protect yet. Re-enrollment while a factor is active
 * is refused: disable first (which revokes sessions), then enroll.
 *
 * The base32 secret and otpauth URI appear ONCE, in this response. The
 * server keeps only the AES-GCM blob; a stale pending enrollment (>15 min)
 * or an in-window one is replaced - one in-flight enrollment per user,
 * enforced by the partial unique index.
 */

import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import { isMfaEnrollmentEnabled } from '@/lib/features/mfa-enrollment';
import { generateTotpSecret, base32Encode, buildOtpauthUri } from '@/services/auth/totp';
import { encryptTotpSecret, bytesToPgHex, MFA_SECRET_ENC_KEY_VERSION } from '@/services/auth/mfa-secret';
import {
  getActiveFactor,
  deletePendingFactor,
  insertPendingFactor,
  PENDING_FACTOR_MAX_AGE_MINUTES,
} from '@/lib/supabase/mfa';
import {
  recordSecurityEvent,
  countSecurityEventsSince,
} from '@/server/infra/supabase/security-events.repo';
import {
  windowStartIso,
  overLimit,
  rateLimitedResponse,
  HOUR_MS,
} from '@/services/auth/durable-limits';

const MAX_STARTS_PER_HOUR = 5;

export async function POST(request: Request) {
  if (!isMfaEnrollmentEnabled()) {
    return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const active = await getActiveFactor(session.userId);
    if (active) {
      return NextResponse.json(
        { error: 'Two-factor authentication is already enabled', code: 'ALREADY_ENROLLED' },
        { status: 409 }
      );
    }

    // Durable ceiling: 5 enrollment starts per account per hour (§9).
    const starts = await countSecurityEventsSince(
      session.userId,
      'mfa_enrollment_started',
      windowStartIso(HOUR_MS)
    );
    if (overLimit(starts, MAX_STARTS_PER_HOUR)) {
      return rateLimitedResponse(60 * 60);
    }

    // One in-flight enrollment per user (the partial unique index enforces
    // it): any prior pending row - stale or in-window - is replaced.
    await deletePendingFactor(session.userId);

    const factorId = crypto.randomUUID();
    const secret = generateTotpSecret();
    const blob = await encryptTotpSecret(secret, session.userId, factorId);

    const row = await insertPendingFactor({
      id: factorId,
      user_id: session.userId,
      secret_enc: bytesToPgHex(blob),
      enc_key_version: MFA_SECRET_ENC_KEY_VERSION,
    });
    if (!row) {
      return NextResponse.json(
        { error: 'Enrollment failed', code: 'ENROLLMENT_FAILED' },
        { status: 500 }
      );
    }

    await recordSecurityEvent({
      userId: session.userId,
      eventType: 'mfa_enrollment_started',
      request,
    });

    const base32Secret = base32Encode(secret);
    return NextResponse.json({
      otpauthUri: buildOtpauthUri(session.email, base32Secret),
      secret: base32Secret,
      expiresInMinutes: PENDING_FACTOR_MAX_AGE_MINUTES,
    });
  } catch (error) {
    console.error('MFA enrollment start error:', error);
    return NextResponse.json(
      { error: 'Enrollment failed', code: 'ENROLLMENT_FAILED' },
      { status: 500 }
    );
  }
}
