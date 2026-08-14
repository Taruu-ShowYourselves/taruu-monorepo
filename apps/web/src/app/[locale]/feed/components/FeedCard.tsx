'use client';

import { memo } from 'react';
import Link from 'next/link';
import { KNESSET_SCOPE } from '@sync/shared';
import { MunicipalityLink } from '@/components/uikit/municipality-link';
import {
  RankingMetrics,
  SourceMetrics,
} from '@/components/press/sections/DeskTopicRow';
import { topicHeadline } from '@/components/press/sections/deskData';
import type { FeedTopicItem } from '../feedData';
import { FeedBallot } from './FeedBallot';
import { useDeckStage } from './useDeckStage';
import styles from './Feed.module.css';
import { localePrefix, type Locale } from '@/lib/i18n';

interface FeedCardProps {
  anchor: string;
  item: FeedTopicItem;
  /** 1-based nationwide heat position - the same number for every reader. */
  heatRank: number;
  index: number;
  rootRef: React.RefObject<HTMLDivElement | null>;
  locale: Locale;
  recordedOptionId: string | null;
  onRecorded: (voteId: string, optionId: string) => void;
  onPosition: (index: number, stage: number) => void;
}

interface FeedCardCopy {
  deckLabels: readonly [string, string, string];
  /** The national scope's name in the card's aria label. */
  nationalScope: string;
  kickerNational: string;
  kickerLocal: string;
  standingLabel: string;
  verifiedVotes: (count: string) => string;
  noBallots: string;
  participants: (count: string) => string;
  daysLeft: (days: number) => string;
  heatBadge: (rank: number) => string;
  agendaOrdinal: (ordinal: number) => string;
  docAriaLabel: string;
  docKicker: string;
  docSummaryTitle: string;
  docLink: string;
  advanceTo: (label: string) => string;
  nextTopic: string;
  scrollToBackground: string;
  scrollToBallot: string;
  votePageLink: string;
}

const COPY: Record<Locale, FeedCardCopy> = {
  he: {
    deckLabels: ['השער', 'הרקע', 'הקלפי'],
    nationalScope: 'כנסת ישראל',
    kickerNational: 'המהדורה הארצית · KNESSET',
    kickerLocal: 'המהדורה המקומית · CIVIC',
    standingLabel: 'הספירה עכשיו',
    verifiedVotes: (count) => `${count} קולות מאומתים`,
    noBallots: 'עדיין אין קולות. הקול הראשון פתוח.',
    participants: (count) => `${count} משתתפים`,
    daysLeft: (days) => (days === 0 ? 'מסתיים היום' : `נותרו ${days} ימים`),
    heatBadge: (rank) => `#${rank} בחום`,
    agendaOrdinal: (ordinal) => `סעיף ${ordinal} בסדר היום`,
    docAriaLabel: 'תקציר המסמך הרשמי',
    docKicker: 'מה על השולחן · THE DOCUMENT',
    docSummaryTitle: 'תקציר אוטומטי מתוך המסמך הרשמי - הנוסח המחייב הוא המקור',
    docLink: 'למסמך הרשמי ↗',
    advanceTo: (label) => `המשיכו אל ${label}`,
    nextTopic: 'לנושא הבא',
    scrollToBackground: 'גללו לרקע',
    scrollToBallot: 'גללו לקלפי',
    votePageLink: 'לעמוד ההצבעה ←',
  },
  en: {
    deckLabels: ['The Front', 'The Background', 'The Ballot'],
    nationalScope: 'The Knesset',
    kickerNational: 'THE NATIONAL EDITION · KNESSET',
    kickerLocal: 'THE LOCAL EDITION · CIVIC',
    standingLabel: 'The count now',
    verifiedVotes: (count) => `${count} verified votes`,
    noBallots: 'No votes yet. The first vote is open.',
    participants: (count) => `${count} participants`,
    daysLeft: (days) => (days === 0 ? 'Ends today' : `${days} days left`),
    heatBadge: (rank) => `#${rank} by heat`,
    agendaOrdinal: (ordinal) => `Item ${ordinal} on the order of the day`,
    docAriaLabel: 'Summary of the official document',
    docKicker: 'ON THE TABLE · THE DOCUMENT',
    docSummaryTitle:
      'Automatic summary of the official document - the binding text is the original',
    docLink: 'To the official document ↗',
    advanceTo: (label) => `Continue to ${label}`,
    nextTopic: 'Next topic',
    scrollToBackground: 'Scroll to the background',
    scrollToBallot: 'Scroll to the ballot',
    votePageLink: 'To the vote page →',
  },
};

function daysRemaining(endDate: string): number {
  return Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000));
}

/**
 * One topic, pinned, deepening as the reader scrolls.
 *
 * Deck 01 is where the count stands, deck 02 is why the topic is on the table
 * and what the desk verified about it, deck 03 is the ballot. The card shell
 * never moves between them - only the deck inside it changes - so the reader
 * keeps their place in the paper while the page gets deeper.
 */
function FeedCardImpl({
  anchor,
  item,
  heatRank,
  index,
  rootRef,
  locale,
  recordedOptionId,
  onRecorded,
  onPosition,
}: FeedCardProps) {
  const t = COPY[locale];
  const { cardRef, stage, advance } = useDeckStage({ rootRef, index, onPosition });

  // `doc`, not `document` - shadowing the DOM global in a client component
  // is a lint trap waiting for the next edit.
  const { topic, ranking, agenda, document: doc, isNational, scope } = item;
  const total = topic.options.reduce((sum, option) => sum + option.votes, 0);
  const leading = topic.options[0] ?? null;
  const days = daysRemaining(topic.endDate);
  const hasBallots = total > 0;
  // Same three-grade resolution as the desks - a bill must not be called one
  // thing on the front page and another in the reader's feed.
  const headline = topicHeadline(topic, ranking);
  // Same rule as the desk tiles: every Knesset item carries identical agenda
  // boilerplate as its description, so where the ranker wrote a rationale it
  // is the background, not the boilerplate.
  const standfirst = ranking?.rationale ?? topic.description;
  // Deck 02 exists for the evidence - document, agenda slot, source and press
  // strips. With none of them it is a headline floating on a full screen, so
  // the card drops to two decks and the scroll goes front → ballot.
  const hasBackground = Boolean(doc || agenda || topic.source || ranking);
  const ballotStage = hasBackground ? 2 : 1;
  const deckCount = hasBackground ? 3 : 2;

  return (
    <article
      id={anchor}
      ref={cardRef}
      className={`${styles.card} ${hasBackground ? '' : styles.cardPair}`}
      aria-label={`${isNational ? t.nationalScope : scope} · ${headline}`}
    >
      <div className={styles.shell}>
        <div className={styles.frame} data-stage={stage}>
          {topic.artUrl ? (
            /* The desk's duotone plate, ghosted under the card - the same
               impression the tile carried, so a topic is recognisable across
               surfaces. Plain <img>: pre-optimized WebP from storage, and
               next/image optimization is unverified on the Workers runtime. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={topic.artUrl}
              alt=""
              aria-hidden
              loading="lazy"
              decoding="async"
              className={styles.cardArt}
            />
          ) : null}

          {/* --- shell chrome: present in every deck --- */}
          <header className={styles.cardHead}>
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              {isNational ? t.kickerNational : t.kickerLocal}
            </span>

            {isNational ? (
              <span className={styles.scope}>{KNESSET_SCOPE}</span>
            ) : (
              <MunicipalityLink name={scope} className={styles.scope} />
            )}
          </header>

          <div className={styles.ruleHeavy} aria-hidden />

          {/* --- deck 01 · the front --- */}
          <section
            className={styles.deck}
            data-active={stage === 0}
            aria-hidden={stage !== 0}
            inert={stage !== 0}
          >
            <span className={styles.deckNo}>01 · {t.deckLabels[0]}</span>

            <h2 className={styles.headline}>{headline}</h2>

            {hasBallots && leading ? (
              <div className={styles.standing}>
                <span className={styles.standingLabel}>{t.standingLabel}</span>
                <div className={styles.standingTop}>
                  <span className={styles.standingLead}>{leading.text}</span>
                  <span className={styles.standingPct}>{leading.pct}%</span>
                </div>
                <span className={styles.track} aria-hidden>
                  <span
                    className={styles.fill}
                    style={{ inlineSize: `${leading.pct}%` }}
                  />
                </span>
                <span className={styles.standingCount}>
                  {t.verifiedVotes(total.toLocaleString('he-IL'))}
                </span>
              </div>
            ) : (
              <p className={styles.noBallots}>{t.noBallots}</p>
            )}

            <p className={styles.meta}>
              <span>{t.participants(topic.participantCount.toLocaleString('he-IL'))}</span>
              <span aria-hidden>·</span>
              <span>{t.daysLeft(days)}</span>
              {heatRank > 0 ? (
                <>
                  <span aria-hidden>·</span>
                  <span className={styles.heat}>{t.heatBadge(heatRank)}</span>
                </>
              ) : null}
            </p>
          </section>

          {/* --- deck 02 · the background (only when there is one to show) --- */}
          {hasBackground ? (
            <section
              className={styles.deck}
              data-active={stage === 1}
              aria-hidden={stage !== 1}
              inert={stage !== 1}
            >
              <span className={styles.deckNo}>02 · {t.deckLabels[1]}</span>
  
              <h3 className={styles.deckTitle}>{headline}</h3>
  
              <p className={styles.body}>{standfirst}</p>
  
              {agenda ? (
                <p className={styles.agenda}>
                  <span aria-hidden>▍</span>
                  {[
                    agenda.ordinal !== null ? t.agendaOrdinal(agenda.ordinal) : null,
                    agenda.weekday && agenda.date
                      ? `${agenda.weekday}, ${agenda.date}`
                      : agenda.date,
                    agenda.itemType,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              ) : null}
  
              {doc ? (
                <aside className={styles.doc} aria-label={t.docAriaLabel}>
                  <span className={styles.docKicker}>{t.docKicker}</span>
                  {doc.summary ? (
                    <p
                      className={styles.docText}
                      title={t.docSummaryTitle}
                    >
                      {doc.summary}
                    </p>
                  ) : null}
                  <span className={styles.docMeta}>
                    {doc.docGroup ? <span>{doc.docGroup}</span> : null}
                    {doc.docUrl ? (
                      <a
                        href={doc.docUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.docLink}
                      >
                        {t.docLink}
                      </a>
                    ) : null}
                  </span>
                </aside>
              ) : null}
  
              {/* Both evidence strips where both exist - the reactions the AI
                  found at the source and the press the ranker verified are
                  different facts, not alternatives. The heat badge prints once,
                  on the editorial strip where the desk ranked the item. */}
              {topic.source ? (
                <SourceMetrics
                  source={topic.source}
                  heatRank={ranking ? undefined : heatRank}
                  locale={locale}
                />
              ) : null}
              {ranking ? (
                <RankingMetrics ranking={ranking} heatRank={heatRank} locale={locale} />
              ) : null}
            </section>
          ) : null}

          {/* --- last deck · the ballot --- */}
          <section
            className={styles.deck}
            data-active={stage === ballotStage}
            aria-hidden={stage !== ballotStage}
            inert={stage !== ballotStage}
          >
            <span className={styles.deckNo}>
              {`0${ballotStage + 1}`} · {t.deckLabels[2]}
            </span>

            <FeedBallot
              voteId={topic.id}
              question={headline}
              options={topic.options}
              totalVotes={total}
              locale={locale}
              anchor={anchor}
              recordedOptionId={recordedOptionId}
              onRecorded={onRecorded}
            />
          </section>

          {/* --- shell footer: the affordance and the way out --- */}
          <footer className={styles.cardFoot}>
            <button
              type="button"
              className={styles.advance}
              onClick={advance}
              aria-label={
                stage < ballotStage
                  ? t.advanceTo(t.deckLabels[hasBackground ? stage + 1 : 2])
                  : t.nextTopic
              }
            >
              <span className={styles.advanceLabel}>
                {stage >= ballotStage
                  ? t.nextTopic
                  : stage === 0 && hasBackground
                    ? t.scrollToBackground
                    : t.scrollToBallot}
              </span>
              <span aria-hidden className={styles.advanceGlyph}>
                ↓
              </span>
            </button>

            <Link href={`${localePrefix(locale)}/votes/${topic.id}`} className={styles.textLink}>
              {t.votePageLink}
            </Link>
          </footer>
        </div>
      </div>

      {/* Scroll stops: invisible, full-height, one per deck. They generate the
          card's scroll length and are what the browser snaps to. */}
      {Array.from({ length: deckCount }, (_, stop) => (
        <div
          key={stop}
          data-stop={stop}
          className={styles.stop}
          style={{ insetBlockStart: `calc(${stop} * var(--feed-h))` }}
          aria-hidden
        />
      ))}
    </article>
  );
}

/**
 * Memoised: a Realtime tally on one topic must not re-render the other 90
 * cards in the stream. Every callback prop from the reader is stable, so the
 * only cards that re-render are the ones whose own numbers moved.
 */
export const FeedCard = memo(FeedCardImpl);
