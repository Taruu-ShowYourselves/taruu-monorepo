import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import { getUserVotesWithDetails } from '@/lib/supabase/db';

/**
 * GET /api/user/participations
 * Get the current user's vote participation history with full details
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const votesWithDetails = await getUserVotesWithDetails(session.userId);

    // Transform to the Participation shape (@sync/shared). Ballots carry no
    // payment, no chain hash and no coordinates - emitting zeroed placeholders
    // for those made the history look chain-anchored when it never was.
    const participations = votesWithDetails.map((item) => ({
      id: item.id,
      voteId: item.vote_id,
      userId: item.user_id,
      optionId: item.option_id,
      createdAt: new Date(item.created_at),
      // Include vote details for convenience
      vote: item.vote
        ? {
            id: item.vote.id,
            title: item.vote.title,
            description: item.vote.description,
            status: item.vote.status,
            endDate: item.vote.end_date,
          }
        : null,
      option: item.option
        ? {
            id: item.option.id,
            text: item.option.text,
          }
        : null,
    }));

    return NextResponse.json({ participations });
  } catch (error) {
    console.error('Error fetching participations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch participations' },
      { status: 500 }
    );
  }
}
