/**
 * GET /api/space-admin/{spaceId} - the dashboard shell and its figures.
 *
 * Thin imperative shell: session → use-case → respond. All authorization lives
 * in the use-case, which resolves membership per request against the database;
 * the JWT carries no roles claim, so a stale token can never carry stale
 * authority.
 */

import type { NextRequest } from 'next/server';
import { errAsync } from 'neverthrow';
import { getSessionFromRequest } from '@/services/auth/session';
import { respond } from '@/server/http/respond';
import { unauthorized } from '@/server/http/errors';
import { getSpaceOverview } from '@/server/app/space-admin/get-space-overview';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));

  const { spaceId } = await params;
  return respond(getSpaceOverview(session, spaceId));
}
