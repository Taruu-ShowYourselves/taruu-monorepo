import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import {
  getVoteWithOptions,
  getUserByGoogleId,
  recordUserVoteOnce,
  incrementVoteOption,
} from '@/lib/supabase/db';
import { supabaseAdmin } from '@/lib/supabase/server';
import { checkVoterEligibility } from '@/services/verification/eligibility';
import { ParticipateRequestSchema } from '@sync/shared/contracts';
import {
  voteParticipationLimiter,
  createRateLimitResponse,
} from '@/lib/rate-limit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/votes/[id]/participate
 *
 * Records a free ballot. Participation costs nothing (cfa5d25, 2026-07-29) and
 * residency is verified once at /verification, so the body is `{ optionId }`
 * alone - no payment id, no per-vote coordinates. Idempotency leans on the
 * `UNIQUE(user_id, vote_id)` constraint rather than on a check-then-act read,
 * so a double-click returns the ballot already cast instead of a second row.
 * Ballots are not chain-anchored; nothing here writes to a chain and no chain
 * outage can reject a resident's vote.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting: 3 requests per minute per user (uses Redis in production)
    const rateLimitResult = await voteParticipationLimiter.check(session.userId);
    if (rateLimitResult.limited) {
      return createRateLimitResponse(
        rateLimitResult,
        'יותר מדי בקשות להשתתפות בהצבעה. נסו שוב בעוד דקה.'
      );
    }

    const { id: voteId } = await params;
    const body = await request.json().catch(() => null);
    const parsed = ParticipateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Missing or invalid field: optionId', code: 'INVALID_BODY' },
        { status: 400 }
      );
    }
    const { optionId } = parsed.data;

    // Get the vote with options
    const vote = await getVoteWithOptions(voteId);

    if (!vote) {
      return NextResponse.json({ error: 'Vote not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    // A closed vote and a not-yet-open vote are different facts and must not
    // collapse into one client message - "refresh and try again" is actively
    // wrong advice for a vote that has ended.
    if (vote.status === 'ended') {
      return NextResponse.json({ error: 'Vote has ended', code: 'VOTE_ENDED' }, { status: 400 });
    }

    if (vote.status !== 'active') {
      return NextResponse.json(
        { error: 'Vote is not open yet', code: 'VOTE_NOT_OPEN' },
        { status: 400 }
      );
    }

    // Status can still lag the clock: a vote whose end_date has passed is
    // ended, whatever the stored status says.
    if (new Date(vote.end_date) < new Date()) {
      return NextResponse.json({ error: 'Vote has ended', code: 'VOTE_ENDED' }, { status: 400 });
    }

    // Validate option exists
    const validOption = vote.options.find((opt) => opt.id === optionId);
    if (!validOption) {
      return NextResponse.json({ error: 'Invalid option', code: 'INVALID_OPTION' }, { status: 400 });
    }

    // Get user profile
    const user = await getUserByGoogleId(session.googleId);
    if (!user) {
      return NextResponse.json(
        { error: 'User profile not found', code: 'USER_NOT_FOUND' },
        { status: 400 }
      );
    }

    // Server-side voter eligibility - the enforcement point, mirroring what
    // the client already shows.
    const eligibility = await checkVoterEligibility(user);
    if (!eligibility.eligible) {
      return NextResponse.json(
        { error: eligibility.message, code: eligibility.code },
        { status: 403 }
      );
    }

    // Persist the ballot. Idempotent: a duplicate submit returns the existing
    // row instead of throwing or double-recording.
    const { created, vote: ballot } = await recordUserVoteOnce({
      user_id: session.userId,
      vote_id: voteId,
      option_id: optionId,
    });

    // Move the tally and participant count only for a genuinely new ballot -
    // never on the duplicate path, or the count drifts above the ballot count.
    if (created) {
      await incrementVoteOption(optionId);
      await supabaseAdmin
        .from('votes')
        .update({
          participant_count: (vote.participant_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', voteId);
    }

    return NextResponse.json({
      success: true,
      alreadyRecorded: !created,
      participation: {
        id: ballot.id,
        voteId,
        userId: session.userId,
        optionId: ballot.option_id,
        createdAt: ballot.created_at,
      },
    });
  } catch (error) {
    console.error('Error participating in vote:', error);
    return NextResponse.json(
      { error: 'Failed to participate in vote' },
      { status: 500 }
    );
  }
}
