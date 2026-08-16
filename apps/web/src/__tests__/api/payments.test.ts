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

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi, type Mock } from 'vitest';
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
  attachPaymentFormUrl: vi.fn(),
  markPaymentCompleted: vi.fn(),
  updatePaymentStatus: vi.fn(),
  createEntitlement: vi.fn(),
  recordUserVote: vi.fn(),
  incrementVoteOption: vi.fn(),
  recordTreasuryDeposit: vi.fn(),
  getWebhookEventByEventId: vi.fn(),
  createWebhookEvent: vi.fn(),
  updateWebhookEventStatus: vi.fn(),
}));

// Mock Green Invoice payment service
vi.mock('@/services/payments/greenInvoice', () => ({
  paymentService: {
    createVoteCreationPayment: vi.fn(),
    getPaymentStatus: vi.fn(),
    verifyWebhook: vi.fn(),
    confirmDocumentIssued: vi.fn(),
    confirmDocumentForPayment: vi.fn(),
    extractDocumentId: vi.fn(),
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

// Mock logger. `logger` is exported too: the SEC-03 describe below exercises the
// REAL greenInvoice service, which logs through it.
vi.mock('@/lib/logger', () => ({
  webhookLogger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  logger: {
    debug: vi.fn(),
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
  attachPaymentFormUrl,
  markPaymentCompleted,
  updatePaymentStatus,
  createEntitlement,
  recordUserVote,
  incrementVoteOption,
  recordTreasuryDeposit,
  getWebhookEventByEventId,
  createWebhookEvent,
  updateWebhookEventStatus,
} from '@/lib/supabase/db';
import { paymentService } from '@/services/payments/greenInvoice';
import { qubikService } from '@/services/qubik';
import { emailService } from '@/services/email';

describe('Payments API Routes (Green Invoice)', () => {
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
    vote_id: 'vote-123',
    option_id: 'option-123',
    provider_id: null,
    created_at: '2025-01-16T00:00:00Z',
    updated_at: '2025-01-16T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Payments are OFF by default in this product until the provider approves
    // the account, and every route below refuses before it does anything else.
    // These cases describe the rails as they behave once money is switched back
    // on, so the switch is held ON for them. The OFF contract has its own
    // describe at the end of this file.
    vi.stubEnv('NEXT_PUBLIC_PAYMENTS_ENABLED', 'true');
    // Default: the atomic pending→completed claim succeeds (this delivery wins).
    // Idempotent/already-completed tests override this to null (lost the race).
    (markPaymentCompleted as Mock).mockResolvedValue(mockPayment);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('GET /api/payments/create', () => {
    it('publishes creation pricing only - there is no participation price', async () => {
      const response = await getPricing();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pricing).toBeDefined();
      expect(data.pricing.voteCreation.amount).toBe(50);
      // Not "priced at zero" - absent. A published ₪0 would still be a price.
      expect('voteParticipation' in data.pricing).toBe(false);
      expect(data.tokenRate.rate).toBe(1);
      expect(data.paymentProvider).toBe('green_invoice');
    });
  });

  describe('POST /api/payments/create', () => {
    it('should return 401 when not authenticated', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({ type: 'vote_creation', voteTitle: 'Test Vote' }),
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

    it('rejects a vote_participation request - participation is free', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({ type: 'vote_participation', voteId: 'vote-123' }),
      });
      const response = await createPayment(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      // Hebrew, because this reaches a resident: the rail is retired, not priced.
      expect(data.error).toMatch(/[֐-׿]/);
      expect(data.error).toContain('חינם');
      // Never priced and never persisted - no payment row is opened.
      expect(dbCreatePayment).not.toHaveBeenCalled();
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

    // The identity-score and GPS-verification 403s that used to live here were
    // participation gates. They now sit on the free path
    // (services/verification/eligibility.ts), and vote creation has its own
    // stricter gate at publish time (server/app/votes/create-vote.ts).

    it('should return existing payment when idempotency key matches', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getPaymentByIdempotencyKey as Mock).mockResolvedValue({
        id: 'existing-payment',
        status: 'pending',
        amount: 100,
        currency: 'ILS',
      });

      // No client-supplied idempotencyKey: the mocked lookup returns the existing
      // row regardless of the key, so this holds both before and after plan 03-08
      // removes the client override.
      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({
          type: 'vote_creation',
          voteTitle: 'Test Vote',
        }),
      });
      const response = await createPayment(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.idempotent).toBe(true);
      expect(data.payment.id).toBe('existing-payment');
      // A legacy row that never had a form URL stored degrades to the old
      // shape: no fabricated URL, the client shows CHECKOUT_UNAVAILABLE.
      expect(data.payment.paymentUrl).toBeUndefined();
    });

    it('hands an idempotent retry the stored hosted-form URL while the payment is pending', async () => {
      (getSessionFromRequest as Mock).mockResolvedValue(mockSession);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (getPaymentByIdempotencyKey as Mock).mockResolvedValue({
        id: 'existing-payment',
        status: 'pending',
        amount: 5000,
        currency: 'ILS',
        metadata: {
          voteTitle: 'Test Vote',
          providerFormUrl: 'https://sandbox.d.greeninvoice.co.il/form/reuse-1',
          providerFormExpiresAt: '2026-08-16T12:00:00.000Z',
        },
      });

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({ type: 'vote_creation', voteTitle: 'Test Vote' }),
      });
      const response = await createPayment(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.idempotent).toBe(true);
      // The retry can PAY: same payment, same checkout - no dead end, and no
      // second Green Invoice form is minted for one payment row.
      expect(data.payment.paymentUrl).toBe('https://sandbox.d.greeninvoice.co.il/form/reuse-1');
      expect(data.payment.expiresAt).toBe('2026-08-16T12:00:00.000Z');
      expect(paymentService.createVoteCreationPayment).not.toHaveBeenCalled();
      expect(dbCreatePayment).not.toHaveBeenCalled();
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
      // The hosted-form URL is persisted on the row, so an idempotent retry of
      // this request can be handed the same checkout.
      expect(attachPaymentFormUrl).toHaveBeenCalledWith(
        'payment-123',
        'https://sandbox.d.greeninvoice.co.il/form/456',
        expect.any(String)
      );
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

    /** A delivery that presents NO header - the shape Green Invoice's hosted form sends. */
    const createHeaderlessRequest = (payload: object, url = 'http://localhost:3000/api/payments/webhook') =>
      new NextRequest(url, { method: 'POST', body: JSON.stringify(payload) });

    beforeEach(() => {
      // Default: the payload carries a real Green Invoice document id, and Green
      // Invoice does NOT vouch for it unless a test says so. Fail-closed default.
      (paymentService.extractDocumentId as Mock).mockReturnValue('txn_123');
      (paymentService.confirmDocumentIssued as Mock).mockResolvedValue(false);
      (paymentService.confirmDocumentForPayment as Mock).mockResolvedValue(false);
    });

    /** Mocks for a delivery that reaches fulfilment, so auth is the only variable. */
    const stubSettledDelivery = (documentId: string | null = 'txn_123') => {
      (paymentService.parseWebhookEvent as Mock).mockReturnValue({
        type: 'payment.succeeded',
        paymentId: documentId ?? 'payment-123',
        amount: 5000,
        metadata: { orderId: 'payment-123' },
      });
      (paymentService.extractDocumentId as Mock).mockReturnValue(documentId);
      (getWebhookEventByEventId as Mock).mockResolvedValue(null);
      (createWebhookEvent as Mock).mockResolvedValue(undefined);
      (getPaymentById as Mock).mockResolvedValue({
        ...mockPayment,
        type: 'vote_creation',
        amount: 5000,
        vote_id: null,
        option_id: null,
      });
      (getUserById as Mock).mockResolvedValue(mockUser);
      (createEntitlement as Mock).mockResolvedValue(undefined);
      (qubikService.mintTokens as Mock).mockResolvedValue(undefined);
      (paymentService.getPaymentStatus as Mock).mockResolvedValue({ receiptUrl: 'https://x/1' });
      (emailService.sendPaymentReceiptEmail as Mock).mockResolvedValue(undefined);
      (updateWebhookEventStatus as Mock).mockResolvedValue(undefined);
    };

    it('accepts a delivery carrying a valid x-greeninvoice-token header', async () => {
      (paymentService.verifyWebhook as Mock).mockReturnValue(true);
      stubSettledDelivery();

      const response = await handleWebhook(
        createWebhookRequest({ event_id: 'evt_hdr', id: 'txn_123', custom: 'payment-123' })
      );

      expect(response.status).toBe(200);
      expect(markPaymentCompleted).toHaveBeenCalledTimes(1);
      // The header short-circuits factor 2: no Green Invoice round-trip at all.
      expect(paymentService.confirmDocumentForPayment).not.toHaveBeenCalled();
    });

    it('accepts a header-less delivery whose document Green Invoice binds to THIS payment', async () => {
      (paymentService.verifyWebhook as Mock).mockReturnValue(false);
      stubSettledDelivery('gi-doc-9');
      (paymentService.confirmDocumentForPayment as Mock).mockResolvedValue(true);

      const response = await handleWebhook(
        createHeaderlessRequest({ event_id: 'evt_conf', id: 'gi-doc-9', custom: 'payment-123' })
      );

      expect(response.status).toBe(200);
      // Ownership, not existence: the check receives the payment row's id and
      // amount, so the document must correlate to the exact payment it settles.
      expect(paymentService.confirmDocumentForPayment).toHaveBeenCalledWith('gi-doc-9', {
        paymentId: 'payment-123',
        amountAgorot: 5000,
      });
      expect(markPaymentCompleted).toHaveBeenCalledTimes(1);
    });

    it('rejects a header-less delivery with no confirmable document', async () => {
      (paymentService.verifyWebhook as Mock).mockReturnValue(false);
      stubSettledDelivery('gi-doc-forged');
      (paymentService.confirmDocumentForPayment as Mock).mockResolvedValue(false);

      const response = await handleWebhook(
        createHeaderlessRequest({ event_id: 'evt_forged', id: 'gi-doc-forged', custom: 'payment-123' })
      );
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      // Guessing an order id must mutate nothing.
      expect(markPaymentCompleted).not.toHaveBeenCalled();
      expect(createWebhookEvent).not.toHaveBeenCalled();
    });

    it('rejects a forged payload borrowing a real but UNRELATED document id - and mutates nothing', async () => {
      (paymentService.verifyWebhook as Mock).mockReturnValue(false);
      stubSettledDelivery('gi-doc-unrelated');
      // The document exists (an attacker's own ₪1 receipt would), but it does not
      // correlate to payment-123, so the binding check says no. Existence alone
      // must never authenticate.
      (paymentService.confirmDocumentIssued as Mock).mockResolvedValue(true);
      (paymentService.confirmDocumentForPayment as Mock).mockResolvedValue(false);

      const response = await handleWebhook(
        createHeaderlessRequest({ event_id: 'evt_borrowed', id: 'gi-doc-unrelated', custom: 'payment-123' })
      );
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(markPaymentCompleted).not.toHaveBeenCalled();
      expect(createWebhookEvent).not.toHaveBeenCalled();
      expect(createEntitlement).not.toHaveBeenCalled();
      expect(qubikService.mintTokens).not.toHaveBeenCalled();
      expect(updatePaymentStatus).not.toHaveBeenCalled();
    });

    it('rejects a VALID document replayed against a DIFFERENT payment', async () => {
      (paymentService.verifyWebhook as Mock).mockReturnValue(false);
      // gi-doc-A genuinely settles payment-A. The forged payload points it at
      // payment-B (a pending row the attacker wants completed for free). The
      // binding check holds the document to the payment the payload claims.
      stubSettledDelivery('gi-doc-A');
      (getPaymentById as Mock).mockResolvedValue({
        ...mockPayment,
        id: 'payment-B',
        type: 'vote_creation',
        amount: 5000,
        vote_id: null,
        option_id: null,
      });
      (paymentService.parseWebhookEvent as Mock).mockReturnValue({
        type: 'payment.succeeded',
        paymentId: 'gi-doc-A',
        amount: 5000,
        metadata: { orderId: 'payment-B' },
      });
      (paymentService.confirmDocumentForPayment as Mock).mockImplementation(
        async (documentId: string, expected: { paymentId: string }) =>
          documentId === 'gi-doc-A' && expected.paymentId === 'payment-A'
      );

      const response = await handleWebhook(
        createHeaderlessRequest({ event_id: 'evt_replayed', id: 'gi-doc-A', custom: 'payment-B' })
      );
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(paymentService.confirmDocumentForPayment).toHaveBeenCalledWith('gi-doc-A', {
        paymentId: 'payment-B',
        amountAgorot: 5000,
      });
      expect(markPaymentCompleted).not.toHaveBeenCalled();
      expect(createWebhookEvent).not.toHaveBeenCalled();
    });

    it('rejects a delivery whose secret arrives as a ?token= query parameter', async () => {
      // The regression that would reintroduce the forbidden transport. verifyWebhook
      // is held to its real header-only contract: a query parameter never matches.
      const secret = 'valid-header';
      (paymentService.verifyWebhook as Mock).mockImplementation(
        (req: Request) => req.headers.get('x-greeninvoice-token') === secret
      );
      stubSettledDelivery('gi-doc-9');
      (paymentService.confirmDocumentForPayment as Mock).mockResolvedValue(false);

      const response = await handleWebhook(
        createHeaderlessRequest(
          { event_id: 'evt_qs', id: 'gi-doc-9', custom: 'payment-123' },
          `http://localhost:3000/api/payments/webhook?token=${secret}`
        )
      );
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(markPaymentCompleted).not.toHaveBeenCalled();
    });

    it('a duplicate webhook_events insert (23505) is a replay', async () => {
      (paymentService.verifyWebhook as Mock).mockReturnValue(true);
      stubSettledDelivery();
      (createWebhookEvent as Mock).mockRejectedValue(
        Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' })
      );

      const response = await handleWebhook(
        createWebhookRequest({ event_id: 'evt_dup', id: 'txn_123', custom: 'payment-123' })
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.replay).toBe(true);
      expect(data.idempotent).toBe(true);
    });

    it('a non-23505 database failure returns 5xx so Green Invoice retries', async () => {
      (paymentService.verifyWebhook as Mock).mockReturnValue(true);
      stubSettledDelivery();
      (createWebhookEvent as Mock).mockRejectedValue(
        Object.assign(new Error('connection failure'), { code: '08006' })
      );

      const response = await handleWebhook(
        createWebhookRequest({ event_id: 'evt_down', id: 'txn_123', custom: 'payment-123' })
      );

      // A 200 here would tell Green Invoice to stop retrying and the delivery
      // would be lost. An outage is not a replay.
      expect(response.status).toBeGreaterThanOrEqual(500);
      expect(markPaymentCompleted).not.toHaveBeenCalled();
    });

    it('stores the Green Invoice document id, not our order id', async () => {
      (paymentService.verifyWebhook as Mock).mockReturnValue(true);
      stubSettledDelivery('gi-doc-9');

      const response = await handleWebhook(
        createWebhookRequest({ event_id: 'evt_doc', id: 'gi-doc-9', custom: 'order-1' })
      );

      expect(response.status).toBe(200);
      expect(markPaymentCompleted).toHaveBeenCalledWith('payment-123', 'gi-doc-9');
    });

    it('leaves provider_id untouched when the payload carries no document id', async () => {
      (paymentService.verifyWebhook as Mock).mockReturnValue(true);
      // Only `custom` - Green Invoice sent no document id at all.
      stubSettledDelivery(null);

      const response = await handleWebhook(
        createWebhookRequest({ event_id: 'evt_nodoc', custom: 'order-1' })
      );

      expect(response.status).toBe(200);
      // `undefined`, never 'order-1': markPaymentCompleted only writes provider_id
      // when the argument is truthy, so the column stays empty rather than holding
      // our own id (PAY-07).
      expect(markPaymentCompleted).toHaveBeenCalledWith('payment-123', undefined);
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

    /** A settled ₪50 creation fee: the only payment that can reach this route. */
    const mockCreationPayment = {
      ...mockPayment,
      type: 'vote_creation',
      amount: 5000, // ₪50 in agorot
      vote_id: null,
      option_id: null,
    };

    it('a settled creation fee completes the payment, mints and emails - and credits no treasury', async () => {
      (paymentService.verifyWebhook as Mock).mockReturnValue(true);
      (paymentService.parseWebhookEvent as Mock).mockReturnValue({
        type: 'payment.succeeded',
        paymentId: 'txn_123',
        amount: 5000,
        metadata: { orderId: 'payment-123' },
      });
      (getWebhookEventByEventId as Mock).mockResolvedValue(null);
      (createWebhookEvent as Mock).mockResolvedValue(undefined);
      (getPaymentById as Mock).mockResolvedValue(mockCreationPayment);
      (updatePaymentStatus as Mock).mockResolvedValue(undefined);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (createEntitlement as Mock).mockResolvedValue(undefined);
      (qubikService.mintTokens as Mock).mockResolvedValue(undefined);
      (paymentService.getPaymentStatus as Mock).mockResolvedValue({ receiptUrl: 'https://greeninvoice.co.il/doc/123' });
      (emailService.sendPaymentReceiptEmail as Mock).mockResolvedValue(undefined);
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
      expect(markPaymentCompleted).toHaveBeenCalledTimes(1);
      expect(markPaymentCompleted).toHaveBeenCalledWith('payment-123', 'txn_123');
      expect(createEntitlement).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'create_vote' })
      );
      expect(qubikService.mintTokens).toHaveBeenCalledWith({
        walletAddress: 'wallet-123',
        amount: 50,
        reason: 'vote_creation',
      });
      expect(emailService.sendPaymentReceiptEmail).toHaveBeenCalled();

      // PAY-06: the ₪50 creation fee is 100% platform. The civic pool is funded by
      // the vote's Bags.fm token, never by a fee.
      expect(recordTreasuryDeposit).not.toHaveBeenCalled();
      // A payment must never be the thing that records a ballot.
      expect(recordUserVote).not.toHaveBeenCalled();
      expect(incrementVoteOption).not.toHaveBeenCalled();
    });

    it('a legacy vote_participation payment settles without fulfilment', async () => {
      (paymentService.verifyWebhook as Mock).mockReturnValue(true);
      (paymentService.parseWebhookEvent as Mock).mockReturnValue({
        type: 'payment.succeeded',
        paymentId: 'txn_legacy',
        amount: 300,
        metadata: { orderId: 'payment-123' },
      });
      (getWebhookEventByEventId as Mock).mockResolvedValue(null);
      (createWebhookEvent as Mock).mockResolvedValue(undefined);
      // A pre-cfa5d25 row: still carries a vote_id and option_id.
      (getPaymentById as Mock).mockResolvedValue(mockPayment);
      (getUserById as Mock).mockResolvedValue(mockUser);
      (updateWebhookEventStatus as Mock).mockResolvedValue(undefined);

      const request = createWebhookRequest({
        event_type: 'transaction.completed',
        event_id: 'evt_legacy',
        data: { id: 'txn_legacy', custom_data: { orderId: 'payment-123' } },
      });
      const response = await handleWebhook(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      // Recognised, logged, and fulfilled in no way at all.
      expect(recordUserVote).not.toHaveBeenCalled();
      expect(incrementVoteOption).not.toHaveBeenCalled();
      expect(recordTreasuryDeposit).not.toHaveBeenCalled();
      expect(createEntitlement).not.toHaveBeenCalled();
      expect(qubikService.mintTokens).not.toHaveBeenCalled();
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

  /**
   * The two authenticity factors themselves, exercised against the REAL service
   * (the rest of this file mocks it). These are the assertions that would fail if
   * anyone reintroduced the secret-in-a-URL transport.
   */
  describe('webhook authenticity factors (SEC-03)', () => {
    type GreenInvoiceModule = typeof import('@/services/payments/greenInvoice');
    // Short on purpose: a fixture long enough to look like a credential trips the
    // repo's "no secret literal in a diff" scan.
    const SECRET = 'unit-fixture';
    let actual: GreenInvoiceModule;

    beforeAll(async () => {
      // Credentials must exist before the real module graph is first imported:
      // services/greenInvoice reads them into a module-level config.
      vi.stubEnv('GREENINVOICE_API_KEY_ID', 'test-key-id');
      vi.stubEnv('GREENINVOICE_API_SECRET', 'test-api-secret');
      actual = await vi.importActual<GreenInvoiceModule>('@/services/payments/greenInvoice');
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const requestWith = (init: { header?: string; url?: string }) =>
      new Request(init.url ?? 'http://localhost:3000/api/payments/webhook', {
        method: 'POST',
        headers: init.header === undefined ? {} : { 'x-greeninvoice-token': init.header },
      });

    describe('verifyWebhook', () => {
      it('accepts a matching x-greeninvoice-token header', () => {
        vi.stubEnv('GREENINVOICE_WEBHOOK_SECRET', SECRET);
        expect(actual.verifyWebhook(requestWith({ header: SECRET }))).toBe(true);
      });

      it('rejects a secret that arrives as a ?token= query parameter', () => {
        vi.stubEnv('GREENINVOICE_WEBHOOK_SECRET', SECRET);
        const request = requestWith({
          url: `http://localhost:3000/api/payments/webhook?token=${SECRET}`,
        });
        // The header is the only accepted transport. A URL secret leaks through
        // referrers, proxy logs and edge request logging, so it must never match.
        expect(actual.verifyWebhook(request)).toBe(false);
      });

      it('rejects a wrong header of the same length, and one of a different length', () => {
        vi.stubEnv('GREENINVOICE_WEBHOOK_SECRET', SECRET);
        expect(actual.verifyWebhook(requestWith({ header: 'x'.repeat(SECRET.length) }))).toBe(false);
        expect(actual.verifyWebhook(requestWith({ header: SECRET + 'extra' }))).toBe(false);
        expect(actual.verifyWebhook(requestWith({ header: undefined }))).toBe(false);
      });

      it('fails closed in production when no secret is configured, open outside it', () => {
        vi.stubEnv('GREENINVOICE_WEBHOOK_SECRET', '');
        vi.stubEnv('NODE_ENV', 'production');
        expect(actual.verifyWebhook(requestWith({ header: 'anything' }))).toBe(false);

        vi.stubEnv('NODE_ENV', 'development');
        expect(actual.verifyWebhook(requestWith({ header: 'anything' }))).toBe(true);
        vi.unstubAllEnvs();
      });
    });

    describe('extractDocumentId', () => {
      it('returns the Green Invoice document id across the fields GI may use', () => {
        expect(actual.extractDocumentId({ id: 'doc-1', custom: 'order-1' })).toBe('doc-1');
        expect(actual.extractDocumentId({ documentId: 'doc-2' })).toBe('doc-2');
        expect(actual.extractDocumentId({ paymentId: 'doc-3' })).toBe('doc-3');
      });

      it('returns null rather than falling back to our own order id', () => {
        expect(actual.extractDocumentId({ custom: 'order-1' })).toBeNull();
        expect(actual.extractDocumentId({ id: '', custom: 'order-1' })).toBeNull();
        expect(actual.extractDocumentId({})).toBeNull();
      });
    });

    describe('confirmDocumentIssued', () => {
      it('resolves true when Green Invoice returns the document', async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn(async (input: unknown) =>
            String(input).includes('/account/token')
              ? { ok: true, headers: { get: () => 'jwt-for-tests' }, json: async () => ({}) }
              : { ok: true, json: async () => ({ id: 'doc-1' }) }
          )
        );

        await expect(actual.confirmDocumentIssued('doc-1')).resolves.toBe(true);
      });

      it('resolves false without throwing when the lookup fails', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));

        // Best-effort by design: the caller fails closed on false.
        await expect(actual.confirmDocumentIssued('doc-1')).resolves.toBe(false);
      });

      it('resolves false for an empty document id without calling Green Invoice', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        await expect(actual.confirmDocumentIssued('')).resolves.toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
      });
    });

    describe('confirmDocumentForPayment - existence is not ownership', () => {
      /** Green Invoice answers the token call and returns `doc` for the document. */
      const giReturns = (doc: Record<string, unknown>) => {
        vi.stubGlobal(
          'fetch',
          vi.fn(async (input: unknown) =>
            String(input).includes('/account/token')
              ? { ok: true, headers: { get: () => 'jwt-for-tests' }, json: async () => ({}) }
              : { ok: true, json: async () => doc }
          )
        );
      };

      const EXPECTED = { paymentId: 'payment-123', amountAgorot: 5000 };

      it('accepts a document whose custom field carries the payment id and whose total matches', async () => {
        giReturns({ id: 'doc-1', custom: 'payment-123', amount: 50 });
        await expect(actual.confirmDocumentForPayment('doc-1', EXPECTED)).resolves.toBe(true);
      });

      it('accepts correlation through remarks - the field createPaymentForm writes', async () => {
        giReturns({ id: 'doc-1', remarks: 'Payment payment-123', sum: 50 });
        await expect(actual.confirmDocumentForPayment('doc-1', EXPECTED)).resolves.toBe(true);
      });

      it('rejects a REAL but unrelated document - it exists, it just is not ours', async () => {
        // The forgery this check exists for: the attacker buys their own ₪1
        // receipt from the same merchant and quotes its (real) id.
        giReturns({ id: 'doc-attacker', custom: 'payment-attacker', amount: 1 });
        await expect(actual.confirmDocumentForPayment('doc-attacker', EXPECTED)).resolves.toBe(false);
      });

      it('rejects a valid document replayed against a different payment', async () => {
        // gi-doc-A genuinely settles payment-A; the payload aims it at payment-B.
        giReturns({ id: 'gi-doc-A', custom: 'payment-A', remarks: 'Payment payment-A', amount: 50 });
        await expect(
          actual.confirmDocumentForPayment('gi-doc-A', { paymentId: 'payment-B', amountAgorot: 5000 })
        ).resolves.toBe(false);
      });

      it('rejects a correlated document whose total does not match the payment row', async () => {
        // Correlation forged into a cheap document must not buy a ₪50 completion.
        giReturns({ id: 'doc-1', custom: 'payment-123', amount: 1 });
        await expect(actual.confirmDocumentForPayment('doc-1', EXPECTED)).resolves.toBe(false);
      });

      it('tolerates sub-agora rounding on the total, and nothing more', async () => {
        giReturns({ id: 'doc-1', custom: 'payment-123', amount: 50.005 });
        await expect(actual.confirmDocumentForPayment('doc-1', EXPECTED)).resolves.toBe(true);

        giReturns({ id: 'doc-1', custom: 'payment-123', amount: 50.02 });
        await expect(actual.confirmDocumentForPayment('doc-1', EXPECTED)).resolves.toBe(false);
      });

      it('accepts on correlation alone when the document exposes no total', async () => {
        giReturns({ id: 'doc-1', custom: 'payment-123' });
        await expect(actual.confirmDocumentForPayment('doc-1', EXPECTED)).resolves.toBe(true);
      });

      it('resolves false without throwing when the lookup fails', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
        await expect(actual.confirmDocumentForPayment('doc-1', EXPECTED)).resolves.toBe(false);
      });

      it('resolves false for an empty document id without calling Green Invoice', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        await expect(actual.confirmDocumentForPayment('', EXPECTED)).resolves.toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
      });
    });
  });
});

/**
 * The shipped default: NEXT_PUBLIC_PAYMENTS_ENABLED is unset, so no payment may
 * be started. The client guard is cosmetic - THIS is the enforcement point, and
 * it must hold for a caller with a valid session, a valid body and every mock in
 * the world lined up behind it.
 */
describe('payments kill switch (NEXT_PUBLIC_PAYMENTS_ENABLED unset)', () => {
  const session = {
    userId: 'user-123',
    googleId: 'google-123',
    email: 'test@example.com',
    did: 'did:sync:' + 'a'.repeat(43),
    expiresAt: Date.now() + 86400000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    // A fully authenticated, fully provisioned caller: nothing but the switch
    // stands between this request and a Green Invoice hosted form.
    (getSessionFromRequest as Mock).mockResolvedValue(session);
    (getUserById as Mock).mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      municipality_id: 'tel-aviv',
    });
    (getPaymentByIdempotencyKey as Mock).mockResolvedValue(null);
  });

  it('POST /api/payments/create answers 503 PAYMENTS_DISABLED', async () => {
    const request = new NextRequest('http://localhost:3000/api/payments/create', {
      method: 'POST',
      body: JSON.stringify({ type: 'vote_creation', voteTitle: 'A perfectly valid vote' }),
    });

    const response = await createPayment(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.code).toBe('PAYMENTS_DISABLED');
    // Hebrew, because a stale client can put this in front of a resident.
    expect(data.error).toMatch(/[֐-׿]/);
  });

  it('refuses BEFORE auth, the body and Green Invoice are ever touched', async () => {
    // No session, and a body that is not even JSON. A gate that ran after either
    // of these would answer 401 or 400 here instead of 503.
    (getSessionFromRequest as Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/payments/create', {
      method: 'POST',
      body: 'not json at all',
    });

    const response = await createPayment(request);

    expect(response.status).toBe(503);
    expect(getSessionFromRequest).not.toHaveBeenCalled();
    expect(dbCreatePayment).not.toHaveBeenCalled();
    expect(paymentService.createVoteCreationPayment).not.toHaveBeenCalled();
  });

  it('opens no payment row and reaches no provider on a well-formed request', async () => {
    const request = new NextRequest('http://localhost:3000/api/payments/create', {
      method: 'POST',
      body: JSON.stringify({ type: 'vote_creation', voteTitle: 'Another valid vote' }),
    });

    await createPayment(request);

    expect(dbCreatePayment).not.toHaveBeenCalled();
    expect(getPaymentByIdempotencyKey).not.toHaveBeenCalled();
    expect(paymentService.createVoteCreationPayment).not.toHaveBeenCalled();
  });

  it.each(['false', 'TRUE', '1', 'yes', ''])(
    'stays closed for the near-miss value %j - only the exact string "true" opens it',
    async (value) => {
      vi.stubEnv('NEXT_PUBLIC_PAYMENTS_ENABLED', value);

      const request = new NextRequest('http://localhost:3000/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({ type: 'vote_creation', voteTitle: 'Near miss' }),
      });

      expect((await createPayment(request)).status).toBe(503);
    }
  );

  it('leaves the webhook fully functional - money already in flight must still land', async () => {
    // The switch stops NEW payments. A settlement for a payment taken before the
    // switch was thrown still has to be recorded, or the resident is charged and
    // never served.
    (paymentService.verifyWebhook as Mock).mockReturnValue(true);
    (paymentService.parseWebhookEvent as Mock).mockReturnValue({
      type: 'payment.succeeded',
      paymentId: 'txn_inflight',
      amount: 5000,
      metadata: { orderId: 'payment-123' },
    });
    (paymentService.extractDocumentId as Mock).mockReturnValue('txn_inflight');
    (getWebhookEventByEventId as Mock).mockResolvedValue(null);
    (createWebhookEvent as Mock).mockResolvedValue(undefined);
    (getPaymentById as Mock).mockResolvedValue({
      id: 'payment-123',
      user_id: 'user-123',
      type: 'vote_creation',
      amount: 5000,
      currency: 'ILS',
      status: 'pending',
      vote_id: null,
      option_id: null,
    });
    (markPaymentCompleted as Mock).mockResolvedValue({ id: 'payment-123' });
    (getUserById as Mock).mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      qubik_wallet_address: 'wallet-123',
    });
    (createEntitlement as Mock).mockResolvedValue(undefined);
    (qubikService.mintTokens as Mock).mockResolvedValue(undefined);
    (paymentService.getPaymentStatus as Mock).mockResolvedValue({ receiptUrl: 'https://x/1' });
    (emailService.sendPaymentReceiptEmail as Mock).mockResolvedValue(undefined);
    (updateWebhookEventStatus as Mock).mockResolvedValue(undefined);

    const response = await handleWebhook(
      new NextRequest('http://localhost:3000/api/payments/webhook', {
        method: 'POST',
        body: JSON.stringify({ event_id: 'evt_inflight', id: 'txn_inflight', custom: 'payment-123' }),
        headers: { 'x-greeninvoice-token': 'ts=1;h1=valid' },
      })
    );

    expect(response.status).toBe(200);
    expect(markPaymentCompleted).toHaveBeenCalledWith('payment-123', 'txn_inflight');
  });
});
