import React from 'react';
import { notFound } from 'next/navigation';
import { Masthead } from '@/components/press';
import { Colophon } from '@/components/press/sections';
import { i18n, type Locale } from '@/lib/i18n';
import styles from './layout.module.css';

/**
 * `locale` is typed `string` and narrowed below, matching `[locale]/layout.tsx`.
 * Next's generated `LayoutConfig` types a layout's params from the route
 * segments alone, so a layout that narrows the segment in its own signature
 * fails the generated validator with `TS2344`. Pages escape this — their
 * generated constraint is intersected with `any` — which is why the sibling
 * surfaces can and do declare `Locale` directly.
 */
interface SpaceAdminLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string; spaceId: string }>;
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
 * `Masthead` is not sticky, so `main` takes no top offset — and in particular
 * no offset computed from the undefined masthead-height custom property that
 * three legacy stylesheets still reference, which makes the whole `calc()`
 * declaration invalid and silently dropped (D2).
 */
export default async function SpaceAdminLayout({
  children,
  params,
}: SpaceAdminLayoutProps) {
  const { locale: rawLocale } = await params;

  // The cast is only sound because of the line under it: an unexpected segment
  // is a 404, not a locale we quietly pretend to support. Same shape as
  // `[locale]/layout.tsx`, which runs first and also refuses — this repeats it
  // rather than depending on a parent layout to have done it.
  const locale = rawLocale as Locale;
  if (!(i18n.locales as readonly string[]).includes(locale)) notFound();

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
