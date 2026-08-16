/**
 * Municipality Profile API Contracts
 * Zod schemas for /api/municipalities/[municipality]
 */

import { z } from 'zod';
import { LocalAuthorityKindSchema } from './authority';

// === Civic metrics ===

export const MunicipalityMetricsSchema = z.object({
  residents: z.number().int().nonnegative(),
  participants: z.number().int().nonnegative(),
  /** Distinct voters / registered residents, 0-1; null when no residents */
  engagementRate: z.number().min(0).max(1).nullable(),
  /** Average hours between a vote opening and a ballot being cast */
  avgTimeToEngageHours: z.number().nonnegative().nullable(),
  /** Average onboarding satisfaction rating, 1-5 */
  satisfactionAvg: z.number().min(1).max(5).nullable(),
  satisfactionCount: z.number().int().nonnegative(),
});

export type MunicipalityMetrics = z.infer<typeof MunicipalityMetricsSchema>;

// === Vote summary (profile view of a vote, with tallies) ===

export const MunicipalityVoteOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  votes: z.number().int().nonnegative(),
  pct: z.number().min(0).max(100),
});

export const MunicipalityVoteSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.string(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  participantCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  options: z.array(MunicipalityVoteOptionSchema),
  totalBallots: z.number().int().nonnegative(),
  winningOption: z.string().nullable(),
});

export type MunicipalityVoteOption = z.infer<typeof MunicipalityVoteOptionSchema>;
export type MunicipalityVoteSummary = z.infer<typeof MunicipalityVoteSummarySchema>;

// === GET /api/municipalities/[municipality] ===

export const MunicipalityProfileResponseSchema = z.object({
  municipality: z.string(),
  metrics: MunicipalityMetricsSchema,
  openVotes: z.array(MunicipalityVoteSummarySchema),
  closedVotes: z.array(MunicipalityVoteSummarySchema),
});

export type MunicipalityProfileResponse = z.infer<
  typeof MunicipalityProfileResponseSchema
>;

// === Civic stats (the desk's municipality dial) ===

/**
 * Every civic score shares one signed scale, so a reader comparing three bars
 * side by side never has to ask which one runs 0..100. See the
 * `municipality_civic_stats()` migration for how each is derived.
 */
export const CIVIC_SCORE_MIN = -100;
export const CIVIC_SCORE_MAX = 100;

/** A signed score as a 0-100 position on its track, for meter widgets. */
export function civicScorePercent(score: number): number {
  const clamped = Math.min(CIVIC_SCORE_MAX, Math.max(CIVIC_SCORE_MIN, score));
  return ((clamped - CIVIC_SCORE_MIN) / (CIVIC_SCORE_MAX - CIVIC_SCORE_MIN)) * 100;
}

const CivicScoreSchema = z
  .number()
  .int()
  .min(CIVIC_SCORE_MIN)
  .max(CIVIC_SCORE_MAX)
  /** null = not measured yet. Never coerce to 0 - that reads as a measured floor. */
  .nullable();

export const MunicipalityCivicStatsSchema = z.object({
  /** Canonical municipality code, which doubles as the Hebrew display name. */
  municipality: z.string(),
  /**
   * What kind of authority this is. Not decoration: a reader's dial is ordered
   * by their own geography - their authority, then the regional council that
   * administers it, then outward by distance - and the middle tier is only
   * findable if the rows say which of them is a `regional_council`.
   */
  kind: LocalAuthorityKindSchema,
  /** Civilian residents (published figure); null when unknown. */
  residents: z.number().int().nonnegative().nullable(),
  /** Residents registered on the platform. */
  platformUsers: z.number().int().nonnegative(),
  /** Registered residents who have cast at least one ballot. */
  activeParticipants: z.number().int().nonnegative(),
  openTopics: z.number().int().nonnegative(),
  engagementScore: CivicScoreSchema,
  cooperationScore: CivicScoreSchema,
  satisfactionScore: CivicScoreSchema,
  overallScore: CivicScoreSchema,
});

export type MunicipalityCivicStats = z.infer<typeof MunicipalityCivicStatsSchema>;
