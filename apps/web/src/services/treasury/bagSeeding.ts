/**
 * Bag Seeding Service
 *
 * Implements the "treasury accrual + batch seed" model:
 *
 *  1. While a vote is open, each Green Invoice-paid participation accrues ILS into the
 *     municipality treasury ledger, tagged with the vote_id (see payments webhook).
 *  2. When the vote ends, this service is invoked once per vote at resolution:
 *       - sums the accrued ILS for the vote,
 *       - converts it to a SOL seed amount (master wallet buys SOL off-platform;
 *         the FX rate is configured via TREASURY_ILS_PER_SOL),
 *       - launches a single Bags.fm bag (Issue Coin) for the vote and seeds it,
 *       - persists the issue_coin row and writes a reconcilable treasury audit
 *         trail (allocation + token_purchase transactions).
 *
 * The on-chain submission of the launch transaction is performed by the master
 * wallet. Bags.fm returns a signed transaction; submitting it requires the master
 * wallet key + a Solana RPC, which run in the deploy environment. Here we create
 * and persist the bag and record the seed intent so the flow is fully reconcilable.
 */

import {
  getAccruedIlsForVote,
  getIssueCoinByVoteId,
  createIssueCoin,
  updateIssueCoin,
  getOrCreateTreasury,
  recordTreasuryTransaction,
} from '@/lib/supabase/db';
import { supabaseAdmin } from '@/lib/supabase/server';
import { bagsService } from '@/services/bags';
import { logger } from '@/lib/logger';

const DEFAULT_ILS_PER_SOL = 750; // overridable via TREASURY_ILS_PER_SOL

export interface BagSeedResult {
  voteId: string;
  seeded: boolean;
  reason?: string;
  tokenMint?: string;
  accruedIlsAgorot?: number;
  solSeeded?: number;
}

function ilsPerSol(): number {
  const raw = Number(process.env.TREASURY_ILS_PER_SOL);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_ILS_PER_SOL;
}

/** Convert agorot (minor ILS) into a SOL amount using the configured FX rate. */
export function agorotToSol(agorot: number): number {
  const ils = agorot / 100;
  return ils / ilsPerSol();
}

async function getVote(voteId: string) {
  const { data, error } = await supabaseAdmin
    .from('votes')
    .select('id, title, description, municipality_id')
    .eq('id', voteId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Create and seed the single Bags.fm bag for a resolved vote.
 * Idempotent: if a bag already exists for the vote, it is left untouched.
 */
export async function seedVoteBag(voteId: string): Promise<BagSeedResult> {
  // Idempotency - never create two bags for one vote
  const existing = await getIssueCoinByVoteId(voteId);
  if (existing) {
    return { voteId, seeded: false, reason: 'bag_already_exists', tokenMint: existing.token_mint };
  }

  const accruedAgorot = await getAccruedIlsForVote(voteId);
  if (accruedAgorot <= 0) {
    return { voteId, seeded: false, reason: 'no_accrued_funds', accruedIlsAgorot: 0 };
  }

  if (!bagsService.isConfigured()) {
    logger.warn('Bags.fm not configured - skipping bag seed', { voteId });
    return { voteId, seeded: false, reason: 'bags_not_configured', accruedIlsAgorot: accruedAgorot };
  }

  const vote = await getVote(voteId);
  if (!vote) {
    return { voteId, seeded: false, reason: 'vote_not_found' };
  }

  const municipalityId = vote.municipality_id || 'unassigned';
  const solSeed = agorotToSol(accruedAgorot);
  const treasuryId = await getOrCreateTreasury(municipalityId);

  // 1. Earmark the accrued ILS for this vote's bag (audit trail)
  await recordTreasuryTransaction({
    treasuryId,
    type: 'allocation',
    voteId,
    amountIls: accruedAgorot,
    description: `Allocated ₪${(accruedAgorot / 100).toFixed(2)} to Issue Coin seed for vote ${voteId}`,
    status: 'confirmed',
  });

  // 2. Create the bag on Bags.fm
  const symbol = bagsService.generateTokenSymbol(voteId);
  const tokenInfo = await bagsService.createTokenInfo({
    name: vote.title,
    symbol,
    description: vote.description || `Issue Coin for "${vote.title}"`,
    image: '',
    municipality: municipalityId,
    voteId,
  });

  // 3. Configure fee sharing (mandatory before launch)
  const platformProviderId = process.env.BAGS_PLATFORM_PROVIDER_ID;
  let feeShareConfigured = false;
  if (platformProviderId) {
    try {
      await bagsService.configureFeeShare(
        bagsService.createDefaultFeeShareConfig(tokenInfo.mint, {
          platformProviderId,
          municipalityProviderId: process.env.BAGS_MUNICIPALITY_PROVIDER_ID,
        })
      );
      feeShareConfigured = true;
    } catch (e) {
      logger.error('Fee share configuration failed', { voteId, error: e });
    }
  } else {
    logger.warn('BAGS_PLATFORM_PROVIDER_ID not set - launching without fee share', { voteId });
  }

  // 4. Build the launch transaction (signed by master wallet downstream)
  await bagsService.createLaunchTransaction(tokenInfo.mint);

  // 5. Persist the issue coin. launch_tx_hash stays null until the master wallet
  //    submits the signed transaction on-chain and reconciliation records the sig.
  const issueCoin = await createIssueCoin({
    voteId,
    tokenMint: tokenInfo.mint,
    tokenName: tokenInfo.name,
    tokenSymbol: tokenInfo.symbol,
    tokenDecimals: tokenInfo.decimals,
    totalSupply: tokenInfo.totalSupply,
  });
  await updateIssueCoin(issueCoin.id, {
    feeShareConfigured,
    tradingEnabled: true,
    totalValueIls: accruedAgorot,
  });

  // 6. Record the fiat→SOL seed intent (master wallet executes the buy off-platform)
  await recordTreasuryTransaction({
    treasuryId,
    type: 'token_purchase',
    voteId,
    amountIls: accruedAgorot,
    amountSol: solSeed,
    description: `Seed ${solSeed.toFixed(6)} SOL into Issue Coin ${symbol} (rate ₪${ilsPerSol()}/SOL)`,
    status: 'pending',
    metadata: { tokenMint: tokenInfo.mint, ilsPerSol: ilsPerSol() },
  });

  logger.info('Seeded vote bag', { voteId, tokenMint: tokenInfo.mint, accruedAgorot, solSeed });

  return {
    voteId,
    seeded: true,
    tokenMint: tokenInfo.mint,
    accruedIlsAgorot: accruedAgorot,
    solSeeded: solSeed,
  };
}
