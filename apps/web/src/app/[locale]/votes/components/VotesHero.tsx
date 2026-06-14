'use client';

import { Segmented } from '@/components/press';
import type { VoteFilter } from './types';
import styles from './VotesHero.module.css';

const filters: { value: VoteFilter; label: string }[] = [
  { value: 'all', label: 'הכל' },
  { value: 'active', label: 'פעילות' },
  { value: 'ended', label: 'הסתיימו' },
  { value: 'pending', label: 'ממתינות' },
];

interface VotesHeroProps {
  activeFilter: VoteFilter;
  onFilterChange: (filter: VoteFilter) => void;
}

export function VotesHero({ activeFilter, onFilterChange }: VotesHeroProps) {
  return (
    <section className={styles.hero}>
      <div className={styles.container}>
        <span className={styles.kicker}>
          <span aria-hidden className={styles.kickerTick} />
          הצבעות פומביות · קריית טבעון
        </span>

        <h1 className={styles.heading}>
          מה על הפרק בקהילה <span className={styles.red}>שלכם.</span>
        </h1>

        <p className={styles.deck}>
          כל הנושאים הפעילים במקום אחד — תוצאות בזמן אמת, גלויות לכולם.
        </p>

        <div className={styles.byline}>
          <span>מדור ההצבעות</span>
          <span className={styles.sep} aria-hidden>■</span>
          <span>חתום בבלוקצ׳יין</span>
          <span className={styles.sep} aria-hidden>■</span>
          <span>תוצאות בזמן אמת</span>
        </div>

        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>סינון</span>
          <Segmented
            segments={filters}
            value={activeFilter}
            onChange={onFilterChange}
            variant="ink"
            aria-label="סינון הצבעות"
            className={styles.filters}
          />
        </div>
      </div>
    </section>
  );
}
