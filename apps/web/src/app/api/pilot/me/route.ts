import type { NextRequest } from 'next/server';
import { errAsync } from 'neverthrow';
import { findPilotRegistration } from '@/server/infra/supabase/pilot-registration.repo';
import { respond } from '@/server/http/respond';
import { unauthorized } from '@/server/http/errors';
import { getSessionFromRequest } from '@/services/auth/session';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  return respond(session ? findPilotRegistration(session.userId).map((registration) => ({ registration })) : errAsync(unauthorized()));
}
