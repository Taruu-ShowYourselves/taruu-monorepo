import { NextRequest, NextResponse } from 'next/server';
import { syncKnessetRollCalls } from '@/services/knesset';
import { currentKnessetNum } from '@/server/read/government';
import { cronLogger as log } from '@/lib/logger';
import { secureEqual } from '@/lib/secureCompare';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/cron/knesset-rollcalls
 *
 * Mirrors the house's own recorded votes, and each member's stance in them,
 * from the official Votes OData service. The roll calls that sit on plenum
 * items Taruu published as national ballots are fetched first - those are the
 * ones that turn into a representation figure.
 *
 * Deliberately incremental: the upstream filter only answers one roll call at
 * a time, so each run takes a bounded bite and the mirror converges over a
 * few runs instead of holding a cron open for a thousand round-trips.
 *
 * Runs after /api/cron/knesset-roster: resolving a Votes-service member to a
 * roster person is a name match, and an empty roster resolves nobody.
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

    // The term comes from the roster rather than a constant, so an election
    // moves this job onto the new Knesset without a deploy.
    const knessetNum = await currentKnessetNum();
    if (knessetNum === null) {
      log.warn('roll-call sync skipped: roster is empty');
      return NextResponse.json({
        success: false,
        skipped: 'roster-empty',
        message: 'Run /api/cron/knesset-roster first',
      });
    }

    const results = await syncKnessetRollCalls(knessetNum);

    log.info('Knesset roll-call cron completed', {
      knessetNum: results.knessetNum,
      rollCallsSeen: results.rollCallsSeen,
      rollCallsUpserted: results.rollCallsUpserted,
      stanceFetches: results.stanceFetches,
      stancesUpserted: results.stancesUpserted,
      stancesUnresolved: results.stancesUnresolved,
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

/** GET /api/cron/knesset-rollcalls - health check. */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'knesset-rollcalls',
    description: "Mirrors the Knesset's recorded votes and member stances",
  });
}
