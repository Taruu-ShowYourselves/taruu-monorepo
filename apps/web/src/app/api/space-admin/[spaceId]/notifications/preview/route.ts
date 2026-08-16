/**
 * POST /api/space-admin/{spaceId}/notifications/preview - cost an audience.
 *
 * Thin imperative shell: session → burst gate → zod parse → use-case → respond.
 * The space predicate never appears here; it is read off the `SpaceScope` the
 * use-case mints, which is the only value the repositories accept.
 */

import { NextRequest, NextResponse } from 'next/server';
import { errAsync } from 'neverthrow';
import { PreviewAudienceRequestSchema } from '@sync/shared/contracts';
import { createRateLimiter, createRateLimitResponse } from '@/lib/rate-limit';
import { previewAudience } from '@/server/app/space-admin/preview-audience';
import { unauthorized } from '@/server/http/errors';
import { parse, respond } from '@/server/http/respond';
import { getSessionFromRequest } from '@/services/auth/session';

/**
 * A burst gate, and explicitly **not the quota**.
 *
 * The monthly quota is a count of campaign rows in the database
 * (`countCampaignsSentThisMonth`). It could not be this: `lib/rate-limit.ts`
 * degrades to an in-process `Map` whenever Upstash is unconfigured, which it is
 * here, and on Cloudflare Workers that map is per-isolate - N isolates would
 * each hand the same space a full allowance. This limiter only stops one client
 * hammering the resolver, which is a database read, not a spend.
 */
const previewBurstLimiter = createRateLimiter('space-notification-preview', {
  windowMs: 60_000,
  maxRequests: 10,
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));

  const { spaceId } = await params;

  const limit = await previewBurstLimiter.check(spaceId);
  if (limit.limited) return createRateLimitResponse(limit) as NextResponse;

  const body = await request.json().catch(() => null);
  const parsed = parse(PreviewAudienceRequestSchema, body);
  if (parsed.isErr()) return respond(errAsync(parsed.error));

  return respond(previewAudience(session, spaceId, parsed.value));
}
