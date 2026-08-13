/**
 * MFA disable (canonical §6.3, engineering model §5.3).
 *
 * POST + X-Reauth-Ticket (purpose 'mfa_disable', method totp|recovery -
 * never google) -> { accessToken, sessionToken, refreshToken }
 *
 * One database transaction (`mfa_disable_factor`): the factor becomes
 * disabled(reason='user') with its row retained as history, every unused
 * recovery code is deleted, and session_version bumps - all other sessions
 * and refresh tokens die at their next request (Model B). The
 * security_score trigger recomputes to 0. The disabling request itself
 * re-mints the caller a fresh sf ["google"] session with the new sv in this
 * same response, so the user stays signed in here and nowhere else.
 *
 * Deliberately NOT behind MFA_ENROLLMENT_ENABLED: an active factor must
 * remain disableable even after the enrollment surface is turned off.
 */

import { NextResponse } from 'next/server';
import { requireReauth } from '@/services/auth/reauth';
import {
  createSessionToken,
  createRefreshToken,
  setSessionCookies,
} from '@/services/auth/session';
import { DEFAULT_LOGIN_AMR, DEFAULT_LOGIN_ASR } from '@/services/auth/assurance';
import { disableFactor } from '@/lib/supabase/mfa';
import { getUserById } from '@/lib/supabase/db';
import { recordSecurityEvent } from '@/server/infra/supabase/security-events.repo';
import { sendMfaDisabledEmail } from '@/services/email/security';

export async function POST(request: Request) {
  try {
    const session = await requireReauth(request, 'mfa_disable');
    if (!session) {
      return NextResponse.json(
        { error: 'Reauthentication required', code: 'REAUTH_REQUIRED' },
        { status: 403 }
      );
    }

    const disabled = await disableFactor(session.userId, 'user');
    if (!disabled) {
      return NextResponse.json(
        { error: 'No active factor', code: 'NO_ACTIVE_FACTOR' },
        { status: 404 }
      );
    }

    // Read the row AFTER the transaction - the new sv is the stored fact,
    // never a locally computed +1.
    const user = await getUserById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found', code: 'USER_NOT_FOUND' }, { status: 404 });
    }

    const accessToken = await createSessionToken({
      userId: user.id,
      googleId: user.google_id || '',
      did: user.did || '',
      email: user.email,
      sv: user.session_version,
      amr: [...DEFAULT_LOGIN_AMR],
      asr: DEFAULT_LOGIN_ASR,
    });
    const refreshToken = await createRefreshToken({
      userId: user.id,
      sv: user.session_version,
      amr: [...DEFAULT_LOGIN_AMR],
      asr: DEFAULT_LOGIN_ASR,
    });
    await setSessionCookies(accessToken, refreshToken);

    await recordSecurityEvent({
      userId: session.userId,
      eventType: 'mfa_disabled',
      request,
    });
    await recordSecurityEvent({
      userId: session.userId,
      eventType: 'session_version_revoked',
      request,
      metadata: { trigger: 'mfa_disable' },
    });

    void sendMfaDisabledEmail({ to: user.email, firstName: user.first_name });

    return NextResponse.json({
      success: true,
      accessToken,
      sessionToken: accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('MFA disable error:', error);
    return NextResponse.json({ error: 'Disable failed', code: 'DISABLE_FAILED' }, { status: 500 });
  }
}
