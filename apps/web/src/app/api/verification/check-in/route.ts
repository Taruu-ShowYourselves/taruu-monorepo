import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import {
  getUserById,
  getActiveVerificationRun,
  getNextPendingCheckIn,
  createVerificationAttempt,
  updateVerificationScheduleItem,
  updateVerificationRun,
  updateUser,
} from '@/lib/supabase/db';
import { verifyCheckIn } from '@/services/verification/municipality';

interface CheckInRequest {
  latitude: number;
  longitude: number;
  accuracy?: number;
  scheduleId?: string;
}

/**
 * POST /api/verification/check-in
 * Record a GPS location check-in
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CheckInRequest = await request.json();
    const { latitude, longitude, accuracy, scheduleId } = body;

    // Validate required fields
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json(
        { error: 'Invalid coordinates provided' },
        { status: 400 }
      );
    }

    const user = await getUserById(session.userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get active verification run
    const run = await getActiveVerificationRun(user.id);
    if (!run) {
      return NextResponse.json(
        { error: 'No verification in progress. Please start verification first.' },
        { status: 400 }
      );
    }

    // Get the next pending check-in or use the provided scheduleId
    let scheduleItem;
    if (scheduleId) {
      // Validate the scheduleId belongs to this run
      const allItems = await getNextPendingCheckIn(run.id);
      scheduleItem = allItems?.id === scheduleId ? allItems : null;
    } else {
      scheduleItem = await getNextPendingCheckIn(run.id);
    }

    if (!scheduleItem) {
      return NextResponse.json(
        { error: 'No pending check-in found' },
        { status: 400 }
      );
    }

    // Check if current time is within the check-in window
    const now = new Date();
    const windowStart = new Date(scheduleItem.window_start);
    const windowEnd = new Date(scheduleItem.window_end);

    if (now < windowStart || now > windowEnd) {
      // Record the missed attempt
      await createVerificationAttempt({
        schedule_id: scheduleItem.id,
        user_id: user.id,
        latitude,
        longitude,
        accuracy: accuracy || 0,
        passed: false,
        fail_reason: now < windowStart ? 'too_early' : 'too_late',
      });

      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: now < windowStart
            ? 'Check-in window has not started yet'
            : 'Check-in window has expired',
        },
        { status: 400 }
      );
    }

    // Verify the GPS location
    const verificationResult = verifyCheckIn(
      latitude,
      longitude,
      accuracy,
      run.municipality_id
    );

    // Record the attempt
    const attempt = await createVerificationAttempt({
      schedule_id: scheduleItem.id,
      user_id: user.id,
      latitude,
      longitude,
      accuracy: accuracy || 0,
      passed: verificationResult.verified,
      fail_reason: verificationResult.verified ? null : verificationResult.error || null,
    });

    if (!verificationResult.verified) {
      // Update run stats for failed attempt
      await updateVerificationRun(run.id, {
        failed_check_ins: run.failed_check_ins + 1,
      });

      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: verificationResult.error,
          details: {
            inMunicipality: verificationResult.inMunicipality,
            accuracyAcceptable: verificationResult.accuracyAcceptable,
            distanceFromCenter: verificationResult.distanceFromCenter,
          },
        },
        { status: 400 }
      );
    }

    // Mark schedule item as completed
    await updateVerificationScheduleItem(scheduleItem.id, {
      completed: true,
    });

    // Update run stats
    const newCompletedCount = run.completed_check_ins + 1;
    const updateData: {
      completed_check_ins: number;
      status?: 'active' | 'verified' | 'failed' | 'cancelled';
      completed_at?: string;
    } = {
      completed_check_ins: newCompletedCount,
    };

    // Check if verification is complete (80% success rate after all check-ins)
    if (newCompletedCount + run.failed_check_ins >= run.total_check_ins) {
      const successRate = newCompletedCount / run.total_check_ins;
      if (successRate >= 0.8) {
        updateData.status = 'verified';
        updateData.completed_at = new Date().toISOString();

        // Update user verification status
        await updateUser(user.id, {
          verification_status: 'verified',
        });
      }
    }

    await updateVerificationRun(run.id, updateData);

    return NextResponse.json({
      success: true,
      verified: true,
      checkIn: {
        id: attempt.id,
        completedAt: attempt.timestamp,
        location: { latitude, longitude, accuracy },
        municipalityVerified: true,
        distanceFromCenter: verificationResult.distanceFromCenter,
      },
      verificationStatus: {
        phase: updateData.status === 'verified' ? 'completed' : 'in_progress',
        completedCheckIns: newCompletedCount,
        totalCheckIns: run.total_check_ins,
      },
      progress: {
        completedCheckIns: newCompletedCount,
        totalCheckIns: run.total_check_ins,
        completionRate: newCompletedCount / run.total_check_ins,
      },
    });
  } catch (error) {
    console.error('Error processing check-in:', error);
    return NextResponse.json(
      { error: 'Failed to process check-in' },
      { status: 500 }
    );
  }
}
