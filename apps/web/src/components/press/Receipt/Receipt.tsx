'use client';

import React from 'react';
import clsx from 'clsx';
import styles from './Receipt.module.css';

interface ReceiptRow {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Emphasise as the total/charged line. */
  strong?: boolean;
}

interface ReceiptProps {
  /** Mono kicker over the receipt, e.g. "קבלה · RECEIPT". */
  kicker?: React.ReactNode;
  title?: React.ReactNode;
  rows: ReceiptRow[];
  /** Footer meta (mono, faint) — issue no., timestamp, imprint. */
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Press receipt: boxed furniture with mono rows joined by dotted leaders and
 * an ink rule before the total. Used for payment confirmation + billing
 * history lines. Mobile-first full-width box.
 */
export function Receipt({ kicker, title, rows, footer, className }: ReceiptProps) {
  return (
    <div className={clsx(styles.receipt, className)}>
      {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
      {title ? <h3 className={styles.title}>{title}</h3> : null}
      <dl className={styles.rows}>
        {rows.map((r, i) => (
          <div key={i} className={clsx(styles.row, r.strong && styles.strong)}>
            <dt className={styles.rowLabel}>{r.label}</dt>
            <span className={styles.leader} aria-hidden />
            <dd className={styles.rowValue}>{r.value}</dd>
          </div>
        ))}
      </dl>
      {footer ? <p className={styles.footer}>{footer}</p> : null}
    </div>
  );
}
