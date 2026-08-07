/**
 * Voting gate endpoint tests (GET /api/user/voting-gate).
 *
 * This is where the desk and the ballot screen learn what to SAY about
 * eligibility, and the reason they ask instead of working it out: residency is
 * a hard requirement of the ballot (issue #71) and its evidence lives in
 * `verification_runs`, which no client screen loads. A screen that guessed it
 * once told eligible residents to go verify something they already had.
 *
 * So the contract worth pinning is that the endpoint reads the run, scores it
 * the way `decideVoterEligibility` scores it, and never reports a resident
 * short for a reason the enforcement point would not also give.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

vi.mock('@/lib/supabase/db', () => ({
  getUserById: vi.fn(),
  getActiveVerificationRun: vi.fn(),
}));

import { getSessionFromRequest } from '@/services/auth/session';
import { getActiveVerificationRun, getUserById } from '@/lib/supabase/db';
import { GET } from '@/app/api/user/voting-gate/route';
import { decideVoterEligibility } from '@/services/verification/eligibility';

const session = {
  userId: 'user-123',
  googleId: 'google-123',
  email: 'resident@example.com',
  did: `did:sync:${'a'.repeat(43)}`,
  expiresAt: Date.now() + 86_400_000,
};

const user = {
  id: 'user-123',
  identity_score: 40,
  verification_status: 'none' as const,
};

const request = () => new NextRequest('http://localhost:3000/api/user/voting-gate');

beforeEach(() => {
  vi.clearAllMocks();
  (getSessionFromRequest as Mock).mockResolvedValue(session);
  (getUserById as Mock).mockResolvedValue(user);
  (getActiveVerificationRun as Mock).mockResolvedValue(null);
});

describe('GET /api/user/voting-gate', () => {
  it('reports a signed-in non-resident as blocked on residency, not points', async () => {
    const data = await (await GET(request())).json();

    expect(data).toMatchObject({
      total: 40,
      required: 40,
      missing: 0,
      canVote: false,
      residencyVerified: false,
      checkInsCompleted: 0,
    });
  });

  it('counts a single check-in as residency and opens the ballot at the Google baseline', async () => {
    (getActiveVerificationRun as Mock).mockResolvedValue({ completed_check_ins: 1 });

    const data = await (await GET(request())).json();

    // Residency is a boolean requirement, never points: the first check-in
    // satisfies it (PR #108 semantics preserved) and the 40-point Google
    // baseline satisfies the floor, so the ballot opens - the stored score's
    // +20 arrives later, when the run completes, and changes nothing here.
    expect(data).toMatchObject({
      total: 40,
      missing: 0,
      canVote: true,
      residencyVerified: true,
      checkInsCompleted: 1,
    });
  });

  it('stays open for a fully backfilled verified resident (score 60)', async () => {
    (getUserById as Mock).mockResolvedValue({
      id: 'user-123',
      identity_score: 60,
      verification_status: 'verified',
    });

    const data = await (await GET(request())).json();

    expect(data).toMatchObject({
      total: 60,
      required: 40,
      missing: 0,
      canVote: true,
      residencyVerified: true,
    });
  });

  it('agrees with the enforcement point on every case it reports', async () => {
    const cases = [
      { identity_score: 0, verification_status: 'none' as const, run: null },
      { identity_score: 40, verification_status: 'none' as const, run: null },
      { identity_score: 60, verification_status: 'none' as const, run: { completed_check_ins: 0 } },
      { identity_score: 40, verification_status: 'pending' as const, run: { completed_check_ins: 1 } },
      { identity_score: 40, verification_status: 'verified' as const, run: null },
      { identity_score: 100, verification_status: 'verified' as const, run: null },
    ];

    for (const { run, ...row } of cases) {
      (getUserById as Mock).mockResolvedValue({ id: 'user-123', ...row });
      (getActiveVerificationRun as Mock).mockResolvedValue(run);

      const data = await (await GET(request())).json();
      const enforced = decideVoterEligibility(row, run);

      expect(data.canVote).toBe(enforced.eligible);
    }
  });

  it('rejects an unauthenticated caller without reading anything', async () => {
    (getSessionFromRequest as Mock).mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(getUserById).not.toHaveBeenCalled();
    expect(getActiveVerificationRun).not.toHaveBeenCalled();
  });

  it('404s a session whose user row is gone', async () => {
    (getUserById as Mock).mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(404);
    expect(getActiveVerificationRun).not.toHaveBeenCalled();
  });
});
