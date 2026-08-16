/**
 * GET /api/space-admin/{spaceId}/metrics - aggregate-only statistics.
 *
 * Thin imperative shell: session → use-case → respond. There is no query
 * vocabulary here on purpose. A filter, a breakdown or a date range would each
 * be the first step of a drill-down, and SPACE-07 says this surface does not
 * have one.
 */

import type { NextRequest } from 'next/server';
import { errAsync } from 'neverthrow';
import { getSpaceMetrics } from '@/server/app/space-admin/get-metrics';
import { unauthorized } from '@/server/http/errors';
import { respond } from '@/server/http/respond';
import { getSessionFromRequest } from '@/services/auth/session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));

  const { spaceId } = await params;

  return respond(getSpaceMetrics(session, spaceId));
}
