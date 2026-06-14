'use client';

import React from 'react';
import clsx from 'clsx';
import styles from './SealCard.module.css';

interface SealCardProps {
  /** The blockchain hash / transaction id (mono, wraps, breakable). */
  hash: string;
  /** Status; defaults to sealed. */
  status?: 'sealed' | 'pending';
  /** Optional explorer URL for the transaction. */
  href?: string;
  /** Extra mono meta rows under the hash (e.g. block height, timestamp). */
  meta?: Array<{ label: string; value: string }>;
  className?: string;
}

/**
 * Press blockchain-seal view: ink block with a halftone field, ✓ verified
 * glyph, and the transaction hash in breakable mono. The proof-of-record
 * furniture at the end of the participation flow. Mobile-first full-width.
 */
export function SealCard({ hash, status = 'sealed', href, meta, className }: SealCardProps) {
  const sealed = status === 'sealed';
  return (
    <div className={clsx(styles.seal, sealed ? styles.sealed : styles.pending, className)}>
      <div className={styles.head}>
        <span className={styles.glyph} aria-hidden>
          {sealed ? '✓' : '●'}
        </span>
        <span className={styles.title}>
          {sealed ? 'חתום בבלוקצ׳יין' : 'ממתין לחתימה'}
        </span>
      </div>
      <p className={styles.hashLabel}>HASH</p>
      <p className={styles.hash}>{hash}</p>
      {meta && meta.length > 0 ? (
        <dl className={styles.meta}>
          {meta.map((m) => (
            <div key={m.label} className={styles.metaRow}>
              <dt>{m.label}</dt>
              <dd>{m.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {href ? (
        <a className={styles.link} href={href} target="_blank" rel="noreferrer">
          צפו בעסקה ↗
        </a>
      ) : null}
    </div>
  );
}
