/**
 * Payments API Route Tests (Green Invoice)
 *
 * Tests for the /api/payments endpoints:
 * - POST /api/payments/create - Create a Green Invoice payment page
 * - GET /api/payments/create - Get pricing information
 * - GET /api/payments/[id]/status - Get payment status
 * - POST /api/payments/[id]/verify - Verify payment completion
 * - POST /api/payments/webhook - Handle Green Invoice notifications
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createPayment, GET as getPricing } from '@/app/api/payments/create/route';
import { GET as getPaymentStatus } from '@/app/api/payments/[id]/status/route';
import { POST as verifyPayment } from '@/app/api/payments/[id]/verify/route';
import { POST as handleWebhook } from '@/app/api/payments/webhook/route';

// Mock session service
vi.mock('@/services/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

// Mock database functions
vi.mock('@/lib/supabase/db', () => ({
  getUserById: vi.fn(),
  createPayment: vi.fn(),
  getPaymentById: vi.fn(),
  getPaymentByProviderId: vi.fn(),
  getPaymentByIdempotencyKey: vi.fn(),
  getVoteWithOptions: vi.fn(),
  markPaymentCompleted: vi.fn(),
  updatePaymentStatus: vi.fn(),
  createEntitlement: vi.fn(),
  castVote: vi.fn(),
  recordTreasuryDeposit: vi.fn(),
  getWebhookEventByEventId: vi.fn(),
  createWebhookEvent: vi.fn(),
  updateWebhookEventStatus: vi.fn(),
}));

// The paid ballot path now applies the same pilot residency gate the free one
// does, so its cohort lookup has to be controllable. Mocked at the repository
// rather than stubbed inside the route: `decidePilotGate` itself is pure and
// runs for real here, which is the half worth exercising.
vi.mock('@/server/infra/supabase/pilot.repo', () => ({
  listActiveCohortIds: vi.fn(),
}));

// The ballot gate is now the same function the free route uses, so it is mocked
// at the service rather than re-derived from `user.identity_score` here. That
// re-derivation was the divergence: it treated only `verification_status ===
// 'verified'` as residency, where the canonical rule also accepts a first
// completed check-in.
vi.mock('@/services/verification/eligibility', () => ({
  checkVoterEligibility: vi.fn(),
}));

// Mock Green Invoice payment service
vi.mock('@/services/payments/greenInvoice', () => ({
  paymentService: {
    createVotePayment: vi.fn(),
    createVoteCreationPayment: vi.fn(),
    getPaymentStatus: vi.fn(),
    verifyWebhook: vi.fn(),
    parseWebhookEvent: vi.fn(),
  },
  getPaymentAmounts: vi.fn(() => ({
    voteParticipation: 3,
    voteCreation: 50,
    currency: 'ILS',
  })),
}));

// Mock Qubik service
vi.mock('@/services/qubik', () => ({
  qubikService: {
    mintTokens: vi.fn(),
  },
}));

// Mock email service
vi.mock('@/services/email', () => ({
  emailService: {
    sendPaymentReceiptEmail: vi.fn(),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  webhookLogger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import mocked modules for type-safe access
import { getSessionFromRequest } from '@/services/auth/session';
import {
  getUserById,
  createPayment as dbCreatePayment,
  getPaymentById,
  getPaymentByProviderId,
  getPaymentByIdempotencyKey,
  getVoteWithOptions,
  markPaymentCompleted,
  updatePaymentStatus,
  createEntitlement,
  castVote,
  recordTreasuryDeposit,
  getWebhookEventByEventId,
  createWebhookEvent,
  updateWebhookEventStatus,
} from '@/lib/supabase/db';
import { listActiveCohortIds } from '@/server/infra/supabase/pilot.repo';
import { checkVoterEligibility } from '@/services/verification/eligibility';
import { ok } from 'neverthrow';
import { paymentService } from '@/services/payments/greenInvoice';
import { qubikService } from '@/services/qubik';
import { emailService } from '@/services/email';

describe('Payments API Routes (Green Invoice)', () => {
  // `payments.vote_id` and `payments.option_id` are UUID columns - option_id
  // since migration 20260904000006. These fixtures used to be VOTE_ID and
  // OPTION_ID, which no database this code talks to would have accepted; the
  // route now refuses them at the boundary, so the fixtures say what a real row
  // says.
  const VOTE_ID = '00000000-0000-4000-8000-00000000fee2';
  const OPTION_ID = '00000000-0000-4000-8000-00000000fee3';
  const OTHER_OPTION_ID = '00000000-0000-4000-8000-00000000fee4';

  /**
   * A vote as the participation path now needs to see it: status, end_date and
   * municipality, because the route checks whether the vote is open and whether
   * the resident may vote in it before it charges anybody. The old fixtures
   * carried only `id` and `options`, which was enough when the route asked
   * nothing about the vote itself.
   */
  const openVote = (options: { id: string }[], overrides = {}) => ({
    id: VOTE_ID,
    status: 'active',
    end_date: new Date(Date.now() + 86_400_000).toISOString(),
    municipality_id: 'tel-aviv',
    options,
    ...overrides,
  });

  const mockSession = {
    userId: 'user-123',
    googleId: 'google-123',
    email: 'test@example.com',
    did: 'did:sync:' + 'a'.repeat(43),
    expiresAt: Date.now() + 86400000,
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    identity_score: 60,
    verification_status: 'verified',
    municipality_id: 'tel-aviv',
    qubik_wallet_address: 'wallet-123',
  };

  const mockPayment = {
    id: 'payment-123',
    user_id: 'user-123',
    type: 'vote_participation',
    amount: 100, // 1 ILS in agorot
    currency: 'ILS',
    status: 'pending',
    vote_id: VOTE_ID,
    option_id: OPTION_ID,
    provider_id: null,
    created_at: '2025-01-16T00:00:00Z',
    updated_at: '2025-01-16T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: the atomic pending→completed claim succeeds (this delivery wins).
    // Idempotent/already-completed tests override this to null (lost the race).
    (markPaymentCompleted as Mock).mockResolvedValue(mockPayment);
    // No pilot cohort active by default: the gate is inert and every existing
    // assertion keeps meaning what it meant. The gate's own tests turn it on.
    (listActiveCohortIds as Mock).mockResolvedValue(ok([]));
    // Eligible by default; the two gate tests below override it.
    (checkVoterEligibility as Mock).mockResolvedValue({ eligible: true });
  });

  describe('GET /api/payments/create', () => {
    it('should return pricing information', async () => {
      const response = await getPricing();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pricing).toBeDefined();
      expect(data.pricing.voteParticipation.amount).toBe(3);
      expect(data.pricing.voteCreation.amount).toBe(50);
      expect(data.tokenRate.rate).toBe(1);
      expect(data.paymentProvider).toBe('green_invoice');
    });
  });

  describe('POST /api/payments/create', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({ type: 'vote_participation', voteId: VOTE_ID }),
      });
      const response = await createPayment(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 when payment type is invalid', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({ type: 'invalid_type' }),
      });
      const response = await createPayment(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid payment type');
    });

    it('should return 400 when voteId missing for participation', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({ type: 'vote_participation' }),
      });
      const response = await createPayment(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Vote ID is required for participation payment');
    });

    // `payments.option_id` was TEXT until migration 20260904000006 and this
    // route stored whatever string arrived. The value is not read back until
    // the Green Invoice webhook hands it to `cast_vote`, whose parameter is
    // UUID - so a malformed option id was accepted, charged, and only rejected
    // after `markPaymentCompleted` had claimed the payment, past the point
    // where the provider's retry could still reach fulfilment.
    it.each([
      ['optionId', 'not-a-uuid'],
      ['optionId', ' '],
      ['optionId', '00000000-0000-4000-8000-00000000fee'],
      ['voteId', 'vote-123'],
    ])('should return 400 before charging when %s is not a UUID (%s)', async (field, value) => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getPaymentByIdempotencyKey as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({
          type: 'vote_participation',
          voteId: field === 'voteId' ? value : VOTE_ID,
          optionId: field === 'optionId' ? value : OPTION_ID,
        }),
      });
      const response = await createPayment(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe(`Invalid field: ${field}`);
      expect(data.code).toBe('INVALID_BODY');
      // Nothing was written and no payment page was opened. A 400 that still
      // created the row would leave a payment nobody can complete.
      expect(dbCreatePayment).not.toHaveBeenCalled();
      expect(paymentService.createVotePayment).not.toHaveBeenCalled();
    });

    // Absence is not invalidity. A vote-creation fee has no ballot choice at
    // all, and the empty string is what an untouched form field sends; both
    // must reach the insert as NULL rather than as a 400 or as ''.
    //
    // These use `vote_creation` deliberately, and now that is the ONLY type for
    // which absence is legal: a participation payment without an option is
    // refused outright (see the test below). A creation fee has no ballot
    // choice to name, which is why the same absence means something different
    // here.
    it.each([
      ['absent', undefined],
      ['empty string', ''],
      ['null', null],
    ])('should store NULL for an option id that is %s', async (_label, value) => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getPaymentByIdempotencyKey as Mock).mockResolvedValue(null);
      (dbCreatePayment as Mock).mockResolvedValue(mockPayment);
      (paymentService.createVoteCreationPayment as Mock).mockResolvedValue({
        paymentUrl: 'https://sandbox.d.greeninvoice.co.il/form/456',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({
          type: 'vote_creation',
          voteTitle: 'New Vote',
          optionId: value,
        }),
      });
      const response = await createPayment(request);

      expect(response.status).toBe(200);
      expect(dbCreatePayment).toHaveBeenCalledWith(
        expect.objectContaining({ vote_id: null, option_id: null })
      );
      // Nothing to look up: no option id means no vote/option relationship to
      // check, so the payment path does not read the vote at all.
      expect(getVoteWithOptions).not.toHaveBeenCalled();
    });

    it('should pass an option id that belongs to the vote through unchanged', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getPaymentByIdempotencyKey as Mock).mockResolvedValue(null);
      (getVoteWithOptions as Mock).mockResolvedValue(
        openVote([{ id: OPTION_ID }, { id: OTHER_OPTION_ID }])
      );
      (dbCreatePayment as Mock).mockResolvedValue(mockPayment);
      (paymentService.createVotePayment as Mock).mockResolvedValue({
        paymentUrl: 'https://sandbox.d.greeninvoice.co.il/form/123',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({
          type: 'vote_participation',
          voteId: VOTE_ID,
          optionId: OPTION_ID,
        }),
      });
      const response = await createPayment(request);

      expect(response.status).toBe(200);
      expect(dbCreatePayment).toHaveBeenCalledWith(
        expect.objectContaining({ vote_id: VOTE_ID, option_id: OPTION_ID })
      );
    });

    // A UUID's hex digits are case-insensitive and zod accepts either case, but
    // PostgreSQL hands every uuid back lowercase. An id sent uppercase must
    // therefore be canonicalised before it is compared against an option read
    // out of the database, or a perfectly valid ballot choice is rejected as
    // belonging to some other vote - and stored uppercase alongside lowercase
    // ids for the same option.
    it('should accept a well-formed option id sent in uppercase', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getPaymentByIdempotencyKey as Mock).mockResolvedValue(null);
      (getVoteWithOptions as Mock).mockResolvedValue(openVote([{ id: OPTION_ID }]));
      (dbCreatePayment as Mock).mockResolvedValue(mockPayment);
      (paymentService.createVotePayment as Mock).mockResolvedValue({
        paymentUrl: 'https://sandbox.d.greeninvoice.co.il/form/123',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({
          type: 'vote_participation',
          voteId: VOTE_ID.toUpperCase(),
          optionId: OPTION_ID.toUpperCase(),
        }),
      });
      const response = await createPayment(request);

      expect(response.status).toBe(200);
      expect(getVoteWithOptions).toHaveBeenCalledWith(VOTE_ID);
      expect(dbCreatePayment).toHaveBeenCalledWith(
        expect.objectContaining({ vote_id: VOTE_ID, option_id: OPTION_ID })
      );
    });

    // A UUID that is well-formed but names nothing, or names an option in a
    // different vote, is exactly as unpayable as 'not-a-uuid': the column has
    // no foreign key, so the value is stored and charged and `cast_vote` only
    // rejects it in the webhook, after the payment has been claimed completed.
    it('should return 400 before charging when the option names no option in this vote', async () => {
      const vote = openVote([{ id: OTHER_OPTION_ID }]);
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getPaymentByIdempotencyKey as Mock).mockResolvedValue(null);
      (getVoteWithOptions as Mock).mockResolvedValue(vote);

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({
          type: 'vote_participation',
          voteId: VOTE_ID,
          optionId: OPTION_ID,
        }),
      });
      const response = await createPayment(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid field: optionId');
      expect(data.code).toBe('INVALID_BODY');
      expect(dbCreatePayment).not.toHaveBeenCalled();
      expect(paymentService.createVotePayment).not.toHaveBeenCalled();
    });

    // A vote id that resolves to nothing is a 404, not a 400 about the option:
    // the option may well be fine, and saying "invalid optionId" for a vote that
    // does not exist sends the caller looking in the wrong place. This is the
    // same code POST /api/votes/[id]/participate returns for the same fact.
    it('should return 404 before charging when the vote does not exist', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getPaymentByIdempotencyKey as Mock).mockResolvedValue(null);
      (getVoteWithOptions as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({
          type: 'vote_participation',
          voteId: VOTE_ID,
          optionId: OPTION_ID,
        }),
      });
      const response = await createPayment(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('NOT_FOUND');
      expect(dbCreatePayment).not.toHaveBeenCalled();
      expect(paymentService.createVotePayment).not.toHaveBeenCalled();
    });

    // A participation payment buys exactly one thing: a ballot. The webhook
    // casts it only `if (payment.type === 'vote_participation' &&
    // payment.vote_id && payment.option_id)`, so a row that reached the provider
    // with no option took the resident's money, minted their tokens, accrued the
    // treasury deposit and emailed a receipt - and cast no vote, with nothing
    // recording that a ballot was owed. It did not fail; it completed.
    it.each([
      ['absent', undefined],
      ['empty string', ''],
      ['null', null],
    ])('should return 400 before charging when the option id is %s for participation', async (_label, value) => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getPaymentByIdempotencyKey as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({
          type: 'vote_participation',
          voteId: VOTE_ID,
          optionId: value,
        }),
      });
      const response = await createPayment(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Option ID is required for participation payment');
      expect(data.code).toBe('INVALID_BODY');
      expect(dbCreatePayment).not.toHaveBeenCalled();
      expect(paymentService.createVotePayment).not.toHaveBeenCalled();
    });

    // The mirror image: an option on a creation fee names a ballot choice inside
    // a vote the fee is paying to CREATE. Nothing downstream reads it, and
    // migration 20260904000007 refuses the shape at the database anyway.
    it('should return 400 when a creation fee carries an option id', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getPaymentByIdempotencyKey as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({
          type: 'vote_creation',
          voteTitle: 'New Vote',
          optionId: OPTION_ID,
        }),
      });
      const response = await createPayment(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid field: optionId');
      expect(dbCreatePayment).not.toHaveBeenCalled();
    });

    // The shape checks sit above the idempotency short-circuit, and this is why.
    // A caller who has used a key before, then replays it with a body the route
    // no longer accepts, must not be answered `200 { idempotent: true }` for a
    // request that was never validated. Both illegal shapes are asserted, in the
    // one arrangement that would pass if either check drifted back below the
    // lookup: the key resolves to an existing payment every time.
    it.each([
      [
        'a creation fee carrying an option id',
        { type: 'vote_creation', voteTitle: 'New Vote', optionId: OPTION_ID },
        'Invalid field: optionId',
      ],
      [
        'a participation payment with no option id',
        { type: 'vote_participation', voteId: VOTE_ID },
        'Option ID is required for participation payment',
      ],
    ])(
      'should return 400 for %s even when the idempotency key already exists',
      async (_label, body, message) => {
        (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
        (getUserById as Mock).mockResolvedValue(mockUser);
        (getPaymentByIdempotencyKey as Mock).mockResolvedValue({
          id: 'existing-payment',
          status: 'pending',
          amount: 100,
          currency: 'ILS',
        });

        const request = new NextRequest('http://localhost:3000/api/payments/create', {
          method: 'POST',
          body: JSON.stringify({ ...body, idempotencyKey: 'key-123' }),
        });
        const response = await createPayment(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe(message);
        expect(data.idempotent).toBeUndefined();
        expect(dbCreatePayment).not.toHaveBeenCalled();
      }
    );

    // A closed vote used to be payable. The charge went through, and `cast_vote`
    // refused the ballot in the webhook - after `markPaymentCompleted` had
    // claimed the payment, past the point the provider's retry reaches
    // fulfilment. The resident paid for a vote that had already ended.
    //
    // The last row is the case that made the old inline check in
    // /api/votes/[id]/participate disagree with `cast_vote`: a vote that was
    // scheduled, never opened, and whose end_date has now passed. The route
    // called it VOTE_NOT_OPEN - "come back later" for a vote that is over.
    // `decideParticipationOpen` tests ended-or-expired first, as `cast_vote`
    // does, so both now call it ENDED.
    it.each([
      ['status is ended', { status: 'ended' }, 'VOTE_ENDED'],
      ['status is pending', { status: 'pending' }, 'VOTE_NOT_OPEN'],
      ['status is in_review', { status: 'in_review' }, 'VOTE_NOT_OPEN'],
      [
        'end_date has passed',
        { end_date: new Date(Date.now() - 1_000).toISOString() },
        'VOTE_ENDED',
      ],
      [
        'it never opened and has now expired',
        {
          status: 'pending',
          end_date: new Date(Date.now() - 1_000).toISOString(),
        },
        'VOTE_ENDED',
      ],
    ])('should return 400 before charging when the vote %s', async (_label, overrides, code) => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getPaymentByIdempotencyKey as Mock).mockResolvedValue(null);
      (getVoteWithOptions as Mock).mockResolvedValue(
        openVote([{ id: OPTION_ID }], overrides)
      );

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({
          type: 'vote_participation',
          voteId: VOTE_ID,
          optionId: OPTION_ID,
        }),
      });
      const response = await createPayment(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe(code);
      expect(dbCreatePayment).not.toHaveBeenCalled();
      expect(paymentService.createVotePayment).not.toHaveBeenCalled();
    });

    // Pilot residency, the rule the free ballot route has applied since 4bc6392
    // and this one never did. The exemption was chronological: the fee was
    // dropped from the vote flow in cfa5d25 (2026-07-29) and the gate written in
    // gate.ts (2026-08-06), so when the rule arrived this route was already off
    // the product's ballot path - but it stayed reachable, and it still ends in
    // a ballot via the webhook's castVote.
    it('should return 403 when a non-resident pays into a pilot municipality vote', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue({ ...mockUser, municipality_id: 'haifa' });
      (getPaymentByIdempotencyKey as Mock).mockResolvedValue(null);
      (getVoteWithOptions as Mock).mockResolvedValue(openVote([{ id: OPTION_ID }]));
      (listActiveCohortIds as Mock).mockResolvedValue(ok(['tel-aviv']));

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({
          type: 'vote_participation',
          voteId: VOTE_ID,
          optionId: OPTION_ID,
        }),
      });
      const response = await createPayment(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe('PILOT_MUNICIPALITY_ONLY');
      expect(dbCreatePayment).not.toHaveBeenCalled();
      expect(paymentService.createVotePayment).not.toHaveBeenCalled();
    });

    it('should let a resident of the pilot municipality pay', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser); // municipality_id: 'tel-aviv'
      (getPaymentByIdempotencyKey as Mock).mockResolvedValue(null);
      (getVoteWithOptions as Mock).mockResolvedValue(openVote([{ id: OPTION_ID }]));
      (listActiveCohortIds as Mock).mockResolvedValue(ok(['tel-aviv']));
      (dbCreatePayment as Mock).mockResolvedValue(mockPayment);
      (paymentService.createVotePayment as Mock).mockResolvedValue({
        paymentUrl: 'https://sandbox.d.greeninvoice.co.il/form/123',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({
          type: 'vote_participation',
          voteId: VOTE_ID,
          optionId: OPTION_ID,
        }),
      });
      const response = await createPayment(request);

      expect(response.status).toBe(200);
      expect(dbCreatePayment).toHaveBeenCalled();
    });

    // The idempotency lookup is scoped to the caller. `payments.idempotency_key`
    // is UNIQUE table-wide and callers may supply the key themselves, so an
    // unscoped lookup answered "what is payment <key>?" for anyone - and the
    // idempotent response hands back id, status, amount and currency.
    it('should look up the idempotency key only within the caller\'s own payments', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getPaymentByIdempotencyKey as Mock).mockResolvedValue(null);
      (getVoteWithOptions as Mock).mockResolvedValue(openVote([{ id: OPTION_ID }]));
      (dbCreatePayment as Mock).mockResolvedValue(mockPayment);
      (paymentService.createVotePayment as Mock).mockResolvedValue({
        paymentUrl: 'https://sandbox.d.greeninvoice.co.il/form/123',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({
          type: 'vote_participation',
          voteId: VOTE_ID,
          optionId: OPTION_ID,
          idempotencyKey: 'somebody-elses-key',
        }),
      });
      await createPayment(request);

      expect(getPaymentByIdempotencyKey).toHaveBeenCalledWith(
        'somebody-elses-key',
        mockUser.id
      );
    });

    // The divergence that unification removed: a resident with one completed
    // check-in but no 'verified' status passes `hasVerifiedResidency` and can
    // cast a FREE ballot. This route used to compute residency itself as
    // `verification_status === 'verified'` and refuse them - same vote, same
    // person, opposite answer, and the refusal told them to go and verify
    // something they had already begun.
    it('should let a resident whom the free route accepts pay as well', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue({
        ...mockUser,
        verification_status: 'pending',
      });
      // What checkVoterEligibility returns for a user with >= 1 check-in.
      (checkVoterEligibility as Mock).mockResolvedValue({ eligible: true });
      (getPaymentByIdempotencyKey as Mock).mockResolvedValue(null);
      (getVoteWithOptions as Mock).mockResolvedValue(openVote([{ id: OPTION_ID }]));
      (dbCreatePayment as Mock).mockResolvedValue(mockPayment);
      (paymentService.createVotePayment as Mock).mockResolvedValue({
        paymentUrl: 'https://sandbox.d.greeninvoice.co.il/form/123',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({
          type: 'vote_participation',
          voteId: VOTE_ID,
          optionId: OPTION_ID,
        }),
      });
      const response = await createPayment(request);

      expect(response.status).toBe(200);
      expect(checkVoterEligibility).toHaveBeenCalledWith(
        expect.objectContaining({ id: mockUser.id })
      );
    });

    it('should return 404 when user not found', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({ type: 'vote_creation' }),
      });
      const response = await createPayment(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });

    it('should return 403 when identity score too low for voting', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue({ ...mockUser, identity_score: 30 });
      (checkVoterEligibility as Mock).mockResolvedValue({
        eligible: false,
        code: 'IDENTITY_NOT_VERIFIED',
        message: 'נדרשות 40 נקודות אימות כדי להצביע. יש לכם 30.',
      });

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({
          type: 'vote_participation',
          voteId: VOTE_ID,
          optionId: OPTION_ID,
        }),
      });
      const response = await createPayment(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe('IDENTITY_NOT_VERIFIED');
      expect(dbCreatePayment).not.toHaveBeenCalled();
    });

    it('should return 403 when not verified for voting', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue({ ...mockUser, verification_status: 'pending' });
      (checkVoterEligibility as Mock).mockResolvedValue({
        eligible: false,
        code: 'RESIDENCY_NOT_VERIFIED',
        message: 'נדרש אימות תושבוּת לפני ההצבעה. יש לכם 60 מתוך 40 נקודות.',
      });

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({
          type: 'vote_participation',
          voteId: VOTE_ID,
          optionId: OPTION_ID,
        }),
      });
      const response = await createPayment(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe('RESIDENCY_NOT_VERIFIED');
      expect(dbCreatePayment).not.toHaveBeenCalled();
    });

    it('should return existing payment when idempotency key matches', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getPaymentByIdempotencyKey as Mock).mockResolvedValue({
        id: 'existing-payment',
        status: 'pending',
        amount: 100,
        currency: 'ILS',
      });

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({
          type: 'vote_participation',
          voteId: VOTE_ID,
          optionId: OPTION_ID,
          idempotencyKey: 'key-123',
        }),
      });
      const response = await createPayment(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.idempotent).toBe(true);
      expect(data.payment.id).toBe('existing-payment');
    });

    it('should create checkout successfully for vote participation', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getPaymentByIdempotencyKey as Mock).mockResolvedValue(null);
      (getVoteWithOptions as Mock).mockResolvedValue(openVote([{ id: OPTION_ID }]));
      (dbCreatePayment as Mock).mockResolvedValue(mockPayment);
      (paymentService.createVotePayment as Mock).mockResolvedValue({
        paymentUrl: 'https://sandbox.d.greeninvoice.co.il/form/123',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({
          type: 'vote_participation',
          voteId: VOTE_ID,
          optionId: OPTION_ID,
          voteTitle: 'Test Vote',
        }),
      });
      const response = await createPayment(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.payment.paymentUrl).toBe('https://sandbox.d.greeninvoice.co.il/form/123');
      expect(data.payment.amount).toBe(3);
      expect(paymentService.createVotePayment).toHaveBeenCalled();
    });

    it('should create checkout successfully for vote creation', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getPaymentByIdempotencyKey as Mock).mockResolvedValue(null);
      (dbCreatePayment as Mock).mockResolvedValue({ ...mockPayment, type: 'vote_creation', amount: 20000 });
      (paymentService.createVoteCreationPayment as Mock).mockResolvedValue({
        paymentUrl: 'https://sandbox.d.greeninvoice.co.il/form/456',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({
          type: 'vote_creation',
          voteTitle: 'New Vote',
        }),
      });
      const response = await createPayment(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.payment.amount).toBe(50);
      expect(paymentService.createVoteCreationPayment).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({ type: 'vote_creation' }),
      });
      const response = await createPayment(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create payment');
    });
  });

  describe('GET /api/payments/[id]/status', () => {
    const createParams = (id: string) => Promise.resolve({ id });

    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/payments/payment-123/status');
      const response = await getPaymentStatus(request, { params: createParams('payment-123') });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when payment not found', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getPaymentById as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/payments/nonexistent/status');
      const response = await getPaymentStatus(request, { params: createParams('nonexistent') });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Payment not found');
    });

    it('should return 403 when payment belongs to different user', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getPaymentById as Mock).mockResolvedValue({ ...mockPayment, user_id: 'different-user' });

      const request = new NextRequest('http://localhost:3000/api/payments/payment-123/status');
      const response = await getPaymentStatus(request, { params: createParams('payment-123') });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return payment status with receipt URL when completed', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getPaymentById as Mock).mockResolvedValue({
        ...mockPayment,
        status: 'completed',
        provider_id: 'txn_123',
      });
      (paymentService.getPaymentStatus as Mock).mockResolvedValue({
        receiptUrl: 'https://greeninvoice.co.il/doc/123',
      });

      const request = new NextRequest('http://localhost:3000/api/payments/payment-123/status');
      const response = await getPaymentStatus(request, { params: createParams('payment-123') });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('completed');
      expect(data.succeeded).toBe(true);
      expect(data.receiptUrl).toBe('https://greeninvoice.co.il/doc/123');
      expect(data.tokensEarned).toBe(1);
    });

    it('should return payment status without receipt URL when pending', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getPaymentById as Mock).mockResolvedValue(mockPayment);

      const request = new NextRequest('http://localhost:3000/api/payments/payment-123/status');
      const response = await getPaymentStatus(request, { params: createParams('payment-123') });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('pending');
      expect(data.succeeded).toBe(false);
      expect(data.receiptUrl).toBeNull();
      expect(data.tokensEarned).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getPaymentById as Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/payments/payment-123/status');
      const response = await getPaymentStatus(request, { params: createParams('payment-123') });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch payment status');
    });
  });

  describe('POST /api/payments/[id]/verify', () => {
    const createParams = (id: string) => Promise.resolve({ id });

    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/payments/payment-123/verify', {
        method: 'POST',
      });
      const response = await verifyPayment(request, { params: createParams('payment-123') });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when payment not found', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getPaymentById as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/payments/nonexistent/verify', {
        method: 'POST',
      });
      const response = await verifyPayment(request, { params: createParams('nonexistent') });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Payment not found');
    });

    it('should return success when payment already completed', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getPaymentById as Mock).mockResolvedValue({
        ...mockPayment,
        status: 'completed',
        provider_id: 'txn_123',
      });
      (paymentService.getPaymentStatus as Mock).mockResolvedValue({
        receiptUrl: 'https://greeninvoice.co.il/doc/123',
      });

      const request = new NextRequest('http://localhost:3000/api/payments/payment-123/verify', {
        method: 'POST',
      });
      const response = await verifyPayment(request, { params: createParams('payment-123') });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tokensEarned).toBe(1);
    });

    it('should update and return success when provider shows completed', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getPaymentById as Mock).mockResolvedValue({
        ...mockPayment,
        status: 'pending',
        provider_id: 'txn_123',
      });
      (paymentService.getPaymentStatus as Mock).mockResolvedValue({
        status: 'succeeded',
        receiptUrl: 'https://greeninvoice.co.il/doc/123',
      });
      (updatePaymentStatus as Mock).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/payments/payment-123/verify', {
        method: 'POST',
      });
      const response = await verifyPayment(request, { params: createParams('payment-123') });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(updatePaymentStatus).toHaveBeenCalledWith('payment-123', 'completed');
    });

    it('should return pending when no provider_id', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getPaymentById as Mock).mockResolvedValue({
        ...mockPayment,
        status: 'pending',
        provider_id: null,
      });

      const request = new NextRequest('http://localhost:3000/api/payments/payment-123/verify', {
        method: 'POST',
      });
      const response = await verifyPayment(request, { params: createParams('payment-123') });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.tokensEarned).toBe(0);
    });
  });

  describe('POST /api/payments/webhook', () => {
    const createWebhookRequest = (payload: object, signature = 'ts=1;h1=valid') => {
      const body = JSON.stringify(payload);
      return new NextRequest('http://localhost:3000/api/payments/webhook', {
        method: 'POST',
        body,
        headers: {
          'x-greeninvoice-token': signature,
        },
      });
    };

    it('should return 401 when signature verification fails', async () => {
      (paymentService.verifyWebhook as Mock).mockReturnValue(false);

      const request = createWebhookRequest({ event_type: 'transaction.completed' }, 'bad');
      const response = await handleWebhook(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid token');
    });

    it('should return success on replay (idempotent)', async () => {
      (paymentService.verifyWebhook as Mock).mockReturnValue(true);
      (paymentService.parseWebhookEvent as Mock).mockReturnValue({
        type: 'payment.succeeded',
        paymentId: 'txn_123',
        amount: 300,
        metadata: { orderId: 'payment-123' },
      });
      (getWebhookEventByEventId as Mock).mockResolvedValue({
        event_id: 'evt_123',
        status: 'processed',
      });

      const request = createWebhookRequest({ event_type: 'transaction.completed', event_id: 'evt_123' });
      const response = await handleWebhook(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(data.idempotent).toBe(true);
      expect(data.replay).toBe(true);
    });

    it('should handle transaction.completed: complete payment, accrue treasury, mint, record vote', async () => {
      (paymentService.verifyWebhook as Mock).mockReturnValue(true);
      (paymentService.parseWebhookEvent as Mock).mockReturnValue({
        type: 'payment.succeeded',
        paymentId: 'txn_123',
        amount: 300,
        metadata: { orderId: 'payment-123' },
      });
      (getWebhookEventByEventId as Mock).mockResolvedValue(null);
      (createWebhookEvent as Mock).mockResolvedValue(undefined);
      (getPaymentById as Mock).mockResolvedValue(mockPayment);
      (updatePaymentStatus as Mock).mockResolvedValue(undefined);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (recordTreasuryDeposit as Mock).mockResolvedValue('tx-1');
      (createEntitlement as Mock).mockResolvedValue(undefined);
      (qubikService.mintTokens as Mock).mockResolvedValue(undefined);
      (paymentService.getPaymentStatus as Mock).mockResolvedValue({ receiptUrl: 'https://greeninvoice.co.il/doc/123' });
      (emailService.sendPaymentReceiptEmail as Mock).mockResolvedValue(undefined);
      (castVote as Mock).mockResolvedValue({
        outcome: 'cast',
        ballotId: 'ballot-1',
        optionId: OPTION_ID,
        optionVotes: 1,
        participantCount: 1,
        createdAt: '2026-08-02T10:00:00.000Z',
      });
      (updateWebhookEventStatus as Mock).mockResolvedValue(undefined);

      const request = createWebhookRequest({
        event_type: 'transaction.completed',
        event_id: 'evt_123',
        data: { id: 'txn_123', custom_data: { orderId: 'payment-123' } },
      });
      const response = await handleWebhook(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(markPaymentCompleted).toHaveBeenCalledWith('payment-123', 'txn_123');
      expect(recordTreasuryDeposit).toHaveBeenCalledWith(
        expect.objectContaining({
          municipalityId: 'tel-aviv',
          amountAgorot: 100,
          paymentId: 'payment-123',
          userId: 'user-123',
          voteId: VOTE_ID,
        })
      );
      expect(createEntitlement).toHaveBeenCalled();
      expect(qubikService.mintTokens).toHaveBeenCalledWith({
        walletAddress: 'wallet-123',
        amount: 1,
        reason: 'vote_participation',
      });
      expect(castVote).toHaveBeenCalledWith({
        userId: 'user-123',
        voteId: VOTE_ID,
        optionId: OPTION_ID,
        paymentId: 'payment-123',
      });
    });

    // The vote cast used to be wrapped in a try/catch that logged and moved on,
    // so a paid ballot that could not be recorded still finished as a
    // `processed` webhook event. These two cover the replacement behaviour: the
    // failure is loud, it is written down, and nothing downstream of it runs.
    it('marks the webhook event failed when the ballot cannot be cast', async () => {
      (paymentService.verifyWebhook as Mock).mockReturnValue(true);
      (paymentService.parseWebhookEvent as Mock).mockReturnValue({
        type: 'payment.succeeded',
        paymentId: 'txn_123',
        amount: 300,
        metadata: { orderId: 'payment-123' },
      });
      (getWebhookEventByEventId as Mock).mockResolvedValue(null);
      (createWebhookEvent as Mock).mockResolvedValue(undefined);
      (getPaymentById as Mock).mockResolvedValue(mockPayment);
      (markPaymentCompleted as Mock).mockResolvedValue(true);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (recordTreasuryDeposit as Mock).mockResolvedValue('tx-1');
      (createEntitlement as Mock).mockResolvedValue(undefined);
      (updateWebhookEventStatus as Mock).mockResolvedValue(undefined);
      (castVote as Mock).mockRejectedValue(new Error('vote is not open for participation'));

      const request = createWebhookRequest({
        event_type: 'transaction.completed',
        event_id: 'evt_123',
        data: { id: 'txn_123', custom_data: { orderId: 'payment-123' } },
      });
      const response = await handleWebhook(request);

      expect(response.status).toBe(500);
      expect(updateWebhookEventStatus).toHaveBeenCalledWith(
        expect.anything(),
        'failed',
        expect.stringContaining('not open')
      );
      expect(updateWebhookEventStatus).not.toHaveBeenCalledWith(
        expect.anything(),
        'processed'
      );
    });

    it('mints no tokens and sends no receipt when the ballot cannot be cast', async () => {
      (paymentService.verifyWebhook as Mock).mockReturnValue(true);
      (paymentService.parseWebhookEvent as Mock).mockReturnValue({
        type: 'payment.succeeded',
        paymentId: 'txn_123',
        amount: 300,
        metadata: { orderId: 'payment-123' },
      });
      (getWebhookEventByEventId as Mock).mockResolvedValue(null);
      (createWebhookEvent as Mock).mockResolvedValue(undefined);
      (getPaymentById as Mock).mockResolvedValue(mockPayment);
      (markPaymentCompleted as Mock).mockResolvedValue(true);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (recordTreasuryDeposit as Mock).mockResolvedValue('tx-1');
      (createEntitlement as Mock).mockResolvedValue(undefined);
      (updateWebhookEventStatus as Mock).mockResolvedValue(undefined);
      (castVote as Mock).mockRejectedValue(new Error('option does not belong to vote'));

      const request = createWebhookRequest({
        event_type: 'transaction.completed',
        event_id: 'evt_123',
        data: { id: 'txn_123', custom_data: { orderId: 'payment-123' } },
      });
      await handleWebhook(request);

      // The cast runs before anything irreversible, so a ballot that cannot be
      // recorded does not leave tokens minted and a receipt sent for it.
      expect(qubikService.mintTokens).not.toHaveBeenCalled();
      expect(emailService.sendPaymentReceiptEmail).not.toHaveBeenCalled();
    });

    it('should handle transaction.payment_failed event', async () => {
      (paymentService.verifyWebhook as Mock).mockReturnValue(true);
      (paymentService.parseWebhookEvent as Mock).mockReturnValue({
        type: 'payment.failed',
        paymentId: 'txn_123',
        metadata: { orderId: 'payment-123' },
      });
      (getWebhookEventByEventId as Mock).mockResolvedValue(null);
      (createWebhookEvent as Mock).mockResolvedValue(undefined);
      (getPaymentById as Mock).mockResolvedValue(mockPayment);
      (updatePaymentStatus as Mock).mockResolvedValue(undefined);
      (updateWebhookEventStatus as Mock).mockResolvedValue(undefined);

      const request = createWebhookRequest({
        event_type: 'transaction.payment_failed',
        event_id: 'evt_123',
        data: { id: 'txn_123', custom_data: { orderId: 'payment-123' } },
      });
      const response = await handleWebhook(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(updatePaymentStatus).toHaveBeenCalledWith('payment-123', 'failed', 'txn_123');
    });

    it('should handle refund (adjustment.created) event', async () => {
      (paymentService.verifyWebhook as Mock).mockReturnValue(true);
      (paymentService.parseWebhookEvent as Mock).mockReturnValue({
        type: 'refund.created',
        paymentId: 'txn_123',
        metadata: { orderId: 'payment-123' },
      });
      (getWebhookEventByEventId as Mock).mockResolvedValue(null);
      (createWebhookEvent as Mock).mockResolvedValue(undefined);
      (getPaymentById as Mock).mockResolvedValue({ ...mockPayment, status: 'completed' });
      (updatePaymentStatus as Mock).mockResolvedValue(undefined);
      (updateWebhookEventStatus as Mock).mockResolvedValue(undefined);

      const request = createWebhookRequest({
        event_type: 'adjustment.created',
        event_id: 'evt_123',
        data: { id: 'txn_123', custom_data: { orderId: 'payment-123' } },
      });
      const response = await handleWebhook(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(updatePaymentStatus).toHaveBeenCalledWith('payment-123', 'refunded', 'txn_123');
    });

    it('should return idempotent when payment already completed', async () => {
      (paymentService.verifyWebhook as Mock).mockReturnValue(true);
      (paymentService.parseWebhookEvent as Mock).mockReturnValue({
        type: 'payment.succeeded',
        paymentId: 'txn_123',
        metadata: { orderId: 'payment-123' },
      });
      (getWebhookEventByEventId as Mock).mockResolvedValue(null);
      (createWebhookEvent as Mock).mockResolvedValue(undefined);
      (getPaymentById as Mock).mockResolvedValue({ ...mockPayment, status: 'completed' });
      // Atomic claim finds no pending row → null → idempotent (lost/already done).
      (markPaymentCompleted as Mock).mockResolvedValue(null);
      (updateWebhookEventStatus as Mock).mockResolvedValue(undefined);

      const request = createWebhookRequest({
        event_type: 'transaction.completed',
        event_id: 'evt_123',
        data: { id: 'txn_123', custom_data: { orderId: 'payment-123' } },
      });
      const response = await handleWebhook(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(data.idempotent).toBe(true);
      // The losing delivery must not run fulfilment.
      expect(recordTreasuryDeposit).not.toHaveBeenCalled();
    });

    it('should return 404 when payment not found', async () => {
      (paymentService.verifyWebhook as Mock).mockReturnValue(true);
      (paymentService.parseWebhookEvent as Mock).mockReturnValue({
        type: 'payment.succeeded',
        paymentId: 'txn_123',
        metadata: { orderId: 'nonexistent-payment' },
      });
      (getWebhookEventByEventId as Mock).mockResolvedValue(null);
      (createWebhookEvent as Mock).mockResolvedValue(undefined);
      (getPaymentById as Mock).mockResolvedValue(null);
      (getPaymentByProviderId as Mock).mockResolvedValue(null);
      (updateWebhookEventStatus as Mock).mockResolvedValue(undefined);

      const request = createWebhookRequest({
        event_type: 'transaction.completed',
        event_id: 'evt_123',
        data: { id: 'txn_123', custom_data: { orderId: 'nonexistent-payment' } },
      });
      const response = await handleWebhook(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Payment not found');
    });

    it('should handle webhook processing errors', async () => {
      (paymentService.verifyWebhook as Mock).mockReturnValue(true);
      (paymentService.parseWebhookEvent as Mock).mockImplementation(() => {
        throw new Error('Parse error');
      });
      (updateWebhookEventStatus as Mock).mockResolvedValue(undefined);

      const request = createWebhookRequest({ event_type: 'transaction.completed' });
      const response = await handleWebhook(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Webhook processing failed');
    });
  });
});
