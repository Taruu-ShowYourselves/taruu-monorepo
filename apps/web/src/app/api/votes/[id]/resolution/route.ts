import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/votes/[id]/resolution
 *
 * Get resolution status for a vote including:
 * - Resolution status and timestamp
 * - Issue Coin freeze status
 * - Fee extraction status
 * - NFT minting statistics
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: voteId } = await params;
    const { supabaseAdmin } = await import('@/lib/supabase/server');

    // Get vote details
    const { data: vote, error: voteError } = await supabaseAdmin
      .from('votes')
      .select('*')
      .eq('id', voteId)
      .single();

    if (voteError && voteError.code !== 'PGRST116') {
      throw voteError;
    }

    if (!vote) {
      return NextResponse.json(
        { error: 'Vote not found' },
        { status: 404 }
      );
    }

    // Get Issue Coin details
    const { data: issueCoin } = await supabaseAdmin
      .from('issue_coins')
      .select('*')
      .eq('vote_id', voteId)
      .single();

    // Get NFT stats manually since the RPC function may not exist yet
    const { data: nftData, error: nftError } = await supabaseAdmin
      .from('vote_nfts')
      .select('type, status')
      .eq('vote_id', voteId);

    let nftStats = {
      verified_voters: 0,
      civic_patrons: 0,
      total: 0,
      minted: 0,
      pending: 0,
      failed: 0,
    };

    if (!nftError && nftData) {
      nftStats = {
        verified_voters: nftData.filter((n) => n.type === 'verified_voter').length,
        civic_patrons: nftData.filter((n) => n.type === 'civic_patron').length,
        total: nftData.length,
        minted: nftData.filter((n) => n.status === 'minted').length,
        pending: nftData.filter((n) => n.status === 'pending').length,
        failed: nftData.filter((n) => n.status === 'failed').length,
      };
    }

    // Build response
    const response = {
      status: vote.resolution_status || 'pending',
      resolvedAt: vote.resolved_at || undefined,
      issueCoin: issueCoin
        ? {
            frozen: issueCoin.is_frozen,
            frozenAt: issueCoin.frozen_at || undefined,
          }
        : undefined,
      fees: undefined, // TODO: Implement fee tracking when Bags.fm fee claiming is added
      nfts: {
        verifiedVoters: nftStats.verified_voters,
        civicPatrons: nftStats.civic_patrons,
        total: nftStats.total,
        minted: nftStats.minted,
        pending: nftStats.pending,
        failed: nftStats.failed,
      },
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    // Log detail server-side; this is a PUBLIC endpoint - don't leak internals.
    console.error('Failed to get vote resolution status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
