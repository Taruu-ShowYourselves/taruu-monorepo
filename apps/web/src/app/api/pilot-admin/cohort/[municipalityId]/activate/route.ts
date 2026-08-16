import type { NextRequest } from 'next/server';
import { activatePilotMunicipality } from '@/server/app/pilot/transition-cohort';
import { respond } from '@/server/http/respond';
import { getSessionFromRequest } from '@/services/auth/session';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ municipalityId: string }> }
) {
  const session = await getSessionFromRequest(request);
  const { municipalityId } = await params;
  return respond(activatePilotMunicipality(session, municipalityId));
}
