'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PressAutocomplete,
  MuiPressProvider,
} from '@/components/press/PressAutocomplete';
import { municipalityHref } from '@/components/uikit/municipality-link';
import type { Locale } from '@/lib/i18n';
import type { MuniRow } from '../data';
import styles from './MuniIndex.module.css';

interface MuniIndexCopy {
  muniProfileTitlePrefix: string;
  issuesLabel: string;
  ballotsLabel: string;
  kicker: string;
  headline: string;
  headlineRed: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchNoOptions: string;
  noMatch: string;
  activeHeading: string;
  dormantHeading: string;
}

const COPY: Record<Locale, MuniIndexCopy> = {
  he: {
    muniProfileTitlePrefix: 'פרופיל רשות - ',
    issuesLabel: 'נושאים',
    ballotsLabel: 'קולות',
    kicker: 'המהדורות המקומיות · THE LOCAL DESKS',
    headline: 'דסקי',
    headlineRed: 'הרשויות.',
    searchLabel: 'חיפוש רשות',
    searchPlaceholder: 'הקלידו שם רשות…',
    searchNoOptions: 'הרשות עוד לא על הלוח',
    noMatch: 'אין רשות בשם הזה על הלוח - עדיין. הרשימה מתרחבת עם כל מהדורה.',
    activeHeading: 'על הלוח עכשיו',
    dormantHeading: 'שאר הרשויות במרשם',
  },
  en: {
    muniProfileTitlePrefix: 'Municipality profile - ',
    issuesLabel: 'issues',
    ballotsLabel: 'votes',
    kicker: 'The local editions · THE LOCAL DESKS',
    headline: 'The municipal',
    headlineRed: 'desks.',
    searchLabel: 'Search municipalities',
    searchPlaceholder: 'Type a municipality name…',
    searchNoOptions: 'That municipality is not on the board yet',
    noMatch: 'No municipality by that name on the board - yet. The list grows with every edition.',
    activeHeading: 'On the board now',
    dormantHeading: 'The rest of the gazetteer',
  },
};

interface MuniIndexRowProps {
  row: MuniRow;
  /** When false the counts print `-` (empty edition, spec §3.2). */
  hasData: boolean;
  locale?: Locale;
}

/** One directory listing: name → profile, open votes + ballots in mono. */
function MuniIndexRow({ row, hasData, locale = 'he' }: MuniIndexRowProps) {
  const t = COPY[locale];
  return (
    <li className={styles.row}>
      <Link
        href={municipalityHref(row.name)}
        className={styles.rowLink}
        title={`${t.muniProfileTitlePrefix}${row.name}`}
      >
        <span className={styles.rowName}>{row.name}</span>
        <span className={styles.rowCounts}>
          <span className={styles.count}>
            <span className={styles.countNum}>
              {hasData ? row.openVotes.toLocaleString('he-IL') : '-'}
            </span>
            <span className={styles.countLabel}>{t.issuesLabel}</span>
          </span>
          <span className={styles.count}>
            <span className={styles.countNum}>
              {hasData ? row.ballots.toLocaleString('he-IL') : '-'}
            </span>
            <span className={styles.countLabel}>{t.ballotsLabel}</span>
          </span>
        </span>
      </Link>
    </li>
  );
}

interface MuniIndexProps {
  rows: MuniRow[];
  hasData: boolean;
  locale?: Locale;
}

/**
 * S4 - דסקי הרשויות. The full municipality directory as an editorial index:
 * hairline listing rows, two newsprint columns on wide, no cards. The search
 * field filters in place; selecting a match (or Enter on an exact one) jumps
 * to the municipality profile.
 */
export function MuniIndex({ rows, hasData, locale = 'he' }: MuniIndexProps) {
  const t = COPY[locale];
  const router = useRouter();
  const [query, setQuery] = useState('');

  const options = useMemo(
    () => rows.map((r) => ({ value: r.name, label: r.name })),
    [rows]
  );

  const filtered = useMemo(() => {
    const needle = query.trim();
    if (!needle) return rows;
    return rows.filter((r) => r.name.includes(needle));
  }, [rows, query]);

  /* Only desks with live counts earn a full listing row - most of the ~250
     localities carry no topics yet, and printing each as a counted row makes
     the index seven screens of zeros. The dormant rest are still on the map,
     as a names-only gazetteer. An empty edition (no data at all) has no
     active desks by definition. */
  const active = useMemo(
    () =>
      hasData ? filtered.filter((r) => r.openVotes > 0 || r.ballots > 0) : [],
    [filtered, hasData]
  );
  const dormant = useMemo(
    () =>
      hasData
        ? filtered.filter((r) => r.openVotes === 0 && r.ballots === 0)
        : filtered,
    [filtered, hasData]
  );

  return (
    <section
      id="muni-index"
      className={styles.desk}
      aria-labelledby="muni-index-headline"
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            {t.kicker}
          </span>
          <h2 id="muni-index-headline" className={styles.headline}>
            {t.headline} <span className={styles.red}>{t.headlineRed}</span>
          </h2>
        </header>

        <div className={styles.searchWrap}>
          <MuiPressProvider>
            <PressAutocomplete
              label={t.searchLabel}
              options={options}
              value=""
              onChange={(name) => {
                if (name) router.push(municipalityHref(name));
              }}
              onInputChange={setQuery}
              placeholder={t.searchPlaceholder}
              noOptionsText={t.searchNoOptions}
              locale={locale}
              className={styles.search}
            />
          </MuiPressProvider>
        </div>

        <div className={styles.ruleHeavy} aria-hidden />

        {filtered.length === 0 ? (
          <p className={styles.noMatch}>
            {t.noMatch}
          </p>
        ) : (
          <>
            {active.length > 0 ? (
              <>
                <h3 className={styles.groupLabel}>{t.activeHeading}</h3>
                <ul className={styles.list}>
                  {active.map((row) => (
                    <MuniIndexRow
                      key={row.name}
                      row={row}
                      hasData={hasData}
                      locale={locale}
                    />
                  ))}
                </ul>
              </>
            ) : null}
            {dormant.length > 0 ? (
              <>
                <h3 className={styles.groupLabel}>{t.dormantHeading}</h3>
                <ul className={styles.gazetteer}>
                  {dormant.map((row) => (
                    <li key={row.name} className={styles.gazItem}>
                      <Link
                        href={municipalityHref(row.name)}
                        className={styles.gazLink}
                        title={`${t.muniProfileTitlePrefix}${row.name}`}
                      >
                        {row.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
