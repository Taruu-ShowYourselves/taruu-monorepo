/**
 * Vote Status Visibility Tests (DB layer + route)
 *
 * What breaks if these fail: a resident sees another resident's *rejected*
 * proposal on /he/votes, or an unapproved *draft* is reachable at
 * /he/votes/{id}. Once a proposal can hold a review state, "every row is
 * public-ish" stops being true, and four read paths in db.ts had no status
 * predicate at all.
 *
 * The guarantee is that public visibility is decided by ONE allow-list -
 * `PUBLIC_VOTE_STATUSES` - and that the predicate lives in the SQL:
 *
 *   .in('status', ['pending','active','ended','resolving','resolved'])
 *
 * So these assertions inspect the recorded query-builder calls, never the
 * returned rows. A post-fetch filter would satisfy a data-shape assertion while
 * still shipping every draft over the wire - the same bug class
 * treasury-transaction-scoping.test.ts pins down for the treasury ledger.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const eq = vi.fn();
const inSpy = vi.fn();
const not = vi.fn();
const select = vi.fn();
const order = vi.fn();
const limit = vi.fn();
const single = vi.fn();
const maybeSingle = vi.fn();
const from = vi.fn();
const rpc = vi.fn();

// Chainable PostgREST query-builder stub that records the calls made on it and
// finally resolves to `{ data, error }`.
function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const chain =
    (spy: ReturnType<typeof vi.fn>) =>
    (...args: unknown[]) => {
      spy(...args);
      return builder;
    };

  builder.select = chain(select);
  builder.eq = chain(eq);
  builder.in = chain(inSpy);
  builder.not = chain(not);
  builder.order = chain(order);
  builder.limit = chain(limit);
  builder.single = chain(single);
  builder.maybeSingle = chain(maybeSingle);
  // Awaiting the builder resolves the query.
  builder.then = (resolve: (value: unknown) => unknown) => resolve(result);

  return builder;
}

let queryResult: { data: unknown; error: unknown } = { data: [], error: null };

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      from(table);
      return makeQueryBuilder(queryResult);
    },
    // `getMunicipalityProfile` aggregates its metrics through an RPC and only
    // its vote lists through `from`; the stub keeps the metrics half inert so
    // the assertions stay about the status predicate.
    rpc: (...args: unknown[]) => {
      rpc(...args);
      return Promise.resolve({ data: [{}], error: null });
    },
  },
}));

import {
  getVotesByMunicipality,
  getVoteWithOptions,
  getVoteById,
  getVoteByIdUnfiltered,
  findVoteByMunicipalityAndTitle,
  countVotesCreatedByUser,
  getMunicipalityProfile,
} from '@/lib/supabase/db';
import {
  PUBLIC_VOTE_STATUSES,
  normalizeStatusFilter,
} from '@/server/domain/votes/vote';
import { REVIEW_VOTE_STATUSES } from '@/server/domain/space/review';
import { GET } from '@/app/api/votes/route';

/** Every column named in an `.in(...)` call, in order. */
const inColumns = () => inSpy.mock.calls.map(([column]) => column);

beforeEach(() => {
  vi.clearAllMocks();
  queryResult = { data: [], error: null };
});

describe('getVotesByMunicipality', () => {
  it('defaults to the public allow-list when no status is supplied', async () => {
    await getVotesByMunicipality('חיפה');

    expect(from).toHaveBeenCalledWith('votes');
    expect(inSpy).toHaveBeenCalledWith('status', PUBLIC_VOTE_STATUSES);
  });

  it('narrows with .eq and adds no allow-list when a status IS supplied', async () => {
    await getVotesByMunicipality('חיפה', 'pending');

    expect(eq).toHaveBeenCalledWith('status', 'pending');
    expect(inColumns()).not.toContain('status');
  });
});

describe('getMunicipalityProfile', () => {
  /**
   * The municipality desk once carried its own `['active','ended']` literal.
   * That is the drift the allow-list exists to prevent, and it was not
   * theoretical: 31 desks printed "0 open topics" over municipalities that had
   * topics, because the desk disagreed with /he/votes about what a resident
   * may see.
   */
  it('filters to the shared allow-list, not a private status literal', async () => {
    await getMunicipalityProfile('רמת גן');

    expect(from).toHaveBeenCalledWith('votes');
    expect(inSpy).toHaveBeenCalledWith('status', PUBLIC_VOTE_STATUSES);
  });

  it('splits the allow-list into standing questions and answered ones', async () => {
    const vote = (id: string, status: string) => ({
      id,
      status,
      title: id,
      description: id,
      start_date: null,
      end_date: null,
      participant_count: 0,
      created_at: '2026-08-19T00:00:00Z',
      vote_options: [],
    });
    queryResult = {
      data: [
        vote('live', 'active'),
        vote('scheduled', 'pending'),
        vote('decided', 'ended'),
        vote('recording', 'resolving'),
        vote('recorded', 'resolved'),
      ],
      error: null,
    };

    const profile = await getMunicipalityProfile('רמת גן');

    expect(profile.openVotes.map((v) => v.id)).toEqual(['live', 'scheduled']);
    expect(profile.closedVotes.map((v) => v.id)).toEqual([
      'decided',
      'recording',
      'recorded',
    ]);
  });
});

describe('single-vote reads', () => {
  it('getVoteWithOptions filters to the allow-list, so a draft uuid is "not found"', async () => {
    await getVoteWithOptions('vote-1');

    expect(eq).toHaveBeenCalledWith('id', 'vote-1');
    expect(inSpy).toHaveBeenCalledWith('status', PUBLIC_VOTE_STATUSES);
  });

  it('getVoteById filters to the allow-list', async () => {
    await getVoteById('vote-1');

    expect(eq).toHaveBeenCalledWith('id', 'vote-1');
    expect(inSpy).toHaveBeenCalledWith('status', PUBLIC_VOTE_STATUSES);
  });

  it('getVoteByIdUnfiltered issues NO status predicate - it is the internal escape hatch', async () => {
    await getVoteByIdUnfiltered('vote-1');

    expect(eq).toHaveBeenCalledWith('id', 'vote-1');
    expect(inColumns()).not.toContain('status');
    expect(eq.mock.calls.map(([column]) => column)).not.toContain('status');
  });
});

describe('findVoteByMunicipalityAndTitle (ingest dedup window)', () => {
  it('sees proposals under review, so an unapproved topic cannot be duplicated', async () => {
    await findVoteByMunicipalityAndTitle('חיפה', 'שדרוג גן העיר');

    const statusCall = inSpy.mock.calls.find(([column]) => column === 'status');
    expect(statusCall).toBeDefined();

    const window = statusCall?.[1] as string[];
    expect(window).toContain('in_review');
    expect(window).toContain('changes_requested');
    // Still finds the already-published duplicates it always found.
    expect(window).toContain('pending');
    expect(window).toContain('active');
  });

  it('throws when the query fails, so a broken lookup is never read as "no such vote"', async () => {
    // What this pins down: the desk printed one Bat Yam topic four times
    // because this status window named enum labels the deployed database did
    // not have, every lookup came back 22P02, and a `null` return told the
    // ingest route to insert a fresh copy - 184 surplus rows deep.
    queryResult = {
      data: null,
      error: { code: '22P02', message: 'invalid input value for enum vote_status: "draft"' },
    };

    await expect(
      findVoteByMunicipalityAndTitle('חיפה', 'שדרוג גן העיר')
    ).rejects.toThrow(/שדרוג גן העיר/);
  });

  it('returns null only when the query succeeded and matched nothing', async () => {
    queryResult = { data: null, error: null };

    await expect(
      findVoteByMunicipalityAndTitle('חיפה', 'שדרוג גן העיר')
    ).resolves.toBeNull();
  });
});

describe('countVotesCreatedByUser', () => {
  it('excludes draft and rejected from the "votes created" statistic', async () => {
    await countVotesCreatedByUser('user-1');

    expect(eq).toHaveBeenCalledWith('creator_id', 'user-1');
    expect(not).toHaveBeenCalledWith('status', 'in', '("draft","rejected")');
  });
});

describe('normalizeStatusFilter', () => {
  it.each(REVIEW_VOTE_STATUSES)(
    'returns null for the review status %s, so it can never select drafts',
    (status) => {
      expect(normalizeStatusFilter(status)).toBeNull();
    }
  );

  it('passes every public status through unchanged', () => {
    for (const status of PUBLIC_VOTE_STATUSES) {
      expect(normalizeStatusFilter(status)).toBe(status);
    }
  });

  it('keeps mapping the legacy cancelled alias to ended', () => {
    expect(normalizeStatusFilter('cancelled')).toBe('ended');
  });

  it('returns null for an unknown label', () => {
    expect(normalizeStatusFilter('not-a-status')).toBeNull();
  });
});

describe('the allow-list and the review vocabulary are disjoint', () => {
  it.each(REVIEW_VOTE_STATUSES)(
    '%s is not a publicly visible status',
    (status) => {
      expect(PUBLIC_VOTE_STATUSES as readonly string[]).not.toContain(status);
    }
  );
});

describe('GET /api/votes status handling', () => {
  it('answers ?status=in_review with 200 and the ordinary public list, not a 400', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/votes?municipality=tel-aviv&status=in_review'
    );
    const response = await GET(request);

    // A 400 here would confirm the label is real - an existence oracle for the
    // review vocabulary. The review status must degrade to "no filter".
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ votes: [] });

    expect(inSpy).toHaveBeenCalledWith('status', PUBLIC_VOTE_STATUSES);
    expect(eq.mock.calls.map(([column]) => column)).not.toContain('status');
  });

  it('still narrows ?status=active to .eq, so widening the schema did not widen the surface', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/votes?municipality=tel-aviv&status=active'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(eq).toHaveBeenCalledWith('status', 'active');
    expect(inColumns()).not.toContain('status');
  });
});
