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
import { normalizeStatusFilter } from '@/server/domain/votes/vote';

const ListQuerySchema = z.object({
  municipality: z.string().min(1).optional(),
  status: z.enum(['pending', 'active', 'ended']).optional(),
});

/**
 * GET /api/votes
 * List votes, optionally filtered by municipality and status.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = parse(ListQuerySchema, {
    municipality: params.get('municipality') ?? undefined,
    status: normalizeStatusFilter(params.get('status')) ?? undefined,
  });
  return respond(query.asyncAndThen(listVotes));
}

// Municipality is always derived from the creator's profile, never the body.
const CreateVoteBodySchema = CreateVoteRequestSchema.omit({ municipality: true });

/**
 * POST /api/votes
 * Create a new vote (requires authentication and a completed payment).
 * Notification fan-out runs after the response via `after()`.
 */
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return respond(errAsync(unauthorized()));

  // after() needs a live request scope (unavailable in unit tests) — fall
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
