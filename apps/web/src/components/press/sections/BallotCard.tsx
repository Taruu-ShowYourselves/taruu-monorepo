'use client';

/* PROTOTYPE — one vote, presented as a ballot slip.
 *
 * The card answers three questions in reading order and in that order of
 * visual weight: what is being decided (the headline, the largest type), what
 * the public currently thinks (the percentages, the only other display-weight
 * type), and how I say my piece (the boxed rows — the only elements on the
 * card with a rule drawn round them).
 *
 * WHY A SLIP AND NOT THE BALANCE BAR. `standingOf()` in DeskTopicRow resolves
 * the two sides with anchored regexes (/^(בעד|for)$/) and falls back to array
 * order, so on a real three-option ballot it mislabels — on the seeded
 * ירושלים garden topic it prints "בעד חניון ציבורי" as the נגד side, and on
 * the חיפה stairs topic it drops a 26% option out of the bar entirely. A
 * per-option slip cannot lie that way: every row prints the text and the
 * number that belong together, and nothing here has to guess what an option
 * means. (The bug is untouched production code; see the note to the user.)
 *
 * WHAT A TAP DOES. It captures intent and nothing else. Guests are handed to
 * the existing VoteAuthDialog holding their position; signed-in readers are
 * handed to the existing TopicDialog, which opens ParticipationFlow at its
 * confirm step with the option preselected. Every eligibility check
 * (useVotingGate, submitParticipation) runs exactly as before — this card
 * casts nothing itself.
 */

import { useId } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks';
import type { Locale } from '@/lib/i18n';
import type { DeskEntry } from './TopicDialog';
import type { DeskOption, DeskTopic } from './DeskTopicRow';
import { topicHeadline } from './deskData';
import desk from './ConsensusDesk.module.css';
import styles from './BallotCard.module.css';

/** Closed topics report -1 rather than 0 — same reading as the desk's tiles. */
function daysRemaining(endDate: string): number {
  const at = new Date(endDate).getTime();
  if (!Number.isFinite(at)) return -1;
  const ms = at - Date.now();
  if (ms <= 0) return -1;
  return Math.ceil(ms / 86_400_000);
}

const he = (n: number) => n.toLocaleString('he-IL');

/**
 * Rows printed before the card sends the reader to the full ballot.
 *
 * A row is ~56px, so an unbounded slip lets one seven-option topic set the
 * height of all three cards in the grid.
 */
const ROWS_SHOWN = 4;

interface CardCopy {
  slipLabel: string;
  tally: (n: string) => string;
  opening: string;
  participants: (n: string) => string;
  daysLeft: (n: number) => string;
  closed: string;
  recorded: string;
  yours: string;
  castHint: string;
  moreOptions: (n: number) => string;
  readMore: string;
  arrow: string;
}

const COPY: Record<Locale, CardCopy> = {
  he: {
    slipLabel: 'הקול שלכם',
    tally: (n) => `${n} קולות נספרו`,
    opening: 'עוד לא הצביעו. הקול הראשון קובע את הכיוון.',
    participants: (n) => `${n} משתתפים`,
    daysLeft: (n) => `נותרו ${n} ימים`,
    closed: 'ההצבעה נסגרה',
    recorded: 'הצבעתכם נרשמה ונספרה',
    yours: 'הקול שלכם',
    /* The only instruction on the card, and it names the act rather than a
       mechanism - there is no gesture left to teach. */
    castHint: 'בחרו כדי להצביע',
    moreOptions: (n) => `+${n} אפשרויות נוספות`,
    readMore: 'לנושא המלא',
    arrow: '←',
  },
  en: {
    slipLabel: 'Your vote',
    tally: (n) => `${n} votes counted`,
    opening: 'No votes yet. The first one sets the direction.',
    participants: (n) => `${n} participants`,
    daysLeft: (n) => `${n} days left`,
    closed: 'Voting has closed',
    recorded: 'Your vote has been recorded and counted',
    yours: 'Your vote',
    castHint: 'Choose to vote',
    moreOptions: (n) => `+${n} more options`,
    readMore: 'The full topic',
    arrow: '→',
  },
};

interface BallotCardProps {
  entry: DeskEntry;
  /** 1-based position in the lane — printed as the slug number. */
  index: number;
  /** The option this reader already recorded, if any. */
  myOptionId?: string | null;
  /** A tap on a row: the reader's intent, handed on to the secure flow. */
  onCast: (topic: DeskTopic, option: DeskOption) => void;
  /** Opening the whole topic — the headline and the footer link. */
  onOpen: (topic: DeskTopic) => void;
  locale: Locale;
}

export function BallotCard({
  entry,
  index,
  myOptionId = null,
  onCast,
  onOpen,
  locale,
}: BallotCardProps) {
  const t = COPY[locale];
  const reduced = useReducedMotion();
  const headlineId = useId();
  const slipId = useId();

  const { topic, ranking } = entry;
  const headline = topicHeadline(topic, ranking);
  const days = daysRemaining(topic.endDate);
  const isOpen = days >= 0;
  const recorded = myOptionId != null;

  const total = topic.options.reduce((sum, o) => sum + o.votes, 0);
  /* The ballot's own order, never sorted by share: re-ordering a live ballot
     by who is winning is a thumb on the scale, and it would make the rows
     jump under the reader's thumb the moment they voted. `toDeskTopic` has
     already sorted by votes, so the leader is marked instead of moved. */
  const rows = topic.options.slice(0, ROWS_SHOWN);
  const hidden = topic.options.length - rows.length;
  const leadPct = Math.max(...topic.options.map((o) => o.pct), 0);

  /* The plain-language line. The ranker's rationale says what a bill actually
     does, which is the thing a reader needs before they can mean their vote;
     municipal topics were written as prose already. Nothing is invented - the
     card prints one or the other, or neither. */
  const standfirst = ranking?.rationale?.trim() || topic.description?.trim() || '';

  return (
    <article className={styles.card} aria-labelledby={headlineId}>
      <p className={styles.slug}>
        <span className={styles.slugNo}>{String(index).padStart(2, '0')}</span>
        <span className={styles.slugRule} aria-hidden />
        <span className={desk.topicMuni}>{entry.municipality}</span>
      </p>

      {topic.titleParts?.kicker ? (
        <p className={styles.billKicker}>{topic.titleParts.kicker}</p>
      ) : null}

      <h3 id={headlineId} className={styles.question}>
        <button
          type="button"
          className={styles.questionLink}
          onClick={() => onOpen(topic)}
        >
          {headline}
        </button>
      </h3>

      {standfirst ? <p className={styles.standfirst}>{standfirst}</p> : null}

      <div className={styles.slipHead}>
        <span className={styles.slipLabel} id={slipId}>
          {isOpen && !recorded ? t.castHint : t.slipLabel}
        </span>
        <span className={styles.tally}>
          {total > 0 ? t.tally(he(total)) : t.opening}
        </span>
      </div>

      <ul className={styles.slip} aria-labelledby={slipId}>
        {rows.map((option) => {
          const mine = option.id === myOptionId;
          /* A recorded or closed ballot is a readout, not a control: the row
             stops being a button entirely rather than looking like one that
             does nothing. */
          const interactive = isOpen && !recorded;
          const inner = (
            <>
              <span className={styles.rowTop}>
                <span className={styles.mark} aria-hidden>
                  {mine ? '■' : '□'}
                </span>
                <span className={styles.label}>{option.text}</span>
                {mine ? <span className={styles.you}>{t.yours}</span> : null}
                <span
                  className={option.pct === leadPct ? styles.pctLead : styles.pct}
                  dir="ltr"
                >
                  {option.pct}%
                </span>
              </span>
              <span className={styles.track} aria-hidden>
                <motion.span
                  className={mine ? styles.fillMine : styles.fill}
                  initial={reduced ? false : { width: 0 }}
                  animate={{ width: `${option.pct}%` }}
                  transition={{ duration: reduced ? 0 : 0.7, ease: [0.2, 0, 0, 1] }}
                />
              </span>
            </>
          );

          return (
            <li key={option.id}>
              {interactive ? (
                <button
                  type="button"
                  className={styles.row}
                  onClick={() => onCast(topic, option)}
                >
                  {inner}
                </button>
              ) : (
                <span className={mine ? styles.rowMine : styles.rowStatic}>
                  {inner}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {hidden > 0 ? (
        <button
          type="button"
          className={styles.more}
          onClick={() => onOpen(topic)}
        >
          {t.moreOptions(hidden)}
        </button>
      ) : null}

      {recorded ? (
        <p className={styles.recorded} role="status">
          <span aria-hidden>✓ </span>
          {t.recorded}
        </p>
      ) : null}

      <p className={styles.meta}>
        <span>{t.participants(he(topic.participantCount))}</span>
        <span aria-hidden className={styles.metaDot}>
          ·
        </span>
        <span>{isOpen ? t.daysLeft(days) : t.closed}</span>
      </p>

      <button type="button" className={styles.readMore} onClick={() => onOpen(topic)}>
        {t.readMore} <span aria-hidden>{t.arrow}</span>
      </button>
    </article>
  );
}
