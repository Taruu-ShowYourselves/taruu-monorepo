import type { NextRequest } from 'next/server';
import { PilotRegisterRequestSchema } from '@sync/shared/contracts';
import { registerPilot } from '@/server/app/pilot/register';
import { parse, respond } from '@/server/http/respond';
import { getSessionFromRequest } from '@/services/auth/session';

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  const body = await request.json().catch(() => null);
  return respond(
    parse(PilotRegisterRequestSchema, body).asyncAndThen((command) =>
      registerPilot(session, command, request.cookies.get('taruu_ref')?.value ?? null)
    )
  );
}
