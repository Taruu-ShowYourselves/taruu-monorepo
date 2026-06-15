'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { NewsButton, VoteWidget, TallyBar } from '@/components/press';
import type { VoteFilter } from './types';
import styles from './VotesList.module.css';

// Number of votes revealed per "Load More" click
const PAGE_SIZE = 6;

const WHATSAPP_LINK = 'https://chat.whatsapp.com/FITvea9IVsn2Ljie1yCrAc';

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

// Fallback mock data for development/error states
const mockVotes: Vote[] = [
  {
    id: '1',
    title: 'שדרוג גינת השכונה ברחוב הרצל',
    description:
      'הצבעה על תוכנית לשדרוג הגינה המרכזית כולל התקנת משחקי ילדים חדשים, ספסלים ותאורה.',
    municipality: 'תל אביב-יפו',
    status: 'active',
    participantCount: 1247,
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    options: [
      { id: '1', label: 'בעד', voteCount: 892 },
      { id: '2', label: 'נגד', voteCount: 355 },
    ],
  },
  {
    id: '2',
    title: 'הקמת מרכז קהילתי חדש',
    description:
      'האם לאשר את בניית מרכז קהילתי חדש באזור הצפוני של העיר?',
    municipality: 'ראשון לציון',
    status: 'active',
    participantCount: 3521,
    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    options: [
      { id: '1', label: 'בעד', voteCount: 2105 },
      { id: '2', label: 'נגד', voteCount: 1416 },
    ],
  },
  {
    id: '3',
    title: 'שינוי תדירות איסוף אשפה',
    description:
      'הצעה להגדלת תדירות איסוף האשפה משלוש פעמים בשבוע לחמש.',
    municipality: 'חיפה',
    status: 'completed',
    participantCount: 8934,
    endDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    options: [
      { id: '1', label: 'בעד', voteCount: 6721 },
      { id: '2', label: 'נגד', voteCount: 2213 },
    ],
  },
  {
    id: '4',
    title: 'הוספת נתיבי אופניים חדשים',
    description:
      'תוכנית להוספת 15 ק"מ של נתיבי אופניים מוגנים ברחבי העיר.',
    municipality: 'ירושלים',
    status: 'active',
    participantCount: 2156,
    endDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    options: [
      { id: '1', label: 'בעד', voteCount: 1823 },
      { id: '2', label: 'נגד', voteCount: 333 },
    ],
  },
];

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
  const total = vote.options.reduce((sum, o) => sum + o.voteCount, 0);
  return vote.options.map((o) => ({
    id: o.id,
    label: o.label,
    count: o.voteCount,
    pct: total > 0 ? Math.round((o.voteCount / total) * 100) : 0,
  }));
}

/**
 * Settled-record press card for ended / pending votes — final tally, winner
 * marked, muted (no live pulse). Mirrors the archive record card.
 */
function RecordCard({ vote }: { vote: Vote }) {
  const total = vote.options.reduce((sum, o) => sum + o.voteCount, 0);
  const leading = vote.options.reduce((a, b) => (a.voteCount > b.voteCount ? a : b));
  const leadingPct = total > 0 ? Math.round((leading.voteCount / total) * 100) : 0;
  const ended = isVoteEnded(vote.status);

  return (
    <article className={styles.record}>
      <header className={styles.recordHead}>
        <span className={styles.recordKicker}>
          {ended ? 'רשומה סגורה' : 'ממתינה לפתיחה'}
        </span>
        <span className={styles.recordPlace}>{vote.municipality}</span>
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
  const [isUsingMockData, setIsUsingMockData] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filteredVotes = useMemo(
    () => votes.filter((vote) => matchesFilter(vote.status, filter)),
    [votes, filter]
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

        if (data.votes && data.votes.length > 0) {
          setVotes(data.votes);
          setIsUsingMockData(false);
        } else {
          // Use mock data if no votes in database yet
          setVotes(mockVotes);
          setIsUsingMockData(true);
        }
      } catch (err) {
        console.error('Error fetching votes:', err);
        // Fall back to mock data on error
        setVotes(mockVotes);
        setIsUsingMockData(true);
        setError('לא ניתן לטעון את ההצבעות. מציג נתוני הדגמה.');
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

        {isUsingMockData && !error && (
          <div className={styles.demoBanner}>
            <span className={styles.demoDot} aria-hidden />
            <span>מציג נתוני הדגמה — הצבעות אמיתיות יופיעו בקרוב</span>
          </div>
        )}

        {filteredVotes.length === 0 ? (
          <EmptyState />
        ) : (
          <div className={styles.grid}>
            {visibleVotes.map((vote) =>
              vote.status === 'active' ? (
                <div key={vote.id} className={styles.ballot}>
                  <VoteWidget
                    kicker="הצבעה חיה"
                    place={vote.municipality}
                    question={vote.title}
                    options={toWidgetOptions(vote)}
                    totalLabel={`${vote.participantCount.toLocaleString('he-IL')} קולות`}
                    href={`/votes/${vote.id}`}
                  />
                  <p className={styles.trustNote}>
                    הקול שלכם ייחתם בבלוקצ׳יין — בלתי ניתן לשינוי.
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
 * the real pilot moment (first vote in Kiryat Tivon) and a WhatsApp CTA.
 */
function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyHead}>
        <span className={styles.emptyKicker}>
          <span className={styles.emptyDot} aria-hidden />
          הפיילוט נפתח בקרוב
        </span>
        <span className={styles.emptyDate}>23.01.26</span>
      </div>

      <h2 className={styles.emptyTitle}>
        עוד אין הצבעות פתוחות בקריית טבעון.
      </h2>

      <p className={styles.emptyText}>
        ההצבעה הראשונה נפתחת 23.01.26 — הצטרפו לוואטסאפ ותהיו הראשונים.
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
