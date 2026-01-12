import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import {
  getUserById,
  getActiveVerificationRun,
  createVerificationRun,
  createVerificationScheduleItems,
  updateUser,
} from '@/lib/supabase/db';
import { getMunicipalityBounds } from '@/services/verification/municipality';

/**
 * Generate check-in windows for 21-day verification
 * Creates 5-7 random windows during working hours (8 AM - 10 PM)
 */
function generateCheckInWindows(
  runId: string,
  numCheckIns: number = 6
): Array<{
  run_id: string;
  window_start: string;
  window_end: string;
}> {
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
  const windows: Array<{
    run_id: string;
    window_start: string;
    window_end: string;
  }> = [];

  // Generate random days within the 21-day period
  const usedDays = new Set<number>();
  while (usedDays.size < numCheckIns) {
    // Random day between 1 and 20 (leave day 0 for onboarding)
    const day = Math.floor(Math.random() * 20) + 1;
    usedDays.add(day);
  }

  const sortedDays = Array.from(usedDays).sort((a, b) => a - b);

  for (const day of sortedDays) {
    // Random hour between 8 AM and 9 PM (to allow 30-min window before 10 PM)
    const hour = Math.floor(Math.random() * 13) + 8; // 8-21
    const minute = Math.floor(Math.random() * 60);

    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() + day);
    windowStart.setHours(hour, minute, 0, 0);

    const windowEnd = new Date(windowStart.getTime() + 30 * 60 * 1000); // 30 minutes

    windows.push({
      run_id: runId,
      window_start: windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
    });
  }

  return windows;
}

/**
 * POST /api/verification/start
 * Start a new 21-day GPS verification period
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserById(session.userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has selected a municipality
    if (!user.municipality_id) {
      return NextResponse.json(
        { error: 'Please select a municipality before starting verification' },
        { status: 400 }
      );
    }

    // Check if municipality is valid
    const municipalityBounds = getMunicipalityBounds(user.municipality_id);
    if (!municipalityBounds) {
      return NextResponse.json(
        { error: 'Invalid municipality selected' },
        { status: 400 }
      );
    }

    // Check if verification is already in progress
    const existingRun = await getActiveVerificationRun(user.id);
    if (existingRun) {
      return NextResponse.json(
        { error: 'Verification is already in progress' },
        { status: 400 }
      );
    }

    // Check if user already verified
    if (user.verification_status === 'verified') {
      return NextResponse.json(
        { error: 'Verification already completed. No need to verify again.' },
        { status: 400 }
      );
    }

    // Create verification run in Supabase
    const numCheckIns = Math.floor(Math.random() * 3) + 5; // 5-7 check-ins
    const run = await createVerificationRun({
      user_id: user.id,
      municipality_id: user.municipality_id,
      status: 'active',
      total_check_ins: numCheckIns,
      completed_check_ins: 0,
      failed_check_ins: 0,
    });

    // Generate and save check-in windows
    const windows = generateCheckInWindows(run.id, numCheckIns);
    await createVerificationScheduleItems(windows);

    // Update user verification status
    await updateUser(user.id, {
      verification_status: 'pending',
    });

    // Calculate period dates
    const periodStart = new Date(run.started_at);
    const periodEnd = new Date(periodStart.getTime() + 21 * 24 * 60 * 60 * 1000);

    return NextResponse.json({
      success: true,
      schedule: {
        id: run.id,
        municipality: user.municipality_id,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        totalCheckIns: numCheckIns,
        // Only send the next check-in time, not the full schedule
        nextCheckIn: windows[0]?.window_start,
      },
      verificationStatus: {
        phase: 'in_progress',
        completedCheckIns: 0,
        totalCheckIns: numCheckIns,
      },
    });
  } catch (error) {
    console.error('Error starting verification:', error);
    return NextResponse.json(
      { error: 'Failed to start verification' },
      { status: 500 }
    );
  }
}
