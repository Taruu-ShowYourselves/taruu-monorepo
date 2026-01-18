import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * GET /api/stats/network
 * Get network-wide statistics for the economics dashboard
 *
 * Returns aggregate statistics across all municipalities:
 * - totalRaised: Total ILS raised across all votes
 * - activeVotes: Count of currently active votes
 * - totalVoters: Unique users who have voted
 * - municipalities: Count of municipalities with activity
 * - weeklyGrowth: Growth rate in the last 7 days
 *
 * Public endpoint - no authentication required.
 */
export async function GET() {
  try {
    // Run all queries in parallel for efficiency
    const [
      treasuryResult,
      activeVotesResult,
      totalVotersResult,
      municipalitiesResult,
      weeklyVotersResult,
      prevWeekVotersResult,
    ] = await Promise.all([
      // Total raised from all treasuries
      supabaseAdmin
        .from('treasury')
        .select('total_collected_ils'),

      // Count of active votes
      supabaseAdmin
        .from('votes')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),

      // Total unique voters
      supabaseAdmin
        .from('user_votes')
        .select('user_id', { count: 'exact', head: true }),

      // Unique municipalities with votes
      supabaseAdmin
        .from('votes')
        .select('municipality_id'),

      // Voters in last 7 days (for weekly growth)
      supabaseAdmin
        .from('user_votes')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

      // Voters in previous 7 days (for weekly growth comparison)
      supabaseAdmin
        .from('user_votes')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
        .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    // Calculate total raised from all treasuries
    let totalRaised = 0;
    if (treasuryResult.data) {
      totalRaised = treasuryResult.data.reduce(
        (sum: number, t: { total_collected_ils: number | null }) =>
          sum + (t.total_collected_ils || 0),
        0
      );
    }
    // Convert from agorot to ILS
    totalRaised = totalRaised / 100;

    // Get unique municipalities count
    const uniqueMunicipalities = new Set(
      (municipalitiesResult.data || []).map((v: { municipality_id: string }) => v.municipality_id)
    );

    // Calculate weekly growth
    const currentWeekVoters = weeklyVotersResult.count || 0;
    const prevWeekVoters = prevWeekVotersResult.count || 0;
    let weeklyGrowth = 0;
    if (prevWeekVoters > 0) {
      weeklyGrowth = (currentWeekVoters - prevWeekVoters) / prevWeekVoters;
    } else if (currentWeekVoters > 0) {
      weeklyGrowth = 1; // 100% growth if no previous week data
    }

    const stats = {
      totalRaised,
      activeVotes: activeVotesResult.count || 0,
      totalVoters: totalVotersResult.count || 0,
      municipalities: uniqueMunicipalities.size,
      weeklyGrowth: Math.round(weeklyGrowth * 100) / 100, // Round to 2 decimals
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error fetching network stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch network statistics' },
      { status: 500 }
    );
  }
}
