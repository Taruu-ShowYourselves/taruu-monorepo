/**
 * Pilot repository - Result-typed access to the pilot cohort, its curated
 * votes, and the ranking/overview RPCs.
 *
 * Service-role client by design; authorization lives in
 * `@/server/app/pilot/authorize`, never in RLS.
 */

import { ResultAsync } from 'neverthrow';
import { supabaseAdmin } from '@/lib/supabase/server';
import type {
  Database,
  InsertTables,
  PilotMunicipality,
  PilotVoteRow,
  Vote,
} from '@/lib/supabase/types';
import { dbError, type AppError } from '@/server/http/errors';

type RankingRpcRow =
  Database['public']['Functions']['pilot_engagement_ranking']['Returns'][number];
type OverviewRpcRow =
  Database['public']['Functions']['pilot_overview']['Returns'][number];

// === Platform-admin flag ==================================================

export function readIsPlatformAdmin(userId: string): ResultAsync<boolean, AppError> {
  const query = supabaseAdmin
    .from('users')
    .select('is_platform_admin')
    .eq('id', userId)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return Boolean(data?.is_platform_admin);
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('users.readIsPlatformAdmin', cause)
  );
}

// === Ranking / overview RPCs ==============================================

export function engagementRanking(): ResultAsync<RankingRpcRow[], AppError> {
  const query = supabaseAdmin
    .rpc('pilot_engagement_ranking')
    .then(({ data, error }) => {
      if (error) throw error;
      return (data ?? []) as RankingRpcRow[];
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('rpc.pilot_engagement_ranking', cause)
  );
}

export function pilotOverview(): ResultAsync<OverviewRpcRow[], AppError> {
  const query = supabaseAdmin.rpc('pilot_overview').then(({ data, error }) => {
    if (error) throw error;
    return (data ?? []) as OverviewRpcRow[];
  });

  return ResultAsync.fromPromise(query, (cause) => dbError('rpc.pilot_overview', cause));
}

// === Cohort ===============================================================

export function listCohort(): ResultAsync<PilotMunicipality[], AppError> {
  const query = supabaseAdmin
    .from('pilot_municipalities')
    .select('*')
    .order('rank', { ascending: true, nullsFirst: false })
    .then(({ data, error }) => {
      if (error) throw error;
      return data ?? [];
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('pilot_municipalities.listCohort', cause)
  );
}

/** Municipality ids whose participate gate is currently enforcing. */
export function listActiveCohortIds(): ResultAsync<string[], AppError> {
  const query = supabaseAdmin
    .from('pilot_municipalities')
    .select('municipality_id')
    .eq('status', 'active')
    .then(({ data, error }) => {
      if (error) throw error;
      return (data ?? []).map((row) => row.municipality_id);
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('pilot_municipalities.listActiveIds', cause)
  );
}

export function findCohortRow(
  municipalityId: string
): ResultAsync<PilotMunicipality | null, AppError> {
  const query = supabaseAdmin
    .from('pilot_municipalities')
    .select('*')
    .eq('municipality_id', municipalityId)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('pilot_municipalities.findCohortRow', cause)
  );
}

export function upsertCohortRows(
  rows: InsertTables<'pilot_municipalities'>[]
): ResultAsync<void, AppError> {
  const query = supabaseAdmin
    .from('pilot_municipalities')
    .upsert(rows, { onConflict: 'municipality_id' })
    .then(({ error }) => {
      if (error) throw error;
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('pilot_municipalities.upsertCohortRows', cause)
  );
}

/**
 * Clear live ranks before a curated reorder. The partial unique index cannot
 * atomically swap two occupied ranks, so the use-case performs this explicit
 * first half before its upsert. Paused rows retain cohort membership and must
 * participate in the same reorder rule.
 */
export function clearLiveCohortRanks(): ResultAsync<void, AppError> {
  const query = supabaseAdmin
    .from('pilot_municipalities')
    .update({ rank: null, updated_at: new Date().toISOString() })
    .in('status', ['selected', 'active', 'paused'])
    .then(({ error }) => {
      if (error) throw error;
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('pilot_municipalities.clearLiveRanks', cause)
  );
}

/** Drop never-activated rows that fell out of the curated list. */
export function deleteSelectedCohortRows(
  municipalityIds: string[]
): ResultAsync<void, AppError> {
  const query = supabaseAdmin
    .from('pilot_municipalities')
    .delete()
    .in('municipality_id', municipalityIds)
    .eq('status', 'selected')
    .then(({ error }) => {
      if (error) throw error;
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('pilot_municipalities.deleteSelectedRows', cause)
  );
}

/** Retire once-active rows that fell out of the curated list. */
export function completeCohortRows(
  municipalityIds: string[]
): ResultAsync<void, AppError> {
  const query = supabaseAdmin
    .from('pilot_municipalities')
    .update({ status: 'completed', rank: null, updated_at: new Date().toISOString() })
    .in('municipality_id', municipalityIds)
    .in('status', ['active', 'paused'])
    .then(({ error }) => {
      if (error) throw error;
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('pilot_municipalities.completeRows', cause)
  );
}

/**
 * Guarded status transition. Returns the updated row, or null when the guard
 * lost (row absent or not in `fromStatuses`) - the caller maps null to 409.
 */
export function transitionCohortStatus(
  municipalityId: string,
  fromStatuses: PilotMunicipality['status'][],
  to: PilotMunicipality['status'],
  extra: Partial<Pick<PilotMunicipality, 'activated_at'>> = {}
): ResultAsync<PilotMunicipality | null, AppError> {
  const query = supabaseAdmin
    .from('pilot_municipalities')
    .update({ status: to, updated_at: new Date().toISOString(), ...extra })
    .eq('municipality_id', municipalityId)
    .in('status', fromStatuses)
    .select('*')
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('pilot_municipalities.transitionStatus', cause)
  );
}

// === Pilot votes ==========================================================

export function listPilotVotes(
  municipalityId: string
): ResultAsync<PilotVoteRow[], AppError> {
  const query = supabaseAdmin
    .from('pilot_votes')
    .select('*')
    .eq('municipality_id', municipalityId)
    .order('position', { ascending: true })
    .then(({ data, error }) => {
      if (error) throw error;
      return data ?? [];
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('pilot_votes.list', cause)
  );
}

/** Every pilot vote id across the cohort, for the votes API's isPilot flag. */
export function listAllPilotVoteIds(): ResultAsync<Set<string>, AppError> {
  const query = supabaseAdmin
    .from('pilot_votes')
    .select('vote_id')
    .then(({ data, error }) => {
      if (error) throw error;
      return new Set((data ?? []).map((row) => row.vote_id));
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('pilot_votes.listAllIds', cause)
  );
}

export function replacePilotVotes(
  municipalityId: string,
  rows: InsertTables<'pilot_votes'>[]
): ResultAsync<void, AppError> {
  const query = supabaseAdmin
    .from('pilot_votes')
    .delete()
    .eq('municipality_id', municipalityId)
    .then(({ error }) => {
      if (error) throw error;
      return supabaseAdmin.from('pilot_votes').insert(rows);
    })
    .then((result) => {
      if (result && 'error' in result && result.error) throw result.error;
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('pilot_votes.replace', cause)
  );
}

export function getVotesByIds(voteIds: string[]): ResultAsync<Vote[], AppError> {
  const query = supabaseAdmin
    .from('votes')
    .select('*')
    .in('id', voteIds)
    .then(({ data, error }) => {
      if (error) throw error;
      return data ?? [];
    });

  return ResultAsync.fromPromise(query, (cause) => dbError('votes.getByIds', cause));
}

/**
 * Activate still-pending curated votes. Explicit status write - both writers
 * of vote status set it explicitly, per 20260802000012's contract.
 */
export function activatePendingVotes(
  voteIds: string[],
  municipalityId: string,
  endDateIso: string
): ResultAsync<void, AppError> {
  const nowIso = new Date().toISOString();
  const query = supabaseAdmin
    .from('votes')
    .update({
      status: 'active',
      start_date: nowIso,
      end_date: endDateIso,
      updated_at: nowIso,
    })
    .in('id', voteIds)
    .eq('municipality_id', municipalityId)
    .eq('status', 'pending')
    .then(({ error }) => {
      if (error) throw error;
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('votes.activatePending', cause)
  );
}
