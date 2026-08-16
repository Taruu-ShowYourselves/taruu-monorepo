/**
 * Proposal decisions - SPACE-05.
 *
 * Five properties are load-bearing here and each gets its own case: approval is
 * the only decision that publishes, a decision that lost a race is a 409 and
 * not a second publication, a submitter cannot decide their own proposal, a
 * reason under ten characters never reaches the database, and every decision
 * that happened wrote exactly one audit row.
 *
 * The repositories are mocked, so what this file proves is the *use-case*
 * chain: which guard fires first, which repository was reached, and which was
 * not. The SQL-level guarantees - the conditional UPDATE and the partial unique
 * index - are the repository's and the database's, not this file's.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { errAsync, okAsync } from 'neverthrow';
import {
  MUNICIPALITY_A,
  OTHER_USER_ID,
  SESSION,
  SPACE_A,
  SPACE_B,
  auditRow,
  proposalRow,
} from '../fixtures/space';

vi.mock('@/services/auth/session', () => ({ getSessionFromRequest: vi.fn() }));

vi.mock('@/server/infra/supabase/space.repo', () => ({
  findActiveGrant: vi.fn(),
  findGrantsForUser: vi.fn(),
  findSpaceSummary: vi.fn(),
  findSpaceSummaryByMembership: vi.fn(),
  listProposals: vi.fn(),
  countProposalsAwaitingDecision: vi.fn(),
}));

/**
 * Spread the real module so `DECISION_CONFLICT_HE` stays the shipped constant
 * rather than a copy this file could let drift from the UI spec.
 */
vi.mock('@/server/infra/supabase/space-decision.repo', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/server/infra/supabase/space-decision.repo')>();
  return { ...actual, findProposalInScope: vi.fn(), transitionProposal: vi.fn() };
});

vi.mock('@/server/infra/supabase/space-audit.repo', () => ({
  AUDIT_PAGE_MAX: 100,
  insertAuditRow: vi.fn(),
  listAuditRows: vi.fn(),
}));

/**
 * Approval charges the ₪50 creation fee (05-10) through this port before it
 * publishes, and the real implementation reaches Supabase. A permanently
 * succeeding stub keeps this file about the guard chain; the charge itself -
 * who is billed, the ordering, what a decline leaves behind - is
 * space-admin-approve-charge.test.ts's subject, and is not duplicated here.
 */
vi.mock('@/server/infra/payments/creation-fee', () => ({
  createCreationFeePort: () => ({
    charge: vi.fn(() =>
      okAsync({ paymentId: '77777777-7777-4777-8777-777777777777', outcome: 'obligation' })
    ),
  }),
}));

import { getSessionFromRequest } from '@/services/auth/session';
import type { Capability } from '@/server/domain/space/capability';
import { findActiveGrant } from '@/server/infra/supabase/space.repo';
import { insertAuditRow } from '@/server/infra/supabase/space-audit.repo';
import {
  DECISION_CONFLICT_HE,
  findProposalInScope,
  transitionProposal,
} from '@/server/infra/supabase/space-decision.repo';
import { conflict } from '@/server/http/errors';
import { POST as DECIDE } from '@/app/api/space-admin/[spaceId]/proposals/[voteId]/decide/route';
import { GET as GET_DETAIL } from '@/app/api/space-admin/[spaceId]/proposals/[voteId]/route';

const VOTE_ID = '55555555-5555-4555-8555-555555555555';
const REASON = 'ההצעה עומדת בכללי המרחב ולכן אושרה לפרסום';
const SELF_SUBMITTED_HE = 'הצעה שהגשתם - ההכרעה שמורה למנהל אחר.';
const PAST = '2026-07-01T00:00:00.000Z';
const FUTURE = '2099-01-01T00:00:00.000Z';

/** The queue row plus the two schedule columns the decision reads. */
const detailRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  ...proposalRow(),
  start_date: PAST,
  end_date: '2099-12-31T00:00:00.000Z',
  ...overrides,
});

const post = (body: unknown, spaceId = SPACE_A, voteId = VOTE_ID) =>
  new NextRequest(
    `http://localhost/api/space-admin/${spaceId}/proposals/${voteId}/decide`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

const get = (spaceId = SPACE_A, voteId = VOTE_ID) =>
  new NextRequest(`http://localhost/api/space-admin/${spaceId}/proposals/${voteId}`);

const ctx = (spaceId = SPACE_A, voteId = VOTE_ID) => ({
  params: Promise.resolve({ spaceId, voteId }),
});

/** The caller holds exactly these capabilities, and only in space A. */
function grantOnlyInSpaceA(capabilities: Capability[]) {
  (findActiveGrant as Mock).mockImplementation((_userId, spaceId, capability) =>
    okAsync(
      spaceId === SPACE_A && capabilities.includes(capability)
        ? { space_id: SPACE_A, municipality_code: MUNICIPALITY_A }
        : null
    )
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SPACE_ADMIN_ENABLED;
  (getSessionFromRequest as Mock).mockResolvedValue(SESSION);
  grantOnlyInSpaceA(['proposal.read', 'proposal.approve', 'proposal.reject']);
  (findProposalInScope as Mock).mockReturnValue(okAsync(detailRow()));
  (transitionProposal as Mock).mockReturnValue(okAsync({ id: VOTE_ID, status: 'active' }));
  (insertAuditRow as Mock).mockReturnValue(okAsync(auditRow()));
});

describe('POST …/decide - the three decisions', () => {
  it('publishes an approved proposal whose start date has passed', async () => {
    const res = await DECIDE(post({ decision: 'approve', reason: REASON }), ctx());

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: VOTE_ID, status: 'active' });
    expect(transitionProposal).toHaveBeenCalledWith(
      expect.anything(),
      VOTE_ID,
      'in_review',
      'active'
    );
    expect(insertAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'proposal.approved' })
    );
  });

  it('schedules rather than opens an approval whose start date is still ahead', async () => {
    (findProposalInScope as Mock).mockReturnValue(
      okAsync(detailRow({ start_date: FUTURE }))
    );

    const res = await DECIDE(post({ decision: 'approve', reason: REASON }), ctx());

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'pending' });
    expect(transitionProposal).toHaveBeenCalledWith(
      expect.anything(),
      VOTE_ID,
      'in_review',
      'pending'
    );
  });

  it('moves a rejected proposal to rejected and publishes nothing', async () => {
    const res = await DECIDE(post({ decision: 'reject', reason: REASON }), ctx());

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'rejected' });
    expect(transitionProposal).toHaveBeenCalledWith(
      expect.anything(),
      VOTE_ID,
      'in_review',
      'rejected'
    );
    expect(insertAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'proposal.rejected' })
    );
  });

  it('returns a proposal for changes without publishing it', async () => {
    const res = await DECIDE(post({ decision: 'request_changes', reason: REASON }), ctx());

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'changes_requested' });
    expect(insertAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'proposal.changes_requested' })
    );
  });
});

describe('POST …/decide - the reason is mandatory', () => {
  it('refuses a nine-character reason before any database work', async () => {
    const res = await DECIDE(post({ decision: 'approve', reason: 'תשעה תוו' }), ctx());

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('VALIDATION_ERROR');
    expect(findProposalInScope).not.toHaveBeenCalled();
    expect(transitionProposal).not.toHaveBeenCalled();
    expect(insertAuditRow).not.toHaveBeenCalled();
  });

  it('treats a whitespace-only reason as a 400, not a database CHECK 500', async () => {
    const res = await DECIDE(post({ decision: 'approve', reason: '          ' }), ctx());

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('VALIDATION_ERROR');
    expect(findProposalInScope).not.toHaveBeenCalled();
  });

  it('refuses an unknown decision verb', async () => {
    const res = await DECIDE(post({ decision: 'publish', reason: REASON }), ctx());

    expect(res.status).toBe(400);
    expect(findProposalInScope).not.toHaveBeenCalled();
  });
});

describe('POST …/decide - object-level and capability refusals', () => {
  it('refuses the submitter their own proposal, whatever the UI rendered', async () => {
    (findProposalInScope as Mock).mockReturnValue(
      okAsync(detailRow({ creator_id: SESSION.userId }))
    );

    const res = await DECIDE(post({ decision: 'approve', reason: REASON }), ctx());

    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(SELF_SUBMITTED_HE);
    expect(transitionProposal).not.toHaveBeenCalled();
    expect(insertAuditRow).not.toHaveBeenCalled();
  });

  it('answers 403 - never 404 - for a vote that belongs to another space', async () => {
    (findProposalInScope as Mock).mockReturnValue(okAsync(null));

    const res = await DECIDE(post({ decision: 'approve', reason: REASON }), ctx());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toEqual({ error: 'Forbidden', code: 'FORBIDDEN' });
    expect(JSON.stringify(body).toLowerCase()).not.toContain('not found');
    expect(transitionProposal).not.toHaveBeenCalled();
  });

  it('refuses a caller who holds only metrics.read', async () => {
    grantOnlyInSpaceA(['metrics.read']);

    const res = await DECIDE(post({ decision: 'approve', reason: REASON }), ctx());

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden', code: 'FORBIDDEN' });
    expect(findProposalInScope).not.toHaveBeenCalled();
  });

  it.each([
    ['approve', ['proposal.reject'] as Capability[]],
    ['reject', ['proposal.approve'] as Capability[]],
    ['request_changes', ['proposal.approve'] as Capability[]],
  ])('refuses %s to a caller holding the other decision capability', async (decision, held) => {
    grantOnlyInSpaceA(held);

    const res = await DECIDE(post({ decision, reason: REASON }), ctx());

    expect(res.status).toBe(403);
    expect(findProposalInScope).not.toHaveBeenCalled();
  });

  it('refuses the same opaque 403 for a space the caller does not administer', async () => {
    const res = await DECIDE(
      post({ decision: 'approve', reason: REASON }, SPACE_B),
      ctx(SPACE_B)
    );

    expect(res.status).toBe(403);
    expect(JSON.stringify(await res.json())).not.toContain(SPACE_B);
  });

  it('rejects an unauthenticated request with 401 before any authorization work', async () => {
    (getSessionFromRequest as Mock).mockResolvedValue(null);

    const res = await DECIDE(post({ decision: 'approve', reason: REASON }), ctx());

    expect(res.status).toBe(401);
    expect(findActiveGrant).not.toHaveBeenCalled();
  });
});

describe('POST …/decide - a decision that already happened', () => {
  it('is a 409 when the proposal is no longer in review', async () => {
    (findProposalInScope as Mock).mockReturnValue(okAsync(detailRow({ status: 'rejected' })));

    const res = await DECIDE(post({ decision: 'approve', reason: REASON }), ctx());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: DECISION_CONFLICT_HE, code: 'CONFLICT' });
    expect(transitionProposal).not.toHaveBeenCalled();
    expect(insertAuditRow).not.toHaveBeenCalled();
  });

  it('is a 409 with no audit row when the conditional update loses the race', async () => {
    (transitionProposal as Mock).mockReturnValue(errAsync(conflict(DECISION_CONFLICT_HE)));

    const res = await DECIDE(post({ decision: 'approve', reason: REASON }), ctx());

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe(DECISION_CONFLICT_HE);
    expect(insertAuditRow).not.toHaveBeenCalled();
  });

  it('carries the conflict copy the UI spec mandates', () => {
    expect(DECISION_CONFLICT_HE).toBe(
      'ההצעה כבר הוכרעה על ידי מנהל אחר. רעננו את הרשימה כדי לראות את המצב העדכני.'
    );
  });
});

describe('POST …/decide - a failed audit write fails the decision', () => {
  it('surfaces the audit failure rather than reporting a silent success', async () => {
    (insertAuditRow as Mock).mockReturnValue(
      errAsync({ kind: 'DB' as const, op: 'space_audit_log.insert' })
    );

    const res = await DECIDE(post({ decision: 'approve', reason: REASON }), ctx());

    expect(res.status).toBe(500);
  });
});

describe('GET …/proposals/[voteId] - the detail panel', () => {
  it('returns the proposal detail for a deep link inside the space', async () => {
    const res = await GET_DETAIL(get(), ctx());

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: VOTE_ID,
      status: 'in_review',
      body: 'גוף ההצעה',
      hiddenAt: null,
      flaggedAt: null,
      submitterId: OTHER_USER_ID,
      selfSubmitted: false,
    });
  });

  it('answers 403 rather than 404 for an id it cannot resolve in this space', async () => {
    (findProposalInScope as Mock).mockReturnValue(okAsync(null));

    const res = await GET_DETAIL(get(), ctx());

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden', code: 'FORBIDDEN' });
  });
});
