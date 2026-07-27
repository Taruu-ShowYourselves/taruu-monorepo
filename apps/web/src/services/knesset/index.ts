/**
 * Knesset day-order sync — pulls the plenum agenda (סדר יום המליאה) from the
 * official Knesset OData API and mirrors each agenda item as an active vote
 * scoped to KNESSET_SCOPE, so the civic position on it is measurable.
 *
 * Idempotent: upstream ItemID is the identity (knesset_items.item_id UNIQUE);
 * re-runs refresh sitting metadata and never duplicate ballots. Runs from
 * /api/cron/knesset-agenda.
 */

import { KNESSET_SCOPE } from '@sync/shared';
import {
  createVote,
  createVoteOptions,
  findVoteByMunicipalityAndTitle,
  getKnessetItemByItemId,
  upsertKnessetItem,
} from '@/lib/supabase/db';
import { cronLogger as log } from '@/lib/logger';
import {
  fetchRecentPlenumSessions,
  fetchSessionItems,
  parseOrdinal,
  type KnsPlenumSession,
  type KnsPlmSessionItem,
} from './odata';

// System editorial user that owns agenda-created votes (same default as the
// discovery ingest route; override with KNESSET_CREATOR_ID / INGEST_CREATOR_ID).
const DEFAULT_CREATOR_ID = '99999999-9999-4999-8999-999999999999';
const CREATOR_ID =
  process.env.KNESSET_CREATOR_ID ??
  process.env.INGEST_CREATOR_ID ??
  DEFAULT_CREATOR_ID;

const VOTE_OPTIONS = ['בעד', 'נגד', 'נמנע'];
const VOTE_DAYS = 14;
/** Sittings younger than this (or in the future) are considered current. */
const SESSION_WINDOW_DAYS = 14;
const MAX_SESSIONS_PER_RUN = 4;
const MAX_ITEMS_PER_RUN = 120;
const MIN_TITLE_LENGTH = 4;

export interface KnessetSyncResult {
  sessionsScanned: number;
  itemsSeen: number;
  created: number;
  refreshed: number;
  skippedTitleDup: number;
  errors: string[];
}

/**
 * "2026-07-13T12:00:00" (local Jerusalem time, no offset) → "13.07.2026".
 * String-sliced on purpose: parsing through Date would shift across UTC.
 */
export function formatSessionDate(startDate: string | null): string | null {
  const match = startDate?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

function describeItem(
  item: KnsPlmSessionItem,
  session: KnsPlenumSession
): string {
  const type = item.ItemTypeDesc?.trim() || 'נושא';
  const parts = [`${type} מתוך סדר היום של מליאת הכנסת`];

  const sitting: string[] = [];
  if (session.Number) sitting.push(`ישיבה מס׳ ${session.Number}`);
  const date = formatSessionDate(session.StartDate);
  if (date) sitting.push(date);
  const ordinal = parseOrdinal(item.Ordinal);
  if (ordinal) sitting.push(`סעיף ${ordinal} בסדר היום`);
  if (sitting.length > 0) parts.push(` — ${sitting.join(', ')}`);

  parts.push('. ההצבעה כאן מודדת את עמדת הרוב האזרחי: בעד, נגד או נמנע.');
  return parts.join('');
}

/**
 * Sittings worth mirroring: anything inside the recency window or scheduled
 * ahead. During recess (no recent sitting) falls back to the latest sitting
 * so the desk always reflects the most recent day order.
 */
export function selectSessions(
  sessions: KnsPlenumSession[],
  now = new Date()
): KnsPlenumSession[] {
  const cutoff = now.getTime() - SESSION_WINDOW_DAYS * 86_400_000;
  const current = sessions.filter((s) => {
    if (!s.StartDate) return false;
    return new Date(s.StartDate).getTime() >= cutoff;
  });

  const picked = current.length > 0 ? current : sessions.slice(0, 1);
  return picked.slice(0, MAX_SESSIONS_PER_RUN);
}

async function syncItem(
  item: KnsPlmSessionItem,
  session: KnsPlenumSession,
  result: KnessetSyncResult
): Promise<void> {
  const title = item.Name?.trim();
  if (!title || title.length < MIN_TITLE_LENGTH) return;

  result.itemsSeen += 1;

  const metadata = {
    item_id: item.ItemID,
    plenum_session_id: session.PlenumSessionID,
    session_date: session.StartDate ?? null,
    session_number: session.Number ?? null,
    knesset_num: session.KnessetNum ?? null,
    item_type: item.ItemTypeDesc?.trim() || null,
    ordinal: parseOrdinal(item.Ordinal),
    status_id: item.StatusID ?? null,
    is_discussion: Boolean(item.IsDiscussion),
    source_updated_at: item.LastUpdatedDate ?? null,
    fetched_at: new Date().toISOString(),
  };

  const existing = await getKnessetItemByItemId(item.ItemID);
  if (existing) {
    // Known item — sitting metadata may have shifted (reschedule, reorder).
    const updated = await upsertKnessetItem({
      ...metadata,
      vote_id: existing.vote_id,
    });
    if (updated) result.refreshed += 1;
    else result.errors.push(`refresh failed for item ${item.ItemID}`);
    return;
  }

  // The same question can reappear under a new ItemID in a later sitting —
  // don't open a second ballot for it while the first is still live.
  const titleDup = await findVoteByMunicipalityAndTitle(KNESSET_SCOPE, title);
  if (titleDup) {
    result.skippedTitleDup += 1;
    return;
  }

  const vote = await createVote({
    creator_id: CREATOR_ID,
    title,
    description: describeItem(item, session),
    municipality_id: KNESSET_SCOPE,
    // Day-order items are system-published: live immediately, no editor gate.
    status: 'active',
    end_date: new Date(Date.now() + VOTE_DAYS * 86_400_000).toISOString(),
  });
  await createVoteOptions(
    VOTE_OPTIONS.map((text) => ({ vote_id: vote.id, text }))
  );

  // The vote and its agenda link are two writes — retry the link once so a
  // transient failure doesn't leave the vote without sitting metadata.
  const linked =
    (await upsertKnessetItem({ ...metadata, vote_id: vote.id })) ??
    (await upsertKnessetItem({ ...metadata, vote_id: vote.id }));
  if (!linked) {
    // Vote exists but lost its agenda link; the title-dup guard keeps the
    // next run from duplicating it. Surface for ops.
    result.errors.push(`metadata link failed for item ${item.ItemID}`);
  }
  result.created += 1;
}

/** Pull the current day order and mirror it into votable topics. */
export async function syncKnessetAgenda(): Promise<KnessetSyncResult> {
  const result: KnessetSyncResult = {
    sessionsScanned: 0,
    itemsSeen: 0,
    created: 0,
    refreshed: 0,
    skippedTitleDup: 0,
    errors: [],
  };

  if (CREATOR_ID === DEFAULT_CREATOR_ID) {
    log.warn(
      'Knesset sync using the default desk seed user as vote creator — set KNESSET_CREATOR_ID (or INGEST_CREATOR_ID) to silence this'
    );
  }

  const sessions = selectSessions(await fetchRecentPlenumSessions());
  let budget = MAX_ITEMS_PER_RUN;

  for (const session of sessions) {
    result.sessionsScanned += 1;

    let items: KnsPlmSessionItem[];
    try {
      items = await fetchSessionItems(session.PlenumSessionID);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`session ${session.PlenumSessionID}: ${message}`);
      continue;
    }

    for (const item of items) {
      if (budget <= 0) {
        result.errors.push(
          `item budget (${MAX_ITEMS_PER_RUN}) exhausted — remainder next run`
        );
        log.warn('Knesset sync item budget exhausted', {
          session: session.PlenumSessionID,
        });
        return result;
      }
      budget -= 1;

      try {
        await syncItem(item, session, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`item ${item.ItemID}: ${message}`);
      }
    }
  }

  return result;
}
