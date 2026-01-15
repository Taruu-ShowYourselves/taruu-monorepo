/**
 * Users API Client
 */

import { getApiClient } from './client';
import type {
  UserProfile,
  UserProfileInput,
  UserProfileUpdate,
  SocialProof,
  SocialPlatform,
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
  async getSocialProofs(): Promise<SocialProof[]> {
    const client = getApiClient();
    const response = await client.get<{ socialProofs: SocialProof[] }>(
      '/api/social/proofs'
    );
    return response.socialProofs;
  },

  /**
   * Get OAuth URL for connecting a social account
   * Redirects to /api/social/connect/{platform} which initiates the OAuth flow
   */
  async getSocialConnectUrl(platform: 'facebook' | 'instagram'): Promise<string> {
    // Social connections use OAuth redirect flow via server-side initiation
    // Returns the URL to the initiation endpoint which handles state generation and redirect
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/api/social/connect/${platform}`;
  },

  /**
   * Disconnect a social account
   */
  async disconnectSocialAccount(
    platform: 'facebook' | 'instagram'
  ): Promise<void> {
    const client = getApiClient();
    await client.delete(`/api/social/proofs?platform=${platform}`);
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

  /**
   * Get user's vote statistics (votes participated, votes created)
   */
  async getVoteStats(): Promise<{ votesParticipated: number; votesCreated: number }> {
    const client = getApiClient();
    return client.get('/api/user/stats');
  },
};
