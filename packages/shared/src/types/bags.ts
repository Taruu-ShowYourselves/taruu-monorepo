/**
 * Bags.fm SocialFi Integration Types
 *
 * Types for the Bags.fm API integration enabling Issue Coins,
 * treasury management, and SocialFi economics.
 *
 * @see https://docs.bags.fm/
 */

// === Token Types ===

/**
 * Token metadata for creating an Issue Coin
 */
export interface TokenMetadata {
  /** Vote title - becomes token name */
  name: string;
  /** Auto-generated symbol (e.g., "TARU-001") */
  symbol: string;
  /** Vote description */
  description: string;
  /** Vote thumbnail URL */
  image: string;
  /** Municipality name */
  municipality: string;
  /** Internal vote ID */
  voteId: string;
}

/**
 * Created token information from Bags.fm
 */
export interface TokenInfo {
  /** Solana mint address */
  mint: string;
  /** Token name */
  name: string;
  /** Token symbol */
  symbol: string;
  /** Token decimals (typically 9 for Solana) */
  decimals: number;
  /** Total supply as string (to handle large numbers) */
  totalSupply: string;
  /** Creation timestamp */
  createdAt: Date;
}

/**
 * Issue Coin - a vote's associated Bags.fm token
 */
export interface IssueCoin {
  id: string;
  voteId: string;
  tokenMint: string;
  tokenName: string;
  tokenSymbol: string;
  municipalityId: string;
  /** Total tokens purchased by all holders */
  totalPurchased: string;
  /** Total ILS value invested */
  totalValueILS: number;
  /** Whether trading is currently enabled */
  tradingEnabled: boolean;
  /** Whether token has been frozen (vote ended) */
  frozen: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Holder of an Issue Coin
 */
export interface IssueCoinHolder {
  id: string;
  issueCoinId: string;
  /** User ID if internal user, null for external wallet */
  userId?: string;
  /** External Solana wallet address */
  walletAddress?: string;
  /** Amount of tokens held */
  tokenAmount: string;
  /** Total ILS value invested */
  investedILS: number;
  /** Whether holder is a verified local resident */
  isLocalResident: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// === Trading Types ===

/**
 * Parameters for getting a swap quote
 */
export interface QuoteParams {
  /** Input token mint address */
  inputMint: string;
  /** Output token mint address */
  outputMint: string;
  /** Amount to swap (as string for precision) */
  amount: string;
  /** Slippage tolerance in basis points (default 50 = 0.5%) */
  slippageBps?: number;
}

/**
 * Swap quote response from Bags.fm
 */
export interface Quote {
  /** Input amount */
  inputAmount: string;
  /** Expected output amount */
  outputAmount: string;
  /** Price impact percentage */
  priceImpact: number;
  /** Fee amount */
  fee: string;
  /** Swap route (token addresses) */
  route: string[];
}

/**
 * Parameters for executing a swap
 */
export interface SwapParams {
  /** Quote to execute */
  quote: Quote;
  /** User's wallet address */
  userWallet: string;
}

/**
 * Swap execution result
 */
export interface SwapResult {
  /** Transaction signature */
  txSignature: string;
  /** Actual input amount */
  inputAmount: string;
  /** Actual output amount */
  outputAmount: string;
  /** Fee paid */
  fee: string;
}

// === Fee Sharing Types ===

/**
 * Social provider for fee sharing
 * Note: Bags.fm requires one of these for fee earners
 */
export type FeeEarnerProvider = 'twitter' | 'kick' | 'github';

/**
 * Fee earner configuration
 */
export interface FeeEarner {
  /** Social provider type */
  provider: FeeEarnerProvider;
  /** Provider account ID */
  providerId: string;
  /** Percentage share (0-100) */
  sharePercentage: number;
}

/**
 * Fee sharing configuration for a token
 */
export interface FeeShareConfig {
  /** Token mint address */
  tokenMint: string;
  /** List of fee earners (max 100 per Bags.fm API) */
  feeEarners: FeeEarner[];
}

/**
 * Position with claimable fees
 */
export interface ClaimablePosition {
  /** Token mint address */
  tokenMint: string;
  /** Token name */
  tokenName: string;
  /** Unclaimed fees in SOL */
  unclaimedFees: string;
  /** Last claim timestamp */
  lastClaimed?: Date;
}

/**
 * Lifetime fee statistics for a token
 */
export interface LifetimeFees {
  /** Total fees earned all time */
  totalFees: string;
  /** Total fees claimed */
  claimedFees: string;
  /** Unclaimed fees */
  unclaimedFees: string;
}

// === Treasury Types ===

/**
 * Treasury balance for a municipality
 */
export interface TreasuryBalance {
  /** Municipality ID */
  municipalityId: string;
  /** Israeli Shekel balance */
  totalILS: number;
  /** Bags.fm SOL balance */
  totalSOL: number;
  /** Amount allocated to active votes */
  allocatedToVotes: number;
  /** Amount available for withdrawal */
  availableForWithdrawal: number;
  /** Last balance update */
  lastUpdated: Date;
}

/**
 * Treasury transaction types
 */
export type TreasuryTransactionType =
  | 'deposit' // ILS payment received
  | 'allocation' // Allocated to a vote
  | 'withdrawal' // Withdrawn to bank
  | 'fee_claim' // Claimed Bags.fm fees
  | 'token_purchase' // External supporter token purchase
  | 'nft_mint'; // NFT minting cost

/**
 * Treasury transaction record
 */
export interface TreasuryTransaction {
  id: string;
  treasuryId: string;
  type: TreasuryTransactionType;
  /** Associated vote ID (if applicable) */
  voteId?: string;
  /** ILS amount */
  amountILS: number;
  /** SOL amount (if applicable) */
  amountSOL?: number;
  /** Transaction description */
  description: string;
  /** Bags.fm transaction hash (if applicable) */
  bagsTxHash?: string;
  /** Green Invoice payment ID (if applicable) */
  paymentId?: string;
  createdAt: Date;
}

/**
 * Treasury state for database record
 */
export interface Treasury {
  id: string;
  municipalityId: string;
  /** Master Solana wallet address */
  walletAddress: string;
  /** Current ILS balance */
  balanceILS: number;
  /** Current SOL balance */
  balanceSOL: number;
  /** Total ILS collected all time */
  totalCollectedILS: number;
  /** Total ILS withdrawn all time */
  totalWithdrawnILS: number;
  createdAt: Date;
  updatedAt: Date;
}

// === API Response Types ===

/**
 * Bags.fm API error response
 */
export interface BagsApiError {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Token launch transaction response
 */
export interface LaunchTransactionResponse {
  /** Signed transaction to submit */
  signedTransaction: string;
  /** Token mint address */
  tokenMint: string;
}

/**
 * Claim transaction response
 */
export interface ClaimTransactionResponse {
  /** Signed transaction to submit */
  signedTransaction: string;
  /** Positions being claimed */
  positions: string[];
}

// === Economics Page Types ===

/**
 * Trending Issue Coin for economics dashboard
 */
export interface TrendingCoin {
  /** Vote ID */
  voteId: string;
  /** Vote title */
  voteTitle: string;
  /** Municipality ID */
  municipality: string;
  /** Price change in last 24h (decimal: 0.23 = 23%) */
  priceChange24h: number;
  /** Trading volume in last 24h */
  volume24h: number;
  /** Total ILS raised */
  totalRaised: number;
  /** Solana mint address */
  tokenMint?: string;
  /** Vote thumbnail URL */
  imageUrl?: string;
  /** Creation timestamp */
  createdAt?: Date;
}

/**
 * Network-wide statistics
 */
export interface NetworkStats {
  /** Total ILS raised across all votes */
  totalRaised: number;
  /** Count of active votes */
  activeVotes: number;
  /** Unique voters count */
  totalVoters: number;
  /** Count of municipalities with activity */
  municipalities: number;
  /** Weekly growth rate (decimal: 0.18 = 18%) */
  weeklyGrowth: number;
  /** Last update timestamp */
  updatedAt?: Date;
}

/**
 * GET /api/bags/trending response
 */
export interface GetTrendingCoinsResponse {
  coins: TrendingCoin[];
  updatedAt?: Date;
}

/**
 * GET /api/stats/network response
 */
export interface GetNetworkStatsResponse {
  stats: NetworkStats;
}
