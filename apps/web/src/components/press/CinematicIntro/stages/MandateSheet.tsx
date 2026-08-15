'use client';

import { useEffect, useState } from 'react';
import type { MandateDecision } from '@/server/domain/mandate/mandate';
import {
  DEMO_MANDATE,
  DEMO_QUERY_FLAG,
  isDemoRequested,
} from '@/server/domain/mandate/demoMandate';
import styles from './BeatStages.module.css';

export interface MandateSheetCopy {
  lead: string;
  empty: string;
  emptyNote: string;
  shareUnit: string;
  ballotsUnit: string;
  demoStamp: string;
}

interface MandateSheetProps {
  /** What the ledger actually holds, resolved on the server. */
  clauses: MandateDecision[];
  copy: MandateSheetCopy;
  numberLocale: string;
}

/**
 * The mandate sheet on the closing beat.
 *
 * A client island for one reason: presentation mode. Reading `?demo=1` on the
 * server would make the whole homepage dynamic and cost every visitor the
 * static render, so the counted clauses are rendered as they are and the demo
 * ones are substituted after mount, on the one screen that asked for them.
 *
 * A demonstrated sheet says so on its face. The stamp is part of the sheet,
 * not a tooltip: this is the surface most likely to end up in a slide.
 */
export function MandateSheet({ clauses, copy, numberLocale }: MandateSheetProps) {
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    const flag = new URLSearchParams(window.location.search).get(DEMO_QUERY_FLAG);
    setDemo(isDemoRequested(flag ?? undefined));
  }, []);

  const shown = demo ? [...DEMO_MANDATE].slice(0, 4) : clauses;

  return (
    <article className={styles.mandateSheet} data-thesis-metric data-depth="0.9">
      <span className={styles.mandateLead}>
        {copy.lead}
        {demo && <b className={styles.demoStamp}>{copy.demoStamp}</b>}
      </span>

      {shown.length === 0 ? (
        <>
          <p className={styles.mandateEmpty}>{copy.empty}</p>
          <p className={styles.mandateNote}>{copy.emptyNote}</p>
        </>
      ) : (
        <ol className={styles.clauses}>
          {shown.map((clause) => (
            <li className={styles.clause} key={clause.voteId}>
              <strong>{clause.position}</strong>
              <span className={styles.clauseSubject}>{clause.title}</span>
              <span className={styles.clauseFigures}>
                {clause.share}% {copy.shareUnit} ·{' '}
                {clause.ballots.toLocaleString(numberLocale)} {copy.ballotsUnit} ·{' '}
                {clause.municipality}
              </span>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
