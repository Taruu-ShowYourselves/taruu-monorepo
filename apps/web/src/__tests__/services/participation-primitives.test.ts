/**
 * Unit proof for the two participation primitives added in phase 02.1-02:
 *
 * - `castVote` (apps/web/src/lib/supabase/db.ts) - the wrapper over the
 *   `cast_vote` RPC. The transactional behaviour it wraps is proven against a
 *   real database in supabase/tests/cast_vote.sql; what is left to prove here
 *   is the part that lives in TypeScript: turning the function's SQLSTATEs
 *   into typed rejections the routes can map to a 4xx.
 * - the voter-eligibility truth table (apps/web/src/services/verification/eligibility.ts)
 *   - the issue #71 ballot rule: identity_score >= 40 AND explicitly verified
 *   residency, with no evidence substituting for residency.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock only the Supabase client. `castVote` and `getUserVote` run for real
// against this mock, following the bags-trending.test.ts chained-mock shape -
// so the error mapping below is exercised through the real code path rather
// than through a stubbed function.
const mockFrom = vi.fn();
const mockRpc = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: (table: string) => mockFrom(table),
    rpc: (fn: string, args: unknown) => mockRpc(fn, args),
  },
}));

// `checkVoterEligibility` needs `getActiveVerificationRun` controllable
// without disturbing `castVote`/`getUserVote`, which must stay real
// implementations running against the mocked `supabaseAdmin` above.
vi.mock('@/lib/supabase/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/db')>();
  return { ...actual, getActiveVerificationRun: vi.fn() };
});

import { castVote, CastVoteRejected } from '@/lib/supabase/db';
import { getActiveVerificationRun } from '@/lib/supabase/db';
import {
  hasVerifiedResidency,
  decideVoterEligibility,
  checkVoterEligibility,
} from '@/services/verification/eligibility';

function rpcChain(result: { data: unknown; error: unknown }) {
  return {
    single: vi.fn().mockResolvedValue(result),
  };
}

describe('castVote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps a fresh ballot to outcome "cast"', async () => {
    mockRpc.mockReturnValueOnce(
      rpcChain({
        data: {
          out_outcome: 'cast',
          out_ballot_id: 'vote-row-1',
          out_option_id: 'option-1',
          out_option_votes: 3,
          out_participant_count: 7,
          out_created_at: '2026-08-02T10:00:00Z',
        },
        error: null,
      })
    );

    const result = await castVote({
      userId: 'user-1',
      voteId: 'vote-1',
      optionId: 'option-1',
    });

    expect(result).toEqual({
      outcome: 'cast',
      ballotId: 'vote-row-1',
      optionId: 'option-1',
      optionVotes: 3,
      participantCount: 7,
      createdAt: '2026-08-02T10:00:00Z',
    });
    expect(mockRpc).toHaveBeenCalledWith('cast_vote', {
      p_user_id: 'user-1',
      p_vote_id: 'vote-1',
      p_option_id: 'option-1',
      p_payment_id: null,
    });
  });

  it('reports a replay as "already_voted" with the ballot already cast', async () => {
    mockRpc.mockReturnValueOnce(
      rpcChain({
        data: {
          out_outcome: 'already_voted',
          out_ballot_id: 'vote-row-existing',
          out_option_id: 'option-2',
          out_option_votes: 1,
          out_participant_count: 1,
          out_created_at: '2026-08-01T09:00:00Z',
        },
        error: null,
      })
    );

    const result = await castVote({
      userId: 'user-1',
      voteId: 'vote-1',
      optionId: 'option-1',
    });

    // The option that came back is the one already on the ballot, not the one
    // just submitted: a second submission does not switch a vote.
    expect(result.outcome).toBe('already_voted');
    expect(result.optionId).toBe('option-2');
  });

  // The three rejections cast_vote raises must arrive as CastVoteRejected, or
  // the routes turn a closed vote into a 500 instead of the 400 it is.
  it.each([
    ['TV001', 'VOTE_NOT_FOUND'],
    ['TV002', 'VOTE_ENDED'],
    ['TV003', 'OPTION_NOT_IN_VOTE'],
    ['TV004', 'VOTE_NOT_OPEN'],
  ])('maps SQLSTATE %s to a %s rejection', async (code, reason) => {
    mockRpc.mockReturnValueOnce(
      rpcChain({ data: null, error: { code, message: 'refused by cast_vote' } })
    );

    await expect(
      castVote({ userId: 'user-1', voteId: 'vote-1', optionId: 'option-1' })
    ).rejects.toMatchObject({ name: 'CastVoteRejected', reason });
  });

  it('rethrows an unrecognised error rather than dressing it as a rejection', async () => {
    mockRpc.mockReturnValueOnce(
      rpcChain({ data: null, error: { code: '23503', message: 'foreign key violation' } })
    );

    const failure = castVote({ userId: 'user-1', voteId: 'vote-1', optionId: 'option-1' });
    await expect(failure).rejects.toThrow(/foreign key violation/);
    await expect(failure).rejects.not.toBeInstanceOf(CastVoteRejected);
  });

  it('rejects an outcome it does not recognise instead of calling it a duplicate', async () => {
    mockRpc.mockReturnValueOnce(
      rpcChain({
        data: {
          out_outcome: 'superseded',
          out_ballot_id: 'vote-row-1',
          out_option_id: 'option-1',
          out_option_votes: 1,
          out_participant_count: 1,
          out_created_at: '2026-08-02T10:00:00Z',
        },
        error: null,
      })
    );

    await expect(
      castVote({ userId: 'user-1', voteId: 'vote-1', optionId: 'option-1' })
    ).rejects.toThrow(/unrecognised outcome/);
  });

  it('rejects when the function returns no row at all', async () => {
    mockRpc.mockReturnValueOnce(rpcChain({ data: null, error: null }));

    await expect(
      castVote({ userId: 'user-1', voteId: 'vote-1', optionId: 'option-1' })
    ).rejects.toThrow(/returned no row/);
  });

  it('passes the payment id through for a paid ballot', async () => {
    mockRpc.mockReturnValueOnce(
      rpcChain({
        data: {
          out_outcome: 'cast',
          out_ballot_id: 'vote-row-1',
          out_option_id: 'option-1',
          out_option_votes: 1,
          out_participant_count: 1,
          out_created_at: '2026-08-02T10:00:00Z',
        },
        error: null,
      })
    );

    await castVote({
      userId: 'user-1',
      voteId: 'vote-1',
      optionId: 'option-1',
      paymentId: 'payment-9',
    });

    expect(mockRpc).toHaveBeenCalledWith(
      'cast_vote',
      expect.objectContaining({ p_payment_id: 'payment-9' })
    );
  });
});

describe('voter eligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hasVerifiedResidency', () => {
    it('is true when verification_status is verified, regardless of the active run', () => {
      expect(hasVerifiedResidency({ verification_status: 'verified' }, null)).toBe(true);
    });

    it('is true when the active run has at least one completed check-in', () => {
      expect(
        hasVerifiedResidency({ verification_status: 'pending' }, { completed_check_ins: 1 })
      ).toBe(true);
    });

    it('is false when the active run has zero completed check-ins', () => {
      expect(
        hasVerifiedResidency({ verification_status: 'pending' }, { completed_check_ins: 0 })
      ).toBe(false);
    });

    it('is false when there is no active run and status is none', () => {
      expect(hasVerifiedResidency({ verification_status: 'none' }, null)).toBe(false);
    });

    it('is true for a completed check-in even when status is failed (client rule does not read failed)', () => {
      expect(
        hasVerifiedResidency({ verification_status: 'failed' }, { completed_check_ins: 2 })
      ).toBe(true);
    });
  });

  describe('decideVoterEligibility', () => {
    it('returns IDENTITY_NOT_VERIFIED when residency is in hand but the points still fall short', () => {
      const result = decideVoterEligibility(
        { verification_status: 'verified', identity_score: 39 },
        null
      );
      expect(result).toEqual({
        eligible: false,
        code: 'IDENTITY_NOT_VERIFIED',
        message: expect.any(String),
      });
    });

    it('returns RESIDENCY_NOT_VERIFIED when residency is the missing half', () => {
      const result = decideVoterEligibility(
        { verification_status: 'none', identity_score: 40 },
        null
      );
      expect(result).toEqual({
        eligible: false,
        code: 'RESIDENCY_NOT_VERIFIED',
        message: expect.any(String),
      });
    });

    it('names residency first when both are missing - it is the larger and the likelier gap', () => {
      const result = decideVoterEligibility(
        { verification_status: 'none', identity_score: 0 },
        null
      );
      expect(result).toMatchObject({ code: 'RESIDENCY_NOT_VERIFIED' });
    });

    it('returns eligible: true at exactly the floor - sign-in plus residency', () => {
      const result = decideVoterEligibility(
        { verification_status: 'verified', identity_score: 40 },
        null
      );
      expect(result).toEqual({ eligible: true });
    });

    it('a verified resident stays eligible during the app-first migration window', () => {
      // The app deploys before the migration backfills the GPS +20 into the
      // stored score, so a verified google-only resident still carries 40.
      // Residency is the boolean requirement, not the points: 40 >= floor
      // AND residency verified -> eligible. The gate never tops up points.
      const preBackfill = decideVoterEligibility(
        { verification_status: 'verified', identity_score: 40 },
        null
      );
      const postBackfill = decideVoterEligibility(
        { verification_status: 'verified', identity_score: 60 },
        null
      );
      expect(preBackfill).toEqual({ eligible: true });
      expect(postBackfill).toEqual({ eligible: true });
    });

    it('refuses every arrangement of accounts that skips the residency check', () => {
      // Google 40 + Facebook 10 + Instagram 10 = 60 clears the points floor,
      // but without residency the ballot stays shut. If this ever passes, the
      // gate has stopped meaning "a real resident".
      const result = decideVoterEligibility(
        { verification_status: 'none', identity_score: 60 },
        { completed_check_ins: 0 }
      );
      expect(result).toMatchObject({ eligible: false, code: 'RESIDENCY_NOT_VERIFIED' });
    });

    it.each([
      [80, 'google + approved identity document'],
      [90, 'google + document + phone'],
      [140, 'every non-residency evidence the model has'],
    ])(
      'no score substitutes for residency: %i points (%s) without GPS stays ineligible',
      (identity_score) => {
        const result = decideVoterEligibility(
          { verification_status: 'none', identity_score },
          null
        );
        expect(result).toMatchObject({ eligible: false, code: 'RESIDENCY_NOT_VERIFIED' });
      }
    );
  });

  describe('checkVoterEligibility', () => {
    it('loads the active run and returns eligible: true when it has a completed check-in', async () => {
      vi.mocked(getActiveVerificationRun).mockResolvedValue({
        id: 'run-1',
        user_id: 'user-1',
        municipality_id: 'tel-aviv',
        status: 'active',
        started_at: '2026-07-01T00:00:00Z',
        completed_at: null,
        total_check_ins: 21,
        completed_check_ins: 1,
        failed_check_ins: 0,
        created_at: '2026-07-01T00:00:00Z',
        updated_at: '2026-07-02T00:00:00Z',
      });

      // Google-only resident mid-programme: the first check-in supplies the
      // residency requirement (PR #108 semantics preserved) and the Google
      // baseline satisfies the 40-point floor.
      const result = await checkVoterEligibility({
        id: 'user-1',
        verification_status: 'pending',
        identity_score: 40,
      });

      expect(result).toEqual({ eligible: true });
      expect(getActiveVerificationRun).toHaveBeenCalledWith('user-1');
    });

    it('reads the run even when the stored score alone would refuse - it holds the residency evidence', async () => {
      // Without the run, this user's residency reads false and the ballot is
      // refused; the run's single check-in is what admits them. Deciding
      // without reading it would refuse exactly the residents the programme
      // exists to admit.
      vi.mocked(getActiveVerificationRun).mockResolvedValue({
        id: 'run-1',
        user_id: 'user-1',
        municipality_id: 'tel-aviv',
        status: 'active',
        started_at: '2026-07-01T00:00:00Z',
        completed_at: null,
        total_check_ins: 21,
        completed_check_ins: 1,
        failed_check_ins: 0,
        created_at: '2026-07-01T00:00:00Z',
        updated_at: '2026-07-02T00:00:00Z',
      });

      const result = await checkVoterEligibility({
        id: 'user-1',
        verification_status: 'pending',
        identity_score: 40,
      });

      expect(result).toEqual({ eligible: true });
      expect(getActiveVerificationRun).toHaveBeenCalledWith('user-1');
    });

    it('refuses a signed-in resident who has not started the residency programme', async () => {
      vi.mocked(getActiveVerificationRun).mockResolvedValue(null);

      const result = await checkVoterEligibility({
        id: 'user-1',
        verification_status: 'none',
        identity_score: 60, // Google + both socials: the ceiling without GPS.
      });

      expect(result).toEqual({
        eligible: false,
        code: 'RESIDENCY_NOT_VERIFIED',
        message: expect.stringContaining('60'),
      });
    });
  });
});
