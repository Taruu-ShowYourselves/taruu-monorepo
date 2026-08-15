'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { NewsButton } from '@/components/press/NewsButton';
import { useLiveTallies } from '@/hooks/useLiveTallies';
import { useAuth } from '@/providers/AuthProvider';
import { getStoredMunicipality, LOCALITY_EVENT } from '@/lib/locality';
import { orderFeed, withPrompts, type WithPrompts } from '@/lib/feed/order';
import type { FeedTopicItem } from '../feedData';
import { FeedCard } from './FeedCard';
import { SuggestCard } from './SuggestCard';
import { EndCard } from './EndCard';
import styles from './Feed.module.css';
import { localePath, localePrefix, type Locale } from '@/lib/i18n';

interface FeedReaderProps {
  items: FeedTopicItem[];
  locale: Locale;
}

interface FeedReaderCopy {
  wordmark: string;
  progressLabel: string;
  emptyKicker: string;
  emptyTitle: string;
  emptyTitleRed: string;
  emptyText: string;
  emptyCta: string;
  allVotesLink: string;
  /** Direction-semantic CTA glyph: mirrored between RTL and LTR. */
  arrow: string;
}

const COPY: Record<Locale, FeedReaderCopy> = {
  he: {
    wordmark: 'תַּרְאוּ',
    progressLabel: 'התקדמות במהדורה',
    emptyKicker: 'המהדורה שלי · MY EDITION',
    emptyTitle: 'אין נושאים פתוחים',
    emptyTitleRed: 'כרגע.',
    emptyText:
      'ברגע שייפתח נושא ברשות שלכם או על שולחן הכנסת, הוא יופיע כאן ראשון. בינתיים אפשר לעלות נושא משלכם.',
    emptyCta: 'העלו נושא',
    allVotesLink: 'לכל ההצבעות ←',
    arrow: '←',
  },
  en: {
    wordmark: 'Taruu',
    progressLabel: 'Progress through the edition',
    emptyKicker: 'MY EDITION · THE FEED',
    emptyTitle: 'No topics are open',
    emptyTitleRed: 'right now.',
    emptyText:
      "The moment a topic opens in your municipality or on the Knesset's table, it will appear here first. In the meantime, you can raise one of your own.",
    emptyCta: 'Raise a topic',
    allVotesLink: 'All votes →',
    arrow: '→',
  },
};

/** Anchor id for a topic card - also the return target after an auth detour. */
export function cardAnchor(voteId: string): string {
  return `v-${voteId}`;
}

/**
 * Recompute option percentages after live tallies land over the snapshot.
 *
 * Returns the SAME object when nothing moved. One ballot anywhere in the
 * country pushes a Realtime update to every reader; without this the whole
 * stream would be rebuilt, re-sorted and re-rendered on each one.
 */
function withLiveTallies(
  item: FeedTopicItem,
  tallies: ReadonlyMap<string, number>
): FeedTopicItem {
  let moved = false;
  const counted = item.topic.options.map((option) => {
    const votes = tallies.get(option.id);
    if (votes === undefined || votes === option.votes) return option;
    moved = true;
    return { ...option, votes };
  });
  if (!moved) return item;

  const total = counted.reduce((sum, option) => sum + option.votes, 0);

  return {
    ...item,
    topic: {
      ...item.topic,
      options: counted
        .map((option) => ({
          ...option,
          pct: total > 0 ? Math.round((option.votes / total) * 100) : 0,
        }))
        .sort((a, b) => b.votes - a.votes),
    },
  };
}

/**
 * FeedReader - the reader's edition as a vertical stack of full-screen cards.
 *
 * Scrolling is the whole interface: each topic occupies three snap stops -
 * the front (headline + where the count stands), the background (why it is on
 * the table, with its evidence), and the ballot. The card itself stays pinned
 * while those three scroll past it, so one topic reads as one deepening page
 * rather than three disconnected screens.
 *
 * `data-lenis-prevent` hands this container's wheel/touch back to the browser:
 * the site-wide smooth-scroll would otherwise fight CSS scroll snapping.
 */
export function FeedReader({ items, locale }: FeedReaderProps) {
  const t = COPY[locale];
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { isAuthenticated, isLoading } = useAuth();

  const [home, setHome] = useState<string | null>(null);
  const [position, setPosition] = useState({ index: 0, stage: 0 });
  /** voteId → the option id the server has on record for this reader. */
  const [recorded, setRecorded] = useState<Map<string, string>>(new Map());

  // The device's stored locality decides the order; GeoGate can change it
  // mid-session, so the stream re-orders live.
  useEffect(() => {
    const apply = () => setHome(getStoredMunicipality());
    apply();
    window.addEventListener(LOCALITY_EVENT, apply);
    return () => window.removeEventListener(LOCALITY_EVENT, apply);
  }, []);

  const voteIds = useMemo(() => items.map((item) => item.id), [items]);
  const tallies = useLiveTallies(voteIds);

  const liveItems = useMemo(() => {
    let moved = false;
    const next = items.map((item) => {
      const updated = withLiveTallies(item, tallies);
      if (updated !== item) moved = true;
      return updated;
    });
    return moved ? next : items;
  }, [items, tallies]);

  const cards: WithPrompts<FeedTopicItem>[] = useMemo(
    () => withPrompts(orderFeed(liveItems, home)),
    [liveItems, home]
  );

  const topicCount = liveItems.length;

  // Ballots already on record: the ballot deck must show what the server
  // holds, never an empty form the reader could believe is still open to them.
  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      setRecorded(new Map());
      return;
    }
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch('/api/user/participations', {
          credentials: 'same-origin',
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          participations?: { voteId?: string; optionId?: string }[];
        };
        if (cancelled) return;
        const next = new Map<string, string>();
        for (const row of payload.participations ?? []) {
          if (row.voteId && row.optionId) next.set(row.voteId, row.optionId);
        }
        setRecorded(next);
      } catch {
        /* history is an enhancement here - the ballot still gates server-side */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading]);

  const markRecorded = useCallback((voteId: string, optionId: string) => {
    setRecorded((prev) => new Map(prev).set(voteId, optionId));
  }, []);

  const handlePosition = useCallback((index: number, stage: number) => {
    setPosition((prev) =>
      prev.index === index && prev.stage === stage ? prev : { index, stage }
    );
  }, []);

  /** `undefined` until read; then the card to return to, or null for the top. */
  const anchorRef = useRef<string | null | undefined>(undefined);

  // Locality arrives after hydration, and re-ordering inserts cards above the
  // reader - which browser scroll anchoring would silently compensate for,
  // stranding them mid-edition. Re-seat the stream every time the order can
  // change: on the card they came back to (#v-<id> after a sign-in detour),
  // otherwise at the top of their own edition.
  useEffect(() => {
    const stream = rootRef.current;
    if (!stream) return;
    if (anchorRef.current === undefined) {
      anchorRef.current = window.location.hash.slice(1) || null;
    }
    const target = anchorRef.current
      ? document.getElementById(anchorRef.current)
      : null;

    if (target) target.scrollIntoView({ block: 'start', behavior: 'auto' });
    else stream.scrollTo({ top: 0, behavior: 'auto' });
  }, [home]);

  // Once the reader takes over, stop re-seating them on the return anchor.
  useEffect(() => {
    const stream = rootRef.current;
    if (!stream) return;
    const release = () => {
      anchorRef.current = null;
    };
    stream.addEventListener('wheel', release, { once: true, passive: true });
    stream.addEventListener('touchstart', release, { once: true, passive: true });
    return () => {
      stream.removeEventListener('wheel', release);
      stream.removeEventListener('touchstart', release);
    };
  }, []);

  // Running topic count per card index, so prompt/end cards keep reporting
  // the last topic the reader actually passed instead of resetting the rail.
  const topicNoByIndex = useMemo(() => {
    const byIndex = new Map<number, number>();
    let passed = 0;
    cards.forEach((card, index) => {
      if (card.kind === 'topic') passed += 1;
      byIndex.set(index, passed);
    });
    return byIndex;
  }, [cards]);

  const activeTopicNo = topicNoByIndex.get(position.index) ?? 0;

  return (
    <div className={`np-page ${styles.page}`}>
      <header className={styles.bar}>
        <Link href={localePath(locale)} className={styles.wordmark}>
          {t.wordmark}
        </Link>

        <span className={styles.barCount}>
          {topicCount === 0
            ? '00'
            : `${String(Math.max(activeTopicNo, 1)).padStart(2, '0')} / ${String(topicCount).padStart(2, '0')}`}
        </span>

        {/* Inside the bar: the rail rides its bottom rule, and `.bar` is the
            positioned ancestor it measures against. */}
        <div
          className={styles.progress}
          role="progressbar"
          aria-label={t.progressLabel}
          aria-valuemin={0}
          aria-valuemax={Math.max(topicCount, 1)}
          aria-valuenow={Math.max(activeTopicNo, 0)}
        >
          <span
            className={styles.progressFill}
            style={{
              inlineSize:
                topicCount > 0 ? `${(activeTopicNo / topicCount) * 100}%` : '0%',
            }}
          />
        </div>
      </header>

      {topicCount === 0 ? (
        <EmptyEdition locale={locale} />
      ) : (
        <div className={styles.stream} ref={rootRef} data-lenis-prevent tabIndex={-1}>
          {cards.map((card, index) => {
            if (card.kind === 'topic') {
              return (
                <FeedCard
                  key={card.key}
                  anchor={cardAnchor(card.item.id)}
                  item={card.item}
                  heatRank={card.heatRank}
                  index={index}
                  rootRef={rootRef}
                  locale={locale}
                  recordedOptionId={recorded.get(card.item.id) ?? null}
                  onRecorded={markRecorded}
                  onPosition={handlePosition}
                />
              );
            }

            if (card.kind === 'prompt') {
              return (
                <SuggestCard
                  key={card.key}
                  index={index}
                  rootRef={rootRef}
                  locale={locale}
                  home={home}
                  isAuthenticated={isAuthenticated}
                  onPosition={handlePosition}
                />
              );
            }

            return (
              <EndCard
                key={card.key}
                index={index}
                rootRef={rootRef}
                locale={locale}
                onPosition={handlePosition}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/** No open ballots anywhere - the pre-launch edition. */
function EmptyEdition({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  return (
    <div className={styles.empty}>
      <span className={styles.kicker}>
        <span aria-hidden className={styles.kickerTick} />
        {t.emptyKicker}
      </span>
      <h1 className={styles.emptyTitle}>
        {t.emptyTitle} <span className={styles.red}>{t.emptyTitleRed}</span>
      </h1>
      <p className={styles.emptyText}>{t.emptyText}</p>
      <div className={styles.emptyActions}>
        <NewsButton
          href={`${localePrefix(locale)}/votes/create`}
          variant="red"
          size="lg"
          trailing={<span aria-hidden>{t.arrow}</span>}
        >
          {t.emptyCta}
        </NewsButton>
        <Link href={`${localePrefix(locale)}/votes`} className={styles.textLink}>
          {t.allVotesLink}
        </Link>
      </div>
    </div>
  );
}
