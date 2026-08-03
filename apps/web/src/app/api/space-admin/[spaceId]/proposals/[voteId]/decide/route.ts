/**
 * POST /api/space-admin/{spaceId}/proposals/{voteId}/decide
 *
 * Thin imperative shell: session → parse → use-case → respond. Every guard that
 * decides whether this decision may happen lives in the use-case, so nothing
 * here can be forgotten by a second caller.
 *
 * A malformed vote id refuses with the same opaque 403 as an unauthorized one
 * rather than a 400: on this surface the shape of an id must not be a signal
 * about whether it names anything.
 */

import type { NextRequest } from 'next/server';
import { errAsync } from 'neverthrow';
import {
  DecideProposalRequestSchema,
  ProposalSummarySchema,
} from '@sync/shared/contracts';
import { decideProposal } from '@/server/app/space-admin/decide-proposal';
import { forbidden, unauthorized } from '@/server/http/errors';
import { parse, respond } from '@/server/http/respond';
import { getSessionFromRequest } from '@/services/auth/session';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string; voteId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));

  const { spaceId, voteId } = await params;
  const id = parse(ProposalSummarySchema.shape.id, voteId);
  if (id.isErr()) return respond(errAsync(forbidden()));

  const body = await request.json().catch(() => null);
  const parsed = parse(DecideProposalRequestSchema, body);
  if (parsed.isErr()) return respond(errAsync(parsed.error));

  return respond(decideProposal(session, spaceId, id.value, parsed.value));
}
