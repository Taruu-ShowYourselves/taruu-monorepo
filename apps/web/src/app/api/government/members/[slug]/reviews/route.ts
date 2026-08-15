/**
 * /api/government/members/[slug]/reviews - citizens' reviews of one member.
 *
 * GET    published reviews (plus the caller's own, whatever its status)
 * POST   submit or amend the caller's review
 * DELETE retract the caller's review
 *
 * Thin imperative shell: session → rate limit → zod parse → use-case → respond.
 */

import { NextRequest, NextResponse } from 'next/server';
import { errAsync } from 'neverthrow';
import { SubmitGovReviewRequestSchema } from '@sync/shared/contracts';
import { getSessionFromRequest } from '@/services/auth/session';
import { memberReviewLimiter, createRateLimitResponse } from '@/lib/rate-limit';
import { parse, respond } from '@/server/http/respond';
import { unauthorized } from '@/server/http/errors';
import {
  listMemberReviews,
  submitMemberReview,
  withdrawMemberReview,
} from '@/server/app/government/review-member';

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  // Signed out is a valid way to read this: the list is public, and the
  // session only decides whether one of the rows is marked as the reader's.
  const session = await getSessionFromRequest(request);
  return respond(listMemberReviews(slug, session?.userId ?? null));
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));

  const limit = await memberReviewLimiter.check(session.userId);
  if (limit.limited) {
    return createRateLimitResponse(limit) as NextResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = parse(SubmitGovReviewRequestSchema, body);
  if (parsed.isErr()) return respond(errAsync(parsed.error));

  return respond(submitMemberReview(slug, session.userId, parsed.value));
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));

  return respond(withdrawMemberReview(slug, session.userId));
}
