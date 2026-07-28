/**
 * Payments API Tests
 *
 * Tests for payment processing including vote payments,
 * vote creation payments, and payment verification.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
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

  describe('createVotePayment', () => {
    it('should create payment for voting', async () => {
      const mockPaymentIntent = {
        id: 'payment-123',
        amount: 300,
        currency: 'ILS',
        status: 'pending',
        paymentUrl: 'https://sandbox.d.greeninvoice.co.il/form/123',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ paymentIntent: mockPaymentIntent }),
      });

      const result = await paymentsApi.createVotePayment('vote-123');

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/api/payments/create`, {
        method: 'POST',
        body: JSON.stringify({ type: 'vote', voteId: 'vote-123' }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      });
      expect(result.id).toBe('payment-123');
      expect(result.amount).toBe(300);
      expect(result.status).toBe('pending');
    });
  });

  describe('createVoteCreationPayment', () => {
    it('should create payment for vote creation', async () => {
      const mockPaymentIntent = {
        id: 'payment-456',
        amount: 20000,
        currency: 'ILS',
        status: 'pending',
        paymentUrl: 'https://sandbox.d.greeninvoice.co.il/form/456',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ paymentIntent: mockPaymentIntent }),
      });

      const result = await paymentsApi.createVoteCreationPayment('Should we build a new park?');

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/api/payments/create`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'create_vote',
          voteTitle: 'Should we build a new park?',
        }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      });
      expect(result.id).toBe('payment-456');
      expect(result.amount).toBe(20000);
      expect(result.status).toBe('pending');
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
        type: 'vote_participation' as const,
        metadata: { customField: 'value' },
      };

      const mockPaymentIntent = {
        id: 'payment-789',
        amount: params.amount,
        currency: 'ILS',
        status: 'pending',
        paymentUrl: 'https://sandbox.d.greeninvoice.co.il/form/789',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ paymentIntent: mockPaymentIntent }),
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
          paymentIntent: { id: 'payment-000', amount: params.amount, currency: 'ILS', status: 'pending', paymentUrl: 'test' },
        }),
      });

      const result = await paymentsApi.createPaymentIntent(params);

      expect(result.amount).toBe(50);
    });
  });
});
