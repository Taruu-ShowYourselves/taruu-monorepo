/**
 * The route refuses to run without an activation cutover.
 *
 * Isolated in its own file because the route reads its configuration once, at
 * module load: proving the unconfigured case needs a module registry that has
 * never seen the configured one.
 */

import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/db', () => ({
  activateIngestVote: vi.fn(),
  createVote: vi.fn(),
  createVoteOptions: vi.fn(),
  findVoteByMunicipalityAndTitle: vi.fn(),
  upsertVoteSource: vi.fn(),
}));

vi.hoisted(() => {
  process.env.INGEST_SECRET = 'test-ingest-secret';
  delete process.env.INGEST_AUTOACTIVATE_SINCE;
});

describe('POST /api/ingest/topics without an activation cutover', () => {
  it('refuses the request instead of creating a vote it cannot activate', async () => {
    const { POST } = await import('@/app/api/ingest/topics/route');
    const { findVoteByMunicipalityAndTitle, createVote } = await import('@/lib/supabase/db');

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
              title: 'בדיקת תצורה',
              description: 'תיאור',
              source: { post_count: 1, comments_count: 0, reactions: {} },
            },
          ],
        }),
      })
    );

    expect(response.status).toBe(503);
    expect(findVoteByMunicipalityAndTitle).not.toHaveBeenCalled();
    expect(createVote).not.toHaveBeenCalled();
  });
});
