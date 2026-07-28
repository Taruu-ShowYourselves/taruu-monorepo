/**
 * Dashboard API Contracts
 * Zod schemas for GET /api/dashboard — the single aggregate the dashboard
 * renders from (replaces six independent client fetches).
 */

import { z } from 'zod';
import { MunicipalityMetricsSchema } from './municipality';

export const DashboardStatsSchema = z.object({
  totalVotes: z.number().int().nonnegative(),
  activeVotes: z.number().int().nonnegative(),
  votesCreated: z.number().int().nonnegative(),
});

export const DashboardRecentVoteSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['active', 'ended']),
  votedAt: z.string(),
  option: z.string(),
});

export const DashboardTokenTxnSchema = z.object({
  id: z.string(),
  amount: z.number(),
  reason: z.enum(['vote_participation', 'vote_creation']),
  txHash: z.string(),
  timestamp: z.string(),
});

export const DashboardContributionSchema = z.object({
  id: z.string(),
  amountILS: z.number(),
  voteId: z.string().nullable(),
  date: z.string(),
});

/**
 * Certificates keep the exact shape of GET /api/user/nfts records — the
 * CertificateCard component owns that contract; here they pass through.
 */
export const DashboardCertificateSchema = z.record(z.unknown());

export const DashboardActiveVoteSchema = z.object({
  id: z.string(),
  title: z.string(),
});

export const DashboardResponseSchema = z.object({
  stats: DashboardStatsSchema,
  recentVotes: z.array(DashboardRecentVoteSchema),
  tokenTransactions: z.array(DashboardTokenTxnSchema),
  contributions: z.array(DashboardContributionSchema),
  certificates: z.array(DashboardCertificateSchema),
  activeInCity: z.array(DashboardActiveVoteSchema),
  cityMetrics: MunicipalityMetricsSchema.nullable(),
});

export type DashboardStats = z.infer<typeof DashboardStatsSchema>;
export type DashboardRecentVote = z.infer<typeof DashboardRecentVoteSchema>;
export type DashboardTokenTxn = z.infer<typeof DashboardTokenTxnSchema>;
export type DashboardContribution = z.infer<typeof DashboardContributionSchema>;
export type DashboardActiveVote = z.infer<typeof DashboardActiveVoteSchema>;
export type DashboardResponse = z.infer<typeof DashboardResponseSchema>;
