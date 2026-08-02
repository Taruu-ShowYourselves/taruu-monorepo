/**
 * Vote Types
 */

// GpsCoordinates is defined in user.ts - re-export for convenience
import type { GpsCoordinates } from './user';
export type { GpsCoordinates };

// Note: Database uses 'ended' instead of 'completed'
export type VoteStatus = 'pending' | 'active' | 'ended' | 'cancelled';

export interface VoteOption {
  id: string;
  label: string;
  text?: string; // Alias for label (used in some UI components)
  description?: string;
  voteCount: number;
  votes?: number; // Alias for voteCount (used in some UI components)
}

export interface VoteResults {
  totalParticipants: number;
  optionResults: {
    optionId: string;
    count: number;
    percentage: number;
  }[];
  winningOptionId: string;
  completedAt: Date;
}

export interface VoteCreator {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
}

export interface Vote {
  id: string;
  title: string;
  description: string;
  municipality: string;
  creatorId: string;
  creator?: VoteCreator; // Expanded creator info (optional)
  status: VoteStatus;
  options: VoteOption[];
  startDate: Date;
  endDate: Date;
  participantCount: number;
  qubikTxHash?: string;
  results?: VoteResults;
  userVote?: string; // Option ID if current user has voted
  createdAt: Date;
  updatedAt: Date;
}

export interface VoteCreateInput {
  title: string;
  description: string;
  municipality: string;
  options: { label: string; description?: string }[];
  startDate: Date;
  endDate: Date;
}

export interface Participation {
  id: string;
  voteId: string;
  userId: string;
  optionId: string;
  createdAt: Date;
}

export interface ParticipationInput {
  voteId: string;
  optionId: string;
}
