/**
 * Payment Types
 */

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed';
export type PaymentType = 'vote' | 'create_vote';

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: 'ILS';
  status: PaymentStatus;
  paymentUrl: string;
  expiresAt: Date;
}

export interface PaymentResult {
  id: string;
  amount: number;
  currency: 'ILS';
  status: 'succeeded' | 'failed';
  receiptUrl?: string;
  txHash: string;
  processedAt: Date;
}

export interface TokenBalance {
  balance: number;
  walletAddress: string;
  lastUpdated: Date;
}

export interface TokenTransaction {
  id: string;
  type: 'mint' | 'transfer';
  amount: number;
  reason: PaymentType;
  txHash: string;
  timestamp: Date;
}
