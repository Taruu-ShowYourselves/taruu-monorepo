/**
 * GET /api/space-admin/{spaceId}/audit - the space's action history.
 *
 * Thin imperative shell: session → zod parse → use-case → respond. Filters and
 * the cursor travel in the query string so a filtered view is linkable and
 * back-button-correct; the space predicate does not, because it is read off the
 * `SpaceScope` the use-case mints rather than off anything the caller sent.
 */

import type { NextRequest } from 'next/server';
import { errAsync } from 'neverthrow';
import {
  AuditListQuerySchema,
  listSpaceAudit,
} from '@/server/app/space-admin/list-audit';
import { unauthorized } from '@/server/http/errors';
import { parse, respond } from '@/server/http/respond';
import { getSessionFromRequest } from '@/services/auth/session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));

  const { spaceId } = await params;

  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = parse(AuditListQuerySchema, query);
  if (parsed.isErr()) return respond(errAsync(parsed.error));

  return respond(listSpaceAudit(session, spaceId, parsed.value));
}
