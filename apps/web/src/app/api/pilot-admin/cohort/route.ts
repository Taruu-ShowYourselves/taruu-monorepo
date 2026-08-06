import type { NextRequest } from 'next/server';
import { CurateCohortRequestSchema } from '@sync/shared/contracts';
import { curatePilotCohort } from '@/server/app/pilot/curate-cohort';
import { requirePilotAdmin } from '@/server/app/pilot/authorize';
import { listCohort } from '@/server/infra/supabase/pilot.repo';
import { parse, respond } from '@/server/http/respond';
import { getSessionFromRequest } from '@/services/auth/session';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  return respond(
    requirePilotAdmin(session).andThen(() =>
      listCohort().map((cohort) => ({ cohort }))
    )
  );
}

export async function PUT(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  const body = await request.json().catch(() => null);
  return respond(
    parse(CurateCohortRequestSchema, body).asyncAndThen((command) =>
      curatePilotCohort(session, command)
    )
  );
}
