/**
 * /api/space-admin/{spaceId}/grants
 *
 * POST   grant a capability, or - when the body names a grant id instead of a
 *        user and capability - suspend one as a platform admin
 * DELETE revoke a capability
 *
 * The two POST bodies are distinguished by shape rather than by a mode flag: a
 * `SuspendGrantRequest` names `grantId`, a `GrantCapabilityRequest` names
 * `userId` and `capability`, and neither validates as the other. A flag would
 * be a caller-supplied choice of which authorization check to run.
 */

import type { NextRequest } from 'next/server';
import { errAsync } from 'neverthrow';
import {
  GrantCapabilityRequestSchema,
  RevokeCapabilityRequestSchema,
  SuspendGrantRequestSchema,
} from '@sync/shared/contracts';
import { getSessionFromRequest } from '@/services/auth/session';
import { parse, respond } from '@/server/http/respond';
import { unauthorized } from '@/server/http/errors';
import {
  grantCapability,
  revokeCapability,
  suspendGrantAsPlatformAdmin,
} from '@/server/app/space-admin/manage-grants';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));

  const { spaceId } = await params;
  const body = await request.json().catch(() => null);

  const suspension = SuspendGrantRequestSchema.safeParse(body);
  if (suspension.success) {
    return respond(suspendGrantAsPlatformAdmin(session, spaceId, suspension.data));
  }

  const parsed = parse(GrantCapabilityRequestSchema, body);
  if (parsed.isErr()) return respond(errAsync(parsed.error));

  return respond(grantCapability(session, spaceId, parsed.value));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));

  const { spaceId } = await params;
  const body = await request.json().catch(() => null);

  const parsed = parse(RevokeCapabilityRequestSchema, body);
  if (parsed.isErr()) return respond(errAsync(parsed.error));

  return respond(revokeCapability(session, spaceId, parsed.value));
}
