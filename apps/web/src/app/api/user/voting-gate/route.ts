import { NextRequest, NextResponse } from 'next/server';
import { votingGate } from '@sync/shared';
import { getSessionFromRequest } from '@/services/auth/session';
import { getActiveVerificationRun, getUserById } from '@/lib/supabase/db';
import { hasVerifiedResidency } from '@/services/verification/eligibility';

/**
 * GET /api/user/voting-gate — what the reader still owes the ballot box.
 *
 * The surfaces that explain the gate cannot compute it. `identityScore` rides
 * on the session profile, but residency is worth 40 of the 80 points and its
 * signal (a completed programme OR one successful check-in) lives in
 * `verification_runs`, which no client screen loads. ParticipationFlow learned
 * that the hard way: it once gated on `checkInsCompleted`, which is undefined
 * there, and turned away residents the server was perfectly willing to accept.
 *
 * So the arithmetic is done here, once, by the same helpers the enforcement
 * point uses — and the client is left with nothing to guess. This still
 * decides nothing: POST /api/votes/[id]/participate remains the only authority.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserById(session.userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const activeRun = await getActiveVerificationRun(user.id);
    const residencyVerified = hasVerifiedResidency(user, activeRun);
    const gate = votingGate({
      identityPoints: user.identity_score ?? 0,
      residencyVerified,
    });

    return NextResponse.json({
      ...gate,
      residencyVerified,
      checkInsCompleted: activeRun?.completed_check_ins ?? 0,
    });
  } catch (error) {
    console.error('Error building the voting gate:', error);
    return NextResponse.json(
      { error: 'Failed to load voting eligibility' },
      { status: 500 }
    );
  }
}
