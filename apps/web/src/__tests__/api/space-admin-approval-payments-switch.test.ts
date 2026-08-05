import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { okAsync } from 'neverthrow';
import { MUNICIPALITY_A, SESSION, SPACE_A, auditRow, proposalRow } from '../fixtures/space';
import type { Payment } from '@/lib/supabase/types';

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

vi.mock('@/lib/supabase/db', () => ({
  createPayment: vi.fn(),
  getPaymentByIdempotencyKey: vi.fn(),
}));

import { getSessionFromRequest } from '@/services/auth/session';
import { findActiveGrant } from '@/server/infra/supabase/space.repo';
import { insertAuditRow } from '@/server/infra/supabase/space-audit.repo';
import {
  findProposalInScope,
  transitionProposal,
} from '@/server/infra/supabase/space-decision.repo';
import { createPayment, getPaymentByIdempotencyKey } from '@/lib/supabase/db';
import { POST as DECIDE } from '@/app/api/space-admin/[spaceId]/proposals/[voteId]/decide/route';

const VOTE_ID = '55555555-5555-4555-8555-555555555555';
const SUBMITTER_ID = '44444444-4444-4444-8444-444444444444';
const PAYMENT_ID = '77777777-7777-4777-8777-777777777777';
const REASON = 'ההצעה עומדת בכללי המרחב ולכן אושרה לפרסום';

const paymentRow = (overrides: Partial<Payment> = {}): Payment => ({
  id: PAYMENT_ID,
  user_id: SUBMITTER_ID,
  type: 'vote_creation',
  amount: 5000,
  currency: 'ILS',
  status: 'pending',
  provider: 'green_invoice',
  provider_id: null,
  idempotency_key: `${SUBMITTER_ID}:vote_creation:${VOTE_ID}`,
  vote_id: VOTE_ID,
  option_id: null,
  metadata: null,
  created_at: '2026-08-05T00:00:00.000Z',
  updated_at: '2026-08-05T00:00:00.000Z',
  ...overrides,
});

const detailRow = () => ({
  ...proposalRow(),
  creator_id: SUBMITTER_ID,
  start_date: '2026-07-01T00:00:00.000Z',
  end_date: '2099-12-31T00:00:00.000Z',
});

const post = () =>
  new NextRequest(
    `http://localhost/api/space-admin/${SPACE_A}/proposals/${VOTE_ID}/decide`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'approve', reason: REASON }),
    }
  );

const ctx = () => ({ params: Promise.resolve({ spaceId: SPACE_A, voteId: VOTE_ID }) });

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SPACE_ADMIN_ENABLED;
  process.env.NEXT_PUBLIC_PAYMENTS_ENABLED = 'false';
  (getSessionFromRequest as Mock).mockResolvedValue(SESSION);
  (findActiveGrant as Mock).mockReturnValue(
    okAsync({ space_id: SPACE_A, municipality_code: MUNICIPALITY_A })
  );
  (findProposalInScope as Mock).mockReturnValue(okAsync(detailRow()));
  (transitionProposal as Mock).mockReturnValue(okAsync({ id: VOTE_ID, status: 'active' }));
  (insertAuditRow as Mock).mockReturnValue(okAsync(auditRow()));
  (getPaymentByIdempotencyKey as Mock).mockResolvedValue(null);
  (createPayment as Mock).mockResolvedValue(paymentRow());
});

describe('proposal approval while payments are switched off', () => {
  it("still approves and records today's pending creation-fee obligation", async () => {
    const res = await DECIDE(post(), ctx());

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: VOTE_ID, status: 'active' });
    expect(createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: SUBMITTER_ID,
        vote_id: VOTE_ID,
        type: 'vote_creation',
        amount: 5000,
        status: 'pending',
        idempotency_key: `${SUBMITTER_ID}:vote_creation:${VOTE_ID}`,
      })
    );
    expect(insertAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'proposal.approved',
        new_state: { status: 'active', paymentId: PAYMENT_ID, amountAgorot: 5000 },
      })
    );
  });
});
