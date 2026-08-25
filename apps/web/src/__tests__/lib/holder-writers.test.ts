/**
 * The holder writers, at the client boundary.
 *
 * `vote_nfts` and `issue_coin_holdings` carried the same defect — a UNIQUE
 * constraint spanning both holder columns, which enforces nothing because the
 * unused column is always NULL — and both had writers that raced into the gap.
 * Each now delegates the guarantee to the database: `bulkCreateVoteNfts` to
 * `claim_vote_nft_records`, `upsertIssueCoinHolding` to
 * `claim_issue_coin_holding`, and `claimNftForMinting` to a conditional UPDATE.
 *
 * What is worth asserting here is the part the database cannot: that the right
 * call is made with the right shape, and that a refusal is surfaced rather than
 * swallowed. The database-side behaviour is proven against a real Postgres in
 * supabase/tests/vote_nft_holder_uniqueness.sql and
 * supabase/tests/issue_coin_holding_uniqueness.sql.
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

import {
  bulkCreateVoteNfts,
  claimNftForMinting,
  upsertIssueCoinHolding,
} from '@/lib/supabase/db';

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

describe('upsertIssueCoinHolding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records the purchase in one call rather than reading then writing', async () => {
    // The read-then-write version let two overlapping purchases by one holder
    // each insert a row, splitting their balance. The accumulate-or-create
    // decision now happens inside the statement that enforces uniqueness.
    const row = { id: 'holding-1', token_amount: '350' };
    rpc.mockResolvedValue({ data: row, error: null });

    const result = await upsertIssueCoinHolding({
      issueCoinId: 'coin-1',
      userId: 'user-1',
      tokenAmount: '250',
      investedIls: 300,
    });

    expect(result).toBe(row);
    expect(from).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('claim_issue_coin_holding', {
      p_issue_coin_id: 'coin-1',
      p_user_id: 'user-1',
      p_wallet_address: null,
      p_token_amount: '250',
      p_invested_ils: 300,
      p_is_local_resident: false,
    });
  });

  it('passes an external wallet through as the holder', async () => {
    rpc.mockResolvedValue({ data: { id: 'holding-2' }, error: null });

    await upsertIssueCoinHolding({
      issueCoinId: 'coin-1',
      walletAddress: 'W1',
      tokenAmount: '10',
      investedIls: 0,
      isLocalResident: true,
    });

    expect(rpc).toHaveBeenCalledWith('claim_issue_coin_holding', {
      p_issue_coin_id: 'coin-1',
      p_user_id: null,
      p_wallet_address: 'W1',
      p_token_amount: '10',
      p_invested_ils: 0,
      p_is_local_resident: true,
    });
  });

  it('surfaces a refusal rather than swallowing it', async () => {
    // The RPC refuses amounts that would corrupt a balance. A purchase path
    // must not treat that as a no-op.
    rpc.mockResolvedValue({ data: null, error: { message: 'p_token_amount must be...' } });
    await expect(
      upsertIssueCoinHolding({
        issueCoinId: 'coin-1',
        userId: 'user-1',
        tokenAmount: '-5',
        investedIls: 0,
      })
    ).rejects.toBeTruthy();
  });
});
