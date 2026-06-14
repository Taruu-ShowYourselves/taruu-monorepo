'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Segmented, PressSelect, TallyBar } from '@/components/press';
import { formatCurrency, formatDate } from '@sync/shared';
import styles from './ArchiveList.module.css';

interface ResolvedVote {
  id: string;
  title: string;
  description: string;
  municipality: string;
  status: 'resolved';
  resolvedAt: string;
  result: {
    winningOption: string;
    totalVoters: number;
    yesPercentage: number;
  };
  nftStats: {
    verifiedVoters: number;
    civicPatrons: number;
    totalMinted: number;
  };
  fundsRaised: {
    totalILS: number;
    localContributions: number;
    externalContributions: number;
  };
}

type ResultFilter = 'all' | 'approved' | 'rejected';

const RESULT_FILTERS: { value: ResultFilter; label: string }[] = [
  { value: 'all', label: 'הכל' },
  { value: 'approved', label: 'אושר' },
  { value: 'rejected', label: 'נדחה' },
];

// Mock data for development
const MOCK_RESOLVED_VOTES: ResolvedVote[] = [
  {
    id: '1',
    title: 'הקמת גינה קהילתית ברחוב הרצל',
    description: 'האם לאשר תקציב של 500,000 ש"ח להקמת גינה קהילתית חדשה?',
    municipality: 'קרית טבעון',
    status: 'resolved',
    resolvedAt: '2025-01-15T10:00:00Z',
    result: {
      winningOption: 'בעד',
      totalVoters: 234,
      yesPercentage: 78,
    },
    nftStats: {
      verifiedVoters: 180,
      civicPatrons: 45,
      totalMinted: 225,
    },
    fundsRaised: {
      totalILS: 15000,
      localContributions: 10000,
      externalContributions: 5000,
    },
  },
  {
    id: '2',
    title: 'שדרוג תאורת רחובות במרכז',
    description: 'התקנת תאורת LED חסכונית בכל הרחובות המרכזיים',
    municipality: 'קרית טבעון',
    status: 'resolved',
    resolvedAt: '2025-01-10T10:00:00Z',
    result: {
      winningOption: 'בעד',
      totalVoters: 189,
      yesPercentage: 92,
    },
    nftStats: {
      verifiedVoters: 150,
      civicPatrons: 30,
      totalMinted: 180,
    },
    fundsRaised: {
      totalILS: 8500,
      localContributions: 6000,
      externalContributions: 2500,
    },
  },
  {
    id: '3',
    title: 'הרחבת מרכז הספורט העירוני',
    description: 'בניית אגף חדש למרכז הספורט הכולל בריכה וחדר כושר',
    municipality: 'קרית טבעון',
    status: 'resolved',
    resolvedAt: '2025-01-05T10:00:00Z',
    result: {
      winningOption: 'נגד',
      totalVoters: 312,
      yesPercentage: 42,
    },
    nftStats: {
      verifiedVoters: 280,
      civicPatrons: 15,
      totalMinted: 295,
    },
    fundsRaised: {
      totalILS: 12000,
      localContributions: 11000,
      externalContributions: 1000,
    },
  },
];

/** Settled-record press card — final tally, winner marked, dateline mono, muted. */
function VoteArchiveCard({ vote }: { vote: ResolvedVote }) {
  const isApproved = vote.result.winningOption === 'בעד';
  const yes = vote.result.yesPercentage;

  return (
    <article className={styles.card}>
      <header className={styles.cardHeader}>
        <span className={styles.cardKicker}>רשומה סגורה</span>
        <span className={`${styles.resultBadge} ${isApproved ? styles.approved : styles.rejected}`}>
          <span aria-hidden>{isApproved ? '✓' : '✕'}</span>
          {isApproved ? 'אושר' : 'נדחה'}
        </span>
      </header>

      <span className={styles.municipality}>{vote.municipality}</span>
      <h3 className={styles.cardTitle}>{vote.title}</h3>
      <p className={styles.cardDescription}>{vote.description}</p>

      {/* Final tally — muted, no live pulse */}
      <div className={styles.tally}>
        <div className={styles.tallyTop}>
          <span className={styles.tallyLabel}>בעד</span>
          <span className={styles.tallyPct}>{yes}%</span>
        </div>
        <TallyBar pct={yes} selected={isApproved} />
        <div className={styles.tallyBreakdown}>
          <span>נגד · {100 - yes}%</span>
          <span>{vote.result.totalVoters.toLocaleString('he-IL')} קולות מאומתים</span>
        </div>
      </div>

      {/* Record stats grid */}
      <dl className={styles.statGrid}>
        <div className={styles.statCell}>
          <dt className={styles.statKey}>מצביעים מאומתים</dt>
          <dd className={styles.statVal}>{vote.nftStats.verifiedVoters.toLocaleString('he-IL')}</dd>
        </div>
        <div className={styles.statCell}>
          <dt className={styles.statKey}>תומכים חיצוניים</dt>
          <dd className={styles.statVal}>{vote.nftStats.civicPatrons.toLocaleString('he-IL')}</dd>
        </div>
        <div className={styles.statCell}>
          <dt className={styles.statKey}>NFTs שהונפקו</dt>
          <dd className={styles.statVal}>{vote.nftStats.totalMinted.toLocaleString('he-IL')}</dd>
        </div>
      </dl>

      {/* Funds — ink block */}
      <div className={styles.funds}>
        <div className={styles.fundsHead}>
          <span className={styles.fundsKey}>כספים שנאספו</span>
          <span className={styles.fundsTotal}>{formatCurrency(vote.fundsRaised.totalILS)}</span>
        </div>
        <div className={styles.fundsBreakdown}>
          <span>מקומי · {formatCurrency(vote.fundsRaised.localContributions)}</span>
          <span className={styles.fundsSep} aria-hidden>■</span>
          <span>חיצוני · {formatCurrency(vote.fundsRaised.externalContributions)}</span>
        </div>
      </div>

      <footer className={styles.cardFooter}>
        <span className={styles.dateline}>
          הסתיים · {formatDate(new Date(vote.resolvedAt))}
        </span>
        <Link href={`/votes/${vote.id}`} className={styles.cardLink}>
          צפו ברשומה ←
        </Link>
      </footer>
    </article>
  );
}

export function ArchiveList() {
  const [votes, setVotes] = useState<ResolvedVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ResultFilter>('all');
  const [municipalityFilter, setMunicipalityFilter] = useState<string>('all');

  useEffect(() => {
    const fetchResolvedVotes = async () => {
      try {
        // Try to fetch from API
        const res = await fetch('/api/votes?status=resolved');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();

        // If empty or error, use mock data
        if (!data.votes || data.votes.length === 0) {
          setVotes(MOCK_RESOLVED_VOTES);
        } else {
          setVotes(data.votes);
        }
      } catch (err) {
        console.error('Error fetching resolved votes:', err);
        // Use mock data as fallback
        setVotes(MOCK_RESOLVED_VOTES);
      } finally {
        setLoading(false);
      }
    };

    fetchResolvedVotes();
  }, []);

  // Get unique municipalities for filter
  const municipalities = ['all', ...new Set(votes.map((v) => v.municipality))];
  const municipalityOptions = municipalities.map((m) => ({
    value: m,
    label: m === 'all' ? 'כל הרשויות' : m,
  }));

  // Apply filters
  const filteredVotes = votes.filter((vote) => {
    const resultMatch =
      filter === 'all' ||
      (filter === 'approved' && vote.result.winningOption === 'בעד') ||
      (filter === 'rejected' && vote.result.winningOption === 'נגד');

    const municipalityMatch =
      municipalityFilter === 'all' || vote.municipality === municipalityFilter;

    return resultMatch && municipalityMatch;
  });

  if (loading) {
    return (
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.grid} aria-busy="true" aria-label="טוען ארכיון">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={styles.skeletonCard}>
                <div className={styles.skeletonRow}>
                  <span className={`${styles.shimmer} ${styles.skMeta}`} />
                  <span className={`${styles.shimmer} ${styles.skBadge}`} />
                </div>
                <span className={`${styles.shimmer} ${styles.skTitle}`} />
                <span className={`${styles.shimmer} ${styles.skLine}`} />
                <span className={`${styles.shimmer} ${styles.skBar}`} />
                <span className={`${styles.shimmer} ${styles.skBlock}`} />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        {/* Filters */}
        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>תוצאה</span>
            <Segmented
              segments={RESULT_FILTERS}
              value={filter}
              onChange={setFilter}
              variant="ink"
              aria-label="סינון לפי תוצאה"
              className={styles.resultSegmented}
            />
          </div>

          <div className={styles.filterGroup}>
            <PressSelect
              label="רשות"
              options={municipalityOptions}
              value={municipalityFilter}
              onChange={(e) => setMunicipalityFilter(e.target.value)}
              className={styles.municipalitySelect}
            />
          </div>
        </div>

        {/* Results Count */}
        <p className={styles.resultsCount}>
          מציג {filteredVotes.length} רשומות סגורות
        </p>

        {/* Votes Grid */}
        {filteredVotes.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyKicker}>
              <span aria-hidden className={styles.emptyTick} />
              אין רשומות
            </span>
            <h3 className={styles.emptyTitle}>לא נמצאו הצבעות.</h3>
            <p className={styles.emptyText}>נסו לשנות את הסינון או לחפש ברשות אחרת.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {filteredVotes.map((vote) => (
              <VoteArchiveCard key={vote.id} vote={vote} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
