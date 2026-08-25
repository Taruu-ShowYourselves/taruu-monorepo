/**
 * Payments API Tests
 *
 * Tests for payment processing. One payment exists - the vote-creation fee -
 * so these lock the wire contract the server actually accepts and the
 * response key it actually returns.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CreatePaymentRequestSchema,
  GetPaymentStatusResponseSchema,
  GetPricingResponseSchema,
  PaymentTypeSchema,
} from '@sync/shared/contracts';
import { paymentsApi } from '../payments';
import { initializeApiClient } from '../client';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('paymentsApi', () => {
  const baseUrl = 'https://api.test.com';

  beforeEach(() => {
    mockFetch.mockReset();
    initializeApiClient({ baseUrl });
  });

  describe('participation is not purchasable', () => {
    it('exposes exactly one payment-creating method, and it is for creation', () => {
      expect(Object.keys(paymentsApi).sort()).toEqual([
        'createPaymentIntent',
        'createVoteCreationPayment',
        'getPaymentStatus',
        'verifyPayment',
      ]);
    });
  });

  describe('createVoteCreationPayment', () => {
    it('should create payment for vote creation', async () => {
      const mockPayment = {
        id: 'payment-456',
        amount: 50,
        currency: 'ILS',
        paymentUrl: 'https://sandbox.d.greeninvoice.co.il/form/456',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, payment: mockPayment }),
      });

      const result = await paymentsApi.createVoteCreationPayment('Test Vote');

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/api/payments/create`, {
        method: 'POST',
        body: JSON.stringify({ type: 'vote_creation', voteTitle: 'Test Vote' }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      });
      expect(result.id).toBe('payment-456');
      expect(result.amount).toBe(50);
      expect(result.paymentUrl).toBe(mockPayment.paymentUrl);
    });

    it('sends a type string the create route accepts', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, payment: { id: 'p', amount: 50, currency: 'ILS', paymentUrl: 'u' } }),
      });

      await paymentsApi.createVoteCreationPayment('Test Vote');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(CreatePaymentRequestSchema.safeParse(body).success).toBe(true);
    });
  });

  describe('getPaymentStatus', () => {
    it('should get pending payment status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'pending' }),
      });

      const result = await paymentsApi.getPaymentStatus('payment-123');

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/api/payments/payment-123/status`, {
        method: 'GET',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      });
      expect(result.status).toBe('pending');
      expect(result.receiptUrl).toBeUndefined();
    });

    it('should get succeeded payment status with receipt', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'succeeded',
          receiptUrl: 'https://greeninvoice.co.il/doc/123',
        }),
      });

      const result = await paymentsApi.getPaymentStatus('payment-456');

      expect(result.status).toBe('succeeded');
      expect(result.receiptUrl).toBe('https://greeninvoice.co.il/doc/123');
    });

    it('should get failed payment status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'failed' }),
      });

      const result = await paymentsApi.getPaymentStatus('payment-789');

      expect(result.status).toBe('failed');
    });
  });

  describe('verifyPayment', () => {
    it('should verify successful payment', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          receiptUrl: 'https://greeninvoice.co.il/doc/123',
          tokensEarned: 1,
        }),
      });

      const result = await paymentsApi.verifyPayment('payment-123');

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/api/payments/payment-123/verify`, {
        method: 'POST',
        body: undefined,
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      });
      expect(result.success).toBe(true);
      expect(result.tokensEarned).toBe(1);
      expect(result.receiptUrl).toBeDefined();
    });

    it('should return failure for unverified payment', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          tokensEarned: 0,
        }),
      });

      const result = await paymentsApi.verifyPayment('payment-456');

      expect(result.success).toBe(false);
      expect(result.tokensEarned).toBe(0);
    });
  });

  describe('createPaymentIntent', () => {
    it('should create generic payment intent', async () => {
      const params = {
        amount: 100,
        type: 'vote_creation' as const,
        metadata: { customField: 'value' },
      };

      const mockPayment = {
        id: 'payment-789',
        amount: params.amount,
        currency: 'ILS',
        paymentUrl: 'https://sandbox.d.greeninvoice.co.il/form/789',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, payment: mockPayment }),
      });

      const result = await paymentsApi.createPaymentIntent(params);

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/api/payments/create`, {
        method: 'POST',
        body: JSON.stringify(params),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      });
      expect(result.amount).toBe(100);
    });

    it('should create payment intent without metadata', async () => {
      const params = {
        amount: 50,
        type: 'vote_creation' as const,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          payment: { id: 'payment-000', amount: params.amount, currency: 'ILS', paymentUrl: 'test' },
        }),
      });

      const result = await paymentsApi.createPaymentIntent(params);

      expect(result.amount).toBe(50);
    });
  });

  // The contracts these methods post against. Narrowed in 03-03 T1; asserted
  // here because @sync/shared has no test runner of its own.
  describe('shared payment contracts', () => {
    it('accepts a creation request', () => {
      expect(
        CreatePaymentRequestSchema.safeParse({ type: 'vote_creation', voteTitle: 'x' }).success
      ).toBe(true);
    });

    it('rejects a participation request', () => {
      expect(
        CreatePaymentRequestSchema.safeParse({
          type: 'vote_participation',
          voteId: '3f6d1c2e-1f2a-4c3b-8d4e-5a6b7c8d9e0f',
        }).success
      ).toBe(false);
    });

    it('publishes creation pricing only', () => {
      const priced = {
        amount: 50,
        currency: 'ILS' as const,
        syncTokens: 50,
        description: 'יצירת הצבעה חדשה',
      };

      const parsed = GetPricingResponseSchema.parse({
        pricing: { voteCreation: priced },
        tokenRate: { rate: 1, description: '1 ILS = 1 SYNC' },
        paymentProvider: 'green_invoice',
      });

      expect(Object.keys(parsed.pricing)).toEqual(['voteCreation']);
    });

    it('still parses a stored legacy participation payment', () => {
      expect(PaymentTypeSchema.safeParse('vote_participation').success).toBe(true);

      const stored = GetPaymentStatusResponseSchema.safeParse({
        id: '3f6d1c2e-1f2a-4c3b-8d4e-5a6b7c8d9e0f',
        status: 'completed',
        amount: 300,
        currency: 'ILS',
        type: 'vote_participation',
        receiptUrl: null,
        succeeded: true,
        tokensEarned: 3,
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
        voteId: null,
      });

      expect(stored.success).toBe(true);
    });
  });
});
