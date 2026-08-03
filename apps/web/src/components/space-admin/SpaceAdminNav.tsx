import React from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import type { Locale } from '@/lib/i18n';
import styles from './SpaceAdminNav.module.css';

/**
 * Href suffix of each surface, relative to `/{locale}/space-admin/{spaceId}`.
 * The overview surface is the empty suffix.
 */
export type SpaceAdminNavHref =
  | ''
  | 'proposals'
  | 'members'
  | 'stats'
  | 'dispatch'
  | 'audit';

interface SpaceAdminNavItem {
  href: SpaceAdminNavHref;
  label: string;
}

export const SPACE_ADMIN_NAV_ITEMS: readonly SpaceAdminNavItem[] = [
  { href: '', label: 'סקירה' },
  { href: 'proposals', label: 'הצעות' },
  { href: 'members', label: 'חברים והרשאות' },
  { href: 'stats', label: 'נתונים' },
  { href: 'dispatch', label: 'התראות' },
  { href: 'audit', label: 'יומן פעולות' },
] as const;

export interface SpaceAdminNavProps {
  spaceId: string;
  /** The surface currently being rendered. Gets `aria-current="page"`. */
  active: SpaceAdminNavHref;
  /**
   * Surfaces the admin holds the capability for. A link the admin cannot use
   * is NOT RENDERED (Interaction Contract 1, Rule A) — never disabled, never
   * greyed. Omit the prop to render all six.
   */
  visibleHrefs?: readonly SpaceAdminNavHref[];
  locale?: Locale;
  className?: string;
}

/**
 * Sub-navigation for the space-admin dashboard: six routed surfaces.
 *
 * It borrows the `Segmented` LOOK (boxed row, ink hairlines between cells,
 * active cell inverts to an ink fill) but deliberately does NOT use the
 * `Segmented` component: that component emits `role="tablist"` / `role="tab"`
 * with no `aria-controls`, no linked `tabpanel` and no roving focus. These six
 * surfaces are separate documents with their own URLs, so tab semantics
 * without a tabpanel would be a false promise to assistive tech.
 */
export function SpaceAdminNav({
  spaceId,
  active,
  visibleHrefs,
  locale = 'he',
  className,
}: SpaceAdminNavProps) {
  const items = visibleHrefs
    ? SPACE_ADMIN_NAV_ITEMS.filter((item) => visibleHrefs.includes(item.href))
    : SPACE_ADMIN_NAV_ITEMS;

  if (items.length === 0) return null;

  const base = `/${locale}/space-admin/${spaceId}`;

  return (
    <nav aria-label="ניווט לוח הניהול" className={clsx(styles.nav, className)}>
      {items.map((item) => {
        const isActive = item.href === active;
        return (
          <Link
            key={item.href || 'overview'}
            href={item.href ? `${base}/${item.href}` : base}
            aria-current={isActive ? 'page' : undefined}
            className={clsx(styles.cell, isActive && styles.active)}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
