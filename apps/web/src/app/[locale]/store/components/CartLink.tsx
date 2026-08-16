'use client';

import Link from 'next/link';
import { useCartCount } from '@/stores/merchCartStore';
import type { Locale } from '@/lib/i18n';
import styles from './CartLink.module.css';

interface CartLinkCopy {
  label: string;
}

const COPY: Record<Locale, CartLinkCopy> = {
  he: {
    label: 'העגלה',
  },
  en: {
    label: 'Cart',
  },
};

interface CartLinkProps {
  /** Locale-prefixed href to the cart page. */
  href: string;
  locale?: Locale;
}

/**
 * Mono cart indicator - a hard-edged press tab showing the live line count.
 * Hydration-safe: count renders from the persisted store after mount.
 */
export function CartLink({ href, locale = 'he' }: CartLinkProps) {
  const count = useCartCount();
  const t = COPY[locale];

  return (
    <Link href={href} className={styles.cart}>
      <span aria-hidden className={styles.glyph}>
        ●
      </span>
      <span className={styles.label}>{t.label}</span>
      <span className={styles.count}>{count}</span>
    </Link>
  );
}
