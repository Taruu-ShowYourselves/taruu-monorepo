import type { NextRequest } from 'next/server';
import { getPilotRanking } from '@/server/app/pilot/ranking';
import { respond } from '@/server/http/respond';
import { getSessionFromRequest } from '@/services/auth/session';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  return respond(getPilotRanking(session));
}
