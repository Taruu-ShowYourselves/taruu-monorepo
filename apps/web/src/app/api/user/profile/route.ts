import { NextRequest, NextResponse } from 'next/server';
import {
  getSessionFromRequest,
  getSessionFromCookies,
} from '@/services/auth/session';
import { convergeService } from '@/services/converge';
import { qubikService } from '@/services/qubik';
import { emailService } from '@/services/email';

/**
 * GET /api/user/profile
 * Get the current user's profile
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await convergeService.getUserByGoogleId(session.googleId);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get token balance from blockchain
    let tokenBalance = 0;
    try {
      tokenBalance = await qubikService.getTokenBalance(
        profile.qubikWalletAddress
      );
    } catch (e) {
      // Qubik might not be configured in dev
      console.warn('Could not fetch token balance:', e);
    }

    return NextResponse.json({
      profile: {
        ...profile,
        syncTokenBalance: tokenBalance,
      },
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/profile
 * Create a new user profile (called after Google signup)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if profile already exists
    const existingProfile = await convergeService.getUserByGoogleId(
      session.googleId
    );

    if (existingProfile) {
      return NextResponse.json(
        { error: 'Profile already exists' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { municipality, firstName, lastName, phone } = body;

    if (!municipality) {
      return NextResponse.json(
        { error: 'Municipality is required' },
        { status: 400 }
      );
    }

    // Create Qubik wallet
    let walletAddress = '';
    try {
      walletAddress = await qubikService.createWallet(session.userId);
    } catch (e) {
      // Qubik might not be configured in dev
      console.warn('Could not create Qubik wallet:', e);
      walletAddress = `mock-wallet-${session.userId}`;
    }

    // Create profile
    const profile = await convergeService.createUser({
      googleId: session.googleId,
      did: session.did,
      qubikWalletAddress: walletAddress,
      firstName: firstName || '',
      lastName: lastName || '',
      email: session.email,
      phone,
      municipality,
      verificationStatus: {
        phase: 'not_started',
        checkInsCompleted: 0,
        checkInsTotal: 0,
      },
      socialProofs: [
        {
          platform: 'google' as const,
          platformUserId: session.googleId,
          displayName: session.email,
          email: session.email,
          verifiedAt: new Date(),
          stampWeight: 40,
        },
      ],
      identityScore: {
        total: 40,
        breakdown: {
          google: 40,
          facebook: 0,
          instagram: 0,
        },
        level: 'basic' as const,
      },
      syncTokenBalance: 0,
    });

    // Send welcome email
    try {
      await emailService.sendWelcomeEmail({
        to: profile.email,
        firstName: profile.firstName,
      });
    } catch (e) {
      console.warn('Could not send welcome email:', e);
    }

    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    console.error('Error creating profile:', error);
    return NextResponse.json(
      { error: 'Failed to create profile' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/profile
 * Update the current user's profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await convergeService.getUserByGoogleId(session.googleId);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const allowedUpdates = ['firstName', 'lastName', 'phone', 'municipality'];

    const updates: Record<string, unknown> = {};

    for (const key of allowedUpdates) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    const updatedProfile = await convergeService.updateUser(profile.id, updates);

    return NextResponse.json({ profile: updatedProfile });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
