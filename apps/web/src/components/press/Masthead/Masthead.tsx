'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { NewsButton } from '@/components/press/NewsButton';
import { useAuth } from '@/providers/AuthProvider';
import type { Locale } from '@/lib/i18n';
import styles from './Masthead.module.css';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';

const WHATSAPP_LINK = WHATSAPP_FOUNDERS_LINK;

interface MastheadProps {
  locale?: Locale;
}

const NAV = [
  { label: 'הצבעות', href: 'votes' },
  { label: 'אודות', href: 'about' },
  { label: 'שאלות נפוצות', href: 'faq' },
];

/** Initials from first/last name, falling back to a glyph. */
function initialsOf(firstName?: string, lastName?: string): string {
  const a = firstName?.trim()?.[0] ?? '';
  const b = lastName?.trim()?.[0] ?? '';
  const out = `${a}${b}`.trim();
  return out || '●';
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
          {cityLabel}
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

export function Masthead({ locale = 'he' }: MastheadProps) {
  const { isAuthenticated } = useAuth();

  return (
    <header className={styles.masthead}>
      {/* Edition ears */}
      <div className={styles.ears}>
        <span>יום שבת · 14.06.26</span>
        <span>מהדורת הפיילוט · גיליון 04</span>
        <span>קריית טבעון · ההשתתפות חינם</span>
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

      {/* Nav + participate / account */}
      <nav className={styles.nav} aria-label="ניווט ראשי">
        {isAuthenticated ? (
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
        <ul className={styles.navList}>
          {NAV.map((n) => (
            <li key={n.href}>
              <Link href={`/${locale}/${n.href}`} className={styles.navLink}>
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className={styles.ruleHair} />
    </header>
  );
}
