/**
 * Bags.fm SocialFi API Client
 *
 * Client-side API for treasury operations and Issue Coin management.
 * Backend handles actual Bags.fm API calls - this client interfaces with
 * our internal API routes.
 */

import { getApiClient } from './client';
import type {
  TreasuryBalance,
  TreasuryTransaction,
  TreasuryTransactionType,
  IssueCoin,
  IssueCoinHolder,
  Quote,
  QuoteParams,
  SwapResult,
} from '@sync/shared';

// === Treasury API ===

export interface GetTreasuryResponse {
  treasury: TreasuryBalance;
}

export interface GetTreasuryTransactionsParams {
  limit?: number;
  offset?: number;
  type?: TreasuryTransactionType;
}

export interface GetTreasuryTransactionsResponse {
  transactions: TreasuryTransaction[];
  total: number;
}

// === Issue Coin API ===

export interface GetIssueCoinResponse {
  issueCoin: IssueCoin | null;
}

export interface GetIssueCoinHoldersParams {
  limit?: number;
  offset?: number;
}

export interface GetIssueCoinHoldersResponse {
  holders: IssueCoinHolder[];
  total: number;
}

// === Trading API ===

export interface GetQuoteResponse {
  success: true;
  quote: Quote;
}

export interface ExecuteSwapResponse {
  success: true;
  result: SwapResult;
}

/**
 * Bags.fm API client for treasury and Issue Coin operations
 */
export const bagsApi = {
  // === Treasury Methods ===

  /**
   * Get treasury balance for a municipality
   */
  async getTreasury(municipalityId: string): Promise<TreasuryBalance> {
    const client = getApiClient();
    const response = await client.get<GetTreasuryResponse>(
      `/api/treasury/${encodeURIComponent(municipalityId)}`
    );
    return response.treasury;
  },

  /**
   * Get treasury transaction history for a municipality
   */
  async getTreasuryTransactions(
    municipalityId: string,
    params?: GetTreasuryTransactionsParams
  ): Promise<GetTreasuryTransactionsResponse> {
    const client = getApiClient();
    const searchParams = new URLSearchParams();

    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    if (params?.type) searchParams.set('type', params.type);

    const queryString = searchParams.toString();
    const endpoint = `/api/treasury/${encodeURIComponent(municipalityId)}/transactions${
      queryString ? `?${queryString}` : ''
    }`;

    return client.get<GetTreasuryTransactionsResponse>(endpoint);
  },

  // === Issue Coin Methods ===

  /**
   * Get Issue Coin details for a vote
   */
  async getIssueCoin(voteId: string): Promise<IssueCoin | null> {
    const client = getApiClient();
    const response = await client.get<GetIssueCoinResponse>(
      `/api/votes/${voteId}/issue-coin`
    );
    return response.issueCoin;
  },

  /**
   * Get Issue Coin holder list for a vote
   */
  async getIssueCoinHolders(
    voteId: string,
    params?: GetIssueCoinHoldersParams
  ): Promise<GetIssueCoinHoldersResponse> {
    const client = getApiClient();
    const searchParams = new URLSearchParams();

    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));

    const queryString = searchParams.toString();
    const endpoint = `/api/votes/${voteId}/issue-coin/holders${
      queryString ? `?${queryString}` : ''
    }`;

    return client.get<GetIssueCoinHoldersResponse>(endpoint);
  },

  // === Trading Methods ===

  /**
   * Get a swap quote for trading tokens
   */
  async getQuote(params: QuoteParams): Promise<Quote> {
    const client = getApiClient();
    const response = await client.post<GetQuoteResponse>('/api/bags/quote', params);
    return response.quote;
  },

  /**
   * Execute a token swap
   * Note: This requires the user to have a connected Solana wallet
   */
  async executeSwap(quote: Quote): Promise<SwapResult> {
    const client = getApiClient();
    const response = await client.post<ExecuteSwapResponse>('/api/bags/swap', {
      quote,
    });
    return response.result;
  },

  // === Utility Methods ===

  /**
   * Check if Issue Coin exists for a vote
   */
  async hasIssueCoin(voteId: string): Promise<boolean> {
    const issueCoin = await this.getIssueCoin(voteId);
    return issueCoin !== null;
  },

  /**
   * Get user's holdings for a specific Issue Coin
   * Returns null if user has no holdings
   */
  async getUserHolding(voteId: string): Promise<IssueCoinHolder | null> {
    const client = getApiClient();
    try {
      const response = await client.get<{ holding: IssueCoinHolder | null }>(
        `/api/votes/${voteId}/issue-coin/my-holding`
      );
      return response.holding;
    } catch (error) {
      // 404 means no holding exists
      return null;
    }
  },
};
