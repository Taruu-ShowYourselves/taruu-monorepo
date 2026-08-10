/**
 * /api/topics/[id]/aside — the desk's "not a matter of consensus" signal.
 *
 * GET    the topic's aside count, plus the caller's own reason if signed in
 * POST   set aside, or amend the reason
 * DELETE put the topic back
 *
 * Thin imperative shell: session → rate limit → zod parse → use-case → respond.
 */

import { NextRequest, NextResponse } from 'next/server';
import { errAsync } from 'neverthrow';
import { SetTopicAsideSchema } from '@sync/shared/contracts';
import { getSessionFromRequest } from '@/services/auth/session';
import { topicAsideLimiter, createRateLimitResponse } from '@/lib/rate-limit';
import { parse, respond } from '@/server/http/respond';
import { unauthorized } from '@/server/http/errors';
import {
  restoreTopic,
  setTopicAside,
  topicAsideStanding,
} from '@/server/app/topics/set-aside';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  // Signed out is a valid way to read this: the count is public, and the
  // session only decides whether the caller's own reason comes back with it.
  const session = await getSessionFromRequest(request);
  return respond(topicAsideStanding(id, session?.userId ?? null));
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));

  const limit = await topicAsideLimiter.check(session.userId);
  if (limit.limited) {
    return createRateLimitResponse(limit) as NextResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = parse(SetTopicAsideSchema, body);
  if (parsed.isErr()) return respond(errAsync(parsed.error));

  return respond(setTopicAside(id, session.userId, parsed.value.reason));
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));

  return respond(restoreTopic(id, session.userId));
}
