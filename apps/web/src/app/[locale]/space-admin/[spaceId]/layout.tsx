import React from 'react';
import { Masthead } from '@/components/press';
import { Colophon } from '@/components/press/sections';
import type { Locale } from '@/lib/i18n';
import styles from './layout.module.css';

interface SpaceAdminLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: Locale; spaceId: string }>;
}

/**
 * Shell for `/[locale]/space-admin/[spaceId]` — chrome only.
 *
 * THIS IS NOT THE AUTHORIZATION BOUNDARY, and it must never become one.
 * A Next.js layout is rendered once and is NOT re-rendered when the user
 * navigates between nested segments, and it does not gate those segments:
 * a check performed here would go stale and would still leave every child
 * route directly reachable. Space identity, membership and capability are
 * therefore resolved by each PAGE, server-side, on every request — which is
 * also what makes the SPACE-03 test ("swap the spaceId, get FORBIDDEN")
 * apply to all six surfaces independently.
 *
 * For the same reason `SpaceAdminHeader` and `SpaceAdminNav` are rendered by
 * each page rather than here: both need the resolved space and the resolved
 * capability set, and the nav must hide links per surface.
 *
 * `Masthead` is not sticky, so `main` takes no top offset — and never
 * `var(--header-height)`, which is referenced in three stylesheets and
 * defined nowhere, making the whole `calc()` declaration invalid (D2).
 */
export default async function SpaceAdminLayout({
  children,
  params,
}: SpaceAdminLayoutProps) {
  const { locale } = await params;

  return (
    <div className="np-page">
      <Masthead locale={locale} />
      <main className={styles.main}>
        <div className={styles.container}>{children}</div>
      </main>
      <Colophon locale={locale} />
    </div>
  );
}
