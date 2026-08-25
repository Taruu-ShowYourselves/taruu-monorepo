/**
 * mintSingleNft orchestration tests - pin metadata → mint cNFT → persist, with
 * clean skips when there's no recipient wallet or the chain/IPFS isn't configured.
 * The chain + IPFS + DB are mocked; this verifies the wiring, not the SDK.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { NftMetadata } from '@sync/shared';

vi.mock('@/lib/supabase/server', () => ({ supabaseAdmin: { from: () => ({}) } }));
vi.mock('@/services/nft/pinata', () => ({
  isPinataConfigured: vi.fn(() => true),
  pinMetadata: vi.fn(async () => 'ipfs://QmHash'),
}));
vi.mock('@/services/nft/solana', () => ({
  isSolanaMintConfigured: vi.fn(() => true),
  mintCompressedNft: vi.fn(async () => ({ assetId: 'asset-1', signature: 'sig-1' })),
}));
vi.mock('@/lib/supabase/db', () => ({
  updateVoteNft: vi.fn(async () => ({})),
  claimNftForMinting: vi.fn(async () => true),
  getIssueCoinByVoteId: vi.fn(),
  getIssueCoinHolders: vi.fn(),
  updateIssueCoin: vi.fn(),
  bulkCreateVoteNfts: vi.fn(),
  getPendingNfts: vi.fn(),
  getVoteNftStats: vi.fn(),
  updateVoteResolutionStatus: vi.fn(),
  getVotesNeedingResolution: vi.fn(),
  getVoteParticipantsWithEmails: vi.fn(),
}));

import { isPinataConfigured, pinMetadata } from '@/services/nft/pinata';
import { isSolanaMintConfigured, mintCompressedNft } from '@/services/nft/solana';
import { updateVoteNft, claimNftForMinting } from '@/lib/supabase/db';

const META: NftMetadata = {
  name: 'Taruu Verified Voter: Test',
  symbol: 'TARUU',
  description: 'c',
  image: 'https://taruu.co.il/images/certificates/verified_voter.png',
  external_url: 'https://taruu.co.il/votes/v1',
  attributes: [],
};

describe('mintSingleNft', () => {
  let mintSingleNft: typeof import('@/services/nft').mintSingleNft;

  beforeEach(async () => {
    vi.clearAllMocks();
    (isPinataConfigured as Mock).mockReturnValue(true);
    (isSolanaMintConfigured as Mock).mockReturnValue(true);
    (pinMetadata as Mock).mockResolvedValue('ipfs://QmHash');
    (mintCompressedNft as Mock).mockResolvedValue({ assetId: 'asset-1', signature: 'sig-1' });
    (claimNftForMinting as Mock).mockResolvedValue(true);
    mintSingleNft = (await import('@/services/nft')).mintSingleNft;
  });

  it('skips (no spend) when there is no recipient wallet', async () => {
    const res = await mintSingleNft('nft-1', null, META);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/no recipient/);
    expect(claimNftForMinting).not.toHaveBeenCalled();
    expect(updateVoteNft).not.toHaveBeenCalled();
    expect(mintCompressedNft).not.toHaveBeenCalled();
  });

  it('skips when minting is unconfigured', async () => {
    (isSolanaMintConfigured as Mock).mockReturnValue(false);
    const res = await mintSingleNft('nft-1', 'wallet-1', META);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/not configured/);
    expect(mintCompressedNft).not.toHaveBeenCalled();
  });

  it('pins, mints, and persists on success', async () => {
    const res = await mintSingleNft('nft-1', 'wallet-1', META);
    expect(res).toEqual({ success: true, nftId: 'nft-1', mintAddress: 'asset-1', txHash: 'sig-1' });
    expect(pinMetadata).toHaveBeenCalledWith(META, META.name);
    expect(mintCompressedNft).toHaveBeenCalledWith({
      recipient: 'wallet-1',
      name: META.name,
      metadataUri: 'ipfs://QmHash',
    });
    expect(claimNftForMinting).toHaveBeenCalledWith('nft-1');
    expect(updateVoteNft).toHaveBeenCalledWith('nft-1', {
      status: 'minted',
      mintAddress: 'asset-1',
      mintTxHash: 'sig-1',
      metadataUri: 'ipfs://QmHash',
      errorMessage: null,
    });
  });

  // The claim is what stops two scheduled minters from both reaching the chain
  // with one database row. It has to happen before ANY irreversible step, and
  // losing it has to be a clean skip rather than an error the caller counts as
  // a failure.
  it('skips without spending when another minter already claimed the row', async () => {
    (claimNftForMinting as Mock).mockResolvedValue(false);
    const res = await mintSingleNft('nft-1', 'wallet-1', META);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/already claimed/);
    // A lost claim is normal cron overlap. `mintPendingNfts` counts anything
    // that is neither minted nor skipped as a failure, so without this flag a
    // healthy schedule reports mint failures.
    expect(res.skipped).toBe(true);
    expect(pinMetadata).not.toHaveBeenCalled();
    expect(mintCompressedNft).not.toHaveBeenCalled();
    expect(updateVoteNft).not.toHaveBeenCalled();
  });

  it('claims the row before pinning or minting anything', async () => {
    const order: string[] = [];
    (claimNftForMinting as Mock).mockImplementation(async () => {
      order.push('claim');
      return true;
    });
    (pinMetadata as Mock).mockImplementation(async () => {
      order.push('pin');
      return 'ipfs://QmHash';
    });
    (mintCompressedNft as Mock).mockImplementation(async () => {
      order.push('mint');
      return { assetId: 'asset-1', signature: 'sig-1' };
    });

    await mintSingleNft('nft-1', 'wallet-1', META);
    expect(order).toEqual(['claim', 'pin', 'mint']);
  });

  // A claim error means we do NOT own the row. Marking it failed would strand a
  // row nothing ever attempted -- and `failed` is terminal by design.
  it('leaves the row alone when the claim itself errors', async () => {
    (claimNftForMinting as Mock).mockRejectedValue(new Error('db unreachable'));
    const res = await mintSingleNft('nft-1', 'wallet-1', META);
    expect(res.success).toBe(false);
    // The row is untouched -- writing `failed` would strand an NFT nothing
    // attempted. But this is NOT a skip: failing to ask is a database outage,
    // and a cron that reported it as skipped would look healthy while minting
    // nothing.
    expect(res.skipped).toBeUndefined();
    expect(res.error).toMatch(/claim failed: db unreachable/);
    expect(updateVoteNft).not.toHaveBeenCalled();
    expect(pinMetadata).not.toHaveBeenCalled();
    expect(mintCompressedNft).not.toHaveBeenCalled();
  });

  // Pinning is strictly before the chain, so its failures are unambiguous: the
  // row goes back to pending and the next run retries it. Only failures that
  // may have reached the chain are terminal.
  it('returns the row to pending when pinning fails, before any broadcast', async () => {
    (pinMetadata as Mock).mockRejectedValue(new Error('ipfs down'));
    const res = await mintSingleNft('nft-1', 'wallet-1', META);
    expect(res.success).toBe(false);
    // The row is retryable, but the RESULT is a failure: an IPFS outage must
    // show up in the batch summary rather than being counted as a clean skip.
    expect(res.skipped).toBeUndefined();
    expect(mintCompressedNft).not.toHaveBeenCalled();
    expect(updateVoteNft).toHaveBeenCalledWith('nft-1', {
      status: 'pending',
      errorMessage: 'ipfs down',
    });
    expect(updateVoteNft).not.toHaveBeenCalledWith('nft-1', expect.objectContaining({
      status: 'failed',
    }));
  });

  it('marks failed only when the mint itself throws, because that is ambiguous', async () => {
    (mintCompressedNft as Mock).mockRejectedValue(new Error('rpc down'));
    const res = await mintSingleNft('nft-1', 'wallet-1', META);
    expect(res.success).toBe(false);
    expect(res.error).toBe('rpc down');
    expect(updateVoteNft).toHaveBeenCalledWith('nft-1', {
      status: 'failed',
      errorMessage: 'rpc down',
      retryCount: 1,
    });
  });
});
