/**
 * The route refuses to run with an activation cutover the clock has not
 * reached yet.
 *
 * Every vote an ingest request creates is stamped `now`, which is BEFORE a
 * future cutover, so both RPCs refuse it on their `created_at >= cutover`
 * bound: the first attempt answers 500 having already written the vote row,
 * and the retry dedups onto that row, skips activation as out of scope, and
 * answers `success: true` while the vote sits in `pending` forever. That is
 * exactly the stranded row this change exists to make impossible, so a future
 * cutover is treated as no cutover at all - refused before the first write.
 *
 * Isolated in its own file for the same reason as the unconfigured case: the
 * route reads its configuration once, at module load.
 */

import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/db', () => ({
  activateIngestVote: vi.fn(),
  createVote: vi.fn(),
  ensureIngestVoteOptions: vi.fn(),
  findVoteByMunicipalityAndTitle: vi.fn(),
  upsertVoteSource: vi.fn(),
}));

vi.hoisted(() => {
  // A year ahead: far enough that no plausible clock skew makes it current.
  const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
  process.env.INGEST_SECRET = 'test-ingest-secret';
  process.env.INGEST_AUTOACTIVATE_SINCE = new Date(Date.now() + YEAR_MS).toISOString();
});

describe('POST /api/ingest/topics with a future activation cutover', () => {
  it('refuses the request instead of stranding a vote it cannot activate', async () => {
    const { POST } = await import('@/app/api/ingest/topics/route');
    const { findVoteByMunicipalityAndTitle, createVote } = await import(
      '@/lib/supabase/db'
    );

    const response = await POST(
      new NextRequest('http://localhost/api/ingest/topics', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-ingest-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          topics: [
            {
              municipality: 'בת ים',
              title: 'בדיקת תצורה עתידית',
              description: 'תיאור',
              source: { post_count: 1, comments_count: 0, reactions: {} },
            },
          ],
        }),
      })
    );

    expect(response.status).toBe(503);
    // The point of the 503: nothing was written, so there is no half-assembled
    // row for a retry to find and report as a success.
    expect(findVoteByMunicipalityAndTitle).not.toHaveBeenCalled();
    expect(createVote).not.toHaveBeenCalled();
  });

  it('still answers 401 first when the caller is unauthenticated', async () => {
    const { POST } = await import('@/app/api/ingest/topics/route');

    const response = await POST(
      new NextRequest('http://localhost/api/ingest/topics', {
        method: 'POST',
        headers: {
          authorization: 'Bearer wrong-secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ topics: [] }),
      })
    );

    expect(response.status).toBe(401);
  });
});
