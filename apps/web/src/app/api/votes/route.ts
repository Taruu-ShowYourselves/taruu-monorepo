import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import { convergeService } from '@/services/converge';

/**
 * GET /api/votes
 * Get votes, optionally filtered by municipality and status
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const municipality = searchParams.get('municipality');
    const status = searchParams.get('status') as
      | 'pending'
      | 'active'
      | 'completed'
      | 'cancelled'
      | null;

    let votes;

    if (municipality && status) {
      votes = await convergeService.getVotesByMunicipality(municipality, status);
    } else if (municipality) {
      votes = await convergeService.getVotesByMunicipality(municipality);
    } else if (status === 'active') {
      votes = await convergeService.getActiveVotes();
    } else {
      votes = await convergeService.getActiveVotes();
    }

    return NextResponse.json({ votes });
  } catch (error) {
    console.error('Error fetching votes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch votes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/votes
 * Create a new vote (requires authentication and payment)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      description,
      municipality,
      options,
      startDate,
      endDate,
      paymentTxId,
    } = body;

    // Validate required fields
    if (
      !title ||
      !description ||
      !municipality ||
      !options ||
      !startDate ||
      !endDate
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate payment (in production, verify with Stripe)
    if (!paymentTxId) {
      return NextResponse.json(
        { error: 'Payment required to create a vote' },
        { status: 402 }
      );
    }

    // Create vote options with initial count
    const voteOptions = options.map(
      (opt: { label: string; description?: string }, index: number) => ({
        id: `opt_${Date.now()}_${index}`,
        label: opt.label,
        description: opt.description,
        voteCount: 0,
      })
    );

    // Create the vote
    const vote = await convergeService.createVote({
      title,
      description,
      municipality,
      creatorId: session.userId,
      status: new Date(startDate) <= new Date() ? 'active' : 'pending',
      options: voteOptions,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    return NextResponse.json({ vote }, { status: 201 });
  } catch (error) {
    console.error('Error creating vote:', error);
    return NextResponse.json(
      { error: 'Failed to create vote' },
      { status: 500 }
    );
  }
}
