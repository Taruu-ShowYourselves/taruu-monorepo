import { NextRequest, NextResponse } from 'next/server';
import { getTreasuryByMunicipality } from '@/lib/supabase/db';

/**
 * GET /api/treasury/[municipality]
 * Get treasury balance for a municipality
 *
 * Treasury balances are public information - no authentication required.
 * Municipality can be either a slug (e.g., 'tel-aviv') or Hebrew name.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ municipality: string }> }
) {
  try {
    const { municipality } = await params;

    // Validate municipality is provided
    if (!municipality || municipality.length === 0) {
      return NextResponse.json(
        { error: 'Municipality is required' },
        { status: 400 }
      );
    }

    const treasury = await getTreasuryByMunicipality(municipality);

    if (!treasury) {
      // Return empty treasury if none exists yet
      return NextResponse.json({
        treasury: {
          municipalityId: municipality,
          balanceILS: 0,
          balanceSOL: 0,
          totalCollectedILS: 0,
          totalWithdrawnILS: 0,
          activeVotesCount: 0,
          lastSyncAt: null,
        },
      });
    }

    return NextResponse.json({
      treasury: {
        id: treasury.id,
        municipalityId: treasury.municipality_id,
        walletAddress: treasury.wallet_address,
        balanceILS: treasury.balance_ils,
        balanceSOL: treasury.balance_sol,
        totalCollectedILS: treasury.total_collected_ils,
        totalWithdrawnILS: treasury.total_withdrawn_ils,
        totalFeesClaimedSOL: treasury.total_fees_claimed_sol,
        activeVotesCount: treasury.active_votes_count,
        lastSyncAt: treasury.last_sync_at,
        createdAt: treasury.created_at,
        updatedAt: treasury.updated_at,
      },
    });
  } catch (error) {
    console.error('Error fetching treasury:', error);
    return NextResponse.json(
      { error: 'Failed to fetch treasury' },
      { status: 500 }
    );
  }
}
