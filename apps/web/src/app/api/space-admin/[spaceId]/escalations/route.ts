/**
 * POST /api/space-admin/{spaceId}/escalations - reach a platform admin.
 *
 * The one endpoint in the dashboard with no capability check, by design: a
 * suspended admin and a member holding nothing must both be able to reach it,
 * and those are the callers who most need to. See `raise-escalation.ts` for the
 * two rules that govern it - it writes only the platform record, and every
 * caller gets the same acknowledgement.
 *
 * The limiter is keyed by user and never by space. A per-space key would leak
 * which spaces are being escalated about through its own reset behaviour, which
 * would undo the opacity the use-case is built around.
 */

import type { NextRequest } from 'next/server';
import { errAsync } from 'neverthrow';
import { EscalationRequestSchema } from '@sync/shared/contracts';
import { getSessionFromRequest } from '@/services/auth/session';
import { createRateLimiter, createRateLimitResponse } from '@/lib/rate-limit';
import { parse, respond } from '@/server/http/respond';
import { unauthorized } from '@/server/http/errors';
import {
  ESCALATION_STATUS,
  raiseEscalation,
} from '@/server/app/space-admin/raise-escalation';

const escalationLimiter = createRateLimiter('space-escalation', {
  windowMs: 3_600_000,
  maxRequests: 5,
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));

  const limit = await escalationLimiter.check(session.userId);
  if (limit.limited) return createRateLimitResponse(limit);

  const { spaceId } = await params;
  const body = await request.json().catch(() => null);

  // A body under ten characters is a property of the caller's own input, not of
  // the target, so rejecting it discloses nothing about the space they named.
  const parsed = parse(EscalationRequestSchema, body);
  if (parsed.isErr()) return respond(errAsync(parsed.error));

  return respond(raiseEscalation(session, spaceId, parsed.value), {
    status: ESCALATION_STATUS,
  });
}
