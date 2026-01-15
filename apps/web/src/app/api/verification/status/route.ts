import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import {
  getUserByGoogleId,
  getActiveVerificationRun,
  getVerificationSchedule,
} from '@/lib/supabase/db';
import type { VerificationStatus } from '@sync/shared';

// Verification period duration
const VERIFICATION_PERIOD_DAYS = 21;

/**
 * GET /api/verification/status
 * Get the current user's verification status with actual database data
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserByGoogleId(session.googleId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get active verification run from database
    const activeRun = await getActiveVerificationRun(user.id);

    // Build verification status from actual database data
    let verificationStatus: VerificationStatus;
    let progress = null;
    let nextCheckIn = null;

    if (!activeRun) {
      // No active verification - check user's verification_status field
      if (user.verification_status === 'verified') {
        verificationStatus = {
          phase: 'completed',
        };
      } else if (user.verification_status === 'failed') {
        verificationStatus = {
          phase: 'failed',
        };
      } else {
        verificationStatus = {
          phase: 'not_started',
        };
      }
    } else {
      // Get the full schedule from database
      const scheduleItems = await getVerificationSchedule(activeRun.id);

      // Count completed and missed check-ins from actual schedule data
      const now = new Date();
      let completedCount = 0;
      let missedCount = 0;
      let pendingCount = 0;
      let nextPendingCheckIn: Date | null = null;

      for (const item of scheduleItems) {
        if (item.completed) {
          completedCount++;
        } else {
          const windowEnd = new Date(item.window_end);
          if (windowEnd < now) {
            // Window has passed and not completed - it's missed
            missedCount++;
          } else {
            // Still pending
            pendingCount++;
            // Track the next pending check-in
            const windowStart = new Date(item.window_start);
            if (!nextPendingCheckIn || windowStart < nextPendingCheckIn) {
              nextPendingCheckIn = windowStart;
            }
          }
        }
      }

      const totalCheckIns = scheduleItems.length;
      const requiredCompletions = Math.ceil(totalCheckIns * 0.8);

      // Can still pass if completed + pending >= required
      const canStillPass = completedCount + pendingCount >= requiredCompletions;

      // Calculate days elapsed and remaining
      const startedAt = new Date(activeRun.started_at);
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysElapsed = Math.floor((now.getTime() - startedAt.getTime()) / msPerDay);
      const daysRemaining = Math.max(0, VERIFICATION_PERIOD_DAYS - daysElapsed);

      // Build verification status
      if (activeRun.status === 'verified') {
        verificationStatus = {
          phase: 'completed',
          startedAt,
          completedAt: activeRun.completed_at ? new Date(activeRun.completed_at) : undefined,
          scheduleId: activeRun.id,
          checkInsCompleted: completedCount,
          checkInsTotal: totalCheckIns,
        };
      } else if (activeRun.status === 'failed') {
        verificationStatus = {
          phase: 'failed',
          startedAt,
          scheduleId: activeRun.id,
          checkInsCompleted: completedCount,
          checkInsTotal: totalCheckIns,
        };
      } else {
        // Active verification in progress
        verificationStatus = {
          phase: 'in_progress',
          startedAt,
          scheduleId: activeRun.id,
          checkInsCompleted: completedCount,
          checkInsTotal: totalCheckIns,
          nextCheckIn: nextPendingCheckIn || undefined,
        };
      }

      // Build progress object with actual data
      progress = {
        daysRemaining,
        daysElapsed,
        completedCheckIns: completedCount,
        totalCheckIns,
        missedCheckIns: missedCount,
        pendingCheckIns: pendingCount,
        completionRate: totalCheckIns > 0 ? completedCount / totalCheckIns : 0,
        requiredCompletionRate: 0.8,
        canStillPass,
      };

      nextCheckIn = nextPendingCheckIn;
    }

    return NextResponse.json({
      verificationStatus,
      progress,
      municipality: user.municipality_id,
      nextCheckIn,
    });
  } catch (error) {
    console.error('Error fetching verification status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch verification status' },
      { status: 500 }
    );
  }
}
