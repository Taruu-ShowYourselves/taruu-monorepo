'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { MUNICIPALITIES } from '@sync/shared';
import { Segmented } from '@/components/press';
import {
  PressAutocomplete,
  MuiPressProvider,
} from '@/components/press/PressAutocomplete';
import { municipalityHref } from '@/components/uikit/municipality-link';
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
  /** Current desk - a municipality name, or null for the nationwide edition. */
  scope: string | null;
  /** Reader's own municipality when known (already validated). */
  homeMunicipality: string | null;
  onScopeChange: (scope: string | null) => void;
}

export function VotesHero({
  activeFilter,
  onFilterChange,
  scope,
  homeMunicipality,
  onScopeChange,
}: VotesHeroProps) {
  const scoutOptions = useMemo(
    () => MUNICIPALITIES.map((name) => ({ value: name, label: name })),
    []
  );

  return (
    <section className={styles.hero}>
      <div className={styles.container}>
        <span className={styles.kicker}>
          <span aria-hidden className={styles.kickerTick} />
          הצבעות פומביות · {scope ?? 'כל הארץ'}
        </span>

        <h1 className={styles.heading}>
          מה על הפרק בקהילה <span className={styles.red}>שלכם.</span>
        </h1>

        <p className={styles.deck}>
          כל הנושאים הפעילים במקום אחד. תוצאות בזמן אמת, גלויות לכולם.
        </p>

        <div className={styles.byline}>
          <span>מדור ההצבעות</span>
          <span className={styles.sep} aria-hidden>■</span>
          <span>חתום בבלוקצ׳יין</span>
          <span className={styles.sep} aria-hidden>■</span>
          <span>תוצאות בזמן אמת</span>
        </div>

        <div className={styles.scopeRow}>
          <span className={styles.filterLabel}>מהדורה</span>

          <div className={styles.scopeChips} role="group" aria-label="בחירת מהדורה">
            <button
              type="button"
              className={scope === null ? styles.chipActive : styles.chip}
              aria-pressed={scope === null}
              onClick={() => onScopeChange(null)}
            >
              כל הארץ
            </button>

            {homeMunicipality ? (
              <button
                type="button"
                className={
                  scope === homeMunicipality ? styles.chipActive : styles.chip
                }
                aria-pressed={scope === homeMunicipality}
                onClick={() => onScopeChange(homeMunicipality)}
              >
                <span aria-hidden className={styles.chipGlyph}>●</span>
                הרשות שלי · {homeMunicipality}
              </button>
            ) : null}
          </div>

          <div className={styles.scout}>
            <MuiPressProvider>
              <PressAutocomplete
                label="סיירו ברשויות"
                options={scoutOptions}
                value={scope ?? ''}
                onChange={(name) => onScopeChange(name || null)}
                placeholder="הקלידו שם רשות…"
                noOptionsText="הרשות עוד לא על הלוח"
              />
            </MuiPressProvider>
          </div>

          {scope ? (
            <Link href={municipalityHref(scope)} className={styles.deskLink}>
              לדסק הרשות ←
            </Link>
          ) : null}
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
