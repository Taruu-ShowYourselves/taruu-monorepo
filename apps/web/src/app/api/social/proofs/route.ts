import { NextRequest, NextResponse } from 'next/server';
import {
  getIdentityLevelForTotal,
  IDENTITY_SCORE_WEIGHTS,
  GPS_SCORE_WEIGHT,
  PHONE_SCORE_WEIGHT,
  ID_DOCUMENT_SCORE_WEIGHT,
} from '@sync/shared';
import { getSessionFromRequest } from '@/services/auth/session';
import {
  getUserById,
  getSocialProofsByUserId,
  deleteSocialProof,
} from '@/lib/supabase/db';

/**
 * GET /api/social/proofs
 * Get user's social proofs and identity score
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserById(session.userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get social proofs from Supabase
    const socialProofs = await getSocialProofsByUserId(user.id);

    // Full six-field breakdown (issue #71 final model): social weights plus the
    // GPS / phone / approved-document evidence that the DB-owned total already
    // counts, so breakdown and total describe the same score rather than a
    // socials-only subset that would zero a user's other evidence client-side.
    const breakdown = {
      gps: user.verification_status === 'verified' ? GPS_SCORE_WEIGHT : 0,
      google: socialProofs.some((p) => p.provider === 'google')
        ? IDENTITY_SCORE_WEIGHTS.google
        : 0,
      facebook: socialProofs.some((p) => p.provider === 'facebook')
        ? IDENTITY_SCORE_WEIGHTS.facebook
        : 0,
      instagram: socialProofs.some((p) => p.provider === 'instagram')
        ? IDENTITY_SCORE_WEIGHTS.instagram
        : 0,
      phone: user.phone_verified === true ? PHONE_SCORE_WEIGHT : 0,
      idDocument: user.identity_verified_at != null ? ID_DOCUMENT_SCORE_WEIGHT : 0,
    };

    // Total comes from the DB-owned canonical score; level from shared bands
    const total = user.identity_score;
    const level = getIdentityLevelForTotal(total);

    return NextResponse.json({
      socialProofs: socialProofs.map((p) => ({
        platform: p.provider,
        providerId: p.provider_id,
        displayName: p.provider_name,
        profileImage: p.provider_avatar,
        email: p.provider_email,
        connectedAt: p.connected_at,
      })),
      identityScore: {
        total,
        breakdown,
        level,
        lastCalculated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching social proofs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch social proofs' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/social/proofs
 * Disconnect a social platform
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') as
      | 'google'
      | 'facebook'
      | 'instagram'
      | null;

    if (!platform || !['facebook', 'instagram'].includes(platform)) {
      return NextResponse.json(
        { error: 'Invalid platform. Must be facebook or instagram.' },
        { status: 400 }
      );
    }

    // Cannot disconnect Google (required)
    if (platform === 'google') {
      return NextResponse.json(
        { error: 'Cannot disconnect Google. It is required for authentication.' },
        { status: 400 }
      );
    }

    const user = await getUserById(session.userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Delete the social proof from Supabase (trigger auto-updates identity score)
    await deleteSocialProof(user.id, platform);

    // Get updated social proofs
    const updatedProofs = await getSocialProofsByUserId(user.id);
    const updatedUser = await getUserById(user.id);

    // Full six-field breakdown (issue #71 final model), consistent with the
    // DB-owned total; evidence columns come from the freshly re-read user row.
    const breakdown = {
      gps: updatedUser?.verification_status === 'verified' ? GPS_SCORE_WEIGHT : 0,
      google: updatedProofs.some((p) => p.provider === 'google')
        ? IDENTITY_SCORE_WEIGHTS.google
        : 0,
      facebook: updatedProofs.some((p) => p.provider === 'facebook')
        ? IDENTITY_SCORE_WEIGHTS.facebook
        : 0,
      instagram: updatedProofs.some((p) => p.provider === 'instagram')
        ? IDENTITY_SCORE_WEIGHTS.instagram
        : 0,
      phone: updatedUser?.phone_verified === true ? PHONE_SCORE_WEIGHT : 0,
      idDocument: updatedUser?.identity_verified_at != null ? ID_DOCUMENT_SCORE_WEIGHT : 0,
    };

    const total = updatedUser?.identity_score || 0;
    const level = getIdentityLevelForTotal(total);

    return NextResponse.json({
      success: true,
      socialProofs: updatedProofs.map((p) => ({
        platform: p.provider,
        providerId: p.provider_id,
        displayName: p.provider_name,
        connectedAt: p.connected_at,
      })),
      identityScore: {
        total,
        breakdown,
        level,
        lastCalculated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error disconnecting social platform:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect platform' },
      { status: 500 }
    );
  }
}
