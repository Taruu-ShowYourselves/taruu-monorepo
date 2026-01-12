/**
 * Green Invoice Payment Service
 *
 * Handles payment processing for:
 * - Vote participation (₪3)
 * - Vote creation (₪50)
 * - Receipt generation
 *
 * Integrates with:
 * - Qubik for token minting (1 ILS = 1 SYNC token)
 * - Resend for payment receipts
 */

interface GreenInvoiceConfig {
  apiKey: string;
  secret: string;
  baseUrl: string;
}

interface PaymentIntent {
  id: string;
  amount: number;
  currency: 'ILS';
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  paymentUrl: string;
  expiresAt: Date;
}

interface PaymentResult {
  id: string;
  amount: number;
  currency: 'ILS';
  status: 'succeeded' | 'failed';
  receiptUrl?: string;
  txHash: string;
  processedAt: Date;
}

interface PaymentWebhookEvent {
  type: 'payment.succeeded' | 'payment.failed' | 'refund.created';
  paymentId: string;
  amount: number;
  metadata: Record<string, string>;
}

// Payment amounts in ILS
const VOTE_PARTICIPATION_AMOUNT = 3; // ₪3
const VOTE_CREATION_AMOUNT = 200; // ₪200

class GreenInvoiceService {
  private config: GreenInvoiceConfig;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    this.config = {
      apiKey: process.env.GREEN_INVOICE_API_KEY || '',
      secret: process.env.GREEN_INVOICE_SECRET || '',
      baseUrl: 'https://api.greeninvoice.co.il/api/v1',
    };
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    const response = await fetch(`${this.config.baseUrl}/account/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: this.config.apiKey,
        secret: this.config.secret,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to authenticate with Green Invoice');
    }

    const data = await response.json();
    const token = data.token as string;
    this.accessToken = token;
    this.tokenExpiry = new Date(Date.now() + data.expiresIn * 1000);

    return token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || 'Green Invoice API error');
    }

    return response.json();
  }

  /**
   * Create a payment intent for vote participation (₪3)
   */
  async createVotePayment(params: {
    orderId: string;
    voteId: string;
    voteTitle?: string;
    userId: string;
    email: string;
    name: string;
    municipality?: string;
  }): Promise<PaymentIntent> {
    const data = await this.request<any>('/payments/form', {
      method: 'POST',
      body: JSON.stringify({
        description: `השתתפות בהצבעה: ${params.voteTitle || params.voteId}`,
        type: 320, // Payment type
        lang: 'he',
        currency: 'ILS',
        vatType: 0,
        amount: VOTE_PARTICIPATION_AMOUNT,
        maxPayments: 1,
        client: {
          name: params.name,
          emails: [params.email],
        },
        income: [
          {
            catalogNum: 'SYNC-VOTE-001',
            description: 'השתתפות בהצבעה',
            quantity: 1,
            price: VOTE_PARTICIPATION_AMOUNT,
            currency: 'ILS',
            vatType: 0,
          },
        ],
        remarks: `Vote: ${params.voteId} | User: ${params.userId}`,
        successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/votes/${params.voteId}/success`,
        failureUrl: `${process.env.NEXT_PUBLIC_APP_URL}/votes/${params.voteId}/failed`,
        notifyUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/webhook`,
        custom: JSON.stringify({
          orderId: params.orderId,
          voteId: params.voteId,
          userId: params.userId,
          type: 'vote_participation',
          tokensToMint: VOTE_PARTICIPATION_AMOUNT, // 1 ILS = 1 SYNC token
          municipality: params.municipality || '',
        }),
      }),
    });

    return {
      id: data.id,
      amount: VOTE_PARTICIPATION_AMOUNT,
      currency: 'ILS',
      status: 'pending',
      paymentUrl: data.url,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    };
  }

  /**
   * Create a payment intent for vote creation (₪200)
   */
  async createVoteCreationPayment(params: {
    orderId: string;
    voteTitle: string;
    userId: string;
    email: string;
    name: string;
    municipality?: string;
  }): Promise<PaymentIntent> {
    const data = await this.request<any>('/payments/form', {
      method: 'POST',
      body: JSON.stringify({
        description: `יצירת הצבעה: ${params.voteTitle || 'הצבעה חדשה'}`,
        type: 320,
        lang: 'he',
        currency: 'ILS',
        vatType: 0,
        amount: VOTE_CREATION_AMOUNT,
        maxPayments: 1,
        client: {
          name: params.name,
          emails: [params.email],
        },
        income: [
          {
            catalogNum: 'SYNC-CREATE-001',
            description: 'דמי יצירת הצבעה',
            quantity: 1,
            price: VOTE_CREATION_AMOUNT,
            currency: 'ILS',
            vatType: 0,
          },
        ],
        remarks: `Create Vote: ${params.voteTitle} | User: ${params.userId}`,
        successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/votes/create/success`,
        failureUrl: `${process.env.NEXT_PUBLIC_APP_URL}/votes/create/failed`,
        notifyUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/webhook`,
        custom: JSON.stringify({
          orderId: params.orderId,
          voteTitle: params.voteTitle,
          userId: params.userId,
          type: 'vote_creation',
          tokensToMint: VOTE_CREATION_AMOUNT, // 1 ILS = 1 SYNC token
          municipality: params.municipality || '',
        }),
      }),
    });

    return {
      id: data.id,
      amount: VOTE_CREATION_AMOUNT,
      currency: 'ILS',
      status: 'pending',
      paymentUrl: data.url,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentResult> {
    const data = await this.request<any>(`/payments/${paymentId}`);

    return {
      id: data.id,
      amount: data.amount,
      currency: 'ILS',
      status: data.status === 'paid' ? 'succeeded' : 'failed',
      receiptUrl: data.documentUrl,
      txHash: data.transactionId,
      processedAt: new Date(data.paidAt || data.createdAt),
    };
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', this.config.secret)
      .update(payload)
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Parse webhook event
   */
  parseWebhookEvent(payload: any): PaymentWebhookEvent {
    const customData = JSON.parse(payload.custom || '{}');

    return {
      type: payload.status === 'paid' ? 'payment.succeeded' : 'payment.failed',
      paymentId: payload.id,
      amount: payload.amount,
      metadata: customData,
    };
  }
}

export const greenInvoiceService = new GreenInvoiceService();

/**
 * Get payment amounts for display
 */
export function getPaymentAmounts() {
  return {
    voteParticipation: VOTE_PARTICIPATION_AMOUNT, // ₪3
    voteCreation: VOTE_CREATION_AMOUNT, // ₪200
    currency: 'ILS',
  };
}

export { VOTE_PARTICIPATION_AMOUNT, VOTE_CREATION_AMOUNT };
export type { PaymentIntent, PaymentResult, PaymentWebhookEvent };
