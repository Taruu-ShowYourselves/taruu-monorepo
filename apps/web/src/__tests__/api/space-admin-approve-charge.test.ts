/**
 * The ₪50 creation fee at approval — SPACE-05, issue #75.
 *
 * This file covers exactly one thing: the interaction between the decision and
 * `CreationFeePort`. Who gets billed, when the charge fires relative to the
 * publish, what a decline leaves behind, and which decisions never charge at
 * all. The guard chain itself — capability, scope, self-review, the reason
 * field — belongs to space-admin-decide.test.ts and is not repeated here.
 *
 * The port is stubbed, so what this proves is ordering and argument
 * correctness. That a retried approval actually collapses onto one `payments`
 * row is the UNIQUE constraint's guarantee, not this file's; what is asserted
 * here is the precondition for it — that both attempts ask for the same thing.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { errAsync, okAsync } from 'neverthrow';
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
 * The port is replaced wholesale. The real one reaches Supabase, and a test
 * that needed a database to prove "a declined charge publishes nothing" would
 * not be able to prove it on the branch that matters.
 */
const charge = vi.fn();
vi.mock('@/server/infra/payments/creation-fee', () => ({
  createCreationFeePort: () => ({ charge }),
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
import { conflict, paymentInvalid } from '@/server/http/errors';
import { CREATION_FEE_AGOROT } from '@/server/app/space-admin/ports/creation-fee';
import { CHARGE_FAILED_HE } from '@/server/app/space-admin/decide-proposal';
import { POST as DECIDE } from '@/app/api/space-admin/[spaceId]/proposals/[voteId]/decide/route';

const VOTE_ID = '55555555-5555-4555-8555-555555555555';
const SUBMITTER_ID = '44444444-4444-4444-8444-444444444444';
const PAYMENT_ID = '77777777-7777-4777-8777-777777777777';
const REASON = 'ההצעה עומדת בכללי המרחב ולכן אושרה לפרסום';

const detailRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  ...proposalRow(),
  start_date: '2026-07-01T00:00:00.000Z',
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
  charge.mockReturnValue(okAsync({ paymentId: PAYMENT_ID, outcome: 'obligation' }));
});

describe('approval charges the submitter, not the reviewer', () => {
  it('asks the port for ₪50 against the proposal’s creator', async () => {
    const res = await DECIDE(post({ decision: 'approve', reason: REASON }), ctx());

    expect(res.status).toBe(200);
    expect(charge).toHaveBeenCalledTimes(1);
    expect(charge).toHaveBeenCalledWith({
      submitterUserId: SUBMITTER_ID,
      voteId: VOTE_ID,
      amountAgorot: CREATION_FEE_AGOROT,
    });
    // The reviewer is the session holder. Billing them would be the exact
    // defect this assertion exists to catch.
    expect(charge.mock.calls[0][0].submitterUserId).not.toBe(SESSION.userId);
    expect(CREATION_FEE_AGOROT).toBe(5000);
  });

  it('bills whoever actually submitted, not a hard-coded fixture id', async () => {
    const otherSubmitter = '88888888-8888-4888-8888-888888888888';
    (findProposalInScope as Mock).mockReturnValue(
      okAsync(detailRow({ creator_id: otherSubmitter }))
    );

    await DECIDE(post({ decision: 'approve', reason: REASON }), ctx());

    expect(charge).toHaveBeenCalledWith(
      expect.objectContaining({ submitterUserId: otherSubmitter })
    );
  });
});

describe('the charge fires before the publish', () => {
  it('reaches the port ahead of transitionProposal', async () => {
    const order: string[] = [];
    charge.mockImplementation(() => {
      order.push('charge');
      return okAsync({ paymentId: PAYMENT_ID, outcome: 'obligation' });
    });
    (transitionProposal as Mock).mockImplementation(() => {
      order.push('transition');
      return okAsync({ id: VOTE_ID, status: 'active' });
    });

    await DECIDE(post({ decision: 'approve', reason: REASON }), ctx());

    expect(order).toEqual(['charge', 'transition']);
  });
});

describe('a declined charge publishes nothing and audits nothing', () => {
  it('answers 402 with the dialog’s copy, leaving the status untouched', async () => {
    charge.mockReturnValue(errAsync(paymentInvalid('התשלום נכשל')));

    const res = await DECIDE(post({ decision: 'approve', reason: REASON }), ctx());
    const body = await res.json();

    expect(res.status).toBe(402);
    expect(body.code).toBe('PAYMENT_REQUIRED');
    expect(body.error).toBe(CHARGE_FAILED_HE);
    expect(transitionProposal).not.toHaveBeenCalled();
    expect(insertAuditRow).not.toHaveBeenCalled();
  });

  it('carries the charge-failure copy the UI spec mandates', () => {
    expect(CHARGE_FAILED_HE).toBe(
      'ההצעה לא פורסמה: החיוב של המגיש/ה נכשל. אף סכום לא נגבה. נסו שוב מאוחר יותר, או החזירו את ההצעה לתיקון.'
    );
  });
});

describe('declining a proposal never asks for money', () => {
  it.each(['reject', 'request_changes'])('does not charge on %s', async (decision) => {
    const res = await DECIDE(post({ decision, reason: REASON }), ctx());

    expect(res.status).toBe(200);
    expect(charge).not.toHaveBeenCalled();
    expect(transitionProposal).toHaveBeenCalled();
  });
});

describe('the audit row ties the money to the decision', () => {
  it('records the payment id and the amount in new_state on an approval', async () => {
    await DECIDE(post({ decision: 'approve', reason: REASON }), ctx());

    expect(insertAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'proposal.approved',
        new_state: {
          status: 'active',
          paymentId: PAYMENT_ID,
          amountAgorot: CREATION_FEE_AGOROT,
        },
      })
    );
  });

  it('leaves new_state free of payment keys when nothing was charged', async () => {
    await DECIDE(post({ decision: 'reject', reason: REASON }), ctx());

    expect(insertAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({ new_state: { status: 'rejected' } })
    );
  });
});

describe('a charge that succeeded before a lost race', () => {
  it('is a 409 with no audit row, and a retry asks for exactly the same thing', async () => {
    (transitionProposal as Mock).mockReturnValue(errAsync(conflict(DECISION_CONFLICT_HE)));

    const first = await DECIDE(post({ decision: 'approve', reason: REASON }), ctx());
    expect(first.status).toBe(409);
    expect(insertAuditRow).not.toHaveBeenCalled();

    const second = await DECIDE(post({ decision: 'approve', reason: REASON }), ctx());
    expect(second.status).toBe(409);

    // Identical arguments on both attempts is what lets the port's
    // deterministic idempotency key collapse them onto one payments row. If
    // either call carried something request-scoped, it could not.
    expect(charge).toHaveBeenCalledTimes(2);
    expect(charge.mock.calls[0][0]).toEqual(charge.mock.calls[1][0]);
  });
});
