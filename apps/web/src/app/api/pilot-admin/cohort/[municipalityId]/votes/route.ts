import type { NextRequest } from 'next/server';
import { SetPilotVotesRequestSchema } from '@sync/shared/contracts';
import { selectPilotVotes } from '@/server/app/pilot/select-votes';
import { parse, respond } from '@/server/http/respond';
import { getSessionFromRequest } from '@/services/auth/session';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ municipalityId: string }> }
) {
  const session = await getSessionFromRequest(request);
  const { municipalityId } = await params;
  const body = await request.json().catch(() => null);
  return respond(
    parse(SetPilotVotesRequestSchema, body).asyncAndThen((command) =>
      selectPilotVotes(session, municipalityId, command)
    )
  );
}
