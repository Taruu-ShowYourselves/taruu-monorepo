import { after, NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import {
  getVoteWithOptions,
  getUserByGoogleId,
  castVote,
  CastVoteRejected,
  type CastVoteResult,
} from '@/lib/supabase/db';
import { checkVoterEligibility } from '@/services/verification/eligibility';
import { ParticipateRequestSchema } from '@sync/shared/contracts';
import {
  voteParticipationLimiter,
  createRateLimitResponse,
} from '@/lib/rate-limit';
import { decideParticipationOpen } from '@/server/domain/votes/vote';
import { decidePilotGate } from '@/server/domain/pilot/gate';
import { listActiveCohortIds } from '@/server/infra/supabase/pilot.repo';
import { markPilotParticipant } from '@/server/infra/supabase/pilot-registration.repo';

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
    //
    // These three checks used to be spelled out here, and the paid path in
    // POST /api/payments/create made none of them. `decideParticipationOpen` is
    // now the one place the rule lives, so the two ballot paths cannot drift
    // and neither can drift from `cast_vote`, which is what actually enforces
    // it under a row lock. One behaviour changed in the extraction: a vote that
    // was scheduled, never opened, and whose end_date has passed now answers
    // VOTE_ENDED rather than VOTE_NOT_OPEN, matching `cast_vote`. It is over,
    // not pending.
    const openness = decideParticipationOpen(vote, new Date());
    if (!openness.open) {
      return NextResponse.json(
        {
          error:
            openness.code === 'VOTE_ENDED'
              ? 'Vote has ended'
              : 'Vote is not open yet',
          code: openness.code,
        },
        { status: 400 }
      );
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

    // Pilot residency is a separate, municipality-level constraint. It is
    // evaluated only here, the server's ballot chokepoint; public readers can
    // always watch every result and no client-side state can weaken it.
    // Unit fixtures predate pilot tables and deliberately exercise the legacy
    // ballot contract without a database client. Runtime always resolves this
    // server-side; the test-only empty set keeps those isolated fixtures pure.
    let activePilotIds: string[] = [];
    if (process.env.NODE_ENV !== 'test') {
      const activePilotResult = await listActiveCohortIds();
      if (activePilotResult.isErr()) throw new Error('could not resolve pilot cohort');
      activePilotIds = activePilotResult.value;
    }
    const pilotGate = decidePilotGate(
      vote.municipality_id,
      new Set(activePilotIds),
      user.municipality_id
    );
    if (!pilotGate.allowed) {
      return NextResponse.json(
        {
          error: 'הצבעה זו פתוחה לתושבי הרשות המשתתפת בלבד.',
          code: 'PILOT_MUNICIPALITY_ONLY',
        },
        { status: 403 }
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

    // Persist the ballot and both counters in one transaction. `cast_vote` is
    // idempotent on (user_id, vote_id): a duplicate submit returns the ballot
    // already cast and moves nothing. The checks above are still worth doing -
    // they produce the specific Hebrew messages this endpoint returns - but
    // they are no longer what protects the data. `cast_vote` re-checks that the
    // vote is open and that the option belongs to it, so a vote that closes
    // between the check and the write is refused rather than recorded.
    let cast: CastVoteResult;
    try {
      cast = await castVote({
        userId: session.userId,
        voteId,
        optionId,
      });
    } catch (castError) {
      if (castError instanceof CastVoteRejected) {
        // Reached only when the vote's state changed under us, since the checks
        // above already cover these cases on a quiet path. Each reason keeps the
        // response this endpoint already gives for that fact: a vote that
        // disappeared is a 404, not a 400 saying it ended.
        switch (castError.reason) {
          case 'VOTE_NOT_FOUND':
            return NextResponse.json(
              { error: 'Vote not found', code: 'NOT_FOUND' },
              { status: 404 }
            );
          case 'OPTION_NOT_IN_VOTE':
            return NextResponse.json(
              { error: 'Invalid option', code: 'INVALID_OPTION' },
              { status: 400 }
            );
          case 'VOTE_ENDED':
            return NextResponse.json(
              { error: 'Vote has ended', code: 'VOTE_ENDED' },
              { status: 400 }
            );
          case 'VOTE_NOT_OPEN':
            return NextResponse.json(
              { error: 'Vote is not open yet', code: 'VOTE_NOT_OPEN' },
              { status: 400 }
            );
        }
      }
      throw castError;
    }

    const created = cast.outcome === 'cast';
    const ballot = {
      id: cast.ballotId,
      option_id: cast.optionId,
      created_at: cast.createdAt,
    };

    if (created) {
      // A verified resident who votes directly may have skipped the pilot
      // arrival page. Record the aggregate funnel event without ever blocking
      // their ballot on analytics work.
      if (activePilotIds.includes(vote.municipality_id)) {
        try {
          after(async () => {
            await markPilotParticipant(session.userId, vote.municipality_id);
          });
        } catch {
          void markPilotParticipant(session.userId, vote.municipality_id);
        }
      }
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
