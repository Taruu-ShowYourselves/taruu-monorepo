/**
 * Payment Types - Green Invoice (Merchant of Record) Integration
 */

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentType = 'vote_participation' | 'vote_creation';

// === Payment Webhook Types ===

/** Normalized webhook event consumed by the payments webhook route */
export interface PaymentWebhookEvent {
  type: 'payment.succeeded' | 'payment.failed' | 'refund.created';
  /** Green Invoice document id (set once the notification is issued) */
  paymentId: string;
  /** Amount in agorot (minor units) */
  amount: number;
  /** Correlation metadata (carries our internal payment id as `orderId`) */
  metadata: Record<string, string>;
}

export interface Payment {
  id: string;

  // Green Invoice document id
  providerId: string;
  idempotencyKey: string;

  // Details
  userId: string;
  amount: number; // In agorot (cents)
  amountILS: number; // Human readable
  currency: 'ILS';

  type: PaymentType;
  status: PaymentStatus;

  // Metadata
  metadata: {
    voteId?: string;
    optionId?: string;
    voteTitle?: string;
  };

  // Tokens
  tokensAwarded: number;
  qubikTxHash?: string;

  createdAt: Date;
  processedAt?: Date;
}

export interface CreatePaymentIntentInput {
  amount: number; // In agorot (300 for vote, 20000 for create_vote)
  type: PaymentType;
  metadata: {
    voteId?: string;
    optionId?: string;
    voteTitle?: string;
  };
}

export interface CreatePaymentIntentResult {
  paymentId: string;
  paymentUrl: string;
  amount: number;
  currency: 'ILS';
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: 'ILS';
  status: PaymentStatus;
  paymentUrl: string;
  expiresAt?: Date;
}

export interface PaymentResult {
  id: string;
  amount: number;
  currency: 'ILS';
  status: 'completed' | 'failed';
  receiptUrl?: string;
  txHash: string;
  processedAt: Date;
}

// === Token Types ===

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

// Note: Payment amounts in ILS are defined in @sync/shared/constants (VOTE_COST, CREATE_VOTE_COST)
// The backend converts to agorot (amount * 100) when storing payments.
// Green Invoice is the merchant of record; ILS settles to the platform bank account and is
// accrued per-vote in the treasury ledger, then batch-seeded into a Bags.fm bag at
// vote resolution (see services/treasury + services/nft).
