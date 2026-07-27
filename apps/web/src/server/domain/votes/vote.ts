/**
 * Votes domain — pure functions only. No IO, no framework.
 *
 * The single source of truth for the DB-row → API-DTO mapping that was
 * previously hand-duplicated across route handlers.
 */

import type { Vote, VoteOption } from '@/lib/supabase/types';

export interface VoteDto {
  id: string;
  title: string;
  description: string;
  municipality: string;
  creatorId: string;
  status: string;
  startDate: string;
  endDate: string;
  participantCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface VoteOptionDto {
  id: string;
  label: string;
  description?: string;
  voteCount: number;
}

export function toVoteDto(row: Vote): VoteDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    municipality: row.municipality_id,
    creatorId: row.creator_id,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    participantCount: row.participant_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toVoteOptionDto(
  row: VoteOption,
  inputDescription?: string
): VoteOptionDto {
  return {
    id: row.id,
    label: row.text,
    description: inputDescription,
    voteCount: row.votes ?? 0,
  };
}

/** A vote whose start date has arrived opens immediately. */
export function initialStatus(startDate: Date, now: Date): 'active' | 'pending' {
  return startDate <= now ? 'active' : 'pending';
}

/** Client compatibility: the API once accepted 'cancelled'; DB knows 'ended'. */
export function normalizeStatusFilter(
  status: string | null
): 'pending' | 'active' | 'ended' | null {
  if (status === 'cancelled') return 'ended';
  if (status === 'pending' || status === 'active' || status === 'ended') return status;
  return null;
}
