import { NextRequest, NextResponse } from 'next/server';
import {
  getUpcomingReminders,
  updateVerificationScheduleItem,
  getActiveUserPushTokens,
  updatePushTokenLastUsed,
} from '@/lib/supabase/db';
import { sendCheckInReminder } from '@/services/notifications/expo';
import { cronLogger as log } from '@/lib/logger';

// Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/cron/verification-notifications
 *
 * Cron job endpoint that runs periodically to:
 * 1. Send check-in reminders to users with upcoming check-ins
 *
 * This should be called by a cron service (e.g., Vercel Cron)
 * every 15 minutes.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();
    const results = {
      remindersProcessed: 0,
      notificationsSent: 0,
      notificationsFailed: 0,
      usersWithoutTokens: 0,
      errors: [] as string[],
    };

    // Get all upcoming reminders that haven't been sent
    const upcomingReminders = await getUpcomingReminders();

    for (const { schedule, run, user } of upcomingReminders) {
      try {
        results.remindersProcessed++;

        // Get user's push tokens
        const pushTokens = await getActiveUserPushTokens(user.id);

        if (pushTokens.length === 0) {
          // No push tokens registered - mark as sent anyway to avoid repeated attempts
          await updateVerificationScheduleItem(schedule.id, {
            reminder_sent: true,
          });
          results.usersWithoutTokens++;
          log.info('User has no push tokens, skipping notification', { userId: user.id });
          continue;
        }

        // Calculate check-in number
        const checkInNumber = run.completed_check_ins + run.failed_check_ins + 1;

        // Send notification to all user's devices
        const usedTokens: string[] = [];
        for (const token of pushTokens) {
          const result = await sendCheckInReminder(token, {
            scheduledTime: schedule.window_start,
            municipality: run.municipality_id,
            checkInNumber,
            totalCheckIns: run.total_check_ins,
          });

          if (result.success) {
            results.notificationsSent++;
            usedTokens.push(token);
            log.info('Notification sent', { userId: user.id, scheduleId: schedule.id });
          } else {
            results.notificationsFailed++;
            results.errors.push(
              `Failed to send to user ${user.id}: ${result.error}`
            );
          }
        }

        // Update last_used timestamp for tokens that received notifications
        if (usedTokens.length > 0) {
          await updatePushTokenLastUsed(usedTokens);
        }

        // Mark reminder as sent
        await updateVerificationScheduleItem(schedule.id, {
          reminder_sent: true,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Error processing schedule ${schedule.id}: ${message}`);
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('Cron job error', { error });
    return NextResponse.json(
      { error: 'Internal server error', message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/verification-notifications
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'verification-notifications',
    description: 'Sends push notifications for verification check-ins',
  });
}
