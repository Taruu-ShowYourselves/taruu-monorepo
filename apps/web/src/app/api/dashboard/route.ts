import { NextRequest } from 'next/server';
import { errAsync } from 'neverthrow';
import { getSessionFromRequest } from '@/services/auth/session';
import { respond } from '@/server/http/respond';
import { unauthorized } from '@/server/http/errors';
import { getDashboard } from '@/server/app/dashboard/get-dashboard';

/**
 * GET /api/dashboard
 * The dashboard aggregate — everything the dashboard renders, one call.
 */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));
  return respond(getDashboard(session.userId));
}
