/**
 * Votes API Client
 */

import { getApiClient } from './client';
import type {
  Vote,
  VoteCreateInput,
  Participation,
  ParticipationInput,
  VoteStatus,
} from '@sync/shared';

export interface GetVotesParams {
  municipality?: string;
  status?: VoteStatus;
}

export interface GetVotesResponse {
  votes: Vote[];
}

export interface GetVoteResponse {
  vote: Vote;
}

export interface CreateVoteResponse {
  vote: Vote;
}

export interface ParticipateResponse {
  success: boolean;
  participation: Participation;
  txHash: string;
  tokensEarned: number;
}

export const votesApi = {
  /**
   * Get list of votes
   */
  async getVotes(params?: GetVotesParams): Promise<Vote[]> {
    const client = getApiClient();
    const searchParams = new URLSearchParams();

    if (params?.municipality) {
      searchParams.set('municipality', params.municipality);
    }
    if (params?.status) {
      searchParams.set('status', params.status);
    }

    const query = searchParams.toString();
    const endpoint = `/api/votes${query ? `?${query}` : ''}`;

    const response = await client.get<GetVotesResponse>(endpoint);
    return response.votes;
  },

  /**
   * Get active votes
   */
  async getActiveVotes(municipality?: string): Promise<Vote[]> {
    return this.getVotes({ municipality, status: 'active' });
  },

  /**
   * Get a single vote by ID
   */
  async getVote(voteId: string): Promise<Vote> {
    const client = getApiClient();
    const response = await client.get<GetVoteResponse>(`/api/votes/${voteId}`);
    return response.vote;
  },

  /**
   * Create a new vote
   */
  async createVote(
    input: VoteCreateInput & { paymentTxId: string }
  ): Promise<Vote> {
    const client = getApiClient();
    const response = await client.post<CreateVoteResponse>('/api/votes', input);
    return response.vote;
  },

  /**
   * Participate in a vote (cast a vote)
   */
  async participate(input: ParticipationInput): Promise<ParticipateResponse> {
    const client = getApiClient();
    return client.post<ParticipateResponse>(
      `/api/votes/${input.voteId}/participate`,
      {
        optionId: input.optionId,
        paymentTxId: input.paymentTxId,
        gpsCoordinates: input.gpsCoordinates,
      }
    );
  },

  /**
   * Get user's participation history
   */
  async getUserParticipations(): Promise<Participation[]> {
    const client = getApiClient();
    const response = await client.get<{ participations: Participation[] }>(
      '/api/user/participations'
    );
    return response.participations;
  },

  /**
   * Check if user has participated in a vote
   */
  async hasParticipated(voteId: string): Promise<boolean> {
    const client = getApiClient();
    const response = await client.get<{ participated: boolean }>(
      `/api/votes/${voteId}/participated`
    );
    return response.participated;
  },

  /**
   * Verify user's location for a specific vote
   */
  async verifyLocation(params: {
    voteId: string;
    latitude: number;
    longitude: number;
  }): Promise<boolean> {
    const client = getApiClient();
    const response = await client.post<{ verified: boolean; municipality?: string }>(
      `/api/votes/${params.voteId}/verify-location`,
      {
        latitude: params.latitude,
        longitude: params.longitude,
      }
    );
    return response.verified;
  },
};
