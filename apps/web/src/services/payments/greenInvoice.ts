/**
 * Green Invoice Payment Service
 *
 * Handles payment processing for:
 * - Vote participation (₪1)
 * - Vote creation (₪50)
 * - Receipt generation
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
   * Create a payment intent for vote participation (₪1)
   */
  async createVotePayment(params: {
    oderId: string;
    voteId: string;
    email: string;
    name: string;
  }): Promise<PaymentIntent> {
    const data = await this.request<any>('/payments/form', {
      method: 'POST',
      body: JSON.stringify({
        description: 'הצבעה בסינק',
        type: 320, // Payment type
        lang: 'he',
        currency: 'ILS',
        vatType: 0,
        amount: 1,
        maxPayments: 1,
        client: {
          name: params.name,
          emails: [params.email],
        },
        income: [
          {
            catalogNum: 'SYNC-VOTE-001',
            description: 'תרומה להצבעה',
            quantity: 1,
            price: 1,
            currency: 'ILS',
            vatType: 0,
          },
        ],
        remarks: `Vote: ${params.voteId}`,
        successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/votes/${params.voteId}/success`,
        failureUrl: `${process.env.NEXT_PUBLIC_APP_URL}/votes/${params.voteId}/failed`,
        notifyUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/webhook`,
        custom: JSON.stringify({
          oderId: params.oderId,
          voteId: params.voteId,
          type: 'vote',
        }),
      }),
    });

    return {
      id: data.id,
      amount: 1,
      currency: 'ILS',
      status: 'pending',
      paymentUrl: data.url,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    };
  }

  /**
   * Create a payment intent for vote creation (₪50)
   */
  async createVoteCreationPayment(params: {
    oderId: string;
    voteTitle: string;
    email: string;
    name: string;
  }): Promise<PaymentIntent> {
    const data = await this.request<any>('/payments/form', {
      method: 'POST',
      body: JSON.stringify({
        description: 'יצירת הצבעה בסינק',
        type: 320,
        lang: 'he',
        currency: 'ILS',
        vatType: 0,
        amount: 50,
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
            price: 50,
            currency: 'ILS',
            vatType: 0,
          },
        ],
        remarks: `Create Vote: ${params.voteTitle}`,
        successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/votes/create/success`,
        failureUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/votes/create/failed`,
        notifyUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/webhook`,
        custom: JSON.stringify({
          oderId: params.oderId,
          voteTitle: params.voteTitle,
          type: 'create_vote',
        }),
      }),
    });

    return {
      id: data.id,
      amount: 50,
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
export type { PaymentIntent, PaymentResult, PaymentWebhookEvent };
