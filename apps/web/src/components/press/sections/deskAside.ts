'use client';

/**
 * Topics this reader has set aside as not being matters of consensus.
 *
 * Two layers, and the local one is authoritative for what the reader sees.
 * The device remembers immediately so the tile leaves the desk the instant the
 * gesture commits, and the desk is told afterwards over /api/topics/[id]/aside.
 * A reader who is signed out, offline, or behind a failing request still gets
 * their own edition rearranged — the signal is simply not collected, which is
 * the same outcome this module had before the endpoint existed.
 *
 * The post is deliberately fire-and-forget. Setting a topic aside is not a
 * ballot: nothing is charged, nothing is tallied, and no result depends on it,
 * so blocking the gesture on a round-trip would buy correctness nobody needs
 * at the cost of the one thing the gesture has to be, which is instant.
 */

import type { SetAsideReason } from '@sync/shared/contracts';

const STORAGE_KEY = 'taruu.desk.aside';

export const DESK_ASIDE_EVENT = 'taruu:desk-aside';

/**
 * The reason the desk sends when the reader has not been asked for one.
 *
 * The gesture is a single downward swipe, which says "not a matter of
 * consensus" and nothing more precise. The contract carries a closed list of
 * finer reasons for a UI that asks; until one does, the honest value is the
 * one the gesture actually means rather than a guess at a better one.
 */
const DEFAULT_REASON: SetAsideReason = 'not_consensus';

function read(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function write(ids: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* Storage unavailable - the set-aside lasts for this page only. */
  }
  window.dispatchEvent(new CustomEvent(DESK_ASIDE_EVENT, { detail: ids }));
}

/**
 * Tell the desk, and shrug if it does not hear.
 *
 * 401 is the ordinary case for a signed-out reader, not an error worth
 * reporting: the desk collects the signal from the people it can identify and
 * rearranges the edition for everybody.
 */
function tell(topicId: string, method: 'POST' | 'DELETE'): void {
  if (typeof fetch === 'undefined') return;
  void fetch(`/api/topics/${encodeURIComponent(topicId)}/aside`, {
    method,
    headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
    body: method === 'POST' ? JSON.stringify({ reason: DEFAULT_REASON }) : undefined,
    keepalive: true,
  }).catch(() => {
    /* Offline, signed out, or the desk is down. The reader's own copy of the
       edition has already changed, which is the part they can see. */
  });
}

export function getAsideTopics(): string[] {
  return read();
}

export function setTopicAside(topicId: string): void {
  const ids = read();
  if (ids.includes(topicId)) return;
  write([...ids, topicId]);
  tell(topicId, 'POST');
}

export function restoreTopic(topicId: string): void {
  const ids = read();
  if (!ids.includes(topicId)) return;
  write(ids.filter((id) => id !== topicId));
  tell(topicId, 'DELETE');
}
