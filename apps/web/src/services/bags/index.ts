/**
 * Bags.fm SocialFi Service
 *
 * Handles all interactions with the Bags.fm API for:
 * - Token (Issue Coin) creation and launch
 * - Fee sharing configuration
 * - Trading (quotes and swaps)
 * - Fee claiming
 *
 * @see https://docs.bags.fm/
 */

import type {
  TokenMetadata,
  TokenInfo,
  QuoteParams,
  Quote,
  SwapParams,
  SwapResult,
  FeeShareConfig,
  ClaimablePosition,
  LifetimeFees,
  BagsApiError,
  LaunchTransactionResponse,
  ClaimTransactionResponse,
} from '@sync/shared';
import { logger } from '@/lib/logger';

// === Configuration ===

interface BagsConfig {
  apiKey: string;
  baseUrl: string;
  masterWalletAddress: string;
  webhookSecret?: string;
}

const config: BagsConfig = {
  apiKey: process.env.BAGS_API_KEY || '',
  baseUrl: 'https://public-api-v2.bags.fm/api/v1',
  masterWalletAddress: process.env.BAGS_MASTER_WALLET_ADDRESS || '',
  webhookSecret: process.env.BAGS_WEBHOOK_SECRET,
};

// === Helper Functions ===

/**
 * Make authenticated request to Bags.fm API
 */
async function bagsRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${config.baseUrl}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'x-api-key': config.apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    logger.error('Bags.fm API error', {
      endpoint,
      status: response.status,
      error,
    });
    throw new BagsServiceError(
      error.error || `API request failed with status ${response.status}`,
      error.code || 'API_ERROR',
      response.status
    );
  }

  return response.json();
}

// === Error Class ===

export class BagsServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'BagsServiceError';
  }
}

// === Service Methods ===

/**
 * Check if Bags.fm service is configured
 */
export function isConfigured(): boolean {
  return Boolean(config.apiKey && config.masterWalletAddress);
}

/**
 * Create token metadata for an Issue Coin
 * This is the first step in launching a new token
 */
export async function createTokenInfo(metadata: TokenMetadata): Promise<TokenInfo> {
  logger.info('Creating token info', { voteId: metadata.voteId, symbol: metadata.symbol });

  const response = await bagsRequest<{
    mint: string;
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
  }>('/token-launch/create-token-info', {
    method: 'POST',
    body: JSON.stringify({
      name: metadata.name,
      symbol: metadata.symbol,
      description: metadata.description,
      image: metadata.image,
      externalUrl: `https://taruu.co.il/votes/${metadata.voteId}`,
      attributes: [
        { trait_type: 'Municipality', value: metadata.municipality },
        { trait_type: 'Vote ID', value: metadata.voteId },
      ],
    }),
  });

  return {
    mint: response.mint,
    name: response.name,
    symbol: response.symbol,
    decimals: response.decimals,
    totalSupply: response.totalSupply,
    createdAt: new Date(),
  };
}

/**
 * Configure fee sharing for a token (REQUIRED before launch)
 * As of Jan 2025, this is mandatory for all token launches
 */
export async function configureFeeShare(config: FeeShareConfig): Promise<void> {
  logger.info('Configuring fee share', {
    tokenMint: config.tokenMint,
    earnerCount: config.feeEarners.length,
  });

  await bagsRequest('/token-launch/fee-share/create-config', {
    method: 'POST',
    body: JSON.stringify({
      tokenMint: config.tokenMint,
      feeEarners: config.feeEarners.map((earner) => ({
        provider: earner.provider,
        providerId: earner.providerId,
        sharePercentage: earner.sharePercentage,
      })),
    }),
  });
}

/**
 * Create signed transaction to launch a token
 * Requires fee sharing to be configured first
 */
export async function createLaunchTransaction(
  tokenMint: string,
  creatorWallet?: string
): Promise<LaunchTransactionResponse> {
  const wallet = creatorWallet || config.masterWalletAddress;

  logger.info('Creating launch transaction', { tokenMint, wallet });

  const response = await bagsRequest<LaunchTransactionResponse>(
    '/token-launch/create-launch-transaction',
    {
      method: 'POST',
      body: JSON.stringify({
        tokenMint,
        creatorWallet: wallet,
      }),
    }
  );

  return response;
}

/**
 * Get a swap quote for trading tokens
 */
export async function getQuote(params: QuoteParams): Promise<Quote> {
  const searchParams = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount,
    slippageBps: String(params.slippageBps || 50),
  });

  logger.debug('Getting quote', {
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount,
    slippageBps: params.slippageBps,
  });

  return bagsRequest<Quote>(`/trade/quote?${searchParams}`);
}

/**
 * Execute a token swap
 */
export async function executeSwap(params: SwapParams): Promise<SwapResult> {
  logger.info('Executing swap', {
    inputAmount: params.quote.inputAmount,
    outputAmount: params.quote.outputAmount,
    wallet: params.userWallet,
  });

  const response = await bagsRequest<{
    txSignature: string;
    inputAmount: string;
    outputAmount: string;
    fee: string;
  }>('/trade/swap', {
    method: 'POST',
    body: JSON.stringify({
      quote: params.quote,
      userWallet: params.userWallet,
    }),
  });

  return {
    txSignature: response.txSignature,
    inputAmount: response.inputAmount,
    outputAmount: response.outputAmount,
    fee: response.fee,
  };
}

/**
 * Get positions with claimable fees for a wallet
 */
export async function getClaimablePositions(
  wallet?: string
): Promise<ClaimablePosition[]> {
  const walletAddress = wallet || config.masterWalletAddress;

  return bagsRequest<ClaimablePosition[]>(
    `/token-launch/claimable-positions?wallet=${walletAddress}`
  );
}

/**
 * Create transactions to claim accumulated fees
 */
export async function createClaimTransactions(
  positions: ClaimablePosition[]
): Promise<ClaimTransactionResponse> {
  logger.info('Creating claim transactions', {
    positionCount: positions.length,
  });

  return bagsRequest<ClaimTransactionResponse>('/token-launch/claim-txs/v2', {
    method: 'POST',
    body: JSON.stringify({
      positions: positions.map((p) => p.tokenMint),
    }),
  });
}

/**
 * Get lifetime fee statistics for a token
 */
export async function getLifetimeFees(tokenMint: string): Promise<LifetimeFees> {
  return bagsRequest<LifetimeFees>(
    `/token-launch/lifetime-fees?tokenMint=${tokenMint}`
  );
}

/**
 * Verify webhook signature from Bags.fm
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  if (!config.webhookSecret) {
    logger.warn('Webhook secret not configured');
    return false;
  }

  // Use crypto to verify HMAC signature
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', config.webhookSecret)
    .update(payload)
    .digest('hex');

  // Decode both from hex and length-guard before timingSafeEqual (which THROWS
  // on length mismatch) - a forged/short signature must return false, not crash.
  const a = Buffer.from(signature, 'hex');
  const b = Buffer.from(expectedSignature, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// === Treasury Integration Helpers ===

/**
 * Generate a symbol for an Issue Coin based on vote ID
 * Format: TARU-XXXX where XXXX is last 4 chars of vote ID
 */
export function generateTokenSymbol(voteId: string): string {
  const suffix = voteId.replace(/-/g, '').slice(-4).toUpperCase();
  return `TARU-${suffix}`;
}

/**
 * Create default fee share config for a vote
 * - Platform: 10%
 * - Creator: 10%
 * - Municipality treasury: 80%
 */
export function createDefaultFeeShareConfig(
  tokenMint: string,
  options: {
    platformProviderId: string;
    creatorProviderId?: string;
    municipalityProviderId?: string;
  }
): FeeShareConfig {
  const feeEarners = [
    {
      provider: 'twitter' as const, // Platform account
      providerId: options.platformProviderId,
      sharePercentage: 10,
    },
  ];

  if (options.creatorProviderId) {
    feeEarners.push({
      provider: 'twitter' as const,
      providerId: options.creatorProviderId,
      sharePercentage: 10,
    });
  }

  if (options.municipalityProviderId) {
    feeEarners.push({
      provider: 'twitter' as const,
      providerId: options.municipalityProviderId,
      sharePercentage: 80,
    });
  }

  return {
    tokenMint,
    feeEarners,
  };
}

// === Export Service Object ===

export const bagsService = {
  isConfigured,
  createTokenInfo,
  configureFeeShare,
  createLaunchTransaction,
  getQuote,
  executeSwap,
  getClaimablePositions,
  createClaimTransactions,
  getLifetimeFees,
  verifyWebhookSignature,
  generateTokenSymbol,
  createDefaultFeeShareConfig,
};

export default bagsService;
