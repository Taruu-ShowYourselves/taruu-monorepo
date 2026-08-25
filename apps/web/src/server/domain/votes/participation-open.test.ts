/**
 * The open-vote rule, on its own.
 *
 * It is worth a unit test rather than only route tests because it is now the
 * single rule two routes share, and because the one thing it must not do is
 * disagree with `cast_vote` - the function that actually enforces this under a
 * row lock. The order of the two branches is the whole content of that
 * agreement, and it is invisible unless a case exercises both at once.
 */

import { describe, it, expect } from 'vitest';
import { decideParticipationOpen } from './vote';

const NOW = new Date('2026-08-25T12:00:00Z');
const LATER = '2026-09-01T12:00:00Z';
const EARLIER = '2026-08-01T12:00:00Z';

describe('decideParticipationOpen', () => {
  it('accepts an active vote that has not reached its end date', () => {
    expect(
      decideParticipationOpen({ status: 'active', end_date: LATER }, NOW)
    ).toEqual({ open: true });
  });

  it('refuses a vote whose status says it ended', () => {
    expect(
      decideParticipationOpen({ status: 'ended', end_date: LATER }, NOW)
    ).toEqual({ open: false, code: 'VOTE_ENDED' });
  });

  it('refuses an active vote whose end date has passed', () => {
    // Status lags the clock: whatever job flips 'active' to 'ended' runs on a
    // schedule, and a resident arriving in between must not be charged.
    expect(
      decideParticipationOpen({ status: 'active', end_date: EARLIER }, NOW)
    ).toEqual({ open: false, code: 'VOTE_ENDED' });
  });

  it('refuses a vote that has not opened yet', () => {
    expect(
      decideParticipationOpen({ status: 'pending', end_date: LATER }, NOW)
    ).toEqual({ open: false, code: 'VOTE_NOT_OPEN' });
  });

  it('treats a vote that never opened and has now expired as ENDED', () => {
    // THE ordering case. Both branches match; ended-or-expired is tested first,
    // as `cast_vote` does. Swap the two ifs in the implementation and this is
    // the only assertion in the codebase that fails - the participate route
    // used to answer VOTE_NOT_OPEN here, telling a resident to come back later
    // for a vote that is over.
    expect(
      decideParticipationOpen({ status: 'pending', end_date: EARLIER }, NOW)
    ).toEqual({ open: false, code: 'VOTE_ENDED' });
  });

  it.each(['draft', 'in_review', 'changes_requested', 'rejected', 'resolving', 'resolved', 'failed'])(
    'refuses a vote in the %s state',
    (status) => {
      // A deny-list would need updating every time a status is invented. This
      // is an accept-list of exactly one value, so a new status is closed by
      // default rather than open by omission.
      //
      // Several of these do not reach the function in production:
      // `getVoteWithOptions` filters on PUBLIC_VOTE_STATUSES, so a vote in
      // 'draft', 'in_review', 'changes_requested' or 'rejected' comes back null
      // and the route answers 404 before this is called. That filter is the
      // first gate; this is the second, and it is asserted over the whole
      // vocabulary on purpose - a status moving INTO the public list later must
      // not silently become payable.
      expect(
        decideParticipationOpen({ status, end_date: LATER }, NOW)
      ).toEqual({ open: false, code: 'VOTE_NOT_OPEN' });
    }
  );

  it('is decided at the instant it is asked, not at module load', () => {
    const vote = { status: 'active', end_date: '2026-08-25T12:00:01Z' };
    expect(decideParticipationOpen(vote, NOW).open).toBe(true);
    expect(
      decideParticipationOpen(vote, new Date('2026-08-25T12:00:02Z')).open
    ).toBe(false);
  });
});
