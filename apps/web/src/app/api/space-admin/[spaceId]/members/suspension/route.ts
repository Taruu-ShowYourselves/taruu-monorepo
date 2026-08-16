/**
 * /api/space-admin/{spaceId}/members/suspension
 *
 * POST   suspend a member in this space
 * DELETE lift that suspension
 *
 * The suspension is the resource and the verb acts on it, which is why
 * reinstatement is a DELETE here rather than a second POST with a flag. Both
 * carry a reason, and both require `member.suspend` - reinstating is the
 * inverse of suspending, not a separate authority.
 */

import type { NextRequest } from 'next/server';
import { errAsync } from 'neverthrow';
import {
  ReinstateMemberRequestSchema,
  SuspendMemberRequestSchema,
} from '@sync/shared/contracts';
import { getSessionFromRequest } from '@/services/auth/session';
import { parse, respond } from '@/server/http/respond';
import { unauthorized } from '@/server/http/errors';
import {
  reinstateMember,
  suspendMember,
} from '@/server/app/space-admin/manage-membership';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));

  const { spaceId } = await params;
  const body = await request.json().catch(() => null);

  const parsed = parse(SuspendMemberRequestSchema, body);
  if (parsed.isErr()) return respond(errAsync(parsed.error));

  return respond(suspendMember(session, spaceId, parsed.value));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));

  const { spaceId } = await params;
  const body = await request.json().catch(() => null);

  const parsed = parse(ReinstateMemberRequestSchema, body);
  if (parsed.isErr()) return respond(errAsync(parsed.error));

  return respond(reinstateMember(session, spaceId, parsed.value));
}
