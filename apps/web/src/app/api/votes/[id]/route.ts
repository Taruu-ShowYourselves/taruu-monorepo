import { NextRequest, NextResponse } from 'next/server';
import {
  getVoteWithOptions,
  getUserVote,
  getKnessetItemsByVoteIds,
} from '@/lib/supabase/db';
import { getSessionFromRequest } from '@/services/auth/session';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/votes/[id]
 * Get a specific vote by ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const voteData = await getVoteWithOptions(id);

    if (!voteData) {
      return NextResponse.json(
        { error: 'Vote not found' },
        { status: 404 }
      );
    }

    // Knesset-agenda votes carry their plenum context (background block on
    // the detail page). getKnessetItemsByVoteIds returns [] on any failure.
    const [knessetItem] = await getKnessetItemsByVoteIds([voteData.id]);
    const knesset = knessetItem
      ? {
          knessetNum: knessetItem.knesset_num,
          sessionNumber: knessetItem.session_number,
          sessionDate: knessetItem.session_date,
          ordinal: knessetItem.ordinal,
          itemType: knessetItem.item_type,
          isDiscussion: knessetItem.is_discussion,
          // Attached official document (fs.knesset.gov.il) + its AI summary,
          // filled in by /api/cron/knesset-docs.
          summary: knessetItem.summary,
          docUrl: knessetItem.doc_url,
          docGroup: knessetItem.doc_group,
        }
      : undefined;

    // Transform to API response format
    const vote = {
      id: voteData.id,
      title: voteData.title,
      description: voteData.description,
      municipality: voteData.municipality_id,
      creatorId: voteData.creator_id,
      status: voteData.status,
      startDate: voteData.start_date,
      endDate: voteData.end_date,
      participantCount: voteData.participant_count,
      // Note: vote_options table doesn't have description field.
      // `text`/`votes` are the contract's aliases for label/voteCount -
      // the detail page consumes them directly.
      options: voteData.options.map((opt) => ({
        id: opt.id,
        label: opt.text,
        text: opt.text,
        voteCount: opt.votes,
        votes: opt.votes,
      })),
      createdAt: voteData.created_at,
      updatedAt: voteData.updated_at,
      knesset,
    };

    // Signed-in caller: surface their existing choice (contract: option id).
    let userVote: string | undefined;
    const session = await getSessionFromRequest(request).catch(() => null);
    if (session) {
      const existing = await getUserVote(session.userId, voteData.id).catch(() => null);
      if (existing) userVote = existing.option_id;
    }

    return NextResponse.json({ vote: { ...vote, userVote } });
  } catch (error) {
    console.error('Error fetching vote:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vote' },
      { status: 500 }
    );
  }
}
