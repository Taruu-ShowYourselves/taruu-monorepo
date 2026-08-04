'use client';

import { useState } from 'react';
import styles from './ProductImage.module.css';

interface ProductImageProps {
  src: string;
  alt: string;
  name: string;
  /** Visual emphasis: lead grid card vs large detail plate. */
  size?: 'card' | 'detail';
  priority?: boolean;
}

/**
 * Hard-edged product plate. Renders the POD art when it loads; on a missing
 * or broken source falls back to an ink/halftone placeholder stamped with the
 * product name - never a broken-image glyph. Plain <img> (not next/image) so
 * onError works for arbitrary, possibly-absent press art.
 */
export function ProductImage({
  src,
  alt,
  name,
  size = 'card',
  priority,
}: ProductImageProps) {
  const [failed, setFailed] = useState(!src);

  if (failed) {
    return (
      <div
        className={`${styles.placeholder} ${size === 'detail' ? styles.detail : styles.card}`}
        role="img"
        aria-label={alt}
      >
        <span aria-hidden className={styles.halftone} />
        <span className={styles.phName}>{name}</span>
        <span aria-hidden className={styles.phMark}>■</span>
      </div>
    );
  }

  return (
    // Plain <img> (not next/image): POD art is external/optional and we need a
    // graceful onError fallback to the press placeholder above.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`${styles.img} ${size === 'detail' ? styles.detail : styles.card}`}
      loading={priority ? 'eager' : 'lazy'}
      onError={() => setFailed(true)}
    />
  );
}
