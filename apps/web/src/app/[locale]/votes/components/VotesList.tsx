'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { NewsButton, VoteWidget, TallyBar } from '@/components/press';
import { MunicipalityLink } from '@/components/uikit/municipality-link';
import { useLiveTallies } from '@/hooks/useLiveTallies';
import type { VoteFilter } from './types';
import type { Locale } from '@/lib/i18n';
import { localePrefix } from '@/lib/i18n';
import styles from './VotesList.module.css';
import { KNESSET_SCOPE, WHATSAPP_FOUNDERS_LINK } from '@sync/shared';

// Number of votes revealed per "Load More" click
const PAGE_SIZE = 6;

const WHATSAPP_LINK = WHATSAPP_FOUNDERS_LINK;

interface ListCopy {
  liveKicker: string;
  votesUnit: string;
  verifiedVotes: string;
  statusActive: string;
  statusEnded: string;
  statusPending: string;
  statusCancelled: string;
  daysUnit: string;
  hoursUnit: string;
  underHour: string;
  recordClosed: string;
  recordAwaiting: string;
  viewRecord: string;
  viewDetails: string;
  loadError: string;
  loadingAria: string;
  trustNote: string;
  loadMore: string;
  emptyKicker: string;
  emptyTitle: string;
  emptyTitleFor: (municipality: string) => string;
  emptyText: string;
  ctaGlyph: string;
  ctaLabel: string;
}

const COPY: Record<Locale, ListCopy> = {
  he: {
    liveKicker: 'הצבעה חיה',
    votesUnit: 'קולות',
    verifiedVotes: 'קולות מאומתים',
    statusActive: 'פעילה',
    statusEnded: 'הסתיימה',
    statusPending: 'ממתינה',
    statusCancelled: 'בוטלה',
    daysUnit: 'ימים',
    hoursUnit: 'שעות',
    underHour: 'פחות משעה',
    recordClosed: 'רשומה סגורה',
    recordAwaiting: 'ממתינה לפתיחה',
    viewRecord: 'צפו ברשומה ←',
    viewDetails: 'לפרטים ←',
    loadError: 'לא ניתן לטעון את ההצבעות כרגע. נסו לרענן את העמוד.',
    loadingAria: 'טוען הצבעות',
    trustNote:
      'הקול שלכם נרשם פעם אחת ומשויך לתושב מאומת. אי אפשר לשנות אותו בדיעבד.',
    loadMore: 'טענו עוד הצבעות',
    emptyKicker: 'נפתחים בקרוב בכל הארץ',
    emptyTitle: 'עוד אין הצבעות פתוחות.',
    emptyTitleFor: (municipality) => `עוד אין הצבעות פתוחות ב${municipality}.`,
    emptyText:
      'ההצבעה הראשונה נפתחת 04.08.26, בכל הארץ בבת אחת. הצטרפו לוואטסאפ לעדכון ביום הפתיחה.',
    ctaGlyph: '←',
    ctaLabel: 'קבוצת המייסדים',
  },
  en: {
    liveKicker: 'Live vote',
    votesUnit: 'votes',
    verifiedVotes: 'verified votes',
    statusActive: 'Active',
    statusEnded: 'Ended',
    statusPending: 'Pending',
    statusCancelled: 'Cancelled',
    daysUnit: 'days',
    hoursUnit: 'hours',
    underHour: 'Under an hour',
    recordClosed: 'Closed record',
    recordAwaiting: 'Awaiting opening',
    viewRecord: 'View the record →',
    viewDetails: 'Details →',
    loadError: 'The votes cannot be loaded right now. Try refreshing the page.',
    loadingAria: 'Loading votes',
    trustNote:
      'Your vote is recorded once and tied to a verified resident. It cannot be changed after the fact.',
    loadMore: 'Load more votes',
    emptyKicker: 'Opening soon nationwide',
    emptyTitle: 'No open votes yet.',
    emptyTitleFor: (municipality) => `No open votes in ${municipality} yet.`,
    emptyText:
      'The first vote opens 04.08.26, nationwide at once. Join the WhatsApp group for an update on opening day.',
    ctaGlyph: '→',
    ctaLabel: "Founders' group",
  },
};

// Vote types matching API response
interface VoteOption {
  id: string;
  label: string;
  description?: string;
  voteCount: number;
}

interface Vote {
  id: string;
  title: string;
  description: string;
  municipality: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'ended';
  participantCount: number;
  endDate: string;
  options: VoteOption[];
}

function getStatusLabel(status: string, t: ListCopy): string {
  switch (status) {
    case 'active':
      return t.statusActive;
    case 'completed':
    case 'ended':
      return t.statusEnded;
    case 'pending':
      return t.statusPending;
    case 'cancelled':
      return t.statusCancelled;
    default:
      return status;
  }
}

function getTimeRemaining(endDate: string | Date, t: ListCopy): string {
  const now = new Date();
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  const diff = end.getTime() - now.getTime();

  if (diff < 0) return t.statusEnded;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days} ${t.daysUnit}`;
  if (hours > 0) return `${hours} ${t.hoursUnit}`;
  return t.underHour;
}

function isVoteEnded(status: string): boolean {
  return status === 'completed' || status === 'ended' || status === 'cancelled';
}

function matchesFilter(status: Vote['status'], filter: VoteFilter): boolean {
  switch (filter) {
    case 'active':
      return status === 'active';
    case 'ended':
      return isVoteEnded(status);
    case 'pending':
      return status === 'pending';
    case 'all':
    default:
      return true;
  }
}

/** Maps an API vote's options into the press VoteWidget option shape (with pct). */
function toWidgetOptions(vote: Vote) {
  const options = vote.options ?? [];
  const total = options.reduce((sum, o) => sum + o.voteCount, 0);
  return options.map((o) => ({
    id: o.id,
    label: o.label,
    count: o.voteCount,
    pct: total > 0 ? Math.round((o.voteCount / total) * 100) : 0,
  }));
}

/**
 * Settled-record press card for ended / pending votes - final tally, winner
 * marked, muted (no live pulse). Mirrors the archive record card.
 */
function RecordCard({ vote, locale }: { vote: Vote; locale: Locale }) {
  const t = COPY[locale];
  const options = vote.options ?? [];
  const total = options.reduce((sum, o) => sum + o.voteCount, 0);
  const leading =
    options.length > 0
      ? options.reduce((a, b) => (a.voteCount > b.voteCount ? a : b))
      : { label: '-', voteCount: 0 };
  const leadingPct = total > 0 ? Math.round((leading.voteCount / total) * 100) : 0;
  const ended = isVoteEnded(vote.status);

  return (
    <article className={styles.record}>
      <header className={styles.recordHead}>
        <span className={styles.recordKicker}>
          {ended ? t.recordClosed : t.recordAwaiting}
        </span>
        <MunicipalityLink name={vote.municipality} className={styles.recordPlace} />
      </header>

      <h3 className={styles.recordTitle}>{vote.title}</h3>
      <p className={styles.recordDesc}>{vote.description}</p>

      <div className={styles.recordTally}>
        <div className={styles.recordTallyTop}>
          <span className={styles.recordMark} aria-hidden>
            {ended ? '✓' : '■'}
          </span>
          <span className={styles.recordLead}>{leading.label}</span>
          <span className={styles.recordPct}>{leadingPct}%</span>
        </div>
        <TallyBar pct={leadingPct} selected={ended} />
        <span className={styles.recordCount}>
          {total.toLocaleString('he-IL')} {t.verifiedVotes}
        </span>
      </div>

      <footer className={styles.recordFoot}>
        <span className={styles.recordMeta}>
          {ended
            ? getStatusLabel(vote.status, t)
            : `${getStatusLabel(vote.status, t)} · ${getTimeRemaining(vote.endDate, t)}`}
        </span>
        <Link href={`${localePrefix(locale)}/votes/${vote.id}`} className={styles.recordLink}>
          {ended ? t.viewRecord : t.viewDetails}
        </Link>
      </footer>
    </article>
  );
}

interface VotesListProps {
  filter: VoteFilter;
  /** Municipality desk to show, or null for the nationwide edition. */
  municipality: string | null;
  locale?: Locale;
}

export function VotesList({ filter, municipality, locale = 'he' }: VotesListProps) {
  const t = COPY[locale];
  const [votes, setVotes] = useState<Vote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Live tallies: Supabase Realtime updates on vote_options merge over the
  // fetched snapshot so bars tick without polling.
  const liveVoteIds = useMemo(() => votes.map((v) => v.id), [votes]);
  const liveTallies = useLiveTallies(liveVoteIds);
  const liveVotes = useMemo(
    () =>
      votes.map((vote) => ({
        ...vote,
        options: (vote.options ?? []).map((option) => ({
          ...option,
          voteCount: liveTallies.get(option.id) ?? option.voteCount,
        })),
      })),
    [votes, liveTallies]
  );

  const filteredVotes = useMemo(
    () => liveVotes.filter((vote) => matchesFilter(vote.status, filter)),
    [liveVotes, filter]
  );

  const visibleVotes = filteredVotes.slice(0, visibleCount);
  const hasMore = visibleCount < filteredVotes.length;

  // Reset pagination when the filter changes or votes reload
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter, votes]);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchVotes() {
      try {
        setIsLoading(true);
        setError(null);

        const url = municipality
          ? `/api/votes?municipality=${encodeURIComponent(municipality)}`
          : '/api/votes';
        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
          throw new Error('Failed to fetch votes');
        }

        const data = await response.json();
        // This is the municipal section: Knesset-agenda topics carry the
        // national pseudo-municipality and belong on /knesset, never here.
        const municipalVotes: Vote[] = (data.votes ?? []).filter(
          (vote: Vote) => vote.municipality !== KNESSET_SCOPE
        );
        setVotes(municipalVotes);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Error fetching votes:', err);
        setVotes([]);
        setError(COPY[locale].loadError);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    fetchVotes();
    return () => controller.abort();
  }, [municipality, locale]);

  if (isLoading) {
    return (
      <section className={styles.votesList}>
        <div className={styles.container}>
          <div className={styles.grid} aria-busy="true" aria-label={t.loadingAria}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={styles.skeletonCard}>
                <div className={styles.skeletonRow}>
                  <span className={`${styles.shimmer} ${styles.skBadge}`} />
                  <span className={`${styles.shimmer} ${styles.skMeta}`} />
                </div>
                <span className={`${styles.shimmer} ${styles.skTitle}`} />
                <span className={`${styles.shimmer} ${styles.skLine}`} />
                <span className={`${styles.shimmer} ${styles.skLineShort}`} />
                <span className={`${styles.shimmer} ${styles.skBar}`} />
                <div className={styles.skeletonFooter}>
                  <span className={`${styles.shimmer} ${styles.skMeta}`} />
                  <span className={`${styles.shimmer} ${styles.skPill}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.votesList}>
      <div className={styles.container}>
        {error && (
          <div className={styles.errorBanner} role="alert">
            <span aria-hidden className={styles.bannerTick} />
            <span>{error}</span>
          </div>
        )}

        {error ? null : filteredVotes.length === 0 ? (
          <EmptyState municipality={municipality} locale={locale} />
        ) : (
          <div className={styles.grid}>
            {visibleVotes.map((vote) =>
              vote.status === 'active' ? (
                <div key={vote.id} className={styles.ballot}>
                  <VoteWidget
                    locale={locale}
                    kicker={t.liveKicker}
                    place={<MunicipalityLink name={vote.municipality} />}
                    question={vote.title}
                    options={toWidgetOptions(vote)}
                    totalLabel={`${vote.participantCount.toLocaleString('he-IL')} ${t.votesUnit}`}
                    href={`${localePrefix(locale)}/votes/${vote.id}`}
                  />
                  <p className={styles.trustNote}>{t.trustNote}</p>
                </div>
              ) : (
                <RecordCard key={vote.id} vote={vote} locale={locale} />
              )
            )}
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div className={styles.loadMore}>
            <NewsButton
              variant="outline"
              size="lg"
              onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            >
              {t.loadMore}
            </NewsButton>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Pre-launch empty state as press furniture: ink-boxed dispatch with dateline,
 * the nationwide opening moment and a WhatsApp CTA.
 */
function EmptyState({
  municipality,
  locale,
}: {
  municipality: string | null;
  locale: Locale;
}) {
  const t = COPY[locale];
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyHead}>
        <span className={styles.emptyKicker}>
          <span className={styles.emptyDot} aria-hidden />
          {t.emptyKicker}
        </span>
        <span className={styles.emptyDate}>04.08.26</span>
      </div>

      <h2 className={styles.emptyTitle}>
        {municipality ? t.emptyTitleFor(municipality) : t.emptyTitle}
      </h2>

      <p className={styles.emptyText}>{t.emptyText}</p>

      <NewsButton
        href={WHATSAPP_LINK}
        target="_blank"
        rel="noopener noreferrer"
        variant="red"
        size="lg"
        trailing={<span aria-hidden>{t.ctaGlyph}</span>}
      >
        {t.ctaLabel}
      </NewsButton>
    </div>
  );
}
