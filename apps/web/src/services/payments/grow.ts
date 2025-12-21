/**
 * Grow Payment Management Service
 *
 * Handles subscription and recurring payment management:
 * - Premium subscriptions (future)
 * - Payment analytics
 * - Billing management
 */

interface GrowConfig {
  apiKey: string;
  baseUrl: string;
}

interface Subscription {
  id: string;
  oderId: string;
  planId: string;
  status: 'active' | 'cancelled' | 'past_due' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
}

interface PaymentAnalytics {
  totalRevenue: number;
  totalTransactions: number;
  averageTransaction: number;
  periodStart: Date;
  periodEnd: Date;
  breakdown: {
    votes: number;
    voteCreations: number;
    subscriptions: number;
  };
}

class GrowService {
  private config: GrowConfig;

  constructor() {
    this.config = {
      apiKey: process.env.GROW_API_KEY || '',
      baseUrl: 'https://api.grow.io/v2',
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || 'Grow API error');
    }

    return response.json();
  }

  /**
   * Track a payment event for analytics
   */
  async trackPayment(params: {
    oderId: string;
    amount: number;
    type: 'vote' | 'create_vote' | 'subscription';
    metadata?: Record<string, string>;
  }): Promise<void> {
    await this.request('/events', {
      method: 'POST',
      body: JSON.stringify({
        eventType: 'payment',
        oderId: params.oderId,
        properties: {
          amount: params.amount,
          currency: 'ILS',
          type: params.type,
          ...params.metadata,
        },
        timestamp: new Date().toISOString(),
      }),
    });
  }

  /**
   * Get payment analytics for a period
   */
  async getAnalytics(params: {
    startDate: Date;
    endDate: Date;
    municipality?: string;
  }): Promise<PaymentAnalytics> {
    const queryParams = new URLSearchParams({
      startDate: params.startDate.toISOString(),
      endDate: params.endDate.toISOString(),
      ...(params.municipality && { municipality: params.municipality }),
    });

    const data = await this.request<any>(
      `/analytics/payments?${queryParams.toString()}`
    );

    return {
      totalRevenue: data.totalRevenue,
      totalTransactions: data.totalTransactions,
      averageTransaction: data.averageTransaction,
      periodStart: new Date(data.periodStart),
      periodEnd: new Date(data.periodEnd),
      breakdown: {
        votes: data.breakdown.votes || 0,
        voteCreations: data.breakdown.voteCreations || 0,
        subscriptions: data.breakdown.subscriptions || 0,
      },
    };
  }

  /**
   * Create a subscription (for future premium features)
   */
  async createSubscription(params: {
    oderId: string;
    planId: string;
    paymentMethodId: string;
  }): Promise<Subscription> {
    const data = await this.request<any>('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        oderId: params.oderId,
        planId: params.planId,
        paymentMethodId: params.paymentMethodId,
      }),
    });

    return {
      id: data.id,
      oderId: params.oderId,
      planId: params.planId,
      status: data.status,
      currentPeriodStart: new Date(data.currentPeriodStart),
      currentPeriodEnd: new Date(data.currentPeriodEnd),
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
      createdAt: new Date(data.createdAt),
    };
  }

  /**
   * Get user's subscription
   */
  async getSubscription(oderId: string): Promise<Subscription | null> {
    try {
      const data = await this.request<any>(`/subscriptions?oderId=${oderId}`);
      if (!data.subscriptions || data.subscriptions.length === 0) {
        return null;
      }

      const sub = data.subscriptions[0];
      return {
        id: sub.id,
        oderId: sub.oderId,
        planId: sub.planId,
        status: sub.status,
        currentPeriodStart: new Date(sub.currentPeriodStart),
        currentPeriodEnd: new Date(sub.currentPeriodEnd),
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        createdAt: new Date(sub.createdAt),
      };
    } catch {
      return null;
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelImmediately = false
  ): Promise<Subscription> {
    const data = await this.request<any>(`/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({
        cancelImmediately,
      }),
    });

    return {
      id: data.id,
      oderId: data.oderId,
      planId: data.planId,
      status: data.status,
      currentPeriodStart: new Date(data.currentPeriodStart),
      currentPeriodEnd: new Date(data.currentPeriodEnd),
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
      createdAt: new Date(data.createdAt),
    };
  }

  /**
   * Track user activity for engagement analytics
   */
  async trackActivity(params: {
    oderId: string;
    activity: 'view_vote' | 'participate' | 'create_vote' | 'share';
    metadata?: Record<string, string>;
  }): Promise<void> {
    await this.request('/events', {
      method: 'POST',
      body: JSON.stringify({
        eventType: 'activity',
        oderId: params.oderId,
        properties: {
          activity: params.activity,
          ...params.metadata,
        },
        timestamp: new Date().toISOString(),
      }),
    });
  }
}

export const growService = new GrowService();
export type { Subscription, PaymentAnalytics };
