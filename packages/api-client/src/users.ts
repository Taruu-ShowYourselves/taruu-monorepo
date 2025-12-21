/**
 * Users API Client
 */

import { getApiClient } from './client';
import type {
  UserProfile,
  UserProfileInput,
  UserProfileUpdate,
  SocialConnection,
  TokenBalance,
  TokenTransaction,
} from '@sync/shared';

export interface GetProfileResponse {
  profile: UserProfile;
}

export interface UpdateProfileResponse {
  profile: UserProfile;
}

export interface TokenBalanceResponse {
  balance: number;
  walletAddress: string;
  transactions: TokenTransaction[];
}

export const usersApi = {
  /**
   * Get current user's profile
   */
  async getProfile(): Promise<UserProfile> {
    const client = getApiClient();
    const response = await client.get<GetProfileResponse>('/api/user/profile');
    return response.profile;
  },

  /**
   * Create user profile (after signup)
   */
  async createProfile(input: UserProfileInput): Promise<UserProfile> {
    const client = getApiClient();
    const response = await client.post<GetProfileResponse>(
      '/api/user/profile',
      input
    );
    return response.profile;
  },

  /**
   * Update user profile
   */
  async updateProfile(updates: UserProfileUpdate): Promise<UserProfile> {
    const client = getApiClient();
    const response = await client.patch<UpdateProfileResponse>(
      '/api/user/profile',
      updates
    );
    return response.profile;
  },

  /**
   * Get user's social connections
   */
  async getSocialConnections(): Promise<SocialConnection[]> {
    const client = getApiClient();
    const response = await client.get<{ connections: SocialConnection[] }>(
      '/api/user/social-connections'
    );
    return response.connections;
  },

  /**
   * Connect a social account
   */
  async connectSocialAccount(
    platform: SocialConnection['platform'],
    accessToken: string
  ): Promise<SocialConnection> {
    const client = getApiClient();
    const response = await client.post<{ connection: SocialConnection }>(
      '/api/user/social-connections',
      { platform, accessToken }
    );
    return response.connection;
  },

  /**
   * Disconnect a social account
   */
  async disconnectSocialAccount(
    platform: SocialConnection['platform']
  ): Promise<void> {
    const client = getApiClient();
    await client.delete(`/api/user/social-connections/${platform}`);
  },

  /**
   * Get user's token balance
   */
  async getTokenBalance(): Promise<TokenBalance> {
    const client = getApiClient();
    const response = await client.get<TokenBalanceResponse>('/api/user/tokens');
    return {
      balance: response.balance,
      walletAddress: response.walletAddress,
      lastUpdated: new Date(),
    };
  },

  /**
   * Get user's token transaction history
   */
  async getTokenTransactions(): Promise<TokenTransaction[]> {
    const client = getApiClient();
    const response = await client.get<{ transactions: TokenTransaction[] }>(
      '/api/user/tokens/transactions'
    );
    return response.transactions;
  },

  /**
   * Get user's voting history
   */
  async getVotingHistory(): Promise<{ voteId: string; optionId: string; createdAt: Date }[]> {
    const client = getApiClient();
    const response = await client.get<{ history: { voteId: string; optionId: string; createdAt: string }[] }>(
      '/api/user/votes'
    );
    return response.history.map((h) => ({
      ...h,
      createdAt: new Date(h.createdAt),
    }));
  },

  /**
   * Verify user's location for their municipality
   */
  async verifyLocation(params: {
    latitude: number;
    longitude: number;
  }): Promise<{ verified: boolean; municipality?: string }> {
    const client = getApiClient();
    return client.post('/api/user/verify-location', params);
  },
};
