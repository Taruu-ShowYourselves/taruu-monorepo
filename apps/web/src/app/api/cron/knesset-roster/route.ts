import { NextRequest, NextResponse } from 'next/server';
import { syncKnessetRoster } from '@/services/knesset';
import { cronLogger as log } from '@/lib/logger';
import { secureEqual } from '@/lib/secureCompare';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/cron/knesset-roster
 *
 * Mirrors the sitting Knesset - every member and every office they currently
 * hold - from the official ParliamentInfo OData service. Every member the
 * Knesset publishes as current gets a row here, and therefore a public
 * profile: the roster is not curated. Idempotent; re-runs refresh.
 */
export async function POST(request: NextRequest) {
  try {
    if (!CRON_SECRET) {
      log.error('CRON_SECRET not configured - rejecting request');
      return NextResponse.json(
        { error: 'Cron endpoint not configured' },
        { status: 503 }
      );
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !secureEqual(authHeader, `Bearer ${CRON_SECRET}`)) {
      log.warn('Invalid cron authorization attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = await syncKnessetRoster();

    log.info('Knesset roster cron completed', {
      personsSeen: results.personsSeen,
      personsUpserted: results.personsUpserted,
      personsRetired: results.personsRetired,
      positionsUpserted: results.positionsUpserted,
      knessetNum: results.knessetNum,
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

/** GET /api/cron/knesset-roster - health check. */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'knesset-roster',
    description: 'Mirrors the sitting Knesset roster and its offices',
  });
}
