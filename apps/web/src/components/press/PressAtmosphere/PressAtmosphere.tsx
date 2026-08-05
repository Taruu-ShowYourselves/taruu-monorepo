import React from 'react';
import clsx from 'clsx';
import styles from './PressAtmosphere.module.css';

interface PressAtmosphereProps {
  /** Cover the viewport instead of the nearest positioned ancestor. */
  fixed?: boolean;
  className?: string;
}

/**
 * Living paper - slow ink/red pigment blooms and a drifting halftone field
 * behind content. Transform-only animation (GPU composited), multiply blend,
 * pointer-transparent. Parent needs `position: relative` unless `fixed`.
 */
export function PressAtmosphere({ fixed = false, className }: PressAtmosphereProps) {
  return (
    <div
      aria-hidden
      className={clsx(styles.atmosphere, fixed && styles.fixed, className)}
    >
      <span className={clsx(styles.blob, styles.blobRed)} />
      <span className={clsx(styles.blob, styles.blobInk)} />
      <span className={styles.halftone} />
    </div>
  );
}
