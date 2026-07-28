import { NextRequest } from 'next/server';
import { respond } from '@/server/http/respond';
import { getMunicipalityProfile } from '@/server/app/municipality/get-profile';

/**
 * GET /api/municipalities/[municipality]
 * Public civic profile: satisfaction, engagement, time-to-engagement,
 * and the municipality's open + closed votes with results.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ municipality: string }> }
) {
  const { municipality } = await params;
  return respond(getMunicipalityProfile(municipality), {
    cacheControl: 'public, s-maxage=300, stale-while-revalidate=600',
  });
}
