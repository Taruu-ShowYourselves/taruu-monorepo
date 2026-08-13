/**
 * Reauthentication challenge (canonical §7.1, engineering model §5.6a).
 *
 * POST { purpose, code } -> { ticket, expiresAt }
 *
 * The permissible methods are derived server-side from the account's factor
 * state and the §7.2 matrix - the client never chooses. The submitted code's
 * shape routes it: 6 digits = TOTP, longer = recovery code. `google` never
 * satisfies reauthentication for an account with an active factor, and no
 * Issue #71 purpose accepts it at all (the future `security_settings`
 * purpose for factor-less accounts is the only §7.2 cell that would).
 *
 * The ticket is single-use, 5 minutes, bound to (user, purpose); the DB row
 * is the authority. Failures are durably limited: 5 reauth failures per 15
 * minutes per account (§9).
 */

import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import { derivePermittedReauthMethods, mintReauthTicket } from '@/services/auth/reauth';
import { verifySecondFactor } from '@/services/auth/second-factor';
import {
  recordSecurityEvent,
  countSecurityEventsSince,
} from '@/server/infra/supabase/security-events.repo';
import {
  windowStartIso,
  overLimit,
  rateLimitedResponse,
  FIFTEEN_MINUTES_MS,
} from '@/services/auth/durable-limits';
import type { ReauthPurpose } from '@/lib/supabase/types';

// The `security_settings` purpose exists in the DB CHECK for a future
// consumer (canonical §7.2); no endpoint consumes it today, so a minted
// ticket would be dead surface. Left out of the accepted set until it has a
// consumer - the DB column keeps the slot reserved.
const PURPOSES: readonly ReauthPurpose[] = ['mfa_disable', 'recovery_regenerate', 'operator_reset'];

const MAX_FAILURES_PER_WINDOW = 5;

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const purpose = body?.purpose as ReauthPurpose | undefined;
    const code = typeof body?.code === 'string' ? body.code : '';

    if (!purpose || !PURPOSES.includes(purpose)) {
      return NextResponse.json(
        { error: 'Invalid purpose', code: 'INVALID_PURPOSE' },
        { status: 400 }
      );
    }

    // Durable failure ceiling before any verification work (§9).
    const failures = await countSecurityEventsSince(
      session.userId,
      'reauth_failure',
      windowStartIso(FIFTEEN_MINUTES_MS)
    );
    if (overLimit(failures, MAX_FAILURES_PER_WINDOW)) {
      return rateLimitedResponse(15 * 60);
    }

    const methods = await derivePermittedReauthMethods(session.userId, purpose);
    if (methods.length === 0) {
      return NextResponse.json(
        { error: 'Reauthentication is not available for this account', code: 'REAUTH_UNAVAILABLE' },
        { status: 403 }
      );
    }

    if (!code) {
      return NextResponse.json({ error: 'Code required', code: 'MISSING_CODE' }, { status: 400 });
    }

    // No Issue #71 purpose accepts the google method (§7.2); only the code
    // factors reach the verifier.
    const factorMethods = methods.filter(
      (m): m is 'totp' | 'recovery' => m === 'totp' || m === 'recovery'
    );
    const result = await verifySecondFactor(session.userId, code, factorMethods);
    if (!result.ok) {
      // The failure-event write is this endpoint's ONLY durable rate limit -
      // there is no per-attempt row counter here. If the write fails the
      // counter never advances and the ceiling silently becomes infinite, so
      // a failed failure-write must refuse rather than pass: fail closed
      // against unbounded TOTP guessing.
      const recorded = await recordSecurityEvent({
        userId: session.userId,
        eventType: 'reauth_failure',
        request,
        metadata: { purpose, method: result.method },
      });
      if (!recorded) {
        return NextResponse.json(
          { error: 'Temporarily unavailable', code: 'RATE_LIMIT_UNAVAILABLE' },
          { status: 503 }
        );
      }
      // Generic - never say which check failed.
      return NextResponse.json({ error: 'Verification failed', code: 'INVALID_CODE' }, { status: 401 });
    }

    const minted = await mintReauthTicket(session.userId, purpose, result.method);
    if (!minted) {
      return NextResponse.json(
        { error: 'Reauthentication failed', code: 'REAUTH_FAILED' },
        { status: 500 }
      );
    }

    await recordSecurityEvent({
      userId: session.userId,
      eventType: 'reauth_success',
      request,
      metadata: { purpose, method: result.method },
    });

    return NextResponse.json({
      ticket: minted.ticket,
      expiresAt: minted.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Reauth challenge error:', error);
    return NextResponse.json(
      { error: 'Reauthentication failed', code: 'REAUTH_FAILED' },
      { status: 500 }
    );
  }
}
