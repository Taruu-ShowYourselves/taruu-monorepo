import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * GET /api/bags/trending
 * Get trending Issue Coins for the economics dashboard
 *
 * Returns Issue Coins sorted by total value invested (totalRaised).
 * Public endpoint - no authentication required.
 *
 * Query params:
 * - limit: Number of coins to return (default 10, max 50)
 * - municipality: Filter by municipality ID (optional)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(1, parseInt(searchParams.get('limit') || '10', 10)),
      50
    );
    const municipality = searchParams.get('municipality');

    // Query issue_coins joined with votes for active/ended votes
    let query = supabaseAdmin
      .from('issue_coins')
      .select(`
        id,
        vote_id,
        token_mint,
        token_name,
        token_symbol,
        total_purchased,
        total_value_ils,
        trading_enabled,
        is_frozen,
        created_at,
        votes!inner (
          id,
          title,
          municipality_id,
          status,
          thumbnail_url,
          end_date
        )
      `)
      .in('votes.status', ['active', 'ended', 'resolving', 'resolved'])
      .order('total_value_ils', { ascending: false })
      .limit(limit);

    if (municipality) {
      query = query.eq('votes.municipality_id', municipality);
    }

    const { data: issueCoins, error } = await query;

    if (error) {
      console.error('Error fetching trending coins:', error);
      return NextResponse.json(
        { error: 'Failed to fetch trending coins' },
        { status: 500 }
      );
    }

    // Transform to API response format
    const coins = (issueCoins || []).map((coin: any) => ({
      voteId: coin.vote_id,
      voteTitle: coin.votes?.title || coin.token_name,
      municipality: coin.votes?.municipality_id || '',
      // Price change would require historical data - placeholder for now
      // In production, this would come from Bags.fm API or tracking
      priceChange24h: 0,
      volume24h: 0,
      totalRaised: (coin.total_value_ils || 0) / 100, // Convert from agorot to ILS
      tokenMint: coin.token_mint,
      imageUrl: coin.votes?.thumbnail_url || null,
      createdAt: coin.created_at,
    }));

    return NextResponse.json({
      coins,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in trending coins endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trending coins' },
      { status: 500 }
    );
  }
}
