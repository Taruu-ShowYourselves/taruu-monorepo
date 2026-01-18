/**
 * Bags.fm API Contracts
 * Zod schemas for Bags.fm integration endpoints
 */

import { z } from 'zod';

// === Token Types ===

export const TokenMetadataSchema = z.object({
  name: z.string().min(1).max(100),
  symbol: z.string().min(1).max(10),
  description: z.string().max(2000),
  image: z.string().url(),
  municipality: z.string().min(1),
  voteId: z.string().uuid(),
});

export const TokenInfoSchema = z.object({
  mint: z.string().min(32).max(64), // Solana address
  name: z.string(),
  symbol: z.string(),
  decimals: z.number().int().min(0).max(18),
  totalSupply: z.string(), // Large number as string
  createdAt: z.string().datetime(),
});

export const IssueCoinSchema = z.object({
  id: z.string().uuid(),
  voteId: z.string().uuid(),
  tokenMint: z.string(),
  tokenName: z.string(),
  tokenSymbol: z.string(),
  municipalityId: z.string(),
  totalPurchased: z.string(),
  totalValueILS: z.number().nonnegative(),
  tradingEnabled: z.boolean(),
  frozen: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const IssueCoinHolderSchema = z.object({
  id: z.string().uuid(),
  issueCoinId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  walletAddress: z.string().optional(),
  tokenAmount: z.string(),
  investedILS: z.number().nonnegative(),
  isLocalResident: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TokenMetadata = z.infer<typeof TokenMetadataSchema>;
export type TokenInfo = z.infer<typeof TokenInfoSchema>;
export type IssueCoin = z.infer<typeof IssueCoinSchema>;
export type IssueCoinHolder = z.infer<typeof IssueCoinHolderSchema>;

// === Trading Types ===

export const QuoteParamsSchema = z.object({
  inputMint: z.string().min(32),
  outputMint: z.string().min(32),
  amount: z.string(),
  slippageBps: z.number().int().min(0).max(10000).optional(),
});

export const QuoteSchema = z.object({
  inputAmount: z.string(),
  outputAmount: z.string(),
  priceImpact: z.number(),
  fee: z.string(),
  route: z.array(z.string()),
});

export const SwapParamsSchema = z.object({
  quote: QuoteSchema,
  userWallet: z.string().min(32),
});

export const SwapResultSchema = z.object({
  txSignature: z.string(),
  inputAmount: z.string(),
  outputAmount: z.string(),
  fee: z.string(),
});

export type QuoteParams = z.infer<typeof QuoteParamsSchema>;
export type Quote = z.infer<typeof QuoteSchema>;
export type SwapParams = z.infer<typeof SwapParamsSchema>;
export type SwapResult = z.infer<typeof SwapResultSchema>;

// === Fee Sharing Types ===

export const FeeEarnerProviderSchema = z.enum(['twitter', 'kick', 'github']);

export const FeeEarnerSchema = z.object({
  provider: FeeEarnerProviderSchema,
  providerId: z.string().min(1),
  sharePercentage: z.number().min(0).max(100),
});

export const FeeShareConfigSchema = z.object({
  tokenMint: z.string().min(32),
  feeEarners: z.array(FeeEarnerSchema).max(100), // Bags.fm limit
});

export const ClaimablePositionSchema = z.object({
  tokenMint: z.string(),
  tokenName: z.string(),
  unclaimedFees: z.string(),
  lastClaimed: z.string().datetime().optional(),
});

export const LifetimeFeesSchema = z.object({
  totalFees: z.string(),
  claimedFees: z.string(),
  unclaimedFees: z.string(),
});

export type FeeEarnerProvider = z.infer<typeof FeeEarnerProviderSchema>;
export type FeeEarner = z.infer<typeof FeeEarnerSchema>;
export type FeeShareConfig = z.infer<typeof FeeShareConfigSchema>;
export type ClaimablePosition = z.infer<typeof ClaimablePositionSchema>;
export type LifetimeFees = z.infer<typeof LifetimeFeesSchema>;

// === Treasury Types ===

export const TreasuryTransactionTypeSchema = z.enum([
  'deposit',
  'allocation',
  'withdrawal',
  'fee_claim',
  'token_purchase',
  'nft_mint',
]);

export const TreasuryBalanceSchema = z.object({
  municipalityId: z.string(),
  totalILS: z.number().nonnegative(),
  totalSOL: z.number().nonnegative(),
  allocatedToVotes: z.number().nonnegative(),
  availableForWithdrawal: z.number().nonnegative(),
  lastUpdated: z.string().datetime(),
});

export const TreasuryTransactionSchema = z.object({
  id: z.string().uuid(),
  treasuryId: z.string().uuid(),
  type: TreasuryTransactionTypeSchema,
  voteId: z.string().uuid().optional(),
  amountILS: z.number(),
  amountSOL: z.number().optional(),
  description: z.string(),
  bagsTxHash: z.string().optional(),
  paymentId: z.string().optional(),
  createdAt: z.string().datetime(),
});

export const TreasurySchema = z.object({
  id: z.string().uuid(),
  municipalityId: z.string(),
  walletAddress: z.string(),
  balanceILS: z.number().nonnegative(),
  balanceSOL: z.number().nonnegative(),
  totalCollectedILS: z.number().nonnegative(),
  totalWithdrawnILS: z.number().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TreasuryTransactionType = z.infer<typeof TreasuryTransactionTypeSchema>;
export type TreasuryBalance = z.infer<typeof TreasuryBalanceSchema>;
export type TreasuryTransaction = z.infer<typeof TreasuryTransactionSchema>;
export type Treasury = z.infer<typeof TreasurySchema>;

// === API Request/Response Schemas ===

// POST /api/bags/quote
export const GetQuoteRequestSchema = QuoteParamsSchema;
export const GetQuoteResponseSchema = z.object({
  success: z.literal(true),
  quote: QuoteSchema,
});

// POST /api/bags/swap
export const ExecuteSwapRequestSchema = z.object({
  quote: QuoteSchema,
});
export const ExecuteSwapResponseSchema = z.object({
  success: z.literal(true),
  result: SwapResultSchema,
});

// GET /api/treasury/[municipality]
export const GetTreasuryResponseSchema = z.object({
  treasury: TreasuryBalanceSchema,
});

// GET /api/treasury/[municipality]/transactions
export const GetTreasuryTransactionsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
  type: TreasuryTransactionTypeSchema.optional(),
});

export const GetTreasuryTransactionsResponseSchema = z.object({
  transactions: z.array(TreasuryTransactionSchema),
  total: z.number().int().nonnegative(),
});

// GET /api/votes/[id]/issue-coin
export const GetIssueCoinResponseSchema = z.object({
  issueCoin: IssueCoinSchema.nullable(),
});

// GET /api/votes/[id]/issue-coin/holders
export const GetIssueCoinHoldersResponseSchema = z.object({
  holders: z.array(IssueCoinHolderSchema),
  total: z.number().int().nonnegative(),
});

// === Error Schemas ===

export const BagsApiErrorSchema = z.object({
  error: z.string(),
  code: z.enum([
    'UNAUTHORIZED',
    'INVALID_TOKEN',
    'INSUFFICIENT_BALANCE',
    'SWAP_FAILED',
    'QUOTE_EXPIRED',
    'RATE_LIMITED',
    'TOKEN_FROZEN',
    'VALIDATION_ERROR',
    'SERVICE_UNAVAILABLE',
    'INTERNAL_ERROR',
  ]).optional(),
  details: z.record(z.unknown()).optional(),
});

export type BagsApiError = z.infer<typeof BagsApiErrorSchema>;

// === Economics Page Schemas ===

export const TrendingCoinSchema = z.object({
  voteId: z.string().uuid(),
  voteTitle: z.string().min(1),
  municipality: z.string(),
  priceChange24h: z.number(), // Can be negative
  volume24h: z.number().nonnegative(),
  totalRaised: z.number().nonnegative(),
  tokenMint: z.string().optional(),
  imageUrl: z.string().url().optional().nullable(),
  createdAt: z.string().datetime().optional(),
});

export const NetworkStatsSchema = z.object({
  totalRaised: z.number().nonnegative(),
  activeVotes: z.number().int().nonnegative(),
  totalVoters: z.number().int().nonnegative(),
  municipalities: z.number().int().nonnegative(),
  weeklyGrowth: z.number(), // Can be negative
  updatedAt: z.string().datetime().optional(),
});

// GET /api/bags/trending
export const GetTrendingCoinsResponseSchema = z.object({
  coins: z.array(TrendingCoinSchema),
  updatedAt: z.string().datetime().optional(),
});

// GET /api/stats/network
export const GetNetworkStatsResponseSchema = z.object({
  stats: NetworkStatsSchema,
});

export type TrendingCoin = z.infer<typeof TrendingCoinSchema>;
export type NetworkStats = z.infer<typeof NetworkStatsSchema>;
export type GetTrendingCoinsResponse = z.infer<typeof GetTrendingCoinsResponseSchema>;
export type GetNetworkStatsResponse = z.infer<typeof GetNetworkStatsResponseSchema>;
