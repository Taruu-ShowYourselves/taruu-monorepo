'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { NewsButton } from '@/components/press/NewsButton';
import { MunicipalityLink } from '@/components/uikit/municipality-link';
import { useAuth } from '@/providers/AuthProvider';
import type { Locale } from '@/lib/i18n';
import styles from './Masthead.module.css';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';

const WHATSAPP_LINK = WHATSAPP_FOUNDERS_LINK;

interface MastheadProps {
  locale?: Locale;
}

/**
 * The primary row is places a reader ACTS in - their edition, the open
 * ballots, the national desk. Everything explanatory, financial or
 * institutional is one click away in "עוד" rather than competing with them
 * for the same glance.
 */
const NAV = [
  { label: 'הפיד', href: 'feed' },
  { label: 'הצבעות', href: 'votes' },
  { label: 'כנסת ישראל', href: 'knesset' },
];

/** Secondary destinations, grouped so nine links read as three decisions. */
const NAV_MORE: { label: string; items: { label: string; href: string }[] }[] = [
  {
    label: 'להבין',
    items: [
      { label: 'מהי תַּרְאוּ?', href: '#what-is-taruu' },
      { label: 'איך זה עובד', href: 'how-it-works' },
      { label: 'שאלות נפוצות', href: 'faq' },
    ],
  },
  {
    label: 'הכלכלה',
    items: [
      { label: 'כלכלה אזרחית', href: 'economics' },
      { label: 'שקיפות הקרן', href: 'treasury' },
      { label: 'BAGS', href: 'coin' },
    ],
  },
  {
    label: 'בעיתון',
    items: [
      { label: 'סדר היום', href: 'explore' },
      { label: 'חנות', href: 'store' },
      { label: 'אודות', href: 'about' },
    ],
  },
];

/** Hash entries anchor on the homepage; everything else is a locale route. */
function navHref(locale: Locale, href: string): string {
  return href.startsWith('#') ? `/${locale}${href}` : `/${locale}/${href}`;
}

/** Initials from first/last name, falling back to a glyph. */
function initialsOf(firstName?: string, lastName?: string): string {
  const a = firstName?.trim()?.[0] ?? '';
  const b = lastName?.trim()?.[0] ?? '';
  const out = `${a}${b}`.trim();
  return out || '●';
}

interface MoreMenuProps {
  locale: Locale;
}

/**
 * "עוד" - secondary nav collapsed into a dropdown. Radix DropdownMenu does
 * the hard part (positioning, viewport collision, focus, keyboard, RTL);
 * press tokens style it.
 */
function MoreMenu({ locale }: MoreMenuProps) {
  return (
    <DropdownMenu.Root dir="rtl" modal={false}>
      <DropdownMenu.Trigger className={styles.moreBtn}>
        עוד
        <span aria-hidden className={styles.moreCaret}>▾</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles.moreMenu}
          align="start"
          sideOffset={6}
          collisionPadding={16}
          loop
        >
          {NAV_MORE.map((group, i) => (
            <DropdownMenu.Group key={group.label}>
              {i > 0 ? (
                <DropdownMenu.Separator className={styles.moreSep} />
              ) : null}
              <DropdownMenu.Label className={styles.moreLabel}>
                {group.label}
              </DropdownMenu.Label>
              {group.items.map((n) => (
                <DropdownMenu.Item key={n.href} asChild>
                  <Link href={navHref(locale, n.href)} className={styles.moreItem}>
                    {n.label}
                  </Link>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Group>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

interface AccountClusterProps {
  locale: Locale;
}

function AccountCluster({ locale }: AccountClusterProps) {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const cityLabel = user?.city || user?.municipality || '';
  const initials = initialsOf(user?.firstName, user?.lastName);
  const closeMenu = () => setOpen(false);

  const navRows = [
    { label: 'לוח שלי', href: `/${locale}/dashboard` },
    { label: 'הפרופיל שלי', href: `/${locale}/settings/profile` },
    { label: 'חשבונות מקושרים', href: `/${locale}/settings/social-connections` },
  ];

  return (
    <div className={styles.account} ref={rootRef}>
      {cityLabel ? (
        <span className={styles.cityChip}>
          <span className={styles.cityGlyph} aria-hidden>
            ●
          </span>
          <MunicipalityLink name={cityLabel} />
        </span>
      ) : null}

      <button
        type="button"
        className={styles.avatarBtn}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="תפריט חשבון"
      >
        {user?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.avatarImg} src={user.avatarUrl} alt="" width={36} height={36} />
        ) : (
          <span className={styles.avatarInitials} aria-hidden>
            {initials}
          </span>
        )}
      </button>

      {open ? (
        <div className={styles.menu} role="menu">
          {cityLabel ? (
            <div className={styles.menuHeader} role="presentation">
              <span className={styles.cityGlyph} aria-hidden>
                ●
              </span>
              {cityLabel}
            </div>
          ) : null}

          {navRows.map((row) => (
            <Link
              key={row.href}
              href={row.href}
              role="menuitem"
              className={styles.menuRow}
              onClick={closeMenu}
            >
              {row.label}
            </Link>
          ))}

          <div className={styles.menuRule} />

          <button
            type="button"
            role="menuitem"
            className={styles.menuRow}
            onClick={() => {
              closeMenu();
              void signOut();
            }}
          >
            התנתקות
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Hebrew edition dateline, e.g. "יום חמישי · 23.07.26" (Israel time). */
function formatDateline(date: Date): string {
  const weekday = new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    timeZone: 'Asia/Jerusalem',
  }).format(date);
  const dmy = new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'Asia/Jerusalem',
  }).format(date);
  return `יום ${weekday.replace(/^יום /, '')} · ${dmy}`;
}

export function Masthead({ locale = 'he' }: MastheadProps) {
  const { isAuthenticated } = useAuth();

  // The auth store rehydrates from localStorage before the first client
  // render, so an authenticated client would disagree with the guest SSR
  // tree and break hydration (Radix useId depends on tree position). Render
  // the guest branch until after mount, matching the server.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const showAccount = mounted && isAuthenticated;

  return (
    <>
      <header className={styles.masthead}>
        {/* Edition ears */}
        <div className={styles.ears}>
          {/* suppressHydrationWarning: server and client may straddle midnight */}
          <span suppressHydrationWarning>{formatDateline(new Date())}</span>
          <span>מהדורת הפיילוט · גיליון 04</span>
          <span>כל הארץ</span>
        </div>

        <div className={styles.ruleHair} />

        {/* Wordmark row */}
        <div className={styles.brandRow}>
          <span className={styles.tagL}>THE PUBLIC LEDGER</span>
          <Link href={`/${locale}`} className={styles.wordmark}>
            תַּרְאוּ
          </Link>
          <span className={styles.tagR}>מנגנון הקונצנזוס הציבורי</span>
        </div>

        <div className={styles.ruleMast} />
      </header>

      {/* This row reaches the viewport edge with the dashboard, then remains pinned. */}
      <div className={styles.navDock}>
        <nav className={styles.nav} aria-label="ניווט ראשי">
          <Link href={`/${locale}`} className={styles.navWordmark} aria-label="תַּרְאוּ - דף הבית">
            תַּרְאוּ<span aria-hidden>.</span>
          </Link>

          <ul className={styles.navList}>
            <li>
              <Link
                href={`/${locale}/#live-dashboard`}
                className={styles.liveDashboardLink}
              >
                <i aria-hidden />
                דופק חי
              </Link>
            </li>
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={navHref(locale, n.href)} className={styles.navLink}>
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <MoreMenu locale={locale} />
            </li>
          </ul>

          {showAccount ? (
            <AccountCluster locale={locale} />
          ) : (
            <div className={styles.guestActions}>
              <NewsButton href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" variant="red" size="sm">
                קבוצת המייסדים
              </NewsButton>
              <Link href={`/${locale}/sign-in`} className={styles.signIn}>
                התחברות
              </Link>
            </div>
          )}
        </nav>
      </div>
    </>
  );
}
