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
  ensureIngestVoteOptions: vi.fn(),
  findVoteByMunicipalityAndTitle: vi.fn(),
  upsertVoteSource: vi.fn(),
}));

import {
  activateIngestVote,
  createVote,
  ensureIngestVoteOptions,
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
  (ensureIngestVoteOptions as Mock).mockResolvedValue(2);
  (activateIngestVote as Mock).mockResolvedValue('active');
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
    expect((ensureIngestVoteOptions as Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (upsertVoteSource as Mock).mock.invocationCallOrder[0]
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
    (activateIngestVote as Mock).mockResolvedValue(null);

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
    // The adopted row still gets its assembly ensured: the winner of the race
    // may not have written its options yet.
    expect(ensureIngestVoteOptions).toHaveBeenCalledWith(
      'vote-race',
      INGEST_CREATOR,
      CUTOVER,
      ['בעד', 'נגד', 'נמנע']
    );
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
    (ensureIngestVoteOptions as Mock).mockResolvedValue(0);
    (activateIngestVote as Mock).mockResolvedValue('active');
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
    (activateIngestVote as Mock).mockResolvedValue(null);

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

  it('asks for each distinct option once', async () => {
    (findVoteByMunicipalityAndTitle as Mock).mockResolvedValue(null);
    (createVote as Mock).mockResolvedValue({
      id: 'vote-new',
      title: TOPIC.title,
      status: 'pending',
      created_at: AFTER_CUTOVER,
    });

    await post({ topics: [{ ...TOPIC, options: ['בעד', '  בעד  ', 'נגד'] }] });

    expect(ensureIngestVoteOptions).toHaveBeenCalledWith(
      'vote-new',
      INGEST_CREATOR,
      CUTOVER,
      ['בעד', 'נגד']
    );
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

  // ── the blocker Octo found: the options write had the same hole ──────────
  //
  // Attempt 1 lands the vote row and then fails writing its ballot. Attempt 2
  // dedups onto that row. Option assembly used to live inside the create-only
  // branch, so the retry skipped it, activation refused the vote forever, and
  // the 500 blocked every topic behind it in the batch on every run.
  it('repairs the ballot of a vote whose options never landed', async () => {
    (findVoteByMunicipalityAndTitle as Mock).mockResolvedValue(null);
    (createVote as Mock).mockResolvedValue({
      id: 'vote-noopts',
      title: TOPIC.title,
      status: 'pending',
      created_at: AFTER_CUTOVER,
    });
    (ensureIngestVoteOptions as Mock).mockRejectedValue(new Error('options write failed'));

    const first = await post({ topics: [TOPIC] });
    expect(first.status).toBe(500);
    expect(upsertVoteSource).not.toHaveBeenCalled();
    expect(activateIngestVote).not.toHaveBeenCalled();

    // ── the retry: the row exists, its ballot does not ──
    vi.clearAllMocks();
    (upsertVoteSource as Mock).mockResolvedValue({ vote_id: 'vote-noopts' });
    (activateIngestVote as Mock).mockResolvedValue('active');
    // The repair reports two options written - the ones the first attempt lost.
    (ensureIngestVoteOptions as Mock).mockResolvedValue(2);
    (findVoteByMunicipalityAndTitle as Mock).mockResolvedValue({
      id: 'vote-noopts',
      title: TOPIC.title,
      status: 'pending',
      created_at: AFTER_CUTOVER,
    });

    const retry = await post({ topics: [TOPIC] });

    expect(retry.status).toBe(200);
    expect(createVote).not.toHaveBeenCalled();
    // Repaired, then sourced, then activated - in that order.
    expect(ensureIngestVoteOptions).toHaveBeenCalledWith(
      'vote-noopts',
      INGEST_CREATOR,
      CUTOVER,
      ['בעד', 'נגד', 'נמנע']
    );
    expect((ensureIngestVoteOptions as Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (upsertVoteSource as Mock).mock.invocationCallOrder[0]
    );
    expect((upsertVoteSource as Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (activateIngestVote as Mock).mock.invocationCallOrder[0]
    );
    // The row is ACTIVE, not merely un-500ed.
    await expect(retry.json()).resolves.toMatchObject({
      success: true,
      ingested: [{ vote_id: 'vote-noopts', created: false, status: 'active' }],
    });
  });

  it('ensures the ballot on the dedup path too', async () => {
    (findVoteByMunicipalityAndTitle as Mock).mockResolvedValue({
      id: 'vote-dedup',
      title: TOPIC.title,
      status: 'pending',
      created_at: AFTER_CUTOVER,
    });

    const response = await post({ topics: [TOPIC] });

    expect(response.status).toBe(200);
    expect(createVote).not.toHaveBeenCalled();
    expect(ensureIngestVoteOptions).toHaveBeenCalledWith(
      'vote-dedup',
      INGEST_CREATOR,
      CUTOVER,
      ['בעד', 'נגד', 'נמנע']
    );
  });

  it('asks for the same option set on every retry, never a growing one', async () => {
    (findVoteByMunicipalityAndTitle as Mock).mockResolvedValue({
      id: 'vote-repeat',
      title: TOPIC.title,
      status: 'pending',
      created_at: AFTER_CUTOVER,
    });

    await post({ topics: [{ ...TOPIC, options: ['בעד', ' בעד ', 'נגד'] }] });
    await post({ topics: [{ ...TOPIC, options: ['בעד', ' בעד ', 'נגד'] }] });

    const calls = (ensureIngestVoteOptions as Mock).mock.calls;
    expect(calls).toHaveLength(2);
    // Identical, de-duplicated, and never accumulating: the database inserts
    // only what is missing, so a repeated request cannot double the ballot.
    expect(calls[0][3]).toEqual(['בעד', 'נגד']);
    expect(calls[1][3]).toEqual(['בעד', 'נגד']);
  });

  it('reports the status the row actually holds, not the one it wanted', async () => {
    (findVoteByMunicipalityAndTitle as Mock).mockResolvedValue({
      id: 'vote-ended',
      title: TOPIC.title,
      status: 'ended',
      created_at: AFTER_CUTOVER,
    });
    // A late retry: activation succeeds because the lifecycle already moved on.
    (activateIngestVote as Mock).mockResolvedValue('ended');

    const response = await post({ topics: [TOPIC] });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ingested: [{ vote_id: 'vote-ended', status: 'ended' }],
    });
  });

  it('rejects an unauthenticated call before touching the database', async () => {
    const response = await post({ topics: [TOPIC] }, 'wrong-secret');

    expect(response.status).toBe(401);
    expect(findVoteByMunicipalityAndTitle).not.toHaveBeenCalled();
  });
});
