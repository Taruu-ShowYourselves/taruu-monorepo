/**
 * `createNftRecordsForVote` — who gets an NFT for a resolved vote, and what
 * happens when resolution runs again.
 *
 * Both properties here exist because the same person can be reachable by two
 * different keys. `uq_vote_nft_user_holder` keys a voter's NFT by user_id and
 * `uq_vote_nft_wallet_holder` keys a patron's by wallet_address, so the database
 * cannot tell that a voter and an Issue Coin holding on that voter's linked
 * wallet are one holder. That recognition has to happen here.
 *
 * The vote lookup, the voter list and the holder list are mocked; the writer is
 * mocked at `bulkCreateVoteNfts`, whose own idempotency is proven against a real
 * Postgres in supabase/tests/vote_nft_holder_uniqueness.sql.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

const mockFrom = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: (table: string) => mockFrom(table) },
}));
vi.mock('@/services/nft/pinata', () => ({
  isPinataConfigured: vi.fn(() => false),
  pinMetadata: vi.fn(),
}));
vi.mock('@/services/nft/solana', () => ({
  isSolanaMintConfigured: vi.fn(() => false),
  mintCompressedNft: vi.fn(),
}));
vi.mock('@/lib/supabase/db', () => ({
  updateVoteNft: vi.fn(),
  claimNftForMinting: vi.fn(),
  bulkCreateVoteNfts: vi.fn(async () => 0),
  getIssueCoinByVoteId: vi.fn(),
  getIssueCoinHolders: vi.fn(),
  updateIssueCoin: vi.fn(),
  getPendingNfts: vi.fn(),
  getVoteNftStats: vi.fn(),
  updateVoteResolutionStatus: vi.fn(),
  getVotesNeedingResolution: vi.fn(),
  getVoteParticipantsWithEmails: vi.fn(),
  getActiveUserPushTokens: vi.fn(),
}));

import {
  bulkCreateVoteNfts,
  getIssueCoinByVoteId,
  getIssueCoinHolders,
} from '@/lib/supabase/db';

const VOTE_ID = 'vote-1';
const LINKED_WALLET = 'Vo1erLinkedWa11etAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const OUTSIDE_WALLET = 'OutsideSupporterWa11etBBBBBBBBBBBBBBBBBBBBBB';

/** Wire `supabaseAdmin.from` for the two tables the record builder reads. */
function seed(voters: Array<Record<string, unknown>>) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'votes') {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { id: VOTE_ID, title: 'v' }, error: null }),
          }),
        }),
      };
    }
    if (table === 'user_votes') {
      return {
        select: () => ({ eq: async () => ({ data: voters, error: null }) }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });
}

describe('createNftRecordsForVote', () => {
  let createNftRecordsForVote: typeof import('@/services/nft').createNftRecordsForVote;

  beforeEach(async () => {
    vi.clearAllMocks();
    (bulkCreateVoteNfts as Mock).mockResolvedValue(0);
    (getIssueCoinByVoteId as Mock).mockResolvedValue({ id: 'coin-1', vote_id: VOTE_ID });
    createNftRecordsForVote = (await import('@/services/nft')).createNftRecordsForVote;
  });

  it('does not issue a second NFT to the wallet a voter is already linked to', async () => {
    seed([{ user_id: 'user-1', option_id: 'opt-1', users: { qubik_wallet_address: LINKED_WALLET } }]);
    (getIssueCoinHolders as Mock).mockResolvedValue([
      // Same person, reached by wallet rather than account: `user_id` is null, so
      // the by-account skip below cannot see them.
      { user_id: null, wallet_address: LINKED_WALLET, is_local_resident: false, token_amount: 5 },
      { user_id: null, wallet_address: OUTSIDE_WALLET, is_local_resident: false, token_amount: 9 },
    ]);

    await createNftRecordsForVote(VOTE_ID);

    const records = (bulkCreateVoteNfts as Mock).mock.calls[0][0];
    expect(records).toEqual([
      { voteId: VOTE_ID, userId: 'user-1', type: 'verified_voter', metadata: { voteCast: 'opt-1' } },
      {
        voteId: VOTE_ID,
        walletAddress: OUTSIDE_WALLET,
        type: 'civic_patron',
        metadata: { tokensHeld: 9, investedILS: undefined },
      },
    ]);
  });

  it('recognises the same wallet through surrounding whitespace', async () => {
    // The RPC strips whitespace before storing and the holder CHECK refuses any
    // that remains, so a raw string comparison here would emit both rows and
    // both would mint to one address.
    seed([{ user_id: 'user-1', option_id: 'opt-1', users: { qubik_wallet_address: LINKED_WALLET } }]);
    (getIssueCoinHolders as Mock).mockResolvedValue([
      { user_id: null, wallet_address: `  ${LINKED_WALLET}\t`, is_local_resident: false, token_amount: 5 },
    ]);

    await createNftRecordsForVote(VOTE_ID);

    const records = (bulkCreateVoteNfts as Mock).mock.calls[0][0];
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ userId: 'user-1', type: 'verified_voter' });
  });

  it('skips a holder whose wallet could not be stored, rather than failing the batch', async () => {
    // An interior space makes the address unusable, and the claim RPC refuses
    // it. Emitting the record anyway would take down the whole resolution for
    // every other participant.
    seed([{ user_id: 'user-1', option_id: 'opt-1', users: { qubik_wallet_address: null } }]);
    (getIssueCoinHolders as Mock).mockResolvedValue([
      { user_id: null, wallet_address: 'Interior Space Wa11et', is_local_resident: false, token_amount: 4 },
      { user_id: null, wallet_address: OUTSIDE_WALLET, is_local_resident: false, token_amount: 9 },
    ]);

    await createNftRecordsForVote(VOTE_ID);

    const records = (bulkCreateVoteNfts as Mock).mock.calls[0][0];
    expect(records.map((r: { walletAddress?: string }) => r.walletAddress)).toEqual([
      undefined,
      OUTSIDE_WALLET,
    ]);
  });

  it('still skips a holder recognised by account', async () => {
    seed([{ user_id: 'user-1', option_id: 'opt-1', users: { qubik_wallet_address: null } }]);
    (getIssueCoinHolders as Mock).mockResolvedValue([
      { user_id: 'user-1', wallet_address: OUTSIDE_WALLET, is_local_resident: false, token_amount: 3 },
    ]);

    await createNftRecordsForVote(VOTE_ID);

    const records = (bulkCreateVoteNfts as Mock).mock.calls[0][0];
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ userId: 'user-1', type: 'verified_voter' });
  });

  it('reports what was actually claimed, not what it enumerated', async () => {
    // The re-run case. Resolution is retried by cron whenever anything earlier
    // failed, so the same participants are enumerated again; the writer claims
    // none of them. Returning the enumerated length would report NFTs that were
    // never created.
    seed([{ user_id: 'user-1', option_id: 'opt-1', users: { qubik_wallet_address: null } }]);
    (getIssueCoinHolders as Mock).mockResolvedValue([]);
    (bulkCreateVoteNfts as Mock).mockResolvedValue(0);

    expect(await createNftRecordsForVote(VOTE_ID)).toBe(0);
  });

  it('claims nothing and calls no writer when a vote has no participants', async () => {
    seed([]);
    (getIssueCoinByVoteId as Mock).mockResolvedValue(null);

    expect(await createNftRecordsForVote(VOTE_ID)).toBe(0);
    expect(bulkCreateVoteNfts).not.toHaveBeenCalled();
  });
});

/**
 * `mintPendingNfts` — how the batch counts what happened to each row.
 *
 * The distinction matters operationally: overlapping cron runs and voters
 * without a linked wallet are both normal, and counting either as a mint
 * failure would make a healthy schedule look broken.
 */
describe('mintPendingNfts accounting', () => {
  let mintPendingNfts: typeof import('@/services/nft').mintPendingNfts;

  beforeEach(async () => {
    vi.clearAllMocks();
    seed([]);
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { id: VOTE_ID, title: 'v', description: 'd', municipality_id: 'm',
                    end_date: new Date().toISOString(), participant_count: 1 },
            error: null,
          }),
        }),
      }),
    }));
    mintPendingNfts = (await import('@/services/nft')).mintPendingNfts;
  });

  it('counts a row with no recipient as skipped, never as failed', async () => {
    const { isSolanaMintConfigured } = await import('@/services/nft/solana');
    const { isPinataConfigured } = await import('@/services/nft/pinata');
    (isSolanaMintConfigured as Mock).mockReturnValue(true);
    (isPinataConfigured as Mock).mockReturnValue(true);
    const { getPendingNfts, claimNftForMinting } = await import('@/lib/supabase/db');
    (getPendingNfts as Mock).mockResolvedValue([
      { id: 'nft-1', vote_id: VOTE_ID, type: 'verified_voter', metadata: null, recipient: null },
    ]);

    const summary = await mintPendingNfts();
    expect(summary).toMatchObject({ attempted: 1, minted: 0, skipped: 1, failed: 0 });
    expect(claimNftForMinting).not.toHaveBeenCalled();
  });

  it('counts a claim that errored as a failure, and leaves the row alone', async () => {
    const { isSolanaMintConfigured } = await import('@/services/nft/solana');
    const { isPinataConfigured } = await import('@/services/nft/pinata');
    (isSolanaMintConfigured as Mock).mockReturnValue(true);
    (isPinataConfigured as Mock).mockReturnValue(true);
    const { getPendingNfts, claimNftForMinting, updateVoteNft } = await import('@/lib/supabase/db');
    (getPendingNfts as Mock).mockResolvedValue([
      { id: 'nft-1', vote_id: VOTE_ID, type: 'verified_voter', metadata: null, recipient: 'W1' },
    ]);
    (claimNftForMinting as Mock).mockRejectedValue(new Error('db unreachable'));

    const summary = await mintPendingNfts();
    // A database outage must be visible in the summary, not absorbed as a skip.
    expect(summary).toMatchObject({ attempted: 1, minted: 0, skipped: 0, failed: 1 });
    // The row itself is still left pending rather than written `failed`, which
    // is terminal and would strand an NFT nothing ever attempted.
    expect(updateVoteNft).not.toHaveBeenCalled();
  });

  it('counts a lost claim as skipped, never as failed', async () => {
    const { isSolanaMintConfigured } = await import('@/services/nft/solana');
    const { isPinataConfigured } = await import('@/services/nft/pinata');
    (isSolanaMintConfigured as Mock).mockReturnValue(true);
    (isPinataConfigured as Mock).mockReturnValue(true);
    const { getPendingNfts, claimNftForMinting } = await import('@/lib/supabase/db');
    (getPendingNfts as Mock).mockResolvedValue([
      { id: 'nft-1', vote_id: VOTE_ID, type: 'verified_voter', metadata: null, recipient: 'W1' },
    ]);
    (claimNftForMinting as Mock).mockResolvedValue(false);

    const summary = await mintPendingNfts();
    expect(summary).toMatchObject({ attempted: 1, minted: 0, skipped: 1, failed: 0 });
  });
});
