import { NextRequest, NextResponse } from 'next/server';
import { syncKnessetDocSummaries } from '@/services/knesset/docs';
import { cronLogger as log } from '@/lib/logger';
import { secureEqual } from '@/lib/secureCompare';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/cron/knesset-docs
 *
 * Processes the next batch of Knesset day-order items that have no document
 * summary yet: discovers the attached official document (bill text /
 * agenda-proposal text), extracts it and stores a short Hebrew summary.
 * Converges — every attempt is stamped, so repeated runs drain the queue.
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

    const results = await syncKnessetDocSummaries();

    log.info('Knesset docs cron completed', {
      scanned: results.scanned,
      summarized: results.summarized,
      docOnly: results.docOnly,
      docless: results.docless,
      errors: results.errors.length,
    });

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    log.error('Knesset docs cron failed', { error });
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
