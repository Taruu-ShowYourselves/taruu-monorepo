/**
 * POST /api/space-admin/{spaceId}/proposals/{voteId}/content — hide, unhide,
 * flag or unflag a proposal's content.
 *
 * The UI for this lives inside the proposal detail panel rather than on a
 * surface of its own, per the locked "no seventh route" decision. That decision
 * is about the dashboard's URL space, not the API's: the authority being
 * exercised is distinct from deciding a proposal, so it gets its own endpoint
 * and its own capability.
 */

import type { NextRequest } from 'next/server';
import { errAsync } from 'neverthrow';
import { ModerateContentRequestSchema } from '@sync/shared/contracts';
import { getSessionFromRequest } from '@/services/auth/session';
import { parse, respond } from '@/server/http/respond';
import { unauthorized } from '@/server/http/errors';
import { moderateContent } from '@/server/app/space-admin/moderate-content';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string; voteId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));

  const { spaceId, voteId } = await params;
  const body = await request.json().catch(() => null);

  const parsed = parse(ModerateContentRequestSchema, body);
  if (parsed.isErr()) return respond(errAsync(parsed.error));

  return respond(moderateContent(session, spaceId, voteId, parsed.value));
}
