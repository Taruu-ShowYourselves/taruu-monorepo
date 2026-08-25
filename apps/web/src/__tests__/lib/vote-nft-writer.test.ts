/**
 * The two vote_nfts writers, at the client boundary.
 *
 * Both exist to keep one holder from getting two irreversible on-chain NFTs,
 * and both delegate the actual guarantee to the database — `bulkCreateVoteNfts`
 * to `claim_vote_nft_records`, `claimNftForMinting` to a conditional UPDATE.
 * What is worth asserting here is the part the database cannot: that the right
 * call is made with the right shape, and that the client refuses the inputs it
 * cannot honour. The database-side behaviour is proven against a real Postgres
 * in supabase/tests/vote_nft_holder_uniqueness.sql.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const rpc = vi.fn();
const update = vi.fn();
const from = vi.fn((_table: string) => ({ update }));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: (table: string) => from(table),
  },
}));

import { bulkCreateVoteNfts, claimNftForMinting } from '@/lib/supabase/db';

/** The `.update().eq().eq().select().maybeSingle()` chain, capturing filters. */
function updateChain(result: { data: unknown; error: unknown }) {
  const filters: Array<[string, unknown]> = [];
  const chain = {
    eq: (column: string, value: unknown) => {
      filters.push([column, value]);
      return chain;
    },
    select: () => chain,
    maybeSingle: async () => result,
  };
  update.mockReturnValue(chain);
  return filters;
}

describe('bulkCreateVoteNfts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ data: 2, error: null });
  });

  it('sends one claim per vote, with exactly one holder named per record', async () => {
    const claimed = await bulkCreateVoteNfts([
      { voteId: 'vote-1', userId: 'user-1', type: 'verified_voter', metadata: { voteCast: 'o1' } },
      { voteId: 'vote-1', walletAddress: 'W1', type: 'civic_patron' },
    ]);

    expect(claimed).toBe(2);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('claim_vote_nft_records', {
      p_vote_id: 'vote-1',
      p_records: [
        { user_id: 'user-1', wallet_address: null, type: 'verified_voter', metadata: { voteCast: 'o1' } },
        { user_id: null, wallet_address: 'W1', type: 'civic_patron', metadata: null },
      ],
    });
  });

  it('refuses a batch spanning several votes rather than splitting it', async () => {
    // Splitting would mean several independent claims: a throw on the second
    // would leave the first committed, and the caller could not tell.
    await expect(
      bulkCreateVoteNfts([
        { voteId: 'vote-1', userId: 'user-1', type: 'verified_voter' },
        { voteId: 'vote-2', userId: 'user-2', type: 'verified_voter' },
      ])
    ).rejects.toThrow(/one vote/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('claims nothing and calls nothing for an empty batch', async () => {
    expect(await bulkCreateVoteNfts([])).toBe(0);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('reports what the database claimed, not what was offered', async () => {
    rpc.mockResolvedValue({ data: 0, error: null });
    const claimed = await bulkCreateVoteNfts([
      { voteId: 'vote-1', userId: 'user-1', type: 'verified_voter' },
    ]);
    expect(claimed).toBe(0);
  });
});

describe('claimNftForMinting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('claims only a pending row, by conditional update', async () => {
    const filters = updateChain({ data: { id: 'nft-1' }, error: null });

    expect(await claimNftForMinting('nft-1')).toBe(true);
    expect(from).toHaveBeenCalledWith('vote_nfts');
    expect(update).toHaveBeenCalledWith({ status: 'minting' });
    // The status filter IS the claim. Without it the update always succeeds and
    // two workers both proceed to mint.
    expect(filters).toEqual([
      ['id', 'nft-1'],
      ['status', 'pending'],
    ]);
  });

  it('reports a lost claim rather than throwing', async () => {
    updateChain({ data: null, error: null });
    expect(await claimNftForMinting('nft-1')).toBe(false);
  });
});
