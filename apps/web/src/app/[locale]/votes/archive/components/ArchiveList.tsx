'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PressSelect } from '@/components/press';
import { MunicipalityLink } from '@/components/uikit/municipality-link';
import { formatDate } from '@sync/shared';
import styles from './ArchiveList.module.css';

interface EndedVote {
  id: string;
  title: string;
  description: string;
  municipality: string;
  status: string;
  participantCount: number;
  endDate: string;
}

/** Settled-record press card - dateline mono, muted; the tally lives on the record page. */
function VoteArchiveCard({ vote }: { vote: EndedVote }) {
  return (
    <article className={styles.card}>
      <header className={styles.cardHeader}>
        <span className={styles.cardKicker}>רשומה סגורה</span>
        <span className={styles.dateline}>
          הסתיים · {formatDate(new Date(vote.endDate))}
        </span>
      </header>

      <MunicipalityLink name={vote.municipality} className={styles.municipality} />
      <h3 className={styles.cardTitle}>{vote.title}</h3>
      <p className={styles.cardDescription}>{vote.description}</p>

      <footer className={styles.cardFooter}>
        <span className={styles.dateline}>
          {vote.participantCount.toLocaleString('he-IL')} קולות מאומתים
        </span>
        <Link href={`/votes/${vote.id}`} className={styles.cardLink}>
          צפו ברשומה ←
        </Link>
      </footer>
    </article>
  );
}

export function ArchiveList() {
  const [votes, setVotes] = useState<EndedVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [municipalityFilter, setMunicipalityFilter] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    const fetchEndedVotes = async () => {
      try {
        const res = await fetch('/api/votes?status=ended');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        if (!cancelled) setVotes(data.votes ?? []);
      } catch (err) {
        console.error('Error fetching ended votes:', err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchEndedVotes();
    return () => {
      cancelled = true;
    };
  }, []);

  // Get unique municipalities for filter
  const municipalities = ['all', ...new Set(votes.map((v) => v.municipality))];
  const municipalityOptions = municipalities.map((m) => ({
    value: m,
    label: m === 'all' ? 'כל הרשויות' : m,
  }));

  const filteredVotes = votes.filter(
    (vote) =>
      municipalityFilter === 'all' || vote.municipality === municipalityFilter
  );

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
        {votes.length > 0 ? (
          <>
            {/* Filters */}
            <div className={styles.filters}>
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
          </>
        ) : null}

        {/* Votes Grid */}
        {filteredVotes.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyKicker}>
              <span aria-hidden className={styles.emptyTick} />
              אין רשומות
            </span>
            <h3 className={styles.emptyTitle}>
              {error
                ? 'לא ניתן לטעון את הארכיון כרגע.'
                : votes.length === 0
                  ? 'עוד לא נסגרו הצבעות.'
                  : 'לא נמצאו הצבעות.'}
            </h3>
            <p className={styles.emptyText}>
              {error
                ? 'נסו לרענן את העמוד בעוד רגע.'
                : votes.length === 0
                  ? 'הרשומות הראשונות יופיעו כאן אחרי שההצבעה הראשונה תיסגר - שקופות לכולם.'
                  : 'נסו לשנות את הסינון או לחפש ברשות אחרת.'}
            </p>
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
