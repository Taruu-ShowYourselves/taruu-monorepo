import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { convergeService } from '@/services/converge';
import { qubikService } from '@/services/qubik';
import { emailService } from '@/services/email';

/**
 * GET /api/user/profile
 * Get the current user's profile
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const profile = await convergeService.getUserByClerkId(userId);

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Get token balance from blockchain
    const tokenBalance = await qubikService.getTokenBalance(profile.qubikWalletAddress);

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
 * Create a new user profile (called after Clerk signup)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if profile already exists
    const existingProfile = await convergeService.getUserByClerkId(userId);

    if (existingProfile) {
      return NextResponse.json(
        { error: 'Profile already exists' },
        { status: 400 }
      );
    }

    const user = await currentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { municipality } = body;

    if (!municipality) {
      return NextResponse.json(
        { error: 'Municipality is required' },
        { status: 400 }
      );
    }

    // Create Qubik wallet
    const walletAddress = await qubikService.createWallet(userId);

    // Create profile
    const profile = await convergeService.createUser({
      clerkId: userId,
      qubikWalletAddress: walletAddress,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.emailAddresses[0]?.emailAddress || '',
      phone: user.phoneNumbers[0]?.phoneNumber,
      municipality,
      verificationStatus: 'pending',
      socialConnections: [],
      syncTokenBalance: 0,
    });

    // Send welcome email
    await emailService.sendWelcomeEmail({
      to: profile.email,
      firstName: profile.firstName,
    });

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
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const profile = await convergeService.getUserByClerkId(userId);

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const allowedUpdates = ['firstName', 'lastName', 'phone', 'municipality'];

    const updates: Record<string, any> = {};

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
