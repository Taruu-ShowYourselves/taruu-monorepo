/**
 * What a shared tile says when it lands somewhere else.
 *
 * A link on its own arrives in a WhatsApp group as a bare URL, and whoever
 * opens it has no idea what they are being asked or why their tap will not
 * count. So the share carries the tile's own reading: the ballot's name, whose
 * ballot it is, where the standing sits right now, and the one condition that
 * decides whether the person receiving it can answer at all - only a verified
 * citizen votes.
 *
 * The figures are stamped at the moment of sharing rather than promised as
 * live. A message is a snapshot: it cannot update itself, and printing a
 * standing as though it were current three days later would be the share
 * lying on the desk's behalf. Anyone who wants the live count follows the link.
 *
 * Pure on purpose - the button is a client island, but what it says is worth
 * asserting in a test rather than reading off a screenshot.
 */

import type { Locale } from '@/lib/i18n';

export interface ShareTopicFacts {
  /** The headline as the tile printed it. */
  headline: string;
  /** Municipality, or the national body for a Knesset item. */
  authority: string;
  forPct: number;
  againstPct: number;
  /** Ballots counted so far. */
  ballots: number;
  participants: number;
  /** Days left, or a negative number once the ballot has closed. */
  daysLeft: number;
  url: string;
}

export interface ShareTopicPayload {
  title: string;
  text: string;
  url: string;
}

const COPY = {
  he: {
    standing: (f: number, a: number) => `עמדת הרוב: ${f}% בעד · ${a}% נגד`,
    counted: (n: string) => `${n} קולות נספרו`,
    opening: 'טרם נספרו קולות - הקול הראשון קובע את הכיוון',
    participants: (n: string) => `${n} משתתפים`,
    closed: 'ההצבעה נסגרה',
    today: 'מסתיים היום',
    days: (n: number) => `נותרו ${n} ימים`,
    verified: 'להצבעה נדרשת הזדהות כאזרח מאומת.',
  },
  en: {
    standing: (f: number, a: number) => `The majority's standing: ${f}% for · ${a}% against`,
    counted: (n: string) => `${n} voices counted`,
    opening: 'No voices counted yet - the first one sets the direction',
    participants: (n: string) => `${n} participants`,
    closed: 'Voting closed',
    today: 'Ends today',
    days: (n: number) => `${n} days left`,
    verified: 'Voting requires signing in as a verified citizen.',
  },
} as const;

function deadline(days: number, t: (typeof COPY)['he' | 'en']): string {
  if (days < 0) return t.closed;
  if (days === 1) return t.today;
  return t.days(days);
}

/**
 * The message body. The headline leads because that is what a reader scans
 * first in a forwarded message, and the verification line closes because it is
 * the thing they need to know before they tap.
 */
export function shareTopicPayload(
  facts: ShareTopicFacts,
  locale: Locale
): ShareTopicPayload {
  const t = COPY[locale];
  const n = (value: number) => value.toLocaleString(locale === 'he' ? 'he-IL' : 'en-US');

  const lines = [
    facts.headline,
    `${facts.authority} · ${deadline(facts.daysLeft, t)}`,
    t.standing(facts.forPct, facts.againstPct),
    facts.ballots > 0 ? t.counted(n(facts.ballots)) : t.opening,
    t.participants(n(facts.participants)),
    t.verified,
  ];

  return { title: facts.headline, text: lines.join('\n'), url: facts.url };
}

/** What goes on the clipboard where the platform has no share sheet. */
export function shareTopicClipboard(payload: ShareTopicPayload): string {
  return `${payload.text}\n${payload.url}`;
}
