import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import {
  getUserByGoogleId,
  createUser,
  updateUser,
  getSocialProofsByUserId,
  createSocialProof,
  updateUserIdentityScore,
} from '@/lib/supabase/db';
import type { User, SocialProof as DbSocialProof } from '@/lib/supabase/types';
import { qubikService } from '@/services/qubik';
import { emailService } from '@/services/email';
import { calculateIdentityScore, IDENTITY_SCORE_WEIGHTS, MUNICIPALITIES } from '@sync/shared';
import type { SocialProof, VerificationStatus, IdentityScore, NotificationSettings } from '@sync/shared';

/**
 * Transform Supabase user + social proofs to API profile format
 */
function transformToProfile(
  user: User,
  socialProofs: DbSocialProof[],
  tokenBalance: number = 0
) {
  // Transform social proofs from DB format to API format
  const transformedProofs: SocialProof[] = socialProofs.map((proof) => ({
    platform: proof.provider,
    providerId: proof.provider_id,
    displayName: proof.provider_name || proof.provider_email || '',
    email: proof.provider_email || undefined,
    profileUrl: undefined,
    profileImage: proof.provider_avatar || undefined,
    connectedAt: new Date(proof.connected_at),
    stampWeight: IDENTITY_SCORE_WEIGHTS[proof.provider] || 0,
  }));

  // Calculate identity score from social proofs
  const identityScore = calculateIdentityScore(transformedProofs);

  // Build verification status from DB enum
  const verificationStatus: VerificationStatus = {
    phase: user.verification_status === 'verified' ? 'completed' :
           user.verification_status === 'pending' ? 'in_progress' :
           user.verification_status === 'failed' ? 'failed' : 'not_started',
    checkInsCompleted: 0,
    checkInsTotal: 0,
  };

  return {
    id: user.id,
    googleId: user.google_id,
    did: user.did,
    qubikWalletAddress: user.qubik_wallet_address,
    firstName: user.first_name || '',
    lastName: user.last_name || '',
    email: user.email,
    phone: user.phone,
    municipality: user.municipality_id,
    city: user.city,
    avatarUrl: user.avatar_url,
    notificationSettings: (user.notification_settings as NotificationSettings | null) ?? undefined,
    verificationStatus,
    socialProofs: transformedProofs,
    identityScore,
    syncTokenBalance: tokenBalance,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

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

    const user = await getUserByGoogleId(session.googleId);

    if (!user) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get social proofs for identity score calculation
    const socialProofs = await getSocialProofsByUserId(user.id);

    // Get token balance from blockchain
    let tokenBalance = 0;
    if (user.qubik_wallet_address) {
      try {
        tokenBalance = await qubikService.getTokenBalance(
          user.qubik_wallet_address
        );
      } catch (e) {
        // Qubik might not be configured in dev
        console.warn('Could not fetch token balance:', e);
      }
    }

    const profile = transformToProfile(user, socialProofs, tokenBalance);

    return NextResponse.json({ profile });
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
    const existingUser = await getUserByGoogleId(session.googleId);

    if (existingUser) {
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

    // Create Qubik wallet - required for token operations
    let walletAddress: string;
    try {
      walletAddress = await qubikService.createWallet(session.userId);
    } catch (e) {
      console.error('Failed to create Qubik wallet:', e);
      return NextResponse.json(
        { error: 'Wallet service unavailable. Please try again later.' },
        { status: 503 }
      );
    }

    // Create user in Supabase
    const user = await createUser({
      google_id: session.googleId,
      did: session.did,
      qubik_wallet_address: walletAddress,
      first_name: firstName || '',
      last_name: lastName || '',
      email: session.email,
      phone: phone || null,
      municipality_id: municipality,
      identity_score: IDENTITY_SCORE_WEIGHTS.google, // Initial score from Google
      verification_status: 'none',
    });

    // Create Google social proof
    await createSocialProof({
      user_id: user.id,
      provider: 'google',
      provider_id: session.googleId,
      provider_email: session.email,
      provider_name: session.email,
    });

    // Get the created social proofs for response
    const socialProofs = await getSocialProofsByUserId(user.id);

    // Send welcome email
    try {
      await emailService.sendWelcomeEmail({
        to: user.email,
        firstName: user.first_name || '',
      });
    } catch (e) {
      console.warn('Could not send welcome email:', e);
    }

    const profile = transformToProfile(user, socialProofs, 0);

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

    const user = await getUserByGoogleId(session.googleId);

    if (!user) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();

    // Map camelCase input to snake_case database fields
    const fieldMapping: Record<string, string> = {
      firstName: 'first_name',
      lastName: 'last_name',
      phone: 'phone',
      municipality: 'municipality_id',
      city: 'city',
    };

    const updates: Record<string, unknown> = {};

    for (const [inputKey, dbKey] of Object.entries(fieldMapping)) {
      if (body[inputKey] !== undefined) {
        updates[dbKey] = body[inputKey];
      }
    }

    // municipality_id is FK-constrained to the municipalities table — reject
    // unknown values here with a 400 instead of surfacing a DB error.
    if (
      updates.municipality_id !== undefined &&
      updates.municipality_id !== null &&
      !(MUNICIPALITIES as readonly string[]).includes(
        String(updates.municipality_id)
      )
    ) {
      return NextResponse.json(
        { error: 'Unknown municipality' },
        { status: 400 }
      );
    }

    // notificationSettings is a JSON object, not a scalar string field
    if (body.notificationSettings !== undefined) {
      updates.notification_settings = body.notificationSettings;
    }

    // Municipality satisfaction rating (onboarding question), 1-5 integer
    if (body.municipalityRating !== undefined) {
      const rating = body.municipalityRating;
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return NextResponse.json(
          { error: 'municipalityRating must be an integer between 1 and 5' },
          { status: 400 }
        );
      }
      updates.municipality_rating = rating;
      updates.municipality_rated_at = new Date().toISOString();
    }

    if (Object.keys(updates).length === 0) {
      // No valid updates provided, return current profile
      const socialProofs = await getSocialProofsByUserId(user.id);
      const profile = transformToProfile(user, socialProofs);
      return NextResponse.json({ profile });
    }

    const updatedUser = await updateUser(user.id, updates);

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    // Get social proofs for the response
    const socialProofs = await getSocialProofsByUserId(updatedUser.id);

    // Get token balance for the response
    let tokenBalance = 0;
    if (updatedUser.qubik_wallet_address) {
      try {
        tokenBalance = await qubikService.getTokenBalance(
          updatedUser.qubik_wallet_address
        );
      } catch (e) {
        console.warn('Could not fetch token balance:', e);
      }
    }

    const profile = transformToProfile(updatedUser, socialProofs, tokenBalance);

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
