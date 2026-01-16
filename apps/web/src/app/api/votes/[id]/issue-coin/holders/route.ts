import { NextRequest, NextResponse } from 'next/server';
import {
  getIssueCoinByVoteId,
  getVoteById,
  getIssueCoinHolders,
  countIssueCoinHolders,
} from '@/lib/supabase/db';

/**
 * GET /api/votes/[id]/issue-coin/holders
 * Get list of Issue Coin holders for a vote
 *
 * Query parameters:
 * - limit: Number of holders to return (default 100, max 500)
 * - offset: Pagination offset (default 0)
 * - residentsOnly: If 'true', only return verified local residents
 *
 * Holder list is public - no authentication required.
 * Personal information is anonymized for non-authenticated requests.
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
        holders: [],
        pagination: {
          total: 0,
          limit: 100,
          offset: 0,
        },
        message: 'No Issue Coin has been created for this vote',
      });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const residentsOnly = searchParams.get('residentsOnly') === 'true';

    // Get holders
    const holders = await getIssueCoinHolders(issueCoin.id, {
      limit,
      offset,
      residentsOnly,
    });

    // Get total count
    const totalCount = await countIssueCoinHolders(issueCoin.id);

    // Transform to API response format
    // Anonymize personal data for public access
    const transformedHolders = holders.map((holder) => ({
      id: holder.id,
      // Show truncated wallet address if external, or "Anonymous User" if internal
      displayName: holder.wallet_address
        ? `${holder.wallet_address.slice(0, 4)}...${holder.wallet_address.slice(-4)}`
        : holder.users
          ? `${(holder.users as { first_name?: string }).first_name?.charAt(0) || 'A'}. ${(holder.users as { last_name?: string }).last_name?.charAt(0) || 'U'}.`
          : 'Anonymous',
      walletAddress: holder.wallet_address,
      tokenAmount: holder.token_amount,
      investedILS: holder.invested_ils,
      isLocalResident: holder.is_local_resident,
      nftMinted: holder.nft_minted,
      firstPurchaseAt: holder.first_purchase_at,
      lastPurchaseAt: holder.last_purchase_at,
    }));

    return NextResponse.json({
      holders: transformedHolders,
      issueCoin: {
        id: issueCoin.id,
        tokenName: issueCoin.token_name,
        tokenSymbol: issueCoin.token_symbol,
        totalPurchased: issueCoin.total_purchased,
        totalValueILS: issueCoin.total_value_ils,
      },
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    console.error('Error fetching issue coin holders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Issue Coin holders' },
      { status: 500 }
    );
  }
}
