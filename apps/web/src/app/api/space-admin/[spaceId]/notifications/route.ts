/**
 * GET /api/space-admin/{spaceId}/notifications - past dispatches and the quota.
 *
 * Feeds the composer's history list and, before any preview exists, composer
 * state 0: the exhausted-quota block needs `{used}/{limit}` and a reset date to
 * explain why there is no send control. The list is capped inside the use-case;
 * there is no caller-supplied limit, because this is a header and not an archive.
 */

import type { NextRequest } from 'next/server';
import { errAsync } from 'neverthrow';
import { listSentCampaigns } from '@/server/app/space-admin/send-notification';
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

  return respond(listSentCampaigns(session, spaceId));
}
