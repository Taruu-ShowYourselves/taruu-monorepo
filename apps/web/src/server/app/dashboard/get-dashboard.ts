/**
 * Use-case: the user's dashboard as ONE aggregate.
 *
 * Replaces six independent client fetches (stats, participations, billing,
 * fund contributions, certificates, city pulse) with a single server-side
 * composition - one round-trip for the client, parallel IO here.
 */

import { ResultAsync } from 'neverthrow';
import type { DashboardResponse } from '@sync/shared/contracts';
import {
  getUserById,
  getUserVoteStats,
  getUserVotesWithDetails,
  getUserEntitlements,
  getUserPayments,
  getTreasuryByMunicipality,
  getTreasuryTransactions,
  getVotesByMunicipality,
  getMunicipalityProfile,
} from '@/lib/supabase/db';
import { supabaseAdmin } from '@/lib/supabase/server';
import { dbError, type AppError } from '@/server/http/errors';

async function fetchCertificates(userId: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabaseAdmin
    .from('vote_nfts')
    .select('id, vote_id, type, status, mint_address, mint_tx_hash, metadata, minted_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(`vote_nfts fetch failed: ${error.message}`);

  const voteIds = [...new Set((data ?? []).map((n) => n.vote_id))];
  let titles = new Map<string, { title: string; municipality_id: string }>();
  if (voteIds.length > 0) {
    const { data: votes } = await supabaseAdmin
      .from('votes')
      .select('id, title, municipality_id')
      .in('id', voteIds);
    titles = new Map((votes ?? []).map((v) => [v.id, v]));
  }
  return (data ?? []).map((nft) => ({
    ...nft,
    vote: titles.get(nft.vote_id) ?? null,
  }));
}

async function buildDashboard(userId: string): Promise<DashboardResponse> {
  const user = await getUserById(userId);
  const municipality = user?.municipality_id ?? null;

  const [stats, participations, entitlements, payments, certificates, cityVotes, cityProfile] =
    await Promise.all([
      getUserVoteStats(userId),
      getUserVotesWithDetails(userId),
      getUserEntitlements(userId),
      getUserPayments(userId),
      fetchCertificates(userId),
      municipality
        ? getVotesByMunicipality(municipality, 'active')
        : Promise.resolve([]),
      municipality ? getMunicipalityProfile(municipality, 1) : Promise.resolve(null),
    ]);

  const completedPayments = payments.filter((p) => p.status === 'completed');

  const contributions = municipality
    ? await (async () => {
        const treasury = await getTreasuryByMunicipality(municipality);
        if (!treasury) return [];
        const txns = await getTreasuryTransactions(treasury.id, {
          type: 'deposit',
          limit: 50,
        });
        return txns
          .filter((t) => t.user_id === userId)
          .map((t) => ({
            id: t.id,
            amountILS: Number(t.amount_ils ?? 0),
            voteId: t.vote_id ?? null,
            date: t.created_at,
          }));
      })()
    : [];

  return {
    stats: {
      totalVotes: stats.votesParticipated,
      activeVotes: participations.filter((p) => p.vote?.status === 'active').length,
      votesCreated: stats.votesCreated,
    },
    recentVotes: participations.map((p) => ({
      id: p.vote_id,
      title: p.vote?.title ?? '',
      status: p.vote?.status === 'active' ? ('active' as const) : ('ended' as const),
      votedAt: p.created_at,
      option: p.option?.text ?? '',
    })),
    tokenTransactions: entitlements
      .filter((e) => e.type === 'vote' || e.type === 'create_vote')
      .map((e) => ({
        id: e.id,
        amount: e.type === 'vote' ? 3 : 50,
        reason:
          e.type === 'vote'
            ? ('vote_participation' as const)
            : ('vote_creation' as const),
        txHash:
          completedPayments.find((p) => p.id === e.payment_id)?.provider_id ?? '',
        timestamp: e.granted_at,
      }))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    contributions,
    certificates,
    activeInCity: cityVotes.map((v) => ({ id: v.id, title: v.title })),
    cityMetrics: cityProfile?.metrics ?? null,
  };
}

export function getDashboard(userId: string): ResultAsync<DashboardResponse, AppError> {
  return ResultAsync.fromPromise(buildDashboard(userId), (cause) =>
    dbError('dashboard.aggregate', cause)
  );
}
