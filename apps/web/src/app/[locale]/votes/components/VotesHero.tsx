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
import type { Locale } from '@/lib/i18n';
import styles from './VotesHero.module.css';

interface HeroCopy {
  kicker: string;
  nationwide: string;
  headingLead: string;
  headingEm: string;
  deck: string;
  bylineDesk: string;
  bylineSigned: string;
  bylineLive: string;
  editionLabel: string;
  editionAria: string;
  myMunicipality: string;
  scoutLabel: string;
  scoutPlaceholder: string;
  scoutNoOptions: string;
  deskLink: string;
  filterLabel: string;
  filterAria: string;
  filterAll: string;
  filterActive: string;
  filterEnded: string;
  filterPending: string;
}

const COPY: Record<Locale, HeroCopy> = {
  he: {
    kicker: 'הצבעות פומביות',
    nationwide: 'כל הארץ',
    headingLead: 'מה על הפרק בקהילה',
    headingEm: 'שלכם.',
    deck: 'כל הנושאים הפעילים במקום אחד. תוצאות בזמן אמת, גלויות לכולם.',
    bylineDesk: 'מדור ההצבעות',
    bylineSigned: 'חתום בבלוקצ׳יין',
    bylineLive: 'תוצאות בזמן אמת',
    editionLabel: 'מהדורה',
    editionAria: 'בחירת מהדורה',
    myMunicipality: 'הרשות שלי',
    scoutLabel: 'סיירו ברשויות',
    scoutPlaceholder: 'הקלידו שם רשות…',
    scoutNoOptions: 'הרשות עוד לא על הלוח',
    deskLink: 'לדסק הרשות ←',
    filterLabel: 'סינון',
    filterAria: 'סינון הצבעות',
    filterAll: 'הכל',
    filterActive: 'פעילות',
    filterEnded: 'הסתיימו',
    filterPending: 'ממתינות',
  },
  en: {
    kicker: 'Public Votes',
    nationwide: 'Nationwide',
    headingLead: "What's on the agenda in",
    headingEm: 'your community.',
    deck: 'Every active issue in one place. Real-time results, visible to all.',
    bylineDesk: 'The Votes Desk',
    bylineSigned: 'Blockchain-signed',
    bylineLive: 'Real-time results',
    editionLabel: 'Edition',
    editionAria: 'Choose an edition',
    myMunicipality: 'My municipality',
    scoutLabel: 'Browse municipalities',
    scoutPlaceholder: 'Type a municipality name…',
    scoutNoOptions: 'That municipality is not on the board yet',
    deskLink: 'To the municipality desk →',
    filterLabel: 'Filter',
    filterAria: 'Filter votes',
    filterAll: 'All',
    filterActive: 'Active',
    filterEnded: 'Ended',
    filterPending: 'Pending',
  },
};

interface VotesHeroProps {
  activeFilter: VoteFilter;
  onFilterChange: (filter: VoteFilter) => void;
  /** Current desk - a municipality name, or null for the nationwide edition. */
  scope: string | null;
  /** Reader's own municipality when known (already validated). */
  homeMunicipality: string | null;
  onScopeChange: (scope: string | null) => void;
  locale?: Locale;
}

export function VotesHero({
  activeFilter,
  onFilterChange,
  scope,
  homeMunicipality,
  onScopeChange,
  locale = 'he',
}: VotesHeroProps) {
  const t = COPY[locale];

  const filters: { value: VoteFilter; label: string }[] = useMemo(
    () => [
      { value: 'all', label: t.filterAll },
      { value: 'active', label: t.filterActive },
      { value: 'ended', label: t.filterEnded },
      { value: 'pending', label: t.filterPending },
    ],
    [t]
  );

  const scoutOptions = useMemo(
    () => MUNICIPALITIES.map((name) => ({ value: name, label: name })),
    []
  );

  return (
    <section className={styles.hero}>
      <div className={styles.container}>
        <span className={styles.kicker}>
          <span aria-hidden className={styles.kickerTick} />
          {t.kicker} · {scope ?? t.nationwide}
        </span>

        <h1 className={styles.heading}>
          {t.headingLead} <span className={styles.red}>{t.headingEm}</span>
        </h1>

        <p className={styles.deck}>{t.deck}</p>

        <div className={styles.byline}>
          <span>{t.bylineDesk}</span>
          <span className={styles.sep} aria-hidden>■</span>
          <span>{t.bylineSigned}</span>
          <span className={styles.sep} aria-hidden>■</span>
          <span>{t.bylineLive}</span>
        </div>

        <div className={styles.scopeRow}>
          <span className={styles.filterLabel}>{t.editionLabel}</span>

          <div className={styles.scopeChips} role="group" aria-label={t.editionAria}>
            <button
              type="button"
              className={scope === null ? styles.chipActive : styles.chip}
              aria-pressed={scope === null}
              onClick={() => onScopeChange(null)}
            >
              {t.nationwide}
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
                {t.myMunicipality} · {homeMunicipality}
              </button>
            ) : null}
          </div>

          <div className={styles.scout}>
            <MuiPressProvider>
              <PressAutocomplete
                label={t.scoutLabel}
                options={scoutOptions}
                value={scope ?? ''}
                onChange={(name) => onScopeChange(name || null)}
                placeholder={t.scoutPlaceholder}
                noOptionsText={t.scoutNoOptions}
              />
            </MuiPressProvider>
          </div>

          {scope ? (
            <Link href={municipalityHref(scope)} className={styles.deskLink}>
              {t.deskLink}
            </Link>
          ) : null}
        </div>

        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>{t.filterLabel}</span>
          <Segmented
            segments={filters}
            value={activeFilter}
            onChange={onFilterChange}
            variant="ink"
            aria-label={t.filterAria}
            className={styles.filters}
          />
        </div>
      </div>
    </section>
  );
}
