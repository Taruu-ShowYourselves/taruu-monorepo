/**
 * Bag Seeding Service Tests
 *
 * Covers seedVoteBag: idempotency, no-funds short-circuit, unconfigured guard,
 * and the happy path that creates a Bags.fm bag from accrued ILS at resolution
 * and writes the treasury audit trail.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

vi.mock('@/lib/supabase/db', () => ({
  getAccruedIlsForVote: vi.fn(),
  getIssueCoinByVoteId: vi.fn(),
  createIssueCoin: vi.fn(),
  updateIssueCoin: vi.fn(),
  getOrCreateTreasury: vi.fn(),
  recordTreasuryTransaction: vi.fn(),
}));

const mockSingle = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({ single: mockSingle }),
      }),
    }),
  },
}));

vi.mock('@/services/bags', () => ({
  bagsService: {
    isConfigured: vi.fn(),
    generateTokenSymbol: vi.fn(() => 'TARU-1234'),
    createTokenInfo: vi.fn(),
    configureFeeShare: vi.fn(),
    createDefaultFeeShareConfig: vi.fn(() => ({ tokenMint: 'mint-1', feeEarners: [] })),
    createLaunchTransaction: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { seedVoteBag, agorotToSol } from '@/services/treasury/bagSeeding';
import {
  getAccruedIlsForVote,
  getIssueCoinByVoteId,
  createIssueCoin,
  updateIssueCoin,
  getOrCreateTreasury,
  recordTreasuryTransaction,
} from '@/lib/supabase/db';
import { bagsService } from '@/services/bags';

describe('seedVoteBag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TREASURY_ILS_PER_SOL = '750';
    process.env.BAGS_PLATFORM_PROVIDER_ID = 'platform-twitter-id';
    (bagsService.isConfigured as Mock).mockReturnValue(true);
  });

  it('is idempotent - skips when a bag already exists for the vote', async () => {
    (getIssueCoinByVoteId as Mock).mockResolvedValue({ token_mint: 'existing-mint' });

    const result = await seedVoteBag('vote-1');

    expect(result.seeded).toBe(false);
    expect(result.reason).toBe('bag_already_exists');
    expect(result.tokenMint).toBe('existing-mint');
    expect(bagsService.createTokenInfo).not.toHaveBeenCalled();
  });

  it('skips when no funds were accrued for the vote', async () => {
    (getIssueCoinByVoteId as Mock).mockResolvedValue(null);
    (getAccruedIlsForVote as Mock).mockResolvedValue(0);

    const result = await seedVoteBag('vote-1');

    expect(result.seeded).toBe(false);
    expect(result.reason).toBe('no_accrued_funds');
    expect(bagsService.createTokenInfo).not.toHaveBeenCalled();
  });

  it('skips when Bags.fm is not configured', async () => {
    (getIssueCoinByVoteId as Mock).mockResolvedValue(null);
    (getAccruedIlsForVote as Mock).mockResolvedValue(5000);
    (bagsService.isConfigured as Mock).mockReturnValue(false);

    const result = await seedVoteBag('vote-1');

    expect(result.seeded).toBe(false);
    expect(result.reason).toBe('bags_not_configured');
  });

  it('creates and seeds the bag from accrued ILS, writing the treasury audit trail', async () => {
    (getIssueCoinByVoteId as Mock).mockResolvedValue(null);
    (getAccruedIlsForVote as Mock).mockResolvedValue(75000); // ₪750 → 1 SOL at 750 ILS/SOL
    mockSingle.mockResolvedValue({
      data: {
        id: 'vote-1',
        title: 'New park',
        description: 'Build a park',
        municipality_id: 'tel-aviv',
      },
      error: null,
    });
    (getOrCreateTreasury as Mock).mockResolvedValue('treasury-1');
    (recordTreasuryTransaction as Mock).mockResolvedValue('tx-1');
    (bagsService.createTokenInfo as Mock).mockResolvedValue({
      mint: 'mint-1',
      name: 'New park',
      symbol: 'TARU-1234',
      decimals: 9,
      totalSupply: '1000000000',
    });
    (bagsService.configureFeeShare as Mock).mockResolvedValue(undefined);
    (bagsService.createLaunchTransaction as Mock).mockResolvedValue({
      signedTransaction: 'signed-tx',
      tokenMint: 'mint-1',
    });
    (createIssueCoin as Mock).mockResolvedValue({ id: 'coin-1' });
    (updateIssueCoin as Mock).mockResolvedValue(undefined);

    const result = await seedVoteBag('vote-1');

    expect(result.seeded).toBe(true);
    expect(result.tokenMint).toBe('mint-1');
    expect(result.accruedIlsAgorot).toBe(75000);
    expect(result.solSeeded).toBeCloseTo(1, 6);

    expect(bagsService.createTokenInfo).toHaveBeenCalledWith(
      expect.objectContaining({ voteId: 'vote-1', symbol: 'TARU-1234', municipality: 'tel-aviv' })
    );
    expect(bagsService.configureFeeShare).toHaveBeenCalled();
    expect(bagsService.createLaunchTransaction).toHaveBeenCalledWith('mint-1');
    expect(createIssueCoin).toHaveBeenCalledWith(
      expect.objectContaining({ voteId: 'vote-1', tokenMint: 'mint-1' })
    );
    // allocation + token_purchase audit rows
    expect(recordTreasuryTransaction).toHaveBeenCalledTimes(2);
    const types = (recordTreasuryTransaction as Mock).mock.calls.map((c) => c[0].type);
    expect(types).toContain('allocation');
    expect(types).toContain('token_purchase');
  });
});

describe('agorotToSol', () => {
  it('converts agorot to SOL using the configured FX rate', () => {
    process.env.TREASURY_ILS_PER_SOL = '750';
    expect(agorotToSol(75000)).toBeCloseTo(1, 6); // ₪750 / 750 = 1 SOL
    expect(agorotToSol(150000)).toBeCloseTo(2, 6);
  });
});
