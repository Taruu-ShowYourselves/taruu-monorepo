import React from 'react';
import styles from './page.module.css';

/**
 * Shell boot for every space-admin surface under this segment.
 *
 * This is the ONLY spinner in the phase, and it never appears alongside
 * skeletons: the per-panel skeletons live inside the surfaces and mean "this
 * panel is still arriving", while this means "the page itself has not booted
 * yet". Showing both at once tells the reader two different stories about the
 * same screen.
 *
 * The mark is a `--space-10` square with a `--np-rule-heavy` border and a
 * `--np-red` top edge, turned by `animation: spin 0.9s steps(8) infinite` -
 * a mechanical tick rather than a smooth sweep, and `animation: none` under
 * `prefers-reduced-motion`. Both live beside `.spinner` in `page.module.css`.
 */
export default function SpaceAdminLoading() {
  return (
    <div className={styles.boot} role="status">
      <span aria-hidden className={styles.spinner} />
      <span className={styles.bootLabel}>…טוען את לוח הניהול</span>
    </div>
  );
}
