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
  activateIngestVote: vi.fn(),
  createVote: vi.fn(),
  createVoteOptions: vi.fn(),
  findVoteByMunicipalityAndTitle: vi.fn(),
  upsertVoteSource: vi.fn(),
}));

import {
  activateIngestVote,
  createVote,
  createVoteOptions,
  findVoteByMunicipalityAndTitle,
  upsertVoteSource,
} from '@/lib/supabase/db';

const SECRET = 'test-ingest-secret';

// The route reads INGEST_SECRET once, at module load. Hoisted above the import
// below so the constant is already set when that evaluation happens - and so
// the route is imported exactly once: re-importing it under vi.resetModules
// would give it a second copy of `errors.ts`, and the `instanceof
// UniqueViolationError` narrowing inside it would answer false against the
// class this file holds.
vi.hoisted(() => {
  process.env.INGEST_SECRET = 'test-ingest-secret';
  process.env.INGEST_AUTOACTIVATE_SINCE = '2026-08-18T00:00:00.000Z';
});

import { POST } from '@/app/api/ingest/topics/route';

const CUTOVER = '2026-08-18T00:00:00.000Z';
const INGEST_CREATOR = '99999999-9999-4999-8999-999999999999';
/** A row this deployment is responsible for. */
const AFTER_CUTOVER = '2026-08-18T09:00:00.000Z';
/** A row from the pre-existing pending backlog. */
const BEFORE_CUTOVER = '2026-08-17T09:00:00.000Z';

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
  (activateIngestVote as Mock).mockResolvedValue(true);
});

describe('POST /api/ingest/topics', () => {
  it('refreshes engagement on the existing vote instead of creating a second one', async () => {
    (findVoteByMunicipalityAndTitle as Mock).mockResolvedValue({
      id: 'vote-1',
      title: TOPIC.title,
      status: 'active',
      created_at: AFTER_CUTOVER,
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
      expect.objectContaining({ municipality_id: 'בת ים', status: 'pending' })
    );
    expect((createVoteOptions as Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (activateIngestVote as Mock).mock.invocationCallOrder[0]
    );
    expect((upsertVoteSource as Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (activateIngestVote as Mock).mock.invocationCallOrder[0]
    );
    expect(activateIngestVote).toHaveBeenCalledWith('vote-new', INGEST_CREATOR, CUTOVER);
    await expect(response.json()).resolves.toMatchObject({
      ingested: [{ vote_id: 'vote-new', created: true, status: 'active' }],
    });
  });

  it('does not expose a new vote when source assembly fails', async () => {
    (findVoteByMunicipalityAndTitle as Mock).mockResolvedValue(null);
    (createVote as Mock).mockResolvedValue({ id: 'vote-new', title: TOPIC.title });
    (upsertVoteSource as Mock).mockResolvedValue(null);

    const response = await post({ topics: [TOPIC] });

    expect(response.status).toBe(500);
    expect(activateIngestVote).not.toHaveBeenCalled();
  });

  it('fails the ingest when the assembled vote cannot be activated', async () => {
    (findVoteByMunicipalityAndTitle as Mock).mockResolvedValue(null);
    (createVote as Mock).mockResolvedValue({ id: 'vote-new', title: TOPIC.title });
    (activateIngestVote as Mock).mockResolvedValue(false);

    const response = await post({ topics: [TOPIC] });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Ingest failed',
      ingested: [],
    });
  });

  it('creates nothing when the dedup lookup fails', async () => {
    (findVoteByMunicipalityAndTitle as Mock).mockRejectedValue(
      new Error('vote lookup failed: invalid input value for enum vote_status')
    );

    const response = await post({ topics: [TOPIC] });

    expect(response.status).toBe(500);
    expect(createVote).not.toHaveBeenCalled();
    expect(activateIngestVote).not.toHaveBeenCalled();
  });

  it('adopts the row a concurrent run inserted rather than failing the batch', async () => {
    (findVoteByMunicipalityAndTitle as Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'vote-race',
        title: TOPIC.title,
        status: 'pending',
        created_at: AFTER_CUTOVER,
      });
    (createVote as Mock).mockRejectedValue(
      new UniqueViolationError('ux_votes_live_topic', 'Vote already exists')
    );

    const response = await post({ topics: [TOPIC] });

    expect(response.status).toBe(200);
    expect(createVoteOptions).not.toHaveBeenCalled();
    expect(upsertVoteSource).toHaveBeenCalledWith(
      expect.objectContaining({ vote_id: 'vote-race' })
    );
    // The loser of the insert race still has to finish the lifecycle: the row
    // it adopted is a real current ingest vote, and nothing else will ever
    // come back for it.
    expect(activateIngestVote).toHaveBeenCalledWith('vote-race', INGEST_CREATOR, CUTOVER);
    await expect(response.json()).resolves.toMatchObject({
      ingested: [{ vote_id: 'vote-race', created: false, status: 'active' }],
    });
  });

  // ── the orphan the first revision of this fix left behind ────────────────
  //
  // Attempt 1 creates the vote and its options, then dies writing the source:
  // HTTP 500, and a real half-assembled vote is left in `pending`. Attempt 2
  // is the fleet's retry. It dedups onto that row, finishes the assembly - and
  // must finish the lifecycle. Gating activation on `created` made this exact
  // sequence return `success: true` over a permanently stranded vote.
  it('completes a vote left half-assembled by a previous failed attempt', async () => {
    (findVoteByMunicipalityAndTitle as Mock).mockResolvedValue(null);
    (createVote as Mock).mockResolvedValue({
      id: 'vote-partial',
      title: TOPIC.title,
      status: 'pending',
      created_at: AFTER_CUTOVER,
    });
    (upsertVoteSource as Mock).mockResolvedValue(null);

    const first = await post({ topics: [TOPIC] });
    expect(first.status).toBe(500);
    expect(activateIngestVote).not.toHaveBeenCalled();

    // ── the retry ──
    vi.clearAllMocks();
    (createVoteOptions as Mock).mockResolvedValue([]);
    (activateIngestVote as Mock).mockResolvedValue(true);
    (upsertVoteSource as Mock).mockResolvedValue({ vote_id: 'vote-partial' });
    (findVoteByMunicipalityAndTitle as Mock).mockResolvedValue({
      id: 'vote-partial',
      title: TOPIC.title,
      status: 'pending',
      created_at: AFTER_CUTOVER,
    });

    const retry = await post({ topics: [TOPIC] });

    expect(retry.status).toBe(200);
    expect(createVote).not.toHaveBeenCalled();
    expect(activateIngestVote).toHaveBeenCalledWith('vote-partial', INGEST_CREATOR, CUTOVER);
    await expect(retry.json()).resolves.toMatchObject({
      ingested: [{ vote_id: 'vote-partial', created: false, status: 'active' }],
    });
  });

  it('never reports success while a current vote is still pending', async () => {
    (findVoteByMunicipalityAndTitle as Mock).mockResolvedValue({
      id: 'vote-stuck',
      title: TOPIC.title,
      status: 'pending',
      created_at: AFTER_CUTOVER,
    });
    (activateIngestVote as Mock).mockResolvedValue(false);

    const response = await post({ topics: [TOPIC] });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: 'Ingest failed' });
  });

  it('leaves a pre-cutover backlog row exactly as it found it', async () => {
    (findVoteByMunicipalityAndTitle as Mock).mockResolvedValue({
      id: 'vote-backlog',
      title: TOPIC.title,
      status: 'pending',
      created_at: BEFORE_CUTOVER,
    });

    const response = await post({ topics: [TOPIC] });

    expect(response.status).toBe(200);
    expect(activateIngestVote).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      ingested: [{ vote_id: 'vote-backlog', created: false, status: 'pending' }],
    });
  });

  it('writes each distinct option once', async () => {
    (findVoteByMunicipalityAndTitle as Mock).mockResolvedValue(null);
    (createVote as Mock).mockResolvedValue({
      id: 'vote-new',
      title: TOPIC.title,
      status: 'pending',
      created_at: AFTER_CUTOVER,
    });

    await post({ topics: [{ ...TOPIC, options: ['בעד', '  בעד  ', 'נגד'] }] });

    expect(createVoteOptions).toHaveBeenCalledWith([
      { vote_id: 'vote-new', text: 'בעד' },
      { vote_id: 'vote-new', text: 'נגד' },
    ]);
  });

  it.each([
    ['zero', 0],
    ['negative', -5],
    ['fractional', 1.5],
    ['non-numeric', 'seven'],
    ['beyond the ceiling', 400],
  ])('rejects %s vote_days before writing anything', async (_label, vote_days) => {
    const response = await post({ topics: [{ ...TOPIC, vote_days }] });

    expect(response.status).toBe(400);
    expect(findVoteByMunicipalityAndTitle).not.toHaveBeenCalled();
    expect(createVote).not.toHaveBeenCalled();
  });

  it.each([
    ['a blank option', ['בעד', '   ']],
    ['a non-string option', ['בעד', 7]],
    ['only one distinct value', ['בעד', ' בעד ']],
    ['a single option', ['בעד']],
  ])('rejects %s before writing anything', async (_label, options) => {
    const response = await post({ topics: [{ ...TOPIC, options }] });

    expect(response.status).toBe(400);
    expect(createVote).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated call before touching the database', async () => {
    const response = await post({ topics: [TOPIC] }, 'wrong-secret');

    expect(response.status).toBe(401);
    expect(findVoteByMunicipalityAndTitle).not.toHaveBeenCalled();
  });
});
