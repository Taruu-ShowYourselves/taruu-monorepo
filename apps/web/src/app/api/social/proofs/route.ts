import { NextRequest, NextResponse } from 'next/server';
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

    // Calculate breakdown from proofs
    const breakdown = {
      google: socialProofs.some((p) => p.provider === 'google') ? 40 : 0,
      facebook: socialProofs.some((p) => p.provider === 'facebook') ? 30 : 0,
      instagram: socialProofs.some((p) => p.provider === 'instagram') ? 30 : 0,
    };

    // Determine level
    const total = user.identity_score;
    const level = total >= 100 ? 'trusted' : total >= 70 ? 'verified' : 'basic';

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

    // Calculate breakdown
    const breakdown = {
      google: updatedProofs.some((p) => p.provider === 'google') ? 40 : 0,
      facebook: updatedProofs.some((p) => p.provider === 'facebook') ? 30 : 0,
      instagram: updatedProofs.some((p) => p.provider === 'instagram') ? 30 : 0,
    };

    const total = updatedUser?.identity_score || 0;
    const level = total >= 100 ? 'trusted' : total >= 70 ? 'verified' : 'basic';

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
