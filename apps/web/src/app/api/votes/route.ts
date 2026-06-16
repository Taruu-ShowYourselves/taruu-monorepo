import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import { emailService, sendInBatches } from '@/services/email';
import { sendBatchNotifications } from '@/services/notifications/expo';
import {
  getActiveVotes,
  getVotesByMunicipality,
  createVote,
  createVoteOptions,
  verifyPaymentCompleted,
  isPaymentAlreadyUsed,
  getUserById,
  getUsersByMunicipality,
  getActiveUserPushTokens,
} from '@/lib/supabase/db';

/**
 * GET /api/votes
 * Get votes, optionally filtered by municipality and status
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const municipality = searchParams.get('municipality');
    const statusParam = searchParams.get('status');
    // Map 'cancelled' to 'ended' for backwards compatibility (DB only has pending/active/ended)
    const status = statusParam === 'cancelled'
      ? 'ended'
      : (statusParam as 'pending' | 'active' | 'ended' | null);

    let votes;

    if (municipality && status) {
      votes = await getVotesByMunicipality(municipality, status);
    } else if (municipality) {
      votes = await getVotesByMunicipality(municipality);
    } else if (status === 'active') {
      votes = await getActiveVotes();
    } else {
      votes = await getActiveVotes();
    }

    // Transform to API response format
    const transformedVotes = votes.map((vote) => ({
      id: vote.id,
      title: vote.title,
      description: vote.description,
      municipality: vote.municipality_id,
      creatorId: vote.creator_id,
      status: vote.status,
      startDate: vote.start_date,
      endDate: vote.end_date,
      participantCount: vote.participant_count,
      createdAt: vote.created_at,
      updatedAt: vote.updated_at,
    }));

    return NextResponse.json({ votes: transformedVotes });
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

    // Only a fully verified resident may raise a vote, and it is always for
    // their OWN municipality (a local issue is raised by a local).
    const creator = await getUserById(session.userId);
    if (!creator) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    if (creator.verification_status !== 'verified') {
      return NextResponse.json(
        { error: 'Only verified residents may create a vote' },
        { status: 403 }
      );
    }
    if (!creator.municipality_id) {
      return NextResponse.json(
        { error: 'Set your municipality before creating a vote' },
        { status: 400 }
      );
    }
    const municipality = creator.municipality_id;

    const body = await request.json();
    const {
      title,
      description,
      options,
      startDate,
      endDate,
      paymentTxId,
    } = body;

    // Validate required fields (municipality is derived from the creator)
    if (!title || !description || !options || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // CRITICAL SECURITY: Validate payment exists, is completed, and belongs to user
    if (!paymentTxId) {
      return NextResponse.json(
        { error: 'Payment required to create a vote' },
        { status: 402 }
      );
    }

    // Verify payment is completed and has correct type
    const paymentVerification = await verifyPaymentCompleted(
      paymentTxId,
      session.userId,
      'vote_creation'
    );

    if (!paymentVerification.valid) {
      console.warn(
        `Payment verification failed for vote creation: ${paymentVerification.error}`,
        { paymentTxId, userId: session.userId }
      );
      return NextResponse.json(
        { error: `Payment verification failed: ${paymentVerification.error}` },
        { status: 402 }
      );
    }

    // Check if payment has already been used (prevents double-spend)
    const paymentUsed = await isPaymentAlreadyUsed(paymentTxId, 'vote_creation');
    if (paymentUsed) {
      console.warn(
        `Payment already used for vote creation: ${paymentTxId}`,
        { userId: session.userId }
      );
      return NextResponse.json(
        { error: 'Payment has already been used' },
        { status: 400 }
      );
    }

    // Create the vote in Supabase
    const vote = await createVote({
      title,
      description,
      municipality_id: municipality,
      creator_id: session.userId,
      status: new Date(startDate) <= new Date() ? 'active' : 'pending',
      start_date: new Date(startDate).toISOString(),
      end_date: new Date(endDate).toISOString(),
      participant_count: 0,
    });

    // Create vote options separately in Supabase
    // Note: vote_options table only has text/votes, no description field
    const createdOptions = await createVoteOptions(
      options.map((opt: { label: string; description?: string }) => ({
        vote_id: vote.id,
        text: opt.label,
        votes: 0,
      }))
    );

    // Notify by email (best-effort — never blocks vote creation)
    try {
      // 1. Creator confirmation (creator fetched + gated above)
      if (creator?.email) {
        await emailService.sendVoteCreatedEmail({
          to: creator.email,
          firstName: creator.first_name || 'יוצר ההצבעה',
          voteTitle: vote.title,
          voteId: vote.id,
          municipality: vote.municipality_id,
          endDate: new Date(vote.end_date),
        });
      }

      // 2. Municipality broadcast — only for votes that are already open.
      // Batched to respect the email provider's rate limits.
      if (vote.status === 'active') {
        const residents = await getUsersByMunicipality(vote.municipality_id);
        const recipients = residents.filter((r) => r.id !== session.userId);
        await sendInBatches(recipients, (r) =>
          emailService.sendVoteNotification({
            to: r.email,
            firstName: r.first_name || 'תושב/ת',
            voteTitle: vote.title,
            voteId: vote.id,
            municipality: vote.municipality_id,
            endDate: new Date(vote.end_date),
          })
        );

        // Push the same residents (best-effort, chunked).
        const tokenLists = await Promise.all(
          recipients.map((r) => getActiveUserPushTokens(r.id))
        );
        const tokens = [...new Set(tokenLists.flat())];
        if (tokens.length > 0) {
          await sendBatchNotifications(tokens, {
            title: '🗳️ הצבעה חדשה בעיר שלכם',
            body: `${vote.municipality_id}: "${vote.title}". הקול שלכם נספר.`,
            data: { type: 'new_vote', voteId: vote.id, screen: `/votes/${vote.id}` },
            channelId: 'votes',
            priority: 'default',
          });
        }
      }
    } catch (notifyError) {
      console.warn('Vote creation notifications failed (non-fatal):', notifyError);
    }

    // Transform to API response format
    // Note: option descriptions are not stored in DB, include from input if provided
    const responseVote = {
      id: vote.id,
      title: vote.title,
      description: vote.description,
      municipality: vote.municipality_id,
      creatorId: vote.creator_id,
      status: vote.status,
      startDate: vote.start_date,
      endDate: vote.end_date,
      participantCount: vote.participant_count,
      options: createdOptions.map((opt, index) => ({
        id: opt.id,
        label: opt.text,
        description: options[index]?.description, // Use input description
        voteCount: opt.votes,
      })),
      createdAt: vote.created_at,
      updatedAt: vote.updated_at,
    };

    return NextResponse.json({ vote: responseVote }, { status: 201 });
  } catch (error) {
    console.error('Error creating vote:', error);
    return NextResponse.json(
      { error: 'Failed to create vote' },
      { status: 500 }
    );
  }
}
