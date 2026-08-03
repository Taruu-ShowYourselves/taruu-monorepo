/**
 * GET /api/space-admin/{spaceId}/proposals/{voteId} — the detail panel.
 *
 * What `?proposal={id}` deep-links resolve against, including the links an
 * audit-log row carries back to its subject. An id this space cannot resolve
 * answers 403 rather than 404, so the endpoint cannot be used to confirm that a
 * vote exists in some other space.
 */

import type { NextRequest } from 'next/server';
import { errAsync } from 'neverthrow';
import { ProposalSummarySchema } from '@sync/shared/contracts';
import { getProposalDetail } from '@/server/app/space-admin/decide-proposal';
import { forbidden, unauthorized } from '@/server/http/errors';
import { parse, respond } from '@/server/http/respond';
import { getSessionFromRequest } from '@/services/auth/session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string; voteId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));

  const { spaceId, voteId } = await params;
  const id = parse(ProposalSummarySchema.shape.id, voteId);
  if (id.isErr()) return respond(errAsync(forbidden()));

  return respond(getProposalDetail(session, spaceId, id.value));
}
