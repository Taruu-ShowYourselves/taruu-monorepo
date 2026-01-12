import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import { convergeService } from '@/services/converge';
import { getScheduleProgress } from '@/services/verification/schedule';
import type { VerificationStatus } from '@sync/shared';

/**
 * GET /api/verification/status
 * Get the current user's verification status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await convergeService.getUserByGoogleId(session.googleId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const verificationStatus: VerificationStatus = user.verificationStatus || {
      phase: 'not_started',
    };

    // If verification is in progress, get the schedule and compute progress
    let progress = null;
    let schedule = null;

    if (
      verificationStatus.phase === 'in_progress' &&
      verificationStatus.scheduleId
    ) {
      // TODO: Fetch full schedule from convergeService.getVerificationSchedule
      // For now, return the status from user record

      // Mock schedule progress based on status data
      if (verificationStatus.checkInsTotal && verificationStatus.checkInsTotal > 0) {
        const completed = verificationStatus.checkInsCompleted || 0;
        const total = verificationStatus.checkInsTotal;

        // Calculate days remaining (assume 21-day period)
        const startedAt = verificationStatus.startedAt
          ? new Date(verificationStatus.startedAt)
          : new Date();
        const now = new Date();
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysElapsed = Math.floor((now.getTime() - startedAt.getTime()) / msPerDay);
        const daysRemaining = Math.max(0, 21 - daysElapsed);

        progress = {
          daysRemaining,
          daysElapsed,
          completedCheckIns: completed,
          totalCheckIns: total,
          missedCheckIns: 0, // Would need full schedule to calculate
          pendingCheckIns: total - completed,
          completionRate: completed / total,
          requiredCompletionRate: 0.8,
          canStillPass: true, // Would need full schedule to calculate
        };
      }
    }

    return NextResponse.json({
      verificationStatus,
      progress,
      municipality: user.municipality,
      nextCheckIn: verificationStatus.nextCheckIn,
    });
  } catch (error) {
    console.error('Error fetching verification status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch verification status' },
      { status: 500 }
    );
  }
}
