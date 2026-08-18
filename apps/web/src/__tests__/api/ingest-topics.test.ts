/**
 * Ingest dedup tests (POST /api/ingest/topics).
 *
 * What breaks if these fail: the desk prints the same topic several times. The
 * discovery fleet re-posts the whole batch on every run, so "already have it"
 * has to be decided here, once, per (municipality, title). It was decided
 * wrongly for a week - the dedup lookup hit an enum the deployed database did
 * not have, the reader turned that error into `null`, and the route read `null`
 * as "no such topic" and inserted a fresh copy each run: 98 topics duplicated,
 * 184 surplus rows, one Bat Yam topic printed four times.
 *
 * So the two assertions that matter are negative ones: a failed lookup must not
 * produce a vote, and neither must a lost insert race.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { UniqueViolationError } from '@/lib/supabase/errors';

vi.mock('@/lib/supabase/db', () => ({
  createVote: vi.fn(),
  createVoteOptions: vi.fn(),
  findVoteByMunicipalityAndTitle: vi.fn(),
  upsertVoteSource: vi.fn(),
}));

import {
  createVote,
  createVoteOptions,
  findVoteByMunicipalityAndTitle,
  upsertVoteSource,
} from '@/lib/supabase/db';
import { isDecidableFrom } from '@/server/domain/space/review';
import {
  PUBLIC_VOTE_STATUSES,
  submissionStatus,
} from '@/server/domain/votes/vote';

const SECRET = 'test-ingest-secret';

// The route reads INGEST_SECRET once, at module load. Hoisted above the import
// below so the constant is already set when that evaluation happens - and so
// the route is imported exactly once: re-importing it under vi.resetModules
// would give it a second copy of `errors.ts`, and the `instanceof
// UniqueViolationError` narrowing inside it would answer false against the
// class this file holds.
vi.hoisted(() => {
  process.env.INGEST_SECRET = 'test-ingest-secret';
});

import { POST } from '@/app/api/ingest/topics/route';

const TOPIC = {
  municipality: 'בת ים',
  title: 'שוטטות והימצאות שיכורים בטיילת ובחופים',
  description: 'תושבים מדווחים על נוכחות מתמשכת של חסרי בית ואנשים שיכורים בטיילת.',
  source: { post_count: 5, comments_count: 30, reactions: { like: 376 } },
};

function post(body: unknown, secret = SECRET) {
  return POST(
    new NextRequest('http://localhost/api/ingest/topics', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (upsertVoteSource as Mock).mockResolvedValue({ vote_id: 'vote-1' });
  (createVoteOptions as Mock).mockResolvedValue([]);
});

describe('POST /api/ingest/topics', () => {
  it('refreshes engagement on the existing vote instead of creating a second one', async () => {
    (findVoteByMunicipalityAndTitle as Mock).mockResolvedValue({
      id: 'vote-1',
      title: TOPIC.title,
    });

    const response = await post({ topics: [TOPIC] });

    expect(response.status).toBe(200);
    expect(createVote).not.toHaveBeenCalled();
    expect(upsertVoteSource).toHaveBeenCalledWith(
      expect.objectContaining({ vote_id: 'vote-1', comments_count: 30 })
    );
    await expect(response.json()).resolves.toMatchObject({
      ingested: [{ vote_id: 'vote-1', created: false }],
    });
  });

  it('creates the vote when the lookup genuinely found nothing', async () => {
    (findVoteByMunicipalityAndTitle as Mock).mockResolvedValue(null);
    (createVote as Mock).mockResolvedValue({ id: 'vote-new', title: TOPIC.title });

    const response = await post({ topics: [TOPIC] });

    expect(response.status).toBe(200);
    expect(createVote).toHaveBeenCalledWith(
      expect.objectContaining({ municipality_id: 'בת ים', status: submissionStatus() })
    );
    await expect(response.json()).resolves.toMatchObject({
      ingested: [{ vote_id: 'vote-new', created: true }],
    });
  });

  it('lands a machine-written topic in the editorial review queue, never in public view', async () => {
    (findVoteByMunicipalityAndTitle as Mock).mockResolvedValue(null);
    (createVote as Mock).mockResolvedValue({ id: 'vote-new', title: TOPIC.title });

    await post({ topics: [TOPIC] });

    const written = (createVote as Mock).mock.calls[0][0].status;

    // One claim from three directions, because the defect this replaces
    // satisfied none of them: a status a reviewer can actually act on, a status
    // no public reader can see, and the SAME status a human submission enters
    // at - one queue, not two.
    expect(isDecidableFrom(written)).toBe(true);
    expect(PUBLIC_VOTE_STATUSES).not.toContain(written);
    expect(written).toBe(submissionStatus());
  });

  it('attaches the counted engagement to the row it just created', async () => {
    (findVoteByMunicipalityAndTitle as Mock).mockResolvedValue(null);
    (createVote as Mock).mockResolvedValue({ id: 'vote-new', title: TOPIC.title });

    await post({ topics: [TOPIC] });

    // Source attachment must survive the lifecycle change: a topic waiting in
    // review still has to carry the evidence a reviewer decides on.
    expect(createVoteOptions).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ vote_id: 'vote-new' })])
    );
    expect(upsertVoteSource).toHaveBeenCalledWith(
      expect.objectContaining({
        vote_id: 'vote-new',
        post_count: 5,
        comments_count: 30,
        reactions: { like: 376 },
      })
    );
  });

  it('refreshes a topic already waiting in review rather than filing it twice', async () => {
    // ux_votes_live_topic covers the review states, so a re-post of a topic no
    // reviewer has reached yet must update its engagement in place. Without
    // this, every fleet run files a second copy of everything in the queue.
    (findVoteByMunicipalityAndTitle as Mock).mockResolvedValue({
      id: 'vote-queued',
      title: TOPIC.title,
      status: 'in_review',
    });

    const response = await post({ topics: [TOPIC] });

    expect(response.status).toBe(200);
    expect(createVote).not.toHaveBeenCalled();
    expect(upsertVoteSource).toHaveBeenCalledWith(
      expect.objectContaining({ vote_id: 'vote-queued', comments_count: 30 })
    );
  });

  it('creates nothing when the dedup lookup fails', async () => {
    (findVoteByMunicipalityAndTitle as Mock).mockRejectedValue(
      new Error('vote lookup failed: invalid input value for enum vote_status')
    );

    const response = await post({ topics: [TOPIC] });

    expect(response.status).toBe(500);
    expect(createVote).not.toHaveBeenCalled();
  });

  it('adopts the row a concurrent run inserted rather than failing the batch', async () => {
    (findVoteByMunicipalityAndTitle as Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'vote-race', title: TOPIC.title });
    (createVote as Mock).mockRejectedValue(
      new UniqueViolationError('ux_votes_live_topic', 'Vote already exists')
    );

    const response = await post({ topics: [TOPIC] });

    expect(response.status).toBe(200);
    expect(createVoteOptions).not.toHaveBeenCalled();
    expect(upsertVoteSource).toHaveBeenCalledWith(
      expect.objectContaining({ vote_id: 'vote-race' })
    );
  });

  it('rejects an unauthenticated call before touching the database', async () => {
    const response = await post({ topics: [TOPIC] }, 'wrong-secret');

    expect(response.status).toBe(401);
    expect(findVoteByMunicipalityAndTitle).not.toHaveBeenCalled();
  });
});
