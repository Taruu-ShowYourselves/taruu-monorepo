/**
 * Payments API Client
 *
 * One payment exists: the vote-creation fee. Participation is free, so there
 * is no participation method and no participation type to send.
 */

import { getApiClient } from './client';
import type { CreatablePaymentType, CreatePaymentResponse as CreatePaymentBody } from '@sync/shared/contracts';

export interface CreatePaymentParams {
  type: CreatablePaymentType;
  voteTitle?: string;
}

export interface CreatePaymentIntentParams {
  amount: number;
  type: CreatablePaymentType;
  metadata?: Record<string, unknown>;
}

/**
 * The payment `POST /api/payments/create` returns. The route always issues a
 * hosted-form URL, so `paymentUrl` is required here even though the shared
 * response contract marks it optional for stored-payment reads.
 */
export interface CreatedPayment {
  id: string;
  orderId?: string;
  paymentUrl: string;
  amount: number;
  currency: 'ILS';
  expiresAt?: string;
}

export interface CreatePaymentResponse extends Omit<CreatePaymentBody, 'payment'> {
  payment: CreatedPayment;
}

export interface PaymentStatusResponse {
  status: 'pending' | 'succeeded' | 'failed';
  receiptUrl?: string;
}

export const paymentsApi = {
  /**
   * Create a payment for the vote-creation fee
   */
  async createVoteCreationPayment(voteTitle: string): Promise<CreatedPayment> {
    const client = getApiClient();
    const response = await client.post<CreatePaymentResponse>(
      '/api/payments/create',
      { type: 'vote_creation', voteTitle }
    );
    return response.payment;
  },

  /**
   * Check payment status
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
    const client = getApiClient();
    return client.get<PaymentStatusResponse>(`/api/payments/${paymentId}/status`);
  },

  /**
   * Verify payment completion (called after redirect from payment provider)
   */
  async verifyPayment(paymentId: string): Promise<{
    success: boolean;
    receiptUrl?: string;
    tokensEarned: number;
  }> {
    const client = getApiClient();
    return client.post(`/api/payments/${paymentId}/verify`);
  },

  /**
   * Create a generic payment
   */
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<CreatedPayment> {
    const client = getApiClient();
    const response = await client.post<CreatePaymentResponse>(
      '/api/payments/create',
      params
    );
    return response.payment;
  },
  // Note: Token balance moved to usersApi.getTokenBalance() to avoid duplication
};
