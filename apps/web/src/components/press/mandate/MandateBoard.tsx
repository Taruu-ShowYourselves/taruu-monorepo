'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { MandateDecision } from '@/server/domain/mandate/mandate';
import { localePrefix, type Locale } from '@/lib/i18n';
import styles from './Mandate.module.css';

export type MandateTab = 'national' | 'municipal';

export interface MandateBoardCopy {
  tabNational: string;
  tabMunicipal: string;
  /** Plain strings only: this copy crosses into a client component. */
  ballotsUnit: string;
  marginLabel: string;
  marginUnit: string;
  decided: string;
  standing: string;
  decidedNote: string;
  standingNote: string;
  authorityFilterLabel: string;
  authorityAll: string;
  emptyNational: string;
  emptyMunicipal: string;
  emptyNote: string;
  readVote: string;
  decidedThat: string;
}

interface MandateBoardProps {
  national: MandateDecision[];
  municipal: MandateDecision[];
  copy: MandateBoardCopy;
  locale: Locale;
}

/**
 * The mandate, as a board a reader can stand in front of.
 *
 * Two tabs, because the public instructs two different bodies and the
 * difference matters legally: what the Knesset and the government are told,
 * and what a named authority is told. The municipal side filters by authority
 * rather than paginating - the question a resident arrives with is "what did
 * my town decide", and that must never be more than one control away.
 *
 * Settled decisions and open standings are printed in one list, distinguished
 * by a stamp rather than separated: hiding the open ones would misrepresent
 * how much of the mandate is still forming, and merging them silently would
 * be worse.
 */
export function MandateBoard({ national, municipal, copy, locale }: MandateBoardProps) {
  const numberLocale = locale === 'he' ? 'he-IL' : 'en-US';
  const [tab, setTab] = useState<MandateTab>(municipal.length >= national.length ? 'municipal' : 'national');
  const [authority, setAuthority] = useState<string | null>(null);

  const authorities = useMemo(
    () => [...new Set(municipal.map((decision) => decision.municipality))].sort((a, b) => a.localeCompare(b, 'he')),
    [municipal]
  );

  const shown = useMemo(() => {
    if (tab === 'national') return national;
    return authority
      ? municipal.filter((decision) => decision.municipality === authority)
      : municipal;
  }, [tab, national, municipal, authority]);

  return (
    <section className={styles.board}>
      <div className={styles.tabs} role="tablist" aria-label={copy.tabNational}>
        <button
          type="button"
          role="tab"
          className={styles.tab}
          aria-selected={tab === 'national'}
          onClick={() => setTab('national')}
        >
          {copy.tabNational}
          <span className={styles.tabCount}>{national.length.toLocaleString(numberLocale)}</span>
        </button>
        <button
          type="button"
          role="tab"
          className={styles.tab}
          aria-selected={tab === 'municipal'}
          onClick={() => setTab('municipal')}
        >
          {copy.tabMunicipal}
          <span className={styles.tabCount}>{municipal.length.toLocaleString(numberLocale)}</span>
        </button>
      </div>

      {tab === 'municipal' && authorities.length > 0 && (
        <div className={styles.filter}>
          <span className={styles.filterLabel}>{copy.authorityFilterLabel}</span>
          <div className={styles.chips}>
            <button
              type="button"
              className={styles.chip}
              aria-pressed={authority === null}
              onClick={() => setAuthority(null)}
            >
              {copy.authorityAll}
            </button>
            {authorities.map((name) => (
              <button
                type="button"
                key={name}
                className={styles.chip}
                aria-pressed={authority === name}
                onClick={() => setAuthority(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {shown.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyLede}>
            {tab === 'national' ? copy.emptyNational : copy.emptyMunicipal}
          </p>
          <p className={styles.emptyNote}>{copy.emptyNote}</p>
        </div>
      ) : (
        <ol className={styles.decisions}>
          {shown.map((decision) => (
            <li className={styles.decision} key={decision.voteId} data-standing={decision.standing}>
              <header className={styles.decisionHead}>
                <span className={styles.stamp}>
                  {decision.standing === 'decided' ? copy.decided : copy.standing}
                </span>
                <span className={styles.authority}>{decision.municipality}</span>
              </header>

              <p className={styles.clause}>
                <span className={styles.clauseLead}>{copy.decidedThat}</span>
                <strong className={styles.position}>{decision.position}</strong>
                <span className={styles.subject}>{decision.title}</span>
              </p>

              <div className={styles.figures}>
                <span className={styles.share}>{decision.share}%</span>
                <span className={styles.figureMeta}>
                  {decision.ballots.toLocaleString(numberLocale)} {copy.ballotsUnit}
                </span>
                <span className={styles.figureMeta}>
                  {copy.marginLabel} {decision.margin} {copy.marginUnit}
                </span>
                <Link
                  className={styles.readLink}
                  href={`${localePrefix(locale)}/votes/${decision.voteId}`}
                >
                  {copy.readVote}
                </Link>
              </div>

              <span className={styles.track} aria-hidden>
                <i style={{ inlineSize: `${decision.share}%` }} />
              </span>

              <p className={styles.standingNote}>
                {decision.standing === 'decided' ? copy.decidedNote : copy.standingNote}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
