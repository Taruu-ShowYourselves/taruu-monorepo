/**
 * GET /api/space-admin/{spaceId}/proposals - the review queue.
 *
 * Thin imperative shell: session → zod parse → use-case → respond. The space
 * predicate never appears here; it is read off the `SpaceScope` the use-case
 * mints, which is the only value the repository will accept.
 */

import type { NextRequest } from 'next/server';
import { errAsync } from 'neverthrow';
import { getSessionFromRequest } from '@/services/auth/session';
import { parse, respond } from '@/server/http/respond';
import { unauthorized } from '@/server/http/errors';
import {
  listSpaceProposals,
  ProposalListQuerySchema,
} from '@/server/app/space-admin/list-proposals';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));

  const { spaceId } = await params;

  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = parse(ProposalListQuerySchema, query);
  if (parsed.isErr()) return respond(errAsync(parsed.error));

  return respond(listSpaceProposals(session, spaceId, parsed.value));
}
