import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import { getUserByGoogleId } from '@/lib/supabase/db';
import { z } from 'zod';

// Query parameter schema
const GetUserNftsRequestSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  municipality: z.string().optional(),
  type: z.enum(['verified_voter', 'civic_patron']).optional(),
});

/**
 * GET /api/user/nfts
 *
 * Get the authenticated user's NFT collection.
 * Returns minted NFTs with vote details.
 *
 * Query parameters:
 * - limit: Max items to return (1-100, default 50)
 * - offset: Pagination offset (default 0)
 * - municipality: Filter by municipality ID
 * - type: Filter by NFT type (verified_voter or civic_patron)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await getUserByGoogleId(session.googleId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const parseResult = GetUserNftsRequestSchema.safeParse({
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
      municipality: searchParams.get('municipality') || undefined,
      type: searchParams.get('type') || undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { limit, offset, municipality, type } = parseResult.data;

    // Get user's NFTs directly from database
    const { supabaseAdmin } = await import('@/lib/supabase/server');

    // Certificates are auto-issued on resolution (view-only) - return every
    // record, not just on-chain-minted ones. The UI shows a status badge
    // (issued / pending-chain) so a not-yet-minted certificate still appears.
    let query = supabaseAdmin
      .from('vote_nfts')
      .select(`
        id,
        vote_id,
        type,
        status,
        mint_address,
        mint_tx_hash,
        metadata,
        minted_at,
        created_at
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      query = query.eq('type', type);
    }

    const { data: nfts, error: nftsError } = await query;

    if (nftsError) {
      console.error('Failed to get user NFTs:', nftsError);
      throw nftsError;
    }

    // Get total count
    const { count, error: countError } = await supabaseAdmin
      .from('vote_nfts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      console.error('Failed to count user NFTs:', countError);
    }

    // Get vote details for each NFT
    const voteIds = [...new Set((nfts || []).map((nft) => nft.vote_id))];
    let votesMap: Record<string, { title: string; municipality_id: string }> = {};

    if (voteIds.length > 0) {
      const { data: votes } = await supabaseAdmin
        .from('votes')
        .select('id, title, municipality_id')
        .in('id', voteIds);

      if (votes) {
        votesMap = votes.reduce(
          (acc, vote) => ({
            ...acc,
            [vote.id]: { title: vote.title, municipality_id: vote.municipality_id },
          }),
          {}
        );
      }
    }

    // Transform to display format and filter by municipality if needed
    let displayNfts = (nfts || []).map((nft) => {
      const vote = votesMap[nft.vote_id];
      const metadata = nft.metadata as Record<string, unknown> | null;

      return {
        id: nft.id,
        type: nft.type,
        status: nft.status,
        voteId: nft.vote_id,
        voteTitle: vote?.title || 'Unknown Vote',
        municipality: vote?.municipality_id || 'Unknown',
        mintAddress: nft.mint_address,
        mintTxHash: nft.mint_tx_hash,
        // Pilot: the on-chain metadata.image is a stubbed CDN; always serve the
        // type-based certificate artwork from the app's public dir.
        imageUrl: `/images/certificates/${nft.type}.png`,
        mintedAt: nft.minted_at,
        createdAt: nft.created_at,
        displayName:
          (metadata?.name as string) || `Taruu NFT: ${vote?.title || 'Vote'}`,
      };
    });

    // Filter by municipality if provided
    if (municipality) {
      displayNfts = displayNfts.filter((nft) => nft.municipality === municipality);
    }

    return NextResponse.json({
      nfts: displayNfts,
      total: count || 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to get user NFTs:', error);
    return NextResponse.json(
      { error: 'Internal server error', message },
      { status: 500 }
    );
  }
}
