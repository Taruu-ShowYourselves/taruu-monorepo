/**
 * Approving a machine-written topic bills nobody.
 *
 * The ₪50 creation fee (SPACE-05, issue #75) is charged to the *submitter* at
 * approval. That is right for a resident who raised a proposal and wrong for a
 * discovery-fleet topic, whose submitter is the editorial desk user - a
 * synthetic account with no card, no consent and nothing to bill. Today's port
 * only records an obligation row, so the mistake would be silent; the moment
 * PAY-06 swaps that insert for a real capture it stops being silent, which is
 * exactly why the exemption goes in before the volume does.
 *
 * The mirror assertion matters as much as the exemption: a human submission
 * must keep paying. An exemption that quietly widened to everyone would delete
 * the fee, and nothing else in the suite would notice.
 *
 * The fee/ordering mechanics themselves live in space-admin-approve-charge.ts
 * and are not repeated here.
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

const charge = vi.fn();
vi.mock('@/server/infra/payments/creation-fee', () => ({
  createCreationFeePort: () => ({ charge }),
}));

import { getSessionFromRequest } from '@/services/auth/session';
import type { Capability } from '@/server/domain/space/capability';
import { findActiveGrant } from '@/server/infra/supabase/space.repo';
import { insertAuditRow } from '@/server/infra/supabase/space-audit.repo';
import {
  findProposalInScope,
  transitionProposal,
} from '@/server/infra/supabase/space-decision.repo';
import { DEFAULT_INGEST_CREATOR_ID } from '@/lib/ingest-creator';
import { POST as DECIDE } from '@/app/api/space-admin/[spaceId]/proposals/[voteId]/decide/route';

const VOTE_ID = '55555555-5555-4555-8555-555555555555';
const HUMAN_SUBMITTER = '44444444-4444-4444-8444-444444444444';
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
  delete process.env.INGEST_CREATOR_ID;
  (getSessionFromRequest as Mock).mockResolvedValue(SESSION);
  grantOnlyInSpaceA(['proposal.read', 'proposal.approve', 'proposal.reject']);
  (transitionProposal as Mock).mockReturnValue(okAsync({ id: VOTE_ID, status: 'active' }));
  (insertAuditRow as Mock).mockReturnValue(okAsync(auditRow()));
  charge.mockReturnValue(okAsync({ paymentId: PAYMENT_ID, outcome: 'obligation' }));
});

describe('a discovery-fleet topic is approved without a charge', () => {
  beforeEach(() => {
    (findProposalInScope as Mock).mockReturnValue(
      okAsync(detailRow({ creator_id: DEFAULT_INGEST_CREATOR_ID }))
    );
  });

  it('never reaches the fee port', async () => {
    const res = await DECIDE(post({ decision: 'approve', reason: REASON }), ctx());

    expect(res.status).toBe(200);
    expect(charge).not.toHaveBeenCalled();
  });

  it('still publishes and still audits', async () => {
    // The exemption removes the billing step and nothing else. A topic that
    // skipped the fee must not also skip the transition or the audit row -
    // SPACE-04 wants every decision logged, editorial ones included.
    await DECIDE(post({ decision: 'approve', reason: REASON }), ctx());

    expect(transitionProposal).toHaveBeenCalledTimes(1);
    expect(insertAuditRow).toHaveBeenCalledTimes(1);
  });

  it('records no payment reference on the audit row', async () => {
    await DECIDE(post({ decision: 'approve', reason: REASON }), ctx());

    const written = (insertAuditRow as Mock).mock.calls[0][0];

    // The audit row is the one immutable record of what a decision did. An
    // approval that cost nothing has to read that way in the log, or a later
    // reconciliation will hunt for a payments row that never existed.
    expect(written.new_state).not.toHaveProperty('paymentId');
    expect(written.new_state).not.toHaveProperty('amountAgorot');
    expect(written.new_state).toMatchObject({ status: 'active' });
  });

  it('follows the configured ingest identity, not a hard-coded literal', async () => {
    const configured = '12121212-1212-4121-8121-121212121212';
    process.env.INGEST_CREATOR_ID = configured;
    (findProposalInScope as Mock).mockReturnValue(
      okAsync(detailRow({ creator_id: configured }))
    );

    await DECIDE(post({ decision: 'approve', reason: REASON }), ctx());

    expect(charge).not.toHaveBeenCalled();
  });
});

describe('a resident’s proposal still pays', () => {
  it('charges the human submitter exactly as before', async () => {
    (findProposalInScope as Mock).mockReturnValue(
      okAsync(detailRow({ creator_id: HUMAN_SUBMITTER }))
    );

    const res = await DECIDE(post({ decision: 'approve', reason: REASON }), ctx());

    expect(res.status).toBe(200);
    expect(charge).toHaveBeenCalledTimes(1);
    expect(charge).toHaveBeenCalledWith(
      expect.objectContaining({ submitterUserId: HUMAN_SUBMITTER })
    );
  });

  it('is not exempted by an unrelated account resembling the desk user', async () => {
    // Guards the shape of the predicate: identity equality, never a prefix or
    // a "looks synthetic" heuristic.
    const lookalike = '99999999-9999-4999-8999-999999999998';
    (findProposalInScope as Mock).mockReturnValue(
      okAsync(detailRow({ creator_id: lookalike }))
    );

    await DECIDE(post({ decision: 'approve', reason: REASON }), ctx());

    expect(charge).toHaveBeenCalledWith(
      expect.objectContaining({ submitterUserId: lookalike })
    );
  });
});
