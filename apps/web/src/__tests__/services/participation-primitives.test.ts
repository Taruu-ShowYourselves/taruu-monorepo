/**
 * Unit proof for the two participation primitives added in phase 02.1-02:
 *
 * - `recordUserVoteOnce` (apps/web/src/lib/supabase/db.ts) — an insert that
 *   survives a duplicate submit by keying off SQLSTATE 23505 and reading the
 *   existing ballot back instead of throwing.
 * - the voter-eligibility truth table (apps/web/src/services/verification/eligibility.ts)
 *   — a pure mirror of the client's `isEligibleToVote` plus the pre-existing
 *   `identity_score >= 40` server gate.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock only the Supabase client. `recordUserVoteOnce` and `getUserVote` run
// for real against this mock, following the bags-trending.test.ts chained-mock
// shape — this is what proves the duplicate path reads the existing ballot
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
    it('returns IDENTITY_NOT_VERIFIED when identity_score is below 40, checked before residency', () => {
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

    it('returns RESIDENCY_NOT_VERIFIED when identity passes but residency does not', () => {
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

    it('returns eligible: true when both identity and residency pass', () => {
      const result = decideVoterEligibility(
        { verification_status: 'verified', identity_score: 40 },
        null
      );
      expect(result).toEqual({ eligible: true });
    });
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

      const result = await checkVoterEligibility({
        id: 'user-1',
        verification_status: 'pending',
        identity_score: 40,
      });

      expect(result).toEqual({ eligible: true });
      expect(getActiveVerificationRun).toHaveBeenCalledWith('user-1');
    });

    it('short-circuits on identity_score below 40 without calling getActiveVerificationRun', async () => {
      const result = await checkVoterEligibility({
        id: 'user-1',
        verification_status: 'verified',
        identity_score: 0,
      });

      expect(result).toEqual({
        eligible: false,
        code: 'IDENTITY_NOT_VERIFIED',
        message: expect.any(String),
      });
      expect(getActiveVerificationRun).not.toHaveBeenCalled();
    });
  });
});
