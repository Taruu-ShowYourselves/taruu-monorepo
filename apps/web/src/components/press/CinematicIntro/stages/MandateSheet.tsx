'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
  /** Locale-correct base of a ballot's page; counted clauses link to theirs. */
  votePathPrefix?: string;
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
export function MandateSheet({
  clauses,
  copy,
  numberLocale,
  votePathPrefix,
}: MandateSheetProps) {
  const [demoAsked, setDemoAsked] = useState(false);

  useEffect(() => {
    const flag = new URLSearchParams(window.location.search).get(DEMO_QUERY_FLAG);
    setDemoAsked(isDemoRequested(flag ?? undefined));
  }, []);

  /* A young ledger substitutes the demonstration by itself: "the mandate is
     still empty" is true, but a backdrop about what the register looks like
     once it fills has to show that register filled. The stamp still rides
     every demonstrated sheet - that rule does not soften. */
  const demo = demoAsked || clauses.length === 0;
  const shown = demo ? [...DEMO_MANDATE].slice(0, 6) : clauses;

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
          {shown.map((clause) => {
            /* A counted clause is a door back to its ballot; a demonstrated
               one has no ballot to open. */
            const href =
              !demo && votePathPrefix ? `${votePathPrefix}/${clause.voteId}` : null;
            const body = (
              <>
                <strong>{clause.position}</strong>
                <span className={styles.clauseFigures}>
                  {clause.ballots.toLocaleString(numberLocale)} {copy.ballotsUnit} ·{' '}
                  {clause.municipality}
                </span>
              </>
            );
            return (
              <li className={styles.clause} key={clause.voteId}>
                {/* The majority is the fact of the row: the same red figure
                    the paper leads every count with, over the share track the
                    ballots draw everywhere else. */}
                <span className={styles.clauseShare}>
                  <b>{clause.share}%</b>
                  <i>{copy.shareUnit}</i>
                </span>
                <span className={styles.clauseBody}>
                  {href ? (
                    <Link href={href} className={styles.clauseLink}>
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                  <span className={styles.clauseTrack} aria-hidden>
                    <i style={{ inlineSize: `${clause.share}%` }} />
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );
}
