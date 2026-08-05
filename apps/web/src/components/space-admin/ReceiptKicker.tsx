import React from 'react';
import styles from './kicker.module.css';

/**
 * A kicker for the press `Receipt`, in this phase's red (D9).
 *
 * `Receipt` paints its own kicker in the accent red at the mono data size —
 * 4.03:1 on paper-box, below AA for normal text. The component is on the
 * reused-as-is list, so the fix is scoped rather than applied to a shared
 * file: `Receipt` takes its kicker as a node, and a colour declared on that
 * node's children governs their own text. The tick keeps the accent red and is
 * `aria-hidden`, which exempts it from the text threshold.
 *
 * Pass the text WITHOUT the `■`. Two receipts use this: the audience preview
 * and the sent confirmation.
 */
export function ReceiptKicker({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span aria-hidden className={styles.receiptKickerTick}>
        {'■ '}
      </span>
      <span className={styles.receiptKickerText}>{children}</span>
    </>
  );
}
