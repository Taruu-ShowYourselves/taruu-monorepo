/**
 * Converge Database Service
 *
 * Secondary database for storing application data:
 * - User profiles
 * - Vote metadata
 * - Participation records
 * - Analytics data
 */

interface ConvergeConfig {
  apiKey: string;
  projectId: string;
  baseUrl: string;
}

// User types
interface UserProfile {
  id: string;
  clerkId: string;
  qubikWalletAddress: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  municipality: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  socialConnections: SocialConnection[];
  syncTokenBalance: number;
  createdAt: Date;
  updatedAt: Date;
}

interface SocialConnection {
  platform: 'facebook' | 'twitter' | 'instagram' | 'linkedin';
  platformId: string;
  connected: boolean;
  verifiedAt?: Date;
}

// Vote types
interface Vote {
  id: string;
  title: string;
  description: string;
  municipality: string;
  creatorId: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  options: VoteOption[];
  startDate: Date;
  endDate: Date;
  participantCount: number;
  qubikTxHash?: string;
  results?: VoteResults;
  createdAt: Date;
  updatedAt: Date;
}

interface VoteOption {
  id: string;
  label: string;
  description?: string;
  voteCount: number;
}

interface VoteResults {
  totalParticipants: number;
  optionResults: {
    optionId: string;
    count: number;
    percentage: number;
  }[];
  winningOptionId: string;
  completedAt: Date;
}

// Participation types
interface Participation {
  id: string;
  voteId: string;
  oderId: string;
  optionId: string;
  paymentTxId: string;
  qubikTxHash: string;
  gpsCoordinates: {
    latitude: number;
    longitude: number;
    timestamp: Date;
  };
  createdAt: Date;
}

class ConvergeService {
  private config: ConvergeConfig;

  constructor() {
    this.config = {
      apiKey: process.env.CONVERGE_API_KEY || '',
      projectId: process.env.CONVERGE_PROJECT_ID || '',
      baseUrl: 'https://api.converge.io/v1',
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(
      `${this.config.baseUrl}/projects/${this.config.projectId}${endpoint}`,
      {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
          ...options.headers,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message);
    }

    return response.json();
  }

  // ============================================
  // USER OPERATIONS
  // ============================================

  async createUser(userData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserProfile> {
    return this.request<UserProfile>('/collections/users/documents', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async getUserByClerkId(clerkId: string): Promise<UserProfile | null> {
    try {
      const result = await this.request<{ documents: UserProfile[] }>(
        `/collections/users/documents?filter=clerkId:${clerkId}`
      );
      return result.documents[0] || null;
    } catch {
      return null;
    }
  }

  async updateUser(id: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    return this.request<UserProfile>(`/collections/users/documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...updates,
        updatedAt: new Date().toISOString(),
      }),
    });
  }

  async updateSocialConnections(
    oderId: string,
    connections: SocialConnection[]
  ): Promise<UserProfile> {
    const user = await this.getUserByClerkId(oderId);
    if (!user) throw new Error('User not found');

    return this.updateUser(user.id, { socialConnections: connections });
  }

  // ============================================
  // VOTE OPERATIONS
  // ============================================

  async createVote(voteData: Omit<Vote, 'id' | 'createdAt' | 'updatedAt' | 'participantCount'>): Promise<Vote> {
    return this.request<Vote>('/collections/votes/documents', {
      method: 'POST',
      body: JSON.stringify({
        ...voteData,
        participantCount: 0,
      }),
    });
  }

  async getVote(voteId: string): Promise<Vote | null> {
    try {
      return await this.request<Vote>(`/collections/votes/documents/${voteId}`);
    } catch {
      return null;
    }
  }

  async getVotesByMunicipality(
    municipality: string,
    status?: Vote['status']
  ): Promise<Vote[]> {
    let filter = `municipality:${municipality}`;
    if (status) {
      filter += `,status:${status}`;
    }

    const result = await this.request<{ documents: Vote[] }>(
      `/collections/votes/documents?filter=${filter}&orderBy=createdAt:desc`
    );
    return result.documents;
  }

  async getActiveVotes(municipality?: string): Promise<Vote[]> {
    let filter = 'status:active';
    if (municipality) {
      filter += `,municipality:${municipality}`;
    }

    const result = await this.request<{ documents: Vote[] }>(
      `/collections/votes/documents?filter=${filter}&orderBy=endDate:asc`
    );
    return result.documents;
  }

  async updateVote(voteId: string, updates: Partial<Vote>): Promise<Vote> {
    return this.request<Vote>(`/collections/votes/documents/${voteId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...updates,
        updatedAt: new Date().toISOString(),
      }),
    });
  }

  async incrementVoteCount(voteId: string, optionId: string): Promise<Vote> {
    const vote = await this.getVote(voteId);
    if (!vote) throw new Error('Vote not found');

    const updatedOptions = vote.options.map((option) =>
      option.id === optionId
        ? { ...option, voteCount: option.voteCount + 1 }
        : option
    );

    return this.updateVote(voteId, {
      options: updatedOptions,
      participantCount: vote.participantCount + 1,
    });
  }

  // ============================================
  // PARTICIPATION OPERATIONS
  // ============================================

  async createParticipation(data: Omit<Participation, 'id' | 'createdAt'>): Promise<Participation> {
    return this.request<Participation>('/collections/participations/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getUserParticipations(oderId: string): Promise<Participation[]> {
    const result = await this.request<{ documents: Participation[] }>(
      `/collections/participations/documents?filter=oderId:${oderId}&orderBy=createdAt:desc`
    );
    return result.documents;
  }

  async hasUserParticipated(voteId: string, oderId: string): Promise<boolean> {
    const result = await this.request<{ documents: Participation[] }>(
      `/collections/participations/documents?filter=voteId:${voteId},oderId:${oderId}`
    );
    return result.documents.length > 0;
  }

  async getVoteParticipations(voteId: string): Promise<Participation[]> {
    const result = await this.request<{ documents: Participation[] }>(
      `/collections/participations/documents?filter=voteId:${voteId}`
    );
    return result.documents;
  }
}

export const convergeService = new ConvergeService();
export type { UserProfile, SocialConnection, Vote, VoteOption, VoteResults, Participation };
