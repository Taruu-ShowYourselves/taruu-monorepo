/**
 * Vote Types
 */

export type VoteStatus = 'pending' | 'active' | 'completed' | 'cancelled';

export interface VoteOption {
  id: string;
  label: string;
  description?: string;
  voteCount: number;
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

export interface Vote {
  id: string;
  title: string;
  description: string;
  municipality: string;
  creatorId: string;
  status: VoteStatus;
  options: VoteOption[];
  startDate: Date;
  endDate: Date;
  participantCount: number;
  qubikTxHash?: string;
  results?: VoteResults;
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

export interface GpsCoordinates {
  latitude: number;
  longitude: number;
  timestamp: Date;
  accuracy?: number;
}

export interface Participation {
  id: string;
  voteId: string;
  userId: string;
  optionId: string;
  paymentTxId: string;
  qubikTxHash: string;
  gpsCoordinates: GpsCoordinates;
  createdAt: Date;
}

export interface ParticipationInput {
  voteId: string;
  optionId: string;
  paymentTxId: string;
  gpsCoordinates: GpsCoordinates;
}
