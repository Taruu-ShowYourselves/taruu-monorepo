import { NextRequest } from 'next/server';
import { getPublicCouncilProfile } from '@/server/app/council/get-public-profile';
import { respond } from '@/server/http/respond';

/**
 * Public aggregate-only council profile. No session is required and the
 * allow-listed response contract contains no individual or payment rows.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  const { identifier } = await params;
  return respond(getPublicCouncilProfile(identifier, 'he'), {
    cacheControl: 'public, s-maxage=300, stale-while-revalidate=600',
  });
}
