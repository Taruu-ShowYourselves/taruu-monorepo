'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { NewsButton } from '@/components/press/NewsButton';
import { MunicipalityLink } from '@/components/uikit/municipality-link';
import { useAuth } from '@/providers/AuthProvider';
import type { Locale } from '@/lib/i18n';
import styles from './Masthead.module.css';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';
import { localeDirections, localePath, localePrefix, localeSwitchPath } from '@/lib/i18n';

const WHATSAPP_LINK = WHATSAPP_FOUNDERS_LINK;

/** Slack on the nav's reveal test, in pixels. See the note at its use. */
const REVEAL_SLACK = 48;

interface MastheadProps {
  locale?: Locale;
}

interface NavItem {
  label: string;
  href: string;
}

interface MastheadCopy {
  edition: string;
  region: string;
  tagL: string;
  wordmark: string;
  tagR: string;
  homeAriaLabel: string;
  mainNavAriaLabel: string;
  livePulse: string;
  nav: NavItem[];
  more: string;
  navMore: { label: string; items: NavItem[] }[];
  accountMenuAriaLabel: string;
  accountRows: { dashboard: string; profile: string; socialConnections: string };
  signOut: string;
  foundersGroup: string;
  signIn: string;
  /** Label of the OTHER edition - what the switcher link shows. */
  switchLabel: string;
}

/**
 * The primary row is places a reader ACTS in - their edition, what the public
 * has already decided, the national desk. The mandate register stands where
 * the ballot list used to: an open ballot is reachable from every desk and
 * every feed card, while the register of decisions had no door of its own.
 * The full list keeps one, in "more" beside the agenda. Everything
 * explanatory, financial or institutional stays a click away there rather
 * than competing for the same glance.
 */
const COPY: Record<Locale, MastheadCopy> = {
  he: {
    edition: 'מהדורת הפיילוט · גיליון 04',
    region: 'כל הארץ',
    tagL: 'THE PUBLIC LEDGER',
    wordmark: 'תַּרְאוּ',
    tagR: 'מנגנון הקונצנזוס הציבורי',
    homeAriaLabel: 'תַּרְאוּ - דף הבית',
    mainNavAriaLabel: 'ניווט ראשי',
    livePulse: 'דופק חי',
    nav: [
      { label: 'הפיד', href: 'feed' },
      { label: 'המנדט האזרחי', href: 'mandate' },
      { label: 'כנסת ישראל', href: 'knesset' },
    ],
    more: 'עוד',
    // Secondary destinations, grouped so nine links read as three decisions.
    navMore: [
      {
        label: 'להבין',
        items: [
          { label: 'מהי תַּרְאוּ?', href: 'what-is-taruu' },
          { label: 'מצבת הכנסת', href: 'government' },
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
          { label: 'כל ההצבעות', href: 'votes' },
          { label: 'חנות', href: 'store' },
          { label: 'אודות', href: 'about' },
        ],
      },
    ],
    accountMenuAriaLabel: 'תפריט חשבון',
    accountRows: {
      dashboard: 'לוח שלי',
      profile: 'הפרופיל שלי',
      socialConnections: 'חשבונות מקושרים',
    },
    signOut: 'התנתקות',
    foundersGroup: 'קבוצת המייסדים',
    signIn: 'התחברות',
    switchLabel: 'EN',
  },
  en: {
    edition: 'Pilot edition · Issue 04',
    region: 'Nationwide',
    tagL: 'THE PUBLIC LEDGER',
    wordmark: 'Taruu',
    tagR: 'The public consensus mechanism',
    homeAriaLabel: 'Taruu - home page',
    mainNavAriaLabel: 'Main navigation',
    livePulse: 'Live pulse',
    nav: [
      { label: 'The Feed', href: 'feed' },
      { label: 'The civic mandate', href: 'mandate' },
      { label: 'The Knesset', href: 'knesset' },
    ],
    more: 'More',
    navMore: [
      {
        label: 'Understand',
        items: [
          { label: 'What is Taruu?', href: 'what-is-taruu' },
          { label: 'The roster', href: 'government' },
          { label: 'FAQ', href: 'faq' },
        ],
      },
      {
        label: 'The economy',
        items: [
          { label: 'Civic economics', href: 'economics' },
          { label: 'Treasury transparency', href: 'treasury' },
          { label: 'BAGS', href: 'coin' },
        ],
      },
      {
        label: 'In the paper',
        items: [
          { label: 'The agenda', href: 'explore' },
          { label: 'All votes', href: 'votes' },
          { label: 'Store', href: 'store' },
          { label: 'About', href: 'about' },
        ],
      },
    ],
    accountMenuAriaLabel: 'Account menu',
    accountRows: {
      dashboard: 'My board',
      profile: 'My profile',
      socialConnections: 'Linked accounts',
    },
    signOut: 'Sign out',
    foundersGroup: 'The founders\' group',
    signIn: 'Sign in',
    switchLabel: 'עברית',
  },
};

/** Hash entries anchor on the homepage; everything else is a locale route. */
function navHref(locale: Locale, href: string): string {
  // Hash anchors must stay rooted on the locale's homepage ('/#x', '/en#x'),
  // not resolve relative to whatever page the visitor is on.
  return href.startsWith('#')
    ? `${localePath(locale)}${href}`
    : `${localePrefix(locale)}/${href}`;
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
 * Secondary nav collapsed into a dropdown. Radix DropdownMenu does the hard
 * part (positioning, viewport collision, focus, keyboard, direction); press
 * tokens style it.
 */
function MoreMenu({ locale }: MoreMenuProps) {
  const t = COPY[locale];
  return (
    <DropdownMenu.Root dir={localeDirections[locale]} modal={false}>
      <DropdownMenu.Trigger className={styles.moreBtn}>
        {t.more}
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
          {t.navMore.map((group, i) => (
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
  const t = COPY[locale];
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
    { label: t.accountRows.dashboard, href: `${localePrefix(locale)}/dashboard` },
    { label: t.accountRows.profile, href: `${localePrefix(locale)}/settings/profile` },
    { label: t.accountRows.socialConnections, href: `${localePrefix(locale)}/settings/social-connections` },
  ];

  return (
    <div className={styles.account} ref={rootRef}>
      {cityLabel ? (
        <span className={styles.cityChip}>
          <span className={styles.cityGlyph} aria-hidden>
            ●
          </span>
          <MunicipalityLink name={cityLabel} locale={locale} />
        </span>
      ) : null}

      <button
        type="button"
        className={styles.avatarBtn}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.accountMenuAriaLabel}
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
            {t.signOut}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Edition dateline in the locale's own convention (Israel time), e.g.
 * "יום חמישי · 23.07.26" / "Thursday · 23.07.26".
 */
function formatDateline(date: Date, locale: Locale): string {
  const intlLocale = locale === 'he' ? 'he-IL' : 'en-GB';
  const weekday = new Intl.DateTimeFormat(intlLocale, {
    weekday: 'long',
    timeZone: 'Asia/Jerusalem',
  }).format(date);
  const dmy = new Intl.DateTimeFormat(intlLocale, {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'Asia/Jerusalem',
  }).format(date);
  const dmyDotted = dmy.replace(/\//g, '.');
  return locale === 'he'
    ? `יום ${weekday.replace(/^יום /, '')} · ${dmyDotted}`
    : `${weekday} · ${dmyDotted}`;
}

export function Masthead({ locale = 'he' }: MastheadProps) {
  const t = COPY[locale];
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const otherLocale: Locale = locale === 'he' ? 'en' : 'he';

  // The auth store rehydrates from localStorage before the first client
  // render, so an authenticated client would disagree with the guest SSR
  // tree and break hydration (Radix useId depends on tree position). Render
  // the guest branch until after mount, matching the server.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const showAccount = mounted && isAuthenticated;

  // Pages that mark a section with [data-nav-reveal] defer the pinned nav:
  // once the masthead scrolls off, the dock stays tucked above the viewport
  // until that section reaches the top, then slides in. Pages without the
  // sentinel keep the plain always-pinned sticky behavior.
  const headerRef = useRef<HTMLElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const [dockHidden, setDockHidden] = useState(false);
  useEffect(() => {
    const header = headerRef.current;
    const dock = dockRef.current;
    const reveals = Array.from(
      document.querySelectorAll<HTMLElement>('[data-nav-reveal]')
    );
    if (!header || !dock || reveals.length === 0) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      // Measure pin state off the untransformed header - the dock's own rect
      // moves with the hide transform and would feed back into the check.
      const pinned = header.getBoundingClientRect().bottom <= 0;
      // The page rests on section edges, and the edge it rests on puts the
      // desk's top within a pixel or two of the dock's own height - a test
      // for exactly that height lost the race by three pixels and left the
      // reader on the desk with no nav until the next swipe.
      //
      // Two sentinel flavours. The default latches: once the section has
      // reached the top, the dock stays for the rest of the page (the
      // pitch deck's behaviour). `data-nav-reveal="hold"` shows the dock
      // only WHILE that section is under it - the homepage marks the
      // locality desk and the thesis chapters, so the nav stands over the
      // sections that ask for it and stays out of the carousel's frame.
      const threshold = dock.offsetHeight + REVEAL_SLACK;
      const revealed = reveals.some((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top > threshold) return false;
        return el.dataset.navReveal === 'hold'
          ? rect.bottom >= dock.offsetHeight - REVEAL_SLACK
          : true;
      });
      setDockHidden(pinned && !revealed);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return (
    <>
      <header ref={headerRef} className={styles.masthead}>
        {/* Edition ears */}
        <div className={styles.ears}>
          {/* suppressHydrationWarning: server and client may straddle midnight */}
          <span suppressHydrationWarning>{formatDateline(new Date(), locale)}</span>
          <span>{t.edition}</span>
          <span>
            {/* Region and separator are the droppable half: on a phone they
                yield, while the locale switch stays - it is the only door to
                the other edition anywhere on the page. */}
            <span className={styles.earsRegion}>
              {t.region}
              {' · '}
            </span>
            <Link
              href={localeSwitchPath(pathname ?? localePath(locale), otherLocale)}
              lang={otherLocale}
              className={styles.localeSwitch}
            >
              {t.switchLabel}
            </Link>
          </span>
        </div>

        <div className={styles.ruleHair} />

        {/* Wordmark row */}
        <div className={styles.brandRow}>
          <span className={styles.tagL}>{t.tagL}</span>
          <Link href={localePath(locale)} className={styles.wordmark}>
            {t.wordmark}
          </Link>
          <span className={styles.tagR}>{t.tagR}</span>
        </div>

        <div className={styles.ruleMast} />
      </header>

      <div
        ref={dockRef}
        data-nav-dock
        className={`${styles.navDock} ${dockHidden ? styles.navDockHidden : ''}`}
      >
        <nav className={styles.nav} aria-label={t.mainNavAriaLabel}>
          <Link href={localePath(locale)} className={styles.navWordmark} aria-label={t.homeAriaLabel}>
            {t.wordmark}<span aria-hidden>.</span>
          </Link>

          {/* "עוד" sits OUTSIDE the scroller, not as its last item: parked
              inside it, the row of links scrolled underneath the trigger and
              the two collided mid-glyph. The scroller now ends at its own
              edge and the door to the other nine destinations stands beside
              it, at every width. */}
          <div className={styles.navCenter}>
            <ul className={styles.navList}>
              <li>
                <Link
                  href={`${localePath(locale)}#live-dashboard`}
                  className={styles.liveDashboardLink}
                >
                  <i aria-hidden />
                  {t.livePulse}
                </Link>
              </li>
              {t.nav.map((n) => (
                <li key={n.href}>
                  <Link href={navHref(locale, n.href)} className={styles.navLink}>
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
            <MoreMenu locale={locale} />
          </div>

          {showAccount ? (
            <AccountCluster locale={locale} />
          ) : (
            <div className={styles.guestActions}>
              <NewsButton href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" variant="red" size="sm">
                {t.foundersGroup}
              </NewsButton>
              <Link href={`${localePrefix(locale)}/sign-in`} className={styles.signIn}>
                {t.signIn}
              </Link>
            </div>
          )}
        </nav>
      </div>
    </>
  );
}
