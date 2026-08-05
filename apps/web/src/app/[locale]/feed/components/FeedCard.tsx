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

interface FeedCardProps {
  anchor: string;
  item: FeedTopicItem;
  /** 1-based nationwide heat position - the same number for every reader. */
  heatRank: number;
  index: number;
  rootRef: React.RefObject<HTMLDivElement | null>;
  locale: string;
  recordedOptionId: string | null;
  onRecorded: (voteId: string, optionId: string) => void;
  onPosition: (index: number, stage: number) => void;
}

const DECK_LABELS = ['השער', 'הרקע', 'הקלפי'] as const;

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

  return (
    <article
      id={anchor}
      ref={cardRef}
      className={styles.card}
      aria-label={`${isNational ? 'כנסת ישראל' : scope} · ${headline}`}
    >
      <div className={styles.shell}>
        <div className={styles.frame} data-stage={stage}>
          {/* --- shell chrome: present in every deck --- */}
          <header className={styles.cardHead}>
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              {isNational ? 'המהדורה הארצית · KNESSET' : 'המהדורה המקומית · CIVIC'}
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
            <span className={styles.deckNo}>01 · {DECK_LABELS[0]}</span>

            <h2 className={styles.headline}>{headline}</h2>

            {hasBallots && leading ? (
              <div className={styles.standing}>
                <span className={styles.standingLabel}>הספירה עכשיו</span>
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
                  {total.toLocaleString('he-IL')} קולות מאומתים
                </span>
              </div>
            ) : (
              <p className={styles.noBallots}>
                עדיין אין קולות. הקול הראשון פתוח.
              </p>
            )}

            <p className={styles.meta}>
              <span>{topic.participantCount.toLocaleString('he-IL')} משתתפים</span>
              <span aria-hidden>·</span>
              <span>{days === 0 ? 'מסתיים היום' : `נותרו ${days} ימים`}</span>
              {heatRank > 0 ? (
                <>
                  <span aria-hidden>·</span>
                  <span className={styles.heat}>#{heatRank} בחום</span>
                </>
              ) : null}
            </p>
          </section>

          {/* --- deck 02 · the background --- */}
          <section
            className={styles.deck}
            data-active={stage === 1}
            aria-hidden={stage !== 1}
            inert={stage !== 1}
          >
            <span className={styles.deckNo}>02 · {DECK_LABELS[1]}</span>

            <h3 className={styles.deckTitle}>{headline}</h3>

            <p className={styles.body}>{standfirst}</p>

            {agenda ? (
              <p className={styles.agenda}>
                <span aria-hidden>▍</span>
                {[
                  agenda.ordinal !== null ? `סעיף ${agenda.ordinal} בסדר היום` : null,
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
              <aside className={styles.doc} aria-label="תקציר המסמך הרשמי">
                <span className={styles.docKicker}>מה על השולחן · THE DOCUMENT</span>
                {doc.summary ? (
                  <p
                    className={styles.docText}
                    title="תקציר אוטומטי מתוך המסמך הרשמי - הנוסח המחייב הוא המקור"
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
                      למסמך הרשמי ↗
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
              />
            ) : null}
            {ranking ? (
              <RankingMetrics ranking={ranking} heatRank={heatRank} />
            ) : null}
          </section>

          {/* --- deck 03 · the ballot --- */}
          <section
            className={styles.deck}
            data-active={stage === 2}
            aria-hidden={stage !== 2}
            inert={stage !== 2}
          >
            <span className={styles.deckNo}>03 · {DECK_LABELS[2]}</span>

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
                stage < 2 ? `המשיכו אל ${DECK_LABELS[stage + 1]}` : 'לנושא הבא'
              }
            >
              <span className={styles.advanceLabel}>
                {stage === 0
                  ? 'גללו לרקע'
                  : stage === 1
                    ? 'גללו לקלפי'
                    : 'לנושא הבא'}
              </span>
              <span aria-hidden className={styles.advanceGlyph}>
                ↓
              </span>
            </button>

            <Link href={`/${locale}/votes/${topic.id}`} className={styles.textLink}>
              לעמוד ההצבעה ←
            </Link>
          </footer>
        </div>
      </div>

      {/* Scroll stops: invisible, full-height, one per deck. They generate the
          card's scroll length and are what the browser snaps to. */}
      {[0, 1, 2].map((stop) => (
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
