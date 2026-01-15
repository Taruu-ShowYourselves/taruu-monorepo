import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import { getUserVoteStats } from '@/lib/supabase/db';

/**
 * GET /api/user/stats
 * Get the current user's vote statistics (votes participated, votes created)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await getUserVoteStats(session.userId);

    return NextResponse.json({
      votesParticipated: stats.votesParticipated,
      votesCreated: stats.votesCreated,
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user stats' },
      { status: 500 }
    );
  }
}
