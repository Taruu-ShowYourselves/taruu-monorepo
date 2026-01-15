import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import { qubikService } from '@/services/qubik';
import { emailService } from '@/services/email';
import {
  getVoteWithOptions,
  hasUserParticipated,
  getUserByGoogleId,
  recordUserVote,
  incrementVoteOption,
  updateUser,
} from '@/lib/supabase/db';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  voteParticipationLimiter,
  createRateLimitResponse,
} from '@/lib/rate-limit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/votes/[id]/participate
 * Cast a vote on a specific vote
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting: 3 requests per minute per user
    const rateLimitResult = voteParticipationLimiter.check(session.userId);
    if (rateLimitResult.limited) {
      return createRateLimitResponse(
        rateLimitResult,
        'יותר מדי בקשות להשתתפות בהצבעה. נסו שוב בעוד דקה.'
      );
    }

    const { id: voteId } = await params;
    const body = await request.json();
    const { optionId, paymentTxId, gpsCoordinates } = body;

    // Validate required fields
    if (!optionId || !paymentTxId || !gpsCoordinates) {
      return NextResponse.json(
        { error: 'Missing required fields: optionId, paymentTxId, gpsCoordinates' },
        { status: 400 }
      );
    }

    // Get the vote with options
    const vote = await getVoteWithOptions(voteId);

    if (!vote) {
      return NextResponse.json({ error: 'Vote not found' }, { status: 404 });
    }

    // Check if vote is active
    if (vote.status !== 'active') {
      return NextResponse.json({ error: 'Vote is not active' }, { status: 400 });
    }

    // Check if vote has ended
    if (new Date(vote.end_date) < new Date()) {
      return NextResponse.json({ error: 'Vote has ended' }, { status: 400 });
    }

    // Check if user has already participated
    const alreadyParticipated = await hasUserParticipated(
      session.userId,
      voteId
    );

    if (alreadyParticipated) {
      return NextResponse.json(
        { error: 'You have already participated in this vote' },
        { status: 400 }
      );
    }

    // Validate option exists
    const validOption = vote.options.find((opt) => opt.id === optionId);
    if (!validOption) {
      return NextResponse.json({ error: 'Invalid option' }, { status: 400 });
    }

    // Get user profile
    const user = await getUserByGoogleId(session.googleId);
    if (!user) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 400 }
      );
    }

    // Check user can vote (identity score >= 40)
    if ((user.identity_score || 0) < 40) {
      return NextResponse.json(
        { error: 'Insufficient identity score to vote. Minimum 40 required.' },
        { status: 403 }
      );
    }

    // Create location hash for blockchain
    const locationHash = Buffer.from(
      JSON.stringify({
        lat: gpsCoordinates.latitude,
        lng: gpsCoordinates.longitude,
        timestamp: gpsCoordinates.timestamp,
      })
    ).toString('base64');

    // Record vote on blockchain - this is critical for vote verification
    let voteRecord: { txHash: string };
    try {
      voteRecord = await qubikService.recordVote({
        voteId,
        userId: session.userId,
        optionId,
        locationHash,
        paymentHash: paymentTxId,
      });
    } catch (e) {
      console.error('Failed to record vote on blockchain:', e);
      return NextResponse.json(
        { error: 'Blockchain service unavailable. Vote not recorded. Please try again later.' },
        { status: 503 }
      );
    }

    // Mint Sync tokens (3 tokens for 3 shekel vote)
    try {
      await qubikService.mintTokens({
        walletAddress: user.qubik_wallet_address || '',
        amount: 3,
        reason: 'vote',
      });
    } catch (e) {
      console.warn('Could not mint tokens:', e);
    }

    // Create user vote record in Supabase
    const userVote = await recordUserVote({
      user_id: session.userId,
      vote_id: voteId,
      option_id: optionId,
      payment_id: paymentTxId,
    });

    // Increment vote option count (atomic)
    await incrementVoteOption(optionId);

    // Increment vote participant count
    await supabaseAdmin
      .from('votes')
      .update({
        participant_count: (vote.participant_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', voteId);

    // Send payment receipt email
    try {
      await emailService.sendPaymentReceiptEmail({
        to: user.email,
        firstName: user.first_name || 'User',
        amount: 3,
        type: 'vote',
        receiptUrl: `${process.env.NEXT_PUBLIC_APP_URL}/receipts/${paymentTxId}`,
        tokensEarned: 3,
      });
    } catch (e) {
      console.warn('Could not send receipt email:', e);
    }

    // Return participation in Converge-compatible format
    const participation = {
      id: userVote.id,
      voteId,
      userId: session.userId,
      optionId,
      paymentTxId,
      qubikTxHash: voteRecord.txHash,
      gpsCoordinates: {
        latitude: gpsCoordinates.latitude,
        longitude: gpsCoordinates.longitude,
        timestamp: new Date(gpsCoordinates.timestamp),
      },
      createdAt: userVote.created_at,
    };

    return NextResponse.json({
      success: true,
      participation,
      txHash: voteRecord.txHash,
      tokensEarned: 3,
    });
  } catch (error) {
    console.error('Error participating in vote:', error);
    return NextResponse.json(
      { error: 'Failed to participate in vote' },
      { status: 500 }
    );
  }
}
