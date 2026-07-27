import type { KnessetItem } from '@/lib/supabase/types';
import type { DeskTopic } from './DeskTopicRow';
import { toDeskTopic, type VoteWithRelations } from './deskData';

/** One day-order entry: the ballot plus its place in the sitting. */
export interface AgendaRow {
  topic: DeskTopic;
  ordinal: number | null;
  itemType: string | null;
  isDiscussion: boolean;
}

/** One plenum sitting with its ordered day-order entries. */
export interface AgendaSession {
  plenumSessionId: number;
  /** Local Jerusalem ISO datetime as reported by the Knesset API. */
  sessionDate: string | null;
  sessionNumber: number | null;
  knessetNum: number | null;
  rows: AgendaRow[];
}

export interface KnessetAgenda {
  /** Sittings, newest first; rows ordered by their day-order ordinal. */
  sessions: AgendaSession[];
  /** National topics without agenda metadata (e.g. discovery-found), by heat. */
  extras: DeskTopic[];
}

/**
 * "2026-07-13T12:00:00" (local Jerusalem time, no offset) → "13.07.2026".
 * String-sliced on purpose: parsing through Date would shift across UTC.
 */
export function formatAgendaDate(sessionDate: string | null): string | null {
  const match = sessionDate?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

/** Hebrew weekday for a session date ("יום שני"), or null. */
export function weekdayOf(sessionDate: string | null): string | null {
  const match = sessionDate?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  // Anchor at UTC noon so the calendar day never shifts with the runtime TZ.
  const day = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
  );
  return new Intl.DateTimeFormat('he-IL', { weekday: 'long' }).format(day);
}

/** Group national votes into sittings by their day-order metadata. */
export function buildKnessetAgenda(
  votes: VoteWithRelations[],
  items: KnessetItem[]
): KnessetAgenda {
  const itemByVote = new Map(items.map((item) => [item.vote_id, item]));
  const sessionById = new Map<number, AgendaSession>();
  const extras: DeskTopic[] = [];

  for (const vote of votes) {
    const topic = toDeskTopic(vote);
    const item = itemByVote.get(vote.id);

    if (!item) {
      extras.push(topic);
      continue;
    }

    let session = sessionById.get(item.plenum_session_id);
    if (!session) {
      session = {
        plenumSessionId: item.plenum_session_id,
        sessionDate: item.session_date,
        sessionNumber: item.session_number,
        knessetNum: item.knesset_num,
        rows: [],
      };
      sessionById.set(item.plenum_session_id, session);
    }

    session.rows.push({
      topic,
      ordinal: item.ordinal,
      itemType: item.item_type,
      isDiscussion: item.is_discussion,
    });
  }

  const sessions = [...sessionById.values()].sort((a, b) =>
    (b.sessionDate ?? '').localeCompare(a.sessionDate ?? '')
  );
  for (const session of sessions) {
    session.rows.sort(
      (a, b) =>
        (a.ordinal ?? Number.MAX_SAFE_INTEGER) -
        (b.ordinal ?? Number.MAX_SAFE_INTEGER)
    );
  }
  extras.sort((a, b) => (b.source?.hotness ?? 0) - (a.source?.hotness ?? 0));

  return { sessions, extras };
}
