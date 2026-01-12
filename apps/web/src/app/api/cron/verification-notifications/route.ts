import { NextRequest, NextResponse } from 'next/server';
import {
  getUpcomingReminders,
  updateVerificationScheduleItem,
} from '@/lib/supabase/db';

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
      remindersSet: 0,
      errors: [] as string[],
    };

    // Get all upcoming reminders that haven't been sent
    const upcomingReminders = await getUpcomingReminders();

    for (const { schedule, run, user } of upcomingReminders) {
      try {
        // Mark reminder as sent
        await updateVerificationScheduleItem(schedule.id, {
          reminder_sent: true,
        });

        // TODO: Send push notification via Expo
        // This requires the user to have a push token stored
        // For now, we just mark the reminder as sent

        console.log(`Reminder sent for user ${user.id}, schedule ${schedule.id}`);
        results.remindersSet++;
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
    console.error('Cron job error:', error);
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
