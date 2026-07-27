import { NextRequest, NextResponse } from 'next/server';
import {
  countRegisteredUsers,
  countRegisteredUsersByMunicipality,
} from '@/lib/supabase/db';
import { MUNICIPALITY_MIN_COHORT, MAX_MUNICIPALITY_LENGTH } from '@/lib/stats';

/**
 * GET /api/stats/registrations
 *
 * How many people have registered on the platform, optionally narrowed to one
 * municipality. Public endpoint — no authentication required, matching
 * /api/stats/network.
 *
 * Aggregate counts only. No user row, id, name or any other per-user field is
 * read or returned, so there is nothing here to scope to a caller.
 *
 * Query parameters:
 * - municipality: optional municipality id to report alongside the total
 *
 * Response:
 *   registeredTotal            platform-wide count
 *   municipality               echo of the requested municipality (or null)
 *   registeredInMunicipality   count, or null when withheld
 *   municipalityWithheld       true when the cohort is below the floor
 */
export async function GET(request: NextRequest) {
  try {
    const requested = request.nextUrl.searchParams.get('municipality')?.trim();
    const municipality =
      requested && requested.length > 0 && requested.length <= MAX_MUNICIPALITY_LENGTH
        ? requested
        : null;

    const [registeredTotal, municipalityCount] = await Promise.all([
      countRegisteredUsers(),
      municipality ? countRegisteredUsersByMunicipality(municipality) : Promise.resolve(null),
    ]);

    // Withhold small cohorts. Note the total is NOT floored: an aggregate over
    // the whole country identifies nobody.
    const municipalityWithheld =
      municipalityCount !== null && municipalityCount < MUNICIPALITY_MIN_COHORT;

    return NextResponse.json({
      stats: {
        registeredTotal,
        municipality,
        registeredInMunicipality: municipalityWithheld ? null : municipalityCount,
        municipalityWithheld,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching registration stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch registration statistics' },
      { status: 500 }
    );
  }
}
