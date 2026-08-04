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
    // Default: the atomic pending→completed claim succeeds (this delivery wins).
    // Idempotent/already-completed tests override this to null (lost the race).
    (markPaymentCompleted as Mock).mockResolvedValue(mockPayment);
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
});
