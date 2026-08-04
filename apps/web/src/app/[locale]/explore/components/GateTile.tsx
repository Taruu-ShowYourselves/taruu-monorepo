'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/providers/AuthProvider';
import type { Locale } from '@/lib/i18n';
import styles from './JoinSlotRow.module.css';

/** Hard-edged padlock glyph - SVG primitive, stroke inherits currentColor. */
function LockGlyph() {
  return (
    <svg
      className={styles.lockGlyph}
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <rect x="3" y="7" width="10" height="7" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

interface GateTileProps {
  locale: Locale;
}

/**
 * The one gated entry on /explore: create-a-vote (₪50). Lock glyph + mono
 * caption mark the gate honestly; a signed-out tap bounces to
 * `/sign-in?redirect=/votes/create` (redirect-with-return, never a modal).
 * Guest markup is SSR'd; auth state upgrades the target after mount only,
 * matching the Masthead hydration pattern.
 */
export function GateTile({ locale }: GateTileProps) {
  const { isAuthenticated } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const href =
    mounted && isAuthenticated
      ? `/${locale}/votes/create`
      : `/${locale}/sign-in?redirect=/votes/create`;

  return (
    <Link href={href} className={styles.slotTile}>
      <span className={styles.slotTitle}>
        <LockGlyph />
        פתיחת נושא · ₪50
      </span>
      <span className={styles.slotCaption}>דורש חשבון מאומת</span>
    </Link>
  );
}
