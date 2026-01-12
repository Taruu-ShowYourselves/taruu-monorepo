import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import { convergeService } from '@/services/converge';
import { qubikService } from '@/services/qubik';
import { emailService } from '@/services/email';

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

    // Get the vote
    const vote = await convergeService.getVote(voteId);

    if (!vote) {
      return NextResponse.json({ error: 'Vote not found' }, { status: 404 });
    }

    // Check if vote is active
    if (vote.status !== 'active') {
      return NextResponse.json({ error: 'Vote is not active' }, { status: 400 });
    }

    // Check if vote has ended
    if (new Date(vote.endDate) < new Date()) {
      return NextResponse.json({ error: 'Vote has ended' }, { status: 400 });
    }

    // Check if user has already participated
    const hasParticipated = await convergeService.hasUserParticipated(
      voteId,
      session.userId
    );

    if (hasParticipated) {
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
    const user = await convergeService.getUserByGoogleId(session.googleId);
    if (!user) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 400 }
      );
    }

    // Check user can vote (identity score >= 40)
    if (user.identityScore.total < 40) {
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

    // Record vote on blockchain
    let voteRecord = { txHash: `mock-tx-${Date.now()}` };
    try {
      voteRecord = await qubikService.recordVote({
        voteId,
        oderId: session.userId,
        optionId,
        locationHash,
        paymentHash: paymentTxId,
      });
    } catch (e) {
      console.warn('Could not record vote on blockchain:', e);
    }

    // Mint Sync tokens (3 tokens for 3 shekel vote)
    try {
      await qubikService.mintTokens({
        walletAddress: user.qubikWalletAddress,
        amount: 3,
        reason: 'vote',
      });
    } catch (e) {
      console.warn('Could not mint tokens:', e);
    }

    // Create participation record
    const participation = await convergeService.createParticipation({
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
    });

    // Increment vote count
    await convergeService.incrementVoteCount(voteId, optionId);

    // Update user token balance
    await convergeService.updateUser(user.id, {
      syncTokenBalance: user.syncTokenBalance + 3,
    });

    // Send payment receipt email
    try {
      await emailService.sendPaymentReceiptEmail({
        to: user.email,
        firstName: user.firstName,
        amount: 3,
        type: 'vote',
        receiptUrl: `${process.env.NEXT_PUBLIC_APP_URL}/receipts/${paymentTxId}`,
        tokensEarned: 3,
      });
    } catch (e) {
      console.warn('Could not send receipt email:', e);
    }

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
