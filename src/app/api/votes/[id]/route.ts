import { NextRequest, NextResponse } from 'next/server';
import { convergeService } from '@/services/converge';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/votes/[id]
 * Get a specific vote by ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const vote = await convergeService.getVote(id);

    if (!vote) {
      return NextResponse.json(
        { error: 'Vote not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ vote });
  } catch (error) {
    console.error('Error fetching vote:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vote' },
      { status: 500 }
    );
  }
}
