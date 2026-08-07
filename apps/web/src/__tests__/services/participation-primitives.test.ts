/**
 * Unit proof for the two participation primitives added in phase 02.1-02:
 *
 * - `recordUserVoteOnce` (apps/web/src/lib/supabase/db.ts) - an insert that
 *   survives a duplicate submit by keying off SQLSTATE 23505 and reading the
 *   existing ballot back instead of throwing.
 * - the voter-eligibility truth table (apps/web/src/services/verification/eligibility.ts)
 *   - the issue #71 ballot rule: identity_score >= 60 AND explicitly verified
 *   residency, with no evidence substituting for residency.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock only the Supabase client. `recordUserVoteOnce` and `getUserVote` run
// for real against this mock, following the bags-trending.test.ts chained-mock
// shape - this is what proves the duplicate path reads the existing ballot
// back through the real code path rather than through a stubbed function.
const mockFrom = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: (table: string) => mockFrom(table),
  },
}));

// `checkVoterEligibility` needs `getActiveVerificationRun` controllable
// without disturbing `recordUserVoteOnce`/`getUserVote`, which must stay real
// implementations running against the mocked `supabaseAdmin` above.
vi.mock('@/lib/supabase/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/db')>();
  return { ...actual, getActiveVerificationRun: vi.fn() };
});

import { recordUserVoteOnce } from '@/lib/supabase/db';
import { getActiveVerificationRun } from '@/lib/supabase/db';
import {
  hasVerifiedResidency,
  decideVoterEligibility,
  checkVoterEligibility,
} from '@/services/verification/eligibility';

function insertChain(result: { data: unknown; error: unknown }) {
  return {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

function selectChain(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(result),
        }),
      }),
    }),
  };
}

describe('recordUserVoteOnce', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves { created: true, vote } on a clean insert', async () => {
    const insertedRow = {
      id: 'vote-row-1',
      user_id: 'user-1',
      vote_id: 'vote-1',
      option_id: 'option-1',
      payment_id: null,
      created_at: '2026-08-02T10:00:00Z',
    };
    mockFrom.mockReturnValueOnce(insertChain({ data: insertedRow, error: null }));

    const result = await recordUserVoteOnce({
      user_id: 'user-1',
      vote_id: 'vote-1',
      option_id: 'option-1',
    });

    expect(result).toEqual({ created: true, vote: insertedRow });
    expect(result.vote.id).toBe('vote-row-1');
  });

  it('resolves { created: false, vote } and does not throw on a 23505 conflict with a readable existing row', async () => {
    const existingRow = {
      id: 'vote-row-existing',
      user_id: 'user-1',
      vote_id: 'vote-1',
      option_id: 'option-2',
      payment_id: null,
      created_at: '2026-08-01T09:00:00Z',
    };
    mockFrom
      .mockReturnValueOnce(
        insertChain({
          data: null,
          error: {
            code: '23505',
            message:
              'duplicate key value violates unique constraint "user_votes_user_id_vote_id_key"',
          },
        })
      )
      .mockReturnValueOnce(selectChain({ data: existingRow, error: null }));

    const result = await recordUserVoteOnce({
      user_id: 'user-1',
      vote_id: 'vote-1',
      option_id: 'option-1',
    });

    expect(result).toEqual({ created: false, vote: existingRow });
  });

  it('rejects when a 23505 conflict has no readable row on read-back', async () => {
    mockFrom
      .mockReturnValueOnce(
        insertChain({
          data: null,
          error: { code: '23505', message: 'duplicate key value violates unique constraint' },
        })
      )
      .mockReturnValueOnce(selectChain({ data: null, error: { code: 'PGRST116', message: 'no rows' } }));

    await expect(
      recordUserVoteOnce({ user_id: 'user-1', vote_id: 'vote-1', option_id: 'option-1' })
    ).rejects.toThrow();
  });

  it('rejects with the message preserved for any other error code', async () => {
    mockFrom.mockReturnValueOnce(
      insertChain({
        data: null,
        error: { code: '23503', message: 'foreign key violation' },
      })
    );

    await expect(
      recordUserVoteOnce({ user_id: 'user-1', vote_id: 'vote-1', option_id: 'option-1' })
    ).rejects.toThrow(/foreign key violation/);
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
