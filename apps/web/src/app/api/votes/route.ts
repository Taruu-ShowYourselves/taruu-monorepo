import { NextRequest } from 'next/server';
import { after } from 'next/server';
import { z } from 'zod';
import { CreateVoteRequestSchema } from '@sync/shared/contracts';
import { getSessionFromRequest } from '@/services/auth/session';
import { parse, respond } from '@/server/http/respond';
import { unauthorized } from '@/server/http/errors';
import { errAsync } from 'neverthrow';
import { listVotes } from '@/server/app/votes/list-votes';
import { createVote } from '@/server/app/votes/create-vote';
import {
  normalizeStatusFilter,
  PUBLIC_VOTE_STATUSES,
} from '@/server/domain/votes/vote';

const ListQuerySchema = z.object({
  municipality: z.string().min(1).optional(),
  // No .nullable(): the call site already coalesces null to undefined.
  status: z.enum(PUBLIC_VOTE_STATUSES).optional(),
  includeOptions: z.boolean().optional(),
});

/**
 * GET /api/votes
 * List votes, optionally filtered by municipality and status.
 * `include=options` adds option tallies (active votes only).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = parse(ListQuerySchema, {
    municipality: params.get('municipality') ?? undefined,
    // normalise BEFORE validating: a review status arriving here becomes
    // undefined — "no filter" — and falls back to the allow-list. Validating
    // first would make ?status=in_review a 400 whose very existence confirms
    // the label is real, an existence oracle for the review vocabulary.
    status: normalizeStatusFilter(params.get('status')) ?? undefined,
    includeOptions: params.get('include') === 'options' || undefined,
  });
  // Public, unauthenticated, aggregate-only: safe in a shared edge cache.
  // Cloudflare keys on the full URL, so each municipality/status variant is
  // cached separately. The 30s window matches the clients' own poll interval.
  return respond(query.asyncAndThen(listVotes), {
    cacheControl: 'public, s-maxage=30, stale-while-revalidate=120',
  });
}

// Municipality is always derived from the creator's profile, never the body.
const CreateVoteBodySchema = CreateVoteRequestSchema.omit({ municipality: true });

/**
 * POST /api/votes
 * Submit a proposal for review. Requires authentication; requires no payment —
 * the ₪50 creation fee is charged when a space admin approves (issue #75).
 * Notification fan-out runs after the response via `after()`.
 */
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));

  // after() needs a live request scope (unavailable in unit tests) - fall
  // back to fire-and-forget so notification fan-out never blocks/breaks.
  const defer = (task: () => Promise<void>) => {
    try {
      after(task);
    } catch {
      void task().catch(() => {});
    }
  };

  const body = await request.json().catch(() => null);
  const result = parse(CreateVoteBodySchema, body).asyncAndThen((cmd) =>
    createVote({ defer }, { ...cmd, userId: session.userId })
  );
  return respond(result, { status: 201 });
}
