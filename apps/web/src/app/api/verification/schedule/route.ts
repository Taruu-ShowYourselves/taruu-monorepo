import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import {
  getUserById,
  getActiveVerificationRun,
  getVerificationSchedule,
} from '@/lib/supabase/db';

/**
 * GET /api/verification/schedule
 * Get the user's verification schedule
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await getUserById(session.userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get active verification run
    const run = await getActiveVerificationRun(user.id);
    if (!run) {
      return NextResponse.json(
        {
          error: 'No verification in progress',
          message: 'User has not started verification process'
        },
        { status: 404 }
      );
    }

    // Get schedule items
    const scheduleItems = await getVerificationSchedule(run.id);

    // Calculate stats
    const completedCount = scheduleItems.filter(s => s.completed).length;
    const pendingCount = scheduleItems.filter(s => !s.completed).length;

    // Only return next upcoming window to prevent gaming
    const now = new Date();
    const nextWindow = scheduleItems.find(
      s => !s.completed && new Date(s.window_end) > now
    );

    return NextResponse.json({
      schedule: {
        id: run.id,
        userId: run.user_id,
        municipality: run.municipality_id,
        periodStart: run.started_at,
        periodEnd: new Date(new Date(run.started_at).getTime() + 21 * 24 * 60 * 60 * 1000).toISOString(),
        status: run.status,
        completedCheckIns: completedCount,
        totalCheckIns: run.total_check_ins,
        pendingCheckIns: pendingCount,
        failedCheckIns: run.failed_check_ins,
        // Only show the next upcoming window
        nextCheckIn: nextWindow ? {
          windowStart: nextWindow.window_start,
          windowEnd: nextWindow.window_end,
        } : null,
      },
      metadata: {
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching verification schedule:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
