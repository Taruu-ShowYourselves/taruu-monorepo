/**
 * Vote API Contracts
 * Zod schemas for vote endpoints
 */

import { z } from 'zod';

// === Vote Types ===

/**
 * All ten `vote_status` labels the database can hold. Kept identical to the
 * `VoteStatus` union in ../types/vote.ts.
 *
 * 'cancelled' is deliberately absent - it was never a database label, only an
 * API-level alias that `normalizeStatusFilter` still maps to 'ended'.
 *
 * This schema describes what a status *can be*, not what is publicly visible.
 * Public visibility is the narrower `PUBLIC_VOTE_STATUSES` allow-list in
 * apps/web/src/server/domain/votes/vote.ts, which excludes every review state.
 */
export const VoteStatusSchema = z.enum([
  'pending',
  'active',
  'ended',
  'resolving',
  'resolved',
  'failed',
  'draft',
  'in_review',
  'changes_requested',
  'rejected',
]);
export type VoteStatus = z.infer<typeof VoteStatusSchema>;

// === Vote Option ===

export const VoteOptionSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  text: z.string().optional(), // Alias for label
  description: z.string().optional(),
  voteCount: z.number().int().nonnegative(),
  votes: z.number().int().nonnegative().optional(), // Alias for voteCount
});

export const VoteOptionInputSchema = z.object({
  label: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export type VoteOption = z.infer<typeof VoteOptionSchema>;
export type VoteOptionInput = z.infer<typeof VoteOptionInputSchema>;

// === Vote Creator ===

export const VoteCreatorSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  displayName: z.string().optional(),
});

export type VoteCreator = z.infer<typeof VoteCreatorSchema>;

// === Vote Results ===

export const VoteResultsSchema = z.object({
  totalParticipants: z.number().int().nonnegative(),
  optionResults: z.array(z.object({
    optionId: z.string().uuid(),
    count: z.number().int().nonnegative(),
    percentage: z.number().min(0).max(100),
  })),
  winningOptionId: z.string().uuid(),
  completedAt: z.string().datetime(),
});

export type VoteResults = z.infer<typeof VoteResultsSchema>;

// === Vote ===

export const VoteSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string(),
  municipality: z.string(),
  creatorId: z.string().uuid(),
  creator: VoteCreatorSchema.optional(),
  status: VoteStatusSchema,
  options: z.array(VoteOptionSchema),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  participantCount: z.number().int().nonnegative(),
  qubikTxHash: z.string().optional(),
  results: VoteResultsSchema.optional(),
  userVote: z.string().uuid().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Vote = z.infer<typeof VoteSchema>;

// === Participation ===

/**
 * A ballot as it exists in `user_votes`. Participation is free (cfa5d25,
 * 2026-07-29), so there is no payment id; ballots are not chain-anchored, so
 * there is no transaction hash. Residency is verified once at /verification,
 * so there are no per-ballot coordinates. Every field here is backed by a
 * column of `user_votes`.
 */
export const ParticipationSchema = z.object({
  id: z.string().uuid(),
  voteId: z.string().uuid(),
  userId: z.string().uuid(),
  optionId: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export type Participation = z.infer<typeof ParticipationSchema>;

// === POST /api/votes (Create Vote) ===

export const CreateVoteRequestSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(2000),
  municipality: z.string().min(1),
  options: z.array(VoteOptionInputSchema).min(2).max(10),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  // paymentTxId removed: submission is free. The ₪50 creation fee is charged
  // when a space admin approves and the proposal publishes (issue #75).
  //
  // Not `.strict()`, deliberately: a bundle deployed before this change still
  // sends the field, and zod strips unknown keys rather than rejecting the
  // request. That tolerance is for old clients in flight only - every caller in
  // this repository has been updated to stop sending it.
});

export const CreateVoteResponseSchema = z.object({
  vote: VoteSchema,
});

export type CreateVoteRequest = z.infer<typeof CreateVoteRequestSchema>;
export type CreateVoteResponse = z.infer<typeof CreateVoteResponseSchema>;

// === GET /api/votes (List Votes) ===

export const GetVotesQuerySchema = z.object({
  municipality: z.string().optional(),
  status: VoteStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

// Vote summary for list (without full options)
export const VoteSummarySchema = VoteSchema.omit({ options: true }).extend({
  options: z.array(VoteOptionSchema).optional(),
});

export const GetVotesResponseSchema = z.object({
  votes: z.array(VoteSummarySchema),
  total: z.number().int().nonnegative().optional(),
});

export type GetVotesQuery = z.infer<typeof GetVotesQuerySchema>;
export type VoteSummary = z.infer<typeof VoteSummarySchema>;
export type GetVotesResponse = z.infer<typeof GetVotesResponseSchema>;

// === GET /api/votes/[id] (Get Vote Details) ===

export const GetVoteResponseSchema = z.object({
  vote: VoteSchema,
});

export type GetVoteResponse = z.infer<typeof GetVoteResponseSchema>;

// === POST /api/votes/[id]/participate ===

export const ParticipateRequestSchema = z.object({
  optionId: z.string().uuid(),
});

/**
 * `alreadyRecorded` is true when the caller had already voted on this vote and
 * the server returned the EXISTING ballot instead of creating a second one -
 * a double-click, a retry, or a replay. It is a successful outcome, not an
 * error, and the tally was not moved a second time.
 */
export const ParticipateResponseSchema = z.object({
  success: z.literal(true),
  participation: ParticipationSchema,
  alreadyRecorded: z.boolean(),
});

export type ParticipateRequest = z.infer<typeof ParticipateRequestSchema>;
export type ParticipateResponse = z.infer<typeof ParticipateResponseSchema>;

// === POST /api/votes/[id]/verify-location ===

export const VerifyLocationRequestSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive(),
});

export const VerifyLocationResponseSchema = z.object({
  verified: z.boolean(),
  municipality: z.string().optional(),
  distanceFromCenter: z.number().nonnegative().optional(),
  error: z.string().optional(),
});

export type VerifyLocationRequest = z.infer<typeof VerifyLocationRequestSchema>;
export type VerifyLocationResponse = z.infer<typeof VerifyLocationResponseSchema>;

// === GET /api/votes/[id]/participated ===

export const GetParticipatedResponseSchema = z.object({
  participated: z.boolean(),
  participation: z.object({
    optionId: z.string().uuid(),
    createdAt: z.string().datetime(),
  }).optional(),
});

export type GetParticipatedResponse = z.infer<typeof GetParticipatedResponseSchema>;

// === GET /api/votes/[id]/results ===

export const GetVoteResultsResponseSchema = z.object({
  results: VoteResultsSchema,
  vote: z.object({
    id: z.string().uuid(),
    title: z.string(),
    status: VoteStatusSchema,
  }),
});

export type GetVoteResultsResponse = z.infer<typeof GetVoteResultsResponseSchema>;

// === Common Error Responses ===

export const VoteErrorSchema = z.object({
  error: z.string(),
  code: z.enum([
    'UNAUTHORIZED',
    'PAYMENT_REQUIRED',
    'INSUFFICIENT_SCORE',
    'VOTE_NOT_FOUND',
    'VOTE_NOT_ACTIVE',
    'VOTE_ENDED',
    'ALREADY_PARTICIPATED',
    'INVALID_OPTION',
    'OUTSIDE_MUNICIPALITY',
    'LOW_GPS_ACCURACY',
    'BLOCKCHAIN_UNAVAILABLE',
    'RATE_LIMITED',
    'VALIDATION_ERROR',
    'INTERNAL_ERROR',
  ]).optional(),
  details: z.record(z.unknown()).optional(),
});

export type VoteError = z.infer<typeof VoteErrorSchema>;
