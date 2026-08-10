/**
 * Government repository - the roster mirror, the roll-call record, and the
 * citizen reviews that hang off them.
 *
 * Two call shapes on purpose. The importers (cron) get plain promises: they
 * run in a job that logs and counts its own failures, and wrapping every
 * upsert in a Result there would only add ceremony. The review use-cases get
 * Result-typed access, like every other write the API layer performs.
 */

import { ResultAsync } from 'neverthrow';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { InsertTables } from '@/lib/supabase/types';
import { dbError, type AppError } from '@/server/http/errors';

// ---------------------------------------------------------------------------
// Roster mirror (importer side)
// ---------------------------------------------------------------------------

export type PersonInsert = InsertTables<'knesset_persons'>;
export type PositionInsert = InsertTables<'knesset_positions'>;
export type RollCallInsert = InsertTables<'knesset_roll_calls'>;
export type StanceInsert = InsertTables<'knesset_roll_call_stances'>;

/** Slugs already taken, so the importer can keep a member's URL stable. */
export async function existingPersonSlugs(): Promise<Map<string, number>> {
  const { data, error } = await supabaseAdmin
    .from('knesset_persons')
    .select('person_id, slug');
  if (error) throw new Error(`knesset_persons.slugs: ${error.message}`);
  return new Map((data ?? []).map((row) => [row.slug, row.person_id]));
}

export async function upsertPersons(rows: PersonInsert[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { error } = await supabaseAdmin
    .from('knesset_persons')
    .upsert(rows, { onConflict: 'person_id' });
  if (error) throw new Error(`knesset_persons.upsert: ${error.message}`);
  return rows.length;
}

export async function upsertPositions(rows: PositionInsert[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { error } = await supabaseAdmin
    .from('knesset_positions')
    .upsert(rows, { onConflict: 'position_row_id' });
  if (error) throw new Error(`knesset_positions.upsert: ${error.message}`);
  return rows.length;
}

/**
 * Everyone the upstream roster no longer lists as sitting stops being
 * current. Their row survives - a former member's page keeps working and
 * keeps its record - it simply leaves the roster.
 */
export async function retireMissingPersons(
  currentPersonIds: number[]
): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('knesset_persons')
    .update({ is_current: false })
    .eq('is_current', true)
    .not(
      'person_id',
      'in',
      `(${currentPersonIds.length > 0 ? currentPersonIds.join(',') : '0'})`
    )
    .select('person_id');
  if (error) throw new Error(`knesset_persons.retire: ${error.message}`);
  return data?.length ?? 0;
}

/** Same, one level down: an office that vanished upstream is no longer held. */
export async function retireMissingPositions(
  currentRowIds: number[]
): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('knesset_positions')
    .update({ is_current: false })
    .eq('is_current', true)
    .not(
      'position_row_id',
      'in',
      `(${currentRowIds.length > 0 ? currentRowIds.join(',') : '0'})`
    )
    .select('position_row_id');
  if (error) throw new Error(`knesset_positions.retire: ${error.message}`);
  return data?.length ?? 0;
}

// ---------------------------------------------------------------------------
// Roll-call record (importer side)
// ---------------------------------------------------------------------------

export async function upsertRollCalls(rows: RollCallInsert[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { error } = await supabaseAdmin
    .from('knesset_roll_calls')
    .upsert(rows, { onConflict: 'roll_call_id' });
  if (error) throw new Error(`knesset_roll_calls.upsert: ${error.message}`);
  return rows.length;
}

export async function upsertStances(rows: StanceInsert[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { error } = await supabaseAdmin
    .from('knesset_roll_call_stances')
    .upsert(rows, { onConflict: 'roll_call_id,member_key' });
  if (error) throw new Error(`knesset_roll_call_stances.upsert: ${error.message}`);
  return rows.length;
}

/** Roll-call ids that already have their member stances mirrored. */
export async function rollCallIdsWithStances(
  candidateIds: number[]
): Promise<Set<number>> {
  if (candidateIds.length === 0) return new Set();
  const { data, error } = await supabaseAdmin
    .from('knesset_roll_call_stances')
    .select('roll_call_id')
    .in('roll_call_id', candidateIds);
  if (error) throw new Error(`knesset_roll_call_stances.have: ${error.message}`);
  return new Set((data ?? []).map((row) => row.roll_call_id));
}

/**
 * The plenum items Taruu has published as national ballots.
 *
 * The roll-call importer fetches member stances for these first: they are the
 * only ones that can produce a representation figure, and a cron with a
 * per-run budget should spend it where it buys a measurement.
 */
export async function publishedItemIds(): Promise<Set<number>> {
  const { data, error } = await supabaseAdmin
    .from('knesset_items')
    .select('item_id');
  if (error) throw new Error(`knesset_items.itemIds: ${error.message}`);
  return new Set((data ?? []).map((row) => row.item_id));
}

/** Sitting members by full name, for resolving the Votes service's own ids. */
export async function personIdsByName(): Promise<Map<string, number>> {
  const { data, error } = await supabaseAdmin
    .from('knesset_persons')
    .select('person_id, full_name')
    .eq('is_current', true);
  if (error) throw new Error(`knesset_persons.byName: ${error.message}`);
  return new Map((data ?? []).map((row) => [normalizeName(row.full_name), row.person_id]));
}

/**
 * The two Knesset services spell the same person differently - one stores
 * "בנימין" and "אלון" in separate columns, the other ships "בנימין אלון" as
 * one string, and both are inconsistent about the geresh in names like
 * "אבו-ריא". Collapsing whitespace, quotes and dashes is enough to match
 * them; anything that still fails to match is left unresolved rather than
 * fuzzily attached to whoever looks closest.
 */
export function normalizeName(name: string): string {
  return name
    .replace(/[״"'׳`]/g, '')
    .replace(/[-־–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Citizen reviews (API side)
// ---------------------------------------------------------------------------

export interface MemberReviewWrite {
  personId: number;
  userId: string;
  rating: number;
  body: string | null;
}

export function upsertMemberReview(
  input: MemberReviewWrite
): ResultAsync<void, AppError> {
  const query = supabaseAdmin
    .from('knesset_member_reviews')
    .upsert(
      {
        person_id: input.personId,
        user_id: input.userId,
        rating: input.rating,
        body: input.body,
        status: 'published',
      },
      { onConflict: 'person_id,user_id' }
    )
    .then(({ error }) => {
      if (error) throw error;
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('knesset_member_reviews.upsert', cause)
  );
}

/**
 * A citizen retracting their own review. Marked `removed`, never deleted:
 * the moderation trail has to survive a retraction, and the unique constraint
 * means the same citizen re-reviewing updates this row back to published.
 */
export function retractMemberReview(
  personId: number,
  userId: string
): ResultAsync<void, AppError> {
  const query = supabaseAdmin
    .from('knesset_member_reviews')
    .update({ status: 'removed' })
    .eq('person_id', personId)
    .eq('user_id', userId)
    .then(({ error }) => {
      if (error) throw error;
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('knesset_member_reviews.retract', cause)
  );
}

export function findPersonIdBySlug(
  slug: string
): ResultAsync<number | null, AppError> {
  const query = supabaseAdmin
    .from('knesset_persons')
    .select('person_id')
    .eq('slug', slug)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return data?.person_id ?? null;
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('knesset_persons.bySlug', cause)
  );
}
