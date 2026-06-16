import { NextRequest, NextResponse } from 'next/server';
import { mintPendingNfts } from '@/services/nft';
import { cronLogger as log } from '@/lib/logger';

const CRON_SECRET = process.env.CRON_SECRET;

// How many pending NFTs to attempt per run (keep within the cron CPU budget).
const BATCH_LIMIT = 25;

/**
 * POST /api/cron/mint-nfts
 *
 * Batch-mints pending compressed-NFT certificates (created at vote resolution)
 * to their recipient wallets via Metaplex Bubblegum, pinning metadata to IPFS.
 * No-op when the chain/IPFS creds are absent. Auth: Bearer CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!CRON_SECRET) {
      log.error('CRON_SECRET not configured - rejecting request');
      return NextResponse.json({ error: 'Cron endpoint not configured' }, { status: 503 });
    }
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      log.warn('Invalid cron authorization attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const summary = await mintPendingNfts(BATCH_LIMIT);
    log.info('NFT mint cron completed', summary);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...summary,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('NFT mint cron error', { error });
    return NextResponse.json({ error: 'Internal server error', message }, { status: 500 });
  }
}

/** GET — health check. */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'mint-nfts',
    description: 'Batch-mints pending compressed-NFT certificates to recipient wallets',
  });
}
