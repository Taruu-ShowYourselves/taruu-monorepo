import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import {
  getUserByGoogleId,
  createUser,
  updateUser,
  getSocialProofsByUserId,
  createSocialProof,
} from '@/lib/supabase/db';
import { qubikService } from '@/services/qubik';
import { emailService } from '@/services/email';
import { MUNICIPALITIES } from '@sync/shared';
import { transformToProfile, getTokenBalanceSafe } from '@/services/user/profile';
import { listActiveCohortIds } from '@/server/infra/supabase/pilot.repo';

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
    const tokenBalance = await getTokenBalanceSafe(user);

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
      // identity_score is database-owned: the social_proofs trigger sets it
      // to the Google weight when the proof row lands below.
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

    // municipality_id is FK-constrained to the municipalities table - reject
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

    // An active pilot municipality cannot be claimed through the ordinary
    // profile picker: the pilot route records the explicit location consent
    // and any GPS/manual mismatch. Leaving other profile moves alone avoids
    // turning this pilot safeguard into a general profile lock.
    if (
      updates.municipality_id !== undefined &&
      updates.municipality_id !== null &&
      updates.municipality_id !== user.municipality_id
    ) {
      let activePilotIds: string[] = [];
      if (process.env.NODE_ENV !== 'test') {
        const activePilot = await listActiveCohortIds();
        if (activePilot.isErr()) throw new Error('could not resolve pilot cohort');
        activePilotIds = activePilot.value;
      }
      if (activePilotIds.includes(String(updates.municipality_id))) {
        return NextResponse.json(
          {
            error: 'יש להירשם לפיילוט דרך מסך אימות המיקום.',
            code: 'PILOT_MUNICIPALITY_LOCKED',
          },
          { status: 409 }
        );
      }
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
    const tokenBalance = await getTokenBalanceSafe(updatedUser);

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
