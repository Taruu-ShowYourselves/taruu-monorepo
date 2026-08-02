/**
 * Vote Types
 */

// GpsCoordinates is defined in user.ts - re-export for convenience
import type { GpsCoordinates } from './user';
export type { GpsCoordinates };

/**
 * Every label the database's `vote_status` enum can hold — the five publication
 * states plus the four review states added for space governance.
 *
 * Note: the database uses 'ended' rather than 'completed'.
 *
 * 'cancelled' is deliberately absent. It never existed as a database label; it
 * was only ever an API-level alias, and `normalizeStatusFilter` in the web app
 * still maps a legacy client's `?status=cancelled` to 'ended'.
 *
 * Holding a status here does NOT make it publicly visible. Public visibility is
 * a separate, narrower allow-list — `PUBLIC_VOTE_STATUSES` in
 * apps/web/src/server/domain/votes/vote.ts — and the four review states are not
 * on it.
 */
export type VoteStatus =
  | 'pending'
  | 'active'
  | 'ended'
  | 'resolving'
  | 'resolved'
  | 'failed'
  | 'draft'
  | 'in_review'
  | 'changes_requested'
  | 'rejected';

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
