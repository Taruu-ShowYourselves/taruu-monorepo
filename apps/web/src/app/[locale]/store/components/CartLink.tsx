'use client';

import Link from 'next/link';
import { useCartCount } from '@/stores/merchCartStore';
import styles from './CartLink.module.css';

interface CartLinkProps {
  /** Locale-prefixed href to the cart page. */
  href: string;
}

/**
 * Mono cart indicator - a hard-edged press tab showing the live line count.
 * Hydration-safe: count renders from the persisted store after mount.
 */
export function CartLink({ href }: CartLinkProps) {
  const count = useCartCount();

  return (
    <Link href={href} className={styles.cart}>
      <span aria-hidden className={styles.glyph}>
        ●
      </span>
      <span className={styles.label}>העגלה</span>
      <span className={styles.count}>{count}</span>
    </Link>
  );
}
