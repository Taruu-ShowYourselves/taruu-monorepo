/**
 * mintSingleNft orchestration tests — pin metadata → mint cNFT → persist, with
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
import { updateVoteNft } from '@/lib/supabase/db';

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
    mintSingleNft = (await import('@/services/nft')).mintSingleNft;
  });

  it('skips (no spend) when there is no recipient wallet', async () => {
    const res = await mintSingleNft('nft-1', null, META);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/no recipient/);
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
    expect(updateVoteNft).toHaveBeenCalledWith('nft-1', { status: 'minting' });
    expect(updateVoteNft).toHaveBeenCalledWith('nft-1', {
      status: 'minted',
      mintAddress: 'asset-1',
      mintTxHash: 'sig-1',
      metadataUri: 'ipfs://QmHash',
    });
  });

  it('marks failed when the mint throws', async () => {
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
