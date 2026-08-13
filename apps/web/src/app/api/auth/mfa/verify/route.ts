/**
 * MFA login challenge verification (canonical §6.4, engineering model §5.5).
 *
 * POST { code, pendingToken? } (+ sync-mfa-pending cookie)
 *   -> { success, user, accessToken, sessionToken, refreshToken }
 *
 * The pending JWT is only a locator: a cryptographically valid token whose
 * row is missing, expired, consumed, or attempt-exhausted is refused (the
 * row is the authority, §6.4a). Code verification completes FIRST - the
 * TOTP monotonic step guard or the recovery-code conditional spend - and
 * only then is the row consumed; the consume UPDATE is the commit point, so
 * two concurrent correct submissions mint exactly one session.
 *
 * Failure ceilings are durable (§9): 5 attempts per pending row, 20 TOTP
 * failures per account-hour, 5 recovery failures per account-hour.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  createSessionToken,
  createRefreshToken,
  setSessionCookies,
  SESSION_TTL_SECONDS,
} from '@/services/auth/session';
import { AMR_GOOGLE, AMR_TOTP, AMR_RECOVERY } from '@/services/auth/assurance';
import {
  MFA_PENDING_COOKIE,
  verifyPendingChallengeToken,
  clearPendingChallengeCookie,
} from '@/services/auth/mfa-challenge';
import {
  verifySecondFactor,
  looksLikeRecoveryCode,
} from '@/services/auth/second-factor';
import {
  getPendingToken,
  consumePendingToken,
  recordPendingAttempt,
  countUnusedRecoveryCodes,
} from '@/lib/supabase/mfa';
import { getUserById, getSocialProofsByUserId } from '@/lib/supabase/db';
import { buildUserProfile } from '@/services/user/profile';
import {
  recordSecurityEvent,
  countSecurityEventsSince,
} from '@/server/infra/supabase/security-events.repo';
import {
  windowStartIso,
  overLimit,
  rateLimitedResponse,
  HOUR_MS,
  DAY_MS,
} from '@/services/auth/durable-limits';
import { sendRecoveryCodeUsedEmail } from '@/services/email/security';

const MAX_ROW_ATTEMPTS = 5;
const MAX_TOTP_FAILURES_PER_HOUR = 20;
const MAX_RECOVERY_FAILURES_PER_HOUR = 5;
const MAX_RECOVERY_FAILURES_PER_DAY = 20;

function unauthorized(code: string, error = 'Verification failed') {
  return NextResponse.json({ error, code }, { status: 401 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const code = typeof body?.code === 'string' ? body.code : '';

    // Locator intake: cookie first (web), body for cookie-less clients.
    const cookieStore = await cookies();
    const pendingJwt =
      cookieStore.get(MFA_PENDING_COOKIE)?.value ??
      (typeof body?.pendingToken === 'string' ? body.pendingToken : null);

    if (!pendingJwt) {
      return unauthorized('NO_PENDING_CHALLENGE', 'No challenge in progress');
    }

    const locator = await verifyPendingChallengeToken(pendingJwt);
    if (!locator) {
      await clearPendingChallengeCookie();
      return unauthorized('INVALID_CHALLENGE', 'No challenge in progress');
    }

    // Classify against the authoritative row for the right code + event.
    const row = await getPendingToken(locator.rowId);
    if (!row || row.user_id !== locator.userId) {
      await clearPendingChallengeCookie();
      return unauthorized('INVALID_CHALLENGE', 'No challenge in progress');
    }
    if (row.consumed_at) {
      await recordSecurityEvent({
        userId: locator.userId,
        eventType: 'mfa_challenge_replayed',
        request,
      });
      await clearPendingChallengeCookie();
      return unauthorized('CHALLENGE_REPLAYED');
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await recordSecurityEvent({
        userId: locator.userId,
        eventType: 'mfa_challenge_expired',
        request,
      });
      await clearPendingChallengeCookie();
      return unauthorized('CHALLENGE_EXPIRED', 'Challenge expired');
    }
    if (row.attempt_count >= MAX_ROW_ATTEMPTS) {
      await clearPendingChallengeCookie();
      return unauthorized('CHALLENGE_EXHAUSTED', 'Challenge expired');
    }

    if (!code) {
      return NextResponse.json({ error: 'Code required', code: 'MISSING_CODE' }, { status: 400 });
    }

    // Durable account-level failure windows (§9), before verification work.
    const isRecoveryShaped = looksLikeRecoveryCode(code);
    const failureEvent = isRecoveryShaped ? 'recovery_code_failed' : 'totp_verification_failure';
    const ceiling = isRecoveryShaped ? MAX_RECOVERY_FAILURES_PER_HOUR : MAX_TOTP_FAILURES_PER_HOUR;
    const failures = await countSecurityEventsSince(
      locator.userId,
      failureEvent,
      windowStartIso(HOUR_MS)
    );
    if (overLimit(failures, ceiling)) {
      return rateLimitedResponse(60 * 60);
    }
    if (isRecoveryShaped) {
      // Recovery codes get a second, daily ceiling (§9: 5/hour AND 20/day) -
      // an 80-bit code space doesn't need it mathematically, but the audit
      // trail should never show a day-long recovery grind.
      const daily = await countSecurityEventsSince(
        locator.userId,
        'recovery_code_failed',
        windowStartIso(DAY_MS)
      );
      if (overLimit(daily, MAX_RECOVERY_FAILURES_PER_DAY)) {
        return rateLimitedResponse(24 * 60 * 60);
      }
    }

    // Code verification BEFORE the consume - §6.4a ordering.
    const result = await verifySecondFactor(locator.userId, code, ['totp', 'recovery']);
    if (!result.ok) {
      // The per-row attempt_count is the primary durable limit here, but the
      // account-hour ceiling rides on the failure event - record it and, if
      // that write fails, refuse rather than under-count (fail closed, same
      // rule as the reauth endpoint).
      const attempts = await recordPendingAttempt(locator.rowId, locator.userId);
      const recorded = await recordSecurityEvent({
        userId: locator.userId,
        eventType: result.method === 'recovery' ? 'recovery_code_failed' : 'totp_verification_failure',
        request,
        metadata: { context: 'login' },
      });
      if (!recorded) {
        return NextResponse.json(
          { error: 'Temporarily unavailable', code: 'RATE_LIMIT_UNAVAILABLE' },
          { status: 503 }
        );
      }
      const remaining =
        attempts === null ? 0 : Math.max(0, MAX_ROW_ATTEMPTS - attempts);
      return NextResponse.json(
        { error: 'Verification failed', code: 'INVALID_CODE', attemptsRemaining: remaining },
        { status: 401 }
      );
    }

    // The commit point: exactly one concurrent winner receives the row.
    const consumed = await consumePendingToken(locator.rowId, locator.userId);
    if (!consumed) {
      await recordSecurityEvent({
        userId: locator.userId,
        eventType: 'mfa_challenge_replayed',
        request,
      });
      await clearPendingChallengeCookie();
      return unauthorized('CHALLENGE_REPLAYED');
    }

    const user = await getUserById(locator.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found', code: 'USER_NOT_FOUND' }, { status: 404 });
    }

    const amr =
      result.method === 'recovery' ? [AMR_GOOGLE, AMR_RECOVERY] : [AMR_GOOGLE, AMR_TOTP];
    const accessToken = await createSessionToken({
      userId: user.id,
      googleId: user.google_id || '',
      did: user.did || '',
      email: user.email,
      sv: user.session_version,
      amr,
      asr: 'mf',
    });
    const refreshToken = await createRefreshToken({
      userId: user.id,
      sv: user.session_version,
      amr,
      asr: 'mf',
    });
    await setSessionCookies(accessToken, refreshToken);
    await clearPendingChallengeCookie();

    if (result.method === 'recovery') {
      const remaining = result.remainingRecoveryCodes ?? (await countUnusedRecoveryCodes(user.id)) ?? 0;
      await recordSecurityEvent({
        userId: user.id,
        eventType: 'recovery_code_used',
        request,
        metadata: { context: 'login', remaining },
      });
      // §6.2a: the degradation is visible - notification never blocks login.
      void sendRecoveryCodeUsedEmail({ to: user.email, firstName: user.first_name, remaining });
    } else {
      await recordSecurityEvent({
        userId: user.id,
        eventType: 'totp_verification_success',
        request,
        metadata: { context: 'login' },
      });
    }

    const proofs = await getSocialProofsByUserId(user.id);
    const userResponse = await buildUserProfile(user, proofs);

    return NextResponse.json({
      success: true,
      user: userResponse,
      accessToken,
      sessionToken: accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString(),
    });
  } catch (error) {
    console.error('MFA challenge verify error:', error);
    return NextResponse.json(
      { error: 'Verification failed', code: 'MFA_VERIFY_FAILED' },
      { status: 500 }
    );
  }
}
