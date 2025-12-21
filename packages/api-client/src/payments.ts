/**
 * Payments API Client
 */

import { getApiClient } from './client';
import type { PaymentIntent, PaymentType, TokenBalance } from '@sync/shared';

export interface CreatePaymentParams {
  type: PaymentType;
  voteId?: string;
  voteTitle?: string;
}

export interface CreatePaymentIntentParams {
  amount: number;
  type: PaymentType;
  metadata?: Record<string, any>;
}

export interface CreatePaymentResponse {
  paymentIntent: PaymentIntent;
}

export interface PaymentStatusResponse {
  status: 'pending' | 'succeeded' | 'failed';
  receiptUrl?: string;
}

export const paymentsApi = {
  /**
   * Create a payment intent for voting
   */
  async createVotePayment(voteId: string): Promise<PaymentIntent> {
    const client = getApiClient();
    const response = await client.post<CreatePaymentResponse>(
      '/api/payments/create',
      { type: 'vote', voteId }
    );
    return response.paymentIntent;
  },

  /**
   * Create a payment intent for vote creation
   */
  async createVoteCreationPayment(voteTitle: string): Promise<PaymentIntent> {
    const client = getApiClient();
    const response = await client.post<CreatePaymentResponse>(
      '/api/payments/create',
      { type: 'create_vote', voteTitle }
    );
    return response.paymentIntent;
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
   * Create a generic payment intent
   */
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent> {
    const client = getApiClient();
    const response = await client.post<CreatePaymentResponse>(
      '/api/payments/create',
      params
    );
    return response.paymentIntent;
  },

  /**
   * Get user's token balance
   */
  async getTokenBalance(): Promise<TokenBalance> {
    const client = getApiClient();
    const response = await client.get<{ balance: number; walletAddress: string }>(
      '/api/user/tokens'
    );
    return {
      balance: response.balance,
      walletAddress: response.walletAddress,
      lastUpdated: new Date(),
    };
  },
};
