'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { NewsButton, VoteWidget, TallyBar } from '@/components/press';
import { MunicipalityLink } from '@/components/uikit/municipality-link';
import { useLiveTallies } from '@/hooks';
import type { VoteFilter } from './types';
import styles from './VotesList.module.css';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';

// Number of votes revealed per "Load More" click
const PAGE_SIZE = 6;

const WHATSAPP_LINK = WHATSAPP_FOUNDERS_LINK;

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

function getStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'פעילה';
    case 'completed':
    case 'ended':
      return 'הסתיימה';
    case 'pending':
      return 'ממתינה';
    case 'cancelled':
      return 'בוטלה';
    default:
      return status;
  }
}

function getTimeRemaining(endDate: string | Date): string {
  const now = new Date();
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  const diff = end.getTime() - now.getTime();

  if (diff < 0) return 'הסתיימה';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days} ימים`;
  if (hours > 0) return `${hours} שעות`;
  return 'פחות משעה';
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
function RecordCard({ vote }: { vote: Vote }) {
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
          {ended ? 'רשומה סגורה' : 'ממתינה לפתיחה'}
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
          {total.toLocaleString('he-IL')} קולות מאומתים
        </span>
      </div>

      <footer className={styles.recordFoot}>
        <span className={styles.recordMeta}>
          {ended
            ? getStatusLabel(vote.status)
            : `${getStatusLabel(vote.status)} · ${getTimeRemaining(vote.endDate)}`}
        </span>
        <Link href={`/votes/${vote.id}`} className={styles.recordLink}>
          {ended ? 'צפו ברשומה ←' : 'לפרטים ←'}
        </Link>
      </footer>
    </article>
  );
}

interface VotesListProps {
  filter: VoteFilter;
}

export function VotesList({ filter }: VotesListProps) {
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
    async function fetchVotes() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/votes');

        if (!response.ok) {
          throw new Error('Failed to fetch votes');
        }

        const data = await response.json();
        setVotes(data.votes ?? []);
      } catch (err) {
        console.error('Error fetching votes:', err);
        setVotes([]);
        setError('לא ניתן לטעון את ההצבעות כרגע. נסו לרענן את העמוד.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchVotes();
  }, []);

  if (isLoading) {
    return (
      <section className={styles.votesList}>
        <div className={styles.container}>
          <div className={styles.grid} aria-busy="true" aria-label="טוען הצבעות">
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
          <EmptyState />
        ) : (
          <div className={styles.grid}>
            {visibleVotes.map((vote) =>
              vote.status === 'active' ? (
                <div key={vote.id} className={styles.ballot}>
                  <VoteWidget
                    kicker="הצבעה חיה"
                    place={<MunicipalityLink name={vote.municipality} />}
                    question={vote.title}
                    options={toWidgetOptions(vote)}
                    totalLabel={`${vote.participantCount.toLocaleString('he-IL')} קולות`}
                    href={`/votes/${vote.id}`}
                  />
                  <p className={styles.trustNote}>
                    הקול שלכם נרשם פעם אחת ומשויך לתושב מאומת. אי אפשר לשנות
                    אותו בדיעבד.
                  </p>
                </div>
              ) : (
                <RecordCard key={vote.id} vote={vote} />
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
              טענו עוד הצבעות
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
function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyHead}>
        <span className={styles.emptyKicker}>
          <span className={styles.emptyDot} aria-hidden />
          נפתחים בקרוב בכל הארץ
        </span>
        <span className={styles.emptyDate}>04.08.26</span>
      </div>

      <h2 className={styles.emptyTitle}>
        עוד אין הצבעות פתוחות.
      </h2>

      <p className={styles.emptyText}>
        ההצבעה הראשונה נפתחת 04.08.26, בכל הארץ בבת אחת. הצטרפו לוואטסאפ לעדכון ביום הפתיחה.
      </p>

      <NewsButton
        href={WHATSAPP_LINK}
        target="_blank"
        rel="noopener noreferrer"
        variant="red"
        size="lg"
        trailing={<span aria-hidden>←</span>}
      >
        קבוצת המייסדים
      </NewsButton>
    </div>
  );
}
