'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PressAutocomplete,
  MuiPressProvider,
} from '@/components/press/PressAutocomplete';
import { municipalityHref } from '@/components/uikit/municipality-link';
import type { MuniRow } from '../data';
import styles from './MuniIndex.module.css';

interface MuniIndexRowProps {
  row: MuniRow;
  /** When false the counts print `-` (empty edition, spec §3.2). */
  hasData: boolean;
}

/** One directory listing: name → profile, open votes + ballots in mono. */
function MuniIndexRow({ row, hasData }: MuniIndexRowProps) {
  return (
    <li className={styles.row}>
      <Link
        href={municipalityHref(row.name)}
        className={styles.rowLink}
        title={`פרופיל רשות - ${row.name}`}
      >
        <span className={styles.rowName}>{row.name}</span>
        <span className={styles.rowCounts}>
          <span className={styles.count}>
            <span className={styles.countNum}>
              {hasData ? row.openVotes.toLocaleString('he-IL') : '-'}
            </span>
            <span className={styles.countLabel}>נושאים</span>
          </span>
          <span className={styles.count}>
            <span className={styles.countNum}>
              {hasData ? row.ballots.toLocaleString('he-IL') : '-'}
            </span>
            <span className={styles.countLabel}>קולות</span>
          </span>
        </span>
      </Link>
    </li>
  );
}

interface MuniIndexProps {
  rows: MuniRow[];
  hasData: boolean;
}

/**
 * S4 - דסקי הרשויות. The full municipality directory as an editorial index:
 * hairline listing rows, two newsprint columns on wide, no cards. The search
 * field filters in place; selecting a match (or Enter on an exact one) jumps
 * to the municipality profile.
 */
export function MuniIndex({ rows, hasData }: MuniIndexProps) {
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
            המהדורות המקומיות · THE LOCAL DESKS
          </span>
          <h2 id="muni-index-headline" className={styles.headline}>
            דסקי <span className={styles.red}>הרשויות.</span>
          </h2>
        </header>

        <div className={styles.searchWrap}>
          <MuiPressProvider>
            <PressAutocomplete
              label="חיפוש רשות"
              options={options}
              value=""
              onChange={(name) => {
                if (name) router.push(municipalityHref(name));
              }}
              onInputChange={setQuery}
              placeholder="הקלידו שם רשות…"
              noOptionsText="הרשות עוד לא על הלוח"
              className={styles.search}
            />
          </MuiPressProvider>
        </div>

        <div className={styles.ruleHeavy} aria-hidden />

        {filtered.length === 0 ? (
          <p className={styles.noMatch}>
            אין רשות בשם הזה על הלוח - עדיין. הרשימה מתרחבת עם כל מהדורה.
          </p>
        ) : (
          <ul className={styles.list}>
            {filtered.map((row) => (
              <MuniIndexRow key={row.name} row={row} hasData={hasData} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
