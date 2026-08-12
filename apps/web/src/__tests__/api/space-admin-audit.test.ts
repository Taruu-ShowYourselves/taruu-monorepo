/**
 * The audit row a decision writes - SPACE-04.
 *
 * WHAT THIS FILE PROVES, AND WHAT IT DOES NOT.
 *
 * It proves the *application* side: that a decision writes exactly one row
 * carrying the six mandated fields plus the object it concerns, that the row's
 * prior and new states are the real transition rather than a restatement of the
 * request, and that the repository module exposes no vocabulary for changing or
 * removing history. That is the strongest property reachable in an
 * `environment: 'node'` suite where Supabase is fully mocked.
 *
 * It does NOT prove the database guarantee. That `UPDATE`, `DELETE` and
 * `TRUNCATE` against `space_audit_log` actually raise is the trigger's and the
 * REVOKE's job, and the evidence for it is `supabase/tests/audit_append_only.sql`
 * - a manual probe run against a scratch database, not something CI executes.
 * Nothing here should be read as covering it.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { okAsync } from 'neverthrow';
import { MUNICIPALITY_A, SESSION, SPACE_A, auditRow, proposalRow } from '../fixtures/space';

vi.mock('@/services/auth/session', () => ({ getSessionFromRequest: vi.fn() }));

vi.mock('@/server/infra/supabase/space.repo', () => ({
  findActiveGrant: vi.fn(),
  findGrantsForUser: vi.fn(),
  findSpaceSummary: vi.fn(),
  findSpaceSummaryByMembership: vi.fn(),
  listProposals: vi.fn(),
  countProposalsAwaitingDecision: vi.fn(),
}));

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
 * Approval charges the ₪50 creation fee (05-10) before it publishes, and the
 * real port reaches Supabase. Stubbed to a fixed payment id so the approval
 * rows below can assert that the money and the decision are linked.
 */
const CHARGED_PAYMENT_ID = '77777777-7777-4777-8777-777777777777';
vi.mock('@/server/infra/payments/creation-fee', () => ({
  createCreationFeePort: () => ({
    charge: vi.fn(() =>
      okAsync({ paymentId: '77777777-7777-4777-8777-777777777777', outcome: 'obligation' })
    ),
  }),
}));

import { getSessionFromRequest } from '@/services/auth/session';
import { findActiveGrant } from '@/server/infra/supabase/space.repo';
import { insertAuditRow } from '@/server/infra/supabase/space-audit.repo';
import {
  findProposalInScope,
  transitionProposal,
} from '@/server/infra/supabase/space-decision.repo';
import { POST as DECIDE } from '@/app/api/space-admin/[spaceId]/proposals/[voteId]/decide/route';

const VOTE_ID = '55555555-5555-4555-8555-555555555555';
const REASON = 'ההצעה עומדת בכללי המרחב ולכן אושרה לפרסום';
const PAST = '2026-07-01T00:00:00.000Z';
const FUTURE = '2099-01-01T00:00:00.000Z';

const detailRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  ...proposalRow(),
  start_date: PAST,
  end_date: '2099-12-31T00:00:00.000Z',
  ...overrides,
});

const post = (body: unknown) =>
  new NextRequest(
    `http://localhost/api/space-admin/${SPACE_A}/proposals/${VOTE_ID}/decide`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

const ctx = () => ({ params: Promise.resolve({ spaceId: SPACE_A, voteId: VOTE_ID }) });

/** The single row `insertAuditRow` was handed. */
const writtenRow = (): Record<string, unknown> => {
  expect(insertAuditRow).toHaveBeenCalledTimes(1);
  return (insertAuditRow as Mock).mock.calls[0][0] as Record<string, unknown>;
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SPACE_ADMIN_ENABLED;
  (getSessionFromRequest as Mock).mockResolvedValue(SESSION);
  (findActiveGrant as Mock).mockReturnValue(
    okAsync({ space_id: SPACE_A, municipality_code: MUNICIPALITY_A })
  );
  (findProposalInScope as Mock).mockReturnValue(okAsync(detailRow()));
  (transitionProposal as Mock).mockReturnValue(okAsync({ id: VOTE_ID, status: 'active' }));
  (insertAuditRow as Mock).mockReturnValue(okAsync(auditRow()));
});

describe('every decision writes one complete audit row', () => {
  it('carries exactly the eight mandated fields and nothing else', async () => {
    const res = await DECIDE(post({ decision: 'approve', reason: REASON }), ctx());
    expect(res.status).toBe(200);

    const row = writtenRow();
    expect(Object.keys(row).sort()).toEqual(
      [
        'action',
        'actor_user_id',
        'new_state',
        'object_id',
        'object_type',
        'prior_state',
        'reason',
        'space_id',
      ].sort()
    );
    expect(row).toMatchObject({
      space_id: SPACE_A,
      actor_user_id: SESSION.userId,
      action: 'proposal.approved',
      object_type: 'vote',
      object_id: VOTE_ID,
      reason: REASON,
    });
  });

  // An approval's new_state carries the creation fee alongside the status
  // (05-10), so the immutable log ties the ₪50 to the decision that caused it.
  // A decline carries the status alone - asserted in the it.each below.
  it('records the real transition, not a restatement of the request', async () => {
    await DECIDE(post({ decision: 'approve', reason: REASON }), ctx());

    const row = writtenRow();
    expect(row.prior_state).toEqual({ status: 'in_review' });
    expect(row.new_state).toEqual({
      status: 'active',
      paymentId: CHARGED_PAYMENT_ID,
      amountAgorot: 5000,
    });
  });

  it('records the scheduled target when approval precedes the start date', async () => {
    (findProposalInScope as Mock).mockReturnValue(
      okAsync(detailRow({ start_date: FUTURE }))
    );

    await DECIDE(post({ decision: 'approve', reason: REASON }), ctx());

    const row = writtenRow();
    expect(row.prior_state).toEqual({ status: 'in_review' });
    expect(row.new_state).toEqual({
      status: 'pending',
      paymentId: CHARGED_PAYMENT_ID,
      amountAgorot: 5000,
    });
  });

  it.each([
    ['reject', 'proposal.rejected', 'rejected'],
    ['request_changes', 'proposal.changes_requested', 'changes_requested'],
  ])('logs %s as %s with the matching new state', async (decision, action, status) => {
    await DECIDE(post({ decision, reason: REASON }), ctx());

    const row = writtenRow();
    expect(row.action).toBe(action);
    expect(row.new_state).toEqual({ status });
  });

  it('stores the reason verbatim, since the row can never be edited afterwards', async () => {
    const reason = '  ההצעה חורגת מסמכות המרחב ולכן הוחזרה לתיקון  ';
    await DECIDE(post({ decision: 'request_changes', reason }), ctx());

    // Trimmed by the contract before it ever reaches the use-case.
    expect(writtenRow().reason).toBe(reason.trim());
  });
});

describe('a reason under ten characters never reaches the data layer', () => {
  it('is refused at the edge, with no repository call at all', async () => {
    const res = await DECIDE(post({ decision: 'approve', reason: 'תשעה תוו' }), ctx());

    expect(res.status).toBe(400);
    expect(findProposalInScope).not.toHaveBeenCalled();
    expect(transitionProposal).not.toHaveBeenCalled();
    expect(insertAuditRow).not.toHaveBeenCalled();
  });
});

describe('the audit repository has no mutation vocabulary', () => {
  it('exposes no mutation path for audit rows', async () => {
    /**
     * The real module, not the mocked namespace this file installs above -
     * `Object.keys` over a mock would only describe the mock, which would make
     * this assertion pass no matter what the repository exports.
     */
    const auditRepo = await vi.importActual<
      typeof import('@/server/infra/supabase/space-audit.repo')
    >('@/server/infra/supabase/space-audit.repo');

    const mutators = Object.keys(auditRepo).filter((k) =>
      /^(update|delete|remove|purge|truncate)/i.test(k)
    );
    expect(mutators).toEqual([]);
  });
});
