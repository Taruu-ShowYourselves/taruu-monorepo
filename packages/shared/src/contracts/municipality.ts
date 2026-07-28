/**
 * Municipality Profile API Contracts
 * Zod schemas for /api/municipalities/[municipality]
 */

import { z } from 'zod';

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
