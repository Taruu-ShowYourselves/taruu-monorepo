import { NextRequest, NextResponse } from 'next/server';
import { syncKnessetAgenda } from '@/services/knesset';
import { cronLogger as log } from '@/lib/logger';
import { secureEqual } from '@/lib/secureCompare';

// Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/cron/knesset-agenda
 *
 * Cron job endpoint that mirrors the Knesset plenum day order
 * (סדר יום המליאה) from the official Knesset OData API into votable
 * topics scoped to KNESSET_SCOPE. Idempotent - items dedup on their
 * upstream ItemID; re-runs only refresh sitting metadata.
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Verify cron secret (required in production)
    const authHeader = request.headers.get('authorization');

    // CRON_SECRET must be configured - reject if not set
    if (!CRON_SECRET) {
      log.error('CRON_SECRET not configured - rejecting request');
      return NextResponse.json(
        { error: 'Cron endpoint not configured' },
        { status: 503 }
      );
    }

    // Verify authorization header matches expected Bearer token
    if (!authHeader || !secureEqual(authHeader, `Bearer ${CRON_SECRET}`)) {
      log.warn('Invalid cron authorization attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const results = await syncKnessetAgenda();

    log.info('Knesset agenda cron completed', {
      sessionsScanned: results.sessionsScanned,
      itemsSeen: results.itemsSeen,
      created: results.created,
      refreshed: results.refreshed,
      skippedTitleDup: results.skippedTitleDup,
      errors: results.errors.length,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
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
 * GET /api/cron/knesset-agenda
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'knesset-agenda',
    description:
      'Mirrors the Knesset plenum day order into votable national topics',
  });
}
