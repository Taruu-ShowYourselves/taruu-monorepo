/**
 * GET /api/space-admin/{spaceId}/members — the members surface.
 *
 * Thin imperative shell: session → zod parse → use-case → respond. The space
 * predicate never appears here; it is read off the `SpaceScope` the use-case
 * mints, which is the only value the repository accepts.
 *
 * The one addition to the usual shape is the final pass through
 * `SpaceMemberListResponseSchema`. Zod strips keys the schema does not name, so
 * that parse is the last enforcement of the privacy allow-list before anything
 * reaches the wire: a future edit that lets a private column through the
 * repository and the use-case still cannot get it past this line.
 */

import type { NextRequest } from 'next/server';
import { err, errAsync, ok } from 'neverthrow';
import { SpaceMemberListResponseSchema } from '@sync/shared/contracts';
import { getSessionFromRequest } from '@/services/auth/session';
import { parse, respond } from '@/server/http/respond';
import { internal, unauthorized } from '@/server/http/errors';
import {
  getSpaceMembers,
  MemberListQuerySchema,
} from '@/server/app/space-admin/list-members';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));

  const { spaceId } = await params;

  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = parse(MemberListQuerySchema, query);
  if (parsed.isErr()) return respond(errAsync(parsed.error));

  return respond(
    getSpaceMembers(session, spaceId, parsed.value).andThen((payload) => {
      const allowed = SpaceMemberListResponseSchema.safeParse(payload);
      // Failing closed with a 500: a response our own contract rejects is a
      // server fault, and shipping it anyway is the outcome worth preventing.
      return allowed.success
        ? ok(allowed.data)
        : err(internal('member response failed the privacy allow-list'));
    })
  );
}
