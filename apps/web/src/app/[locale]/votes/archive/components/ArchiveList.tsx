'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PressSelect } from '@/components/press';
import { MunicipalityLink } from '@/components/uikit/municipality-link';
import { formatDate } from '@sync/shared';
import type { Locale } from '@/lib/i18n';
import { localePrefix } from '@/lib/i18n';
import styles from './ArchiveList.module.css';

interface ArchiveListCopy {
  cardKicker: string;
  endedPrefix: string;
  verifiedVotes: string;
  viewRecord: string;
  filterLabel: string;
  allMunicipalities: string;
  loadingAria: string;
  resultsCount: (count: number) => string;
  emptyKicker: string;
  errorTitle: string;
  noneClosedTitle: string;
  notFoundTitle: string;
  errorText: string;
  noneClosedText: string;
  notFoundText: string;
}

const COPY: Record<Locale, ArchiveListCopy> = {
  he: {
    cardKicker: 'רשומה סגורה',
    endedPrefix: 'הסתיים',
    verifiedVotes: 'קולות מאומתים',
    viewRecord: 'צפו ברשומה ←',
    filterLabel: 'רשות',
    allMunicipalities: 'כל הרשויות',
    loadingAria: 'טוען ארכיון',
    resultsCount: (count) => `מציג ${count} רשומות סגורות`,
    emptyKicker: 'אין רשומות',
    errorTitle: 'לא ניתן לטעון את הארכיון כרגע.',
    noneClosedTitle: 'עוד לא נסגרו הצבעות.',
    notFoundTitle: 'לא נמצאו הצבעות.',
    errorText: 'נסו לרענן את העמוד בעוד רגע.',
    noneClosedText:
      'הרשומות הראשונות יופיעו כאן אחרי שההצבעה הראשונה תיסגר - שקופות לכולם.',
    notFoundText: 'נסו לשנות את הסינון או לחפש ברשות אחרת.',
  },
  en: {
    cardKicker: 'Closed record',
    endedPrefix: 'Ended',
    verifiedVotes: 'verified votes',
    viewRecord: 'View the record →',
    filterLabel: 'Municipality',
    allMunicipalities: 'All municipalities',
    loadingAria: 'Loading archive',
    resultsCount: (count) => `Showing ${count} closed records`,
    emptyKicker: 'No records',
    errorTitle: 'The archive cannot be loaded right now.',
    noneClosedTitle: 'No votes have closed yet.',
    notFoundTitle: 'No votes found.',
    errorText: 'Try refreshing the page in a moment.',
    noneClosedText:
      'The first records will appear here once the first vote closes - transparent to all.',
    notFoundText: 'Try changing the filter or searching another municipality.',
  },
};

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
function VoteArchiveCard({ vote, locale }: { vote: EndedVote; locale: Locale }) {
  const t = COPY[locale];
  return (
    <article className={styles.card}>
      <header className={styles.cardHeader}>
        <span className={styles.cardKicker}>{t.cardKicker}</span>
        <span className={styles.dateline}>
          {t.endedPrefix} · {formatDate(new Date(vote.endDate))}
        </span>
      </header>

      <MunicipalityLink name={vote.municipality} className={styles.municipality} />
      <h3 className={styles.cardTitle}>{vote.title}</h3>
      <p className={styles.cardDescription}>{vote.description}</p>

      <footer className={styles.cardFooter}>
        <span className={styles.dateline}>
          {vote.participantCount.toLocaleString('he-IL')} {t.verifiedVotes}
        </span>
        <Link href={`${localePrefix(locale)}/votes/${vote.id}`} className={styles.cardLink}>
          {t.viewRecord}
        </Link>
      </footer>
    </article>
  );
}

interface ArchiveListProps {
  locale?: Locale;
}

export function ArchiveList({ locale = 'he' }: ArchiveListProps) {
  const t = COPY[locale];
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
    label: m === 'all' ? t.allMunicipalities : m,
  }));

  const filteredVotes = votes.filter(
    (vote) =>
      municipalityFilter === 'all' || vote.municipality === municipalityFilter
  );

  if (loading) {
    return (
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.grid} aria-busy="true" aria-label={t.loadingAria}>
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
                  label={t.filterLabel}
                  options={municipalityOptions}
                  value={municipalityFilter}
                  onChange={(e) => setMunicipalityFilter(e.target.value)}
                  className={styles.municipalitySelect}
                />
              </div>
            </div>

            {/* Results Count */}
            <p className={styles.resultsCount}>
              {t.resultsCount(filteredVotes.length)}
            </p>
          </>
        ) : null}

        {/* Votes Grid */}
        {filteredVotes.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyKicker}>
              <span aria-hidden className={styles.emptyTick} />
              {t.emptyKicker}
            </span>
            <h3 className={styles.emptyTitle}>
              {error
                ? t.errorTitle
                : votes.length === 0
                  ? t.noneClosedTitle
                  : t.notFoundTitle}
            </h3>
            <p className={styles.emptyText}>
              {error
                ? t.errorText
                : votes.length === 0
                  ? t.noneClosedText
                  : t.notFoundText}
            </p>
          </div>
        ) : (
          <div className={styles.grid}>
            {filteredVotes.map((vote) => (
              <VoteArchiveCard key={vote.id} vote={vote} locale={locale} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
