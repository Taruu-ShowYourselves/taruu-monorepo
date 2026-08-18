/**
 * The status vocabulary, pinned.
 *
 * What breaks if these fail: a machine-written topic becomes publicly readable
 * without a human ever having looked at it.
 *
 * Two separate incidents motivate this file. First, `POST /api/ingest/topics`
 * wrote `'pending'` from the day it shipped while `docs/INGEST.md` promised the
 * row stayed private "until an editor activates them" - a promise no code kept,
 * because nothing could move a `pending` row anywhere. Second, `'pending'` was
 * later added to `PUBLIC_VOTE_STATUSES` on the reading that it means "approved
 * and scheduled", which is true of the approval path and was never true of the
 * ingest path. The same label meant two things in two files.
 *
 * So the properties asserted here are about the vocabulary itself: the review
 * states and the public states never overlap, every label the database can hold
 * is accounted for by one of them, and whatever a newly submitted proposal
 * enters at - human or machine - is on the non-public side of that line.
 */

import { describe, it, expect } from 'vitest';
import { VoteStatusSchema } from '@sync/shared/contracts';
import {
  initialStatus,
  submissionStatus,
  PUBLIC_VOTE_STATUSES,
  REVIEW_VOTE_STATUSES,
  normalizeStatusFilter,
} from './vote';

/** Every label `vote_status` can hold, from the one shared contract. */
const ALL_STATUSES = VoteStatusSchema.options;

describe('the public and review vocabularies partition the enum', () => {
  it('never lets a status be public and under review at once', () => {
    const overlap = PUBLIC_VOTE_STATUSES.filter((status) =>
      (REVIEW_VOTE_STATUSES as readonly string[]).includes(status)
    );

    expect(overlap).toEqual([]);
  });

  it('accounts for every database label, leaving only the documented exclusion', () => {
    const classified = new Set<string>([
      ...PUBLIC_VOTE_STATUSES,
      ...REVIEW_VOTE_STATUSES,
    ]);
    const unclassified = ALL_STATUSES.filter((status) => !classified.has(status));

    // `failed` is the one deliberate omission: a vote whose NFT resolution
    // failed is neither public nor reviewable. Documented on the allow-list.
    // A NEW label added to the enum lands here and fails this test, which is
    // the point - a status nobody classified must not default to visible.
    expect(unclassified).toEqual(['failed']);
  });

  it('keeps the review states out of every public filter', () => {
    for (const status of REVIEW_VOTE_STATUSES) {
      expect(normalizeStatusFilter(status)).toBeNull();
    }
  });
});

describe('a newly submitted proposal is never public', () => {
  it('places a human submission on the non-public side of the line', () => {
    expect(submissionStatus()).toBe('in_review');
    expect(PUBLIC_VOTE_STATUSES).not.toContain(submissionStatus());
    expect(REVIEW_VOTE_STATUSES).toContain(submissionStatus());
  });

  it('is the same state a decision can actually act on', async () => {
    // The one coupling that makes the queue work at all: whatever submission
    // writes has to be what `isDecidableFrom` accepts, or the row is submitted
    // into a state no reviewer can leave. That is precisely how the ingest
    // path stranded 380 rows in `pending`.
    const { isDecidableFrom } = await import('@/server/domain/space/review');

    expect(isDecidableFrom(submissionStatus())).toBe(true);
  });
});

describe('initialStatus decides publication, and only at approval time', () => {
  const now = new Date('2026-08-18T12:00:00.000Z');

  it('opens a proposal whose start date has arrived', () => {
    expect(initialStatus(new Date('2026-08-18T11:59:59.000Z'), now)).toBe('active');
    expect(initialStatus(now, now)).toBe('active');
  });

  it('schedules a proposal whose start date has not', () => {
    expect(initialStatus(new Date('2026-08-19T00:00:00.000Z'), now)).toBe('pending');
  });

  it('only ever produces publicly readable states', () => {
    // `pending` here means "approved, scheduled, not yet open" - the sense the
    // allow-list documents. Both outcomes are public because both are already
    // past review; that is what makes it safe for `pending` to be on the list.
    expect(PUBLIC_VOTE_STATUSES).toContain(initialStatus(now, now));
    expect(PUBLIC_VOTE_STATUSES).toContain(
      initialStatus(new Date('2026-08-19T00:00:00.000Z'), now)
    );
  });
});
