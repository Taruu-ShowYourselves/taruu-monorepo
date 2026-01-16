import { NextRequest, NextResponse } from 'next/server';
import { getIssueCoinByVoteId, getVoteById, countIssueCoinHolders } from '@/lib/supabase/db';

/**
 * GET /api/votes/[id]/issue-coin
 * Get Issue Coin details for a vote
 *
 * Issue Coin information is public - no authentication required.
 * Returns the Bags.fm token associated with the vote (if exists).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: voteId } = await params;

    // Verify vote exists
    const vote = await getVoteById(voteId);
    if (!vote) {
      return NextResponse.json({ error: 'Vote not found' }, { status: 404 });
    }

    // Get Issue Coin for this vote
    const issueCoin = await getIssueCoinByVoteId(voteId);

    if (!issueCoin) {
      return NextResponse.json({
        issueCoin: null,
        message: 'No Issue Coin has been created for this vote',
      });
    }

    // Get holder count
    const holderCount = await countIssueCoinHolders(issueCoin.id);

    return NextResponse.json({
      issueCoin: {
        id: issueCoin.id,
        voteId: issueCoin.vote_id,
        tokenMint: issueCoin.token_mint,
        tokenName: issueCoin.token_name,
        tokenSymbol: issueCoin.token_symbol,
        tokenDecimals: issueCoin.token_decimals,
        totalSupply: issueCoin.total_supply,
        totalPurchased: issueCoin.total_purchased,
        totalValueILS: issueCoin.total_value_ils,
        tradingEnabled: issueCoin.trading_enabled,
        isFrozen: issueCoin.is_frozen,
        frozenAt: issueCoin.frozen_at,
        launchTxHash: issueCoin.launch_tx_hash,
        feeShareConfigured: issueCoin.fee_share_configured,
        holderCount,
        createdAt: issueCoin.created_at,
        updatedAt: issueCoin.updated_at,
      },
    });
  } catch (error) {
    console.error('Error fetching issue coin:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Issue Coin' },
      { status: 500 }
    );
  }
}
