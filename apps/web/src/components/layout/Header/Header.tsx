'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { RippleButton } from '@/components/ui/RippleButton';
import { useReducedMotion } from '@/hooks';
import type { Locale } from '@/lib/i18n';
import clsx from 'clsx';
import styles from './Header.module.css';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';
import { localePath, localePrefix, localeSwitchPath } from '@/lib/i18n';

const WHATSAPP_LINK = WHATSAPP_FOUNDERS_LINK;

interface HeaderProps {
  locale?: Locale;
}

interface NavLink {
  href: string;
  label: string;
}

interface HeaderCopy {
  logo: string;
  logoAria: string;
  nav: {
    home: string;
    votes: string;
    economics: string;
    treasury: string;
    about: string;
    faq: string;
  };
  cta: string;
  desktopNavAria: string;
  mobileNavAria: string;
  openMenu: string;
  closeMenu: string;
  langSwitch: string;
}

const COPY: Record<Locale, HeaderCopy> = {
  he: {
    logo: 'תַּרְאוּ',
    logoAria: 'תַּרְאוּ, דף הבית',
    nav: {
      home: 'בית',
      votes: 'הצבעות',
      economics: 'כלכלה אזרחית',
      treasury: 'שקיפות הקרן',
      about: 'אודות',
      faq: 'שאלות נפוצות',
    },
    cta: 'הצטרפו לפיילוט',
    desktopNavAria: 'ניווט ראשי',
    mobileNavAria: 'ניווט נייד',
    openMenu: 'פתיחת תפריט',
    closeMenu: 'סגירת תפריט',
    langSwitch: 'EN',
  },
  en: {
    logo: 'Taruu',
    logoAria: 'Taruu, home page',
    nav: {
      home: 'Home',
      votes: 'Votes',
      economics: 'Civic Economics',
      treasury: 'Treasury Transparency',
      about: 'About',
      faq: 'FAQ',
    },
    cta: 'Join the Pilot',
    desktopNavAria: 'Primary navigation',
    mobileNavAria: 'Mobile navigation',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    langSwitch: 'עברית',
  },
};

const getNavLinks = (locale: Locale): NavLink[] => {
  const t = COPY[locale];
  return [
    { href: localePath(locale), label: t.nav.home },
    { href: `${localePrefix(locale)}/votes`, label: t.nav.votes },
    { href: `${localePrefix(locale)}/economics`, label: t.nav.economics },
    { href: `${localePrefix(locale)}/treasury`, label: t.nav.treasury },
    { href: `${localePrefix(locale)}/about`, label: t.nav.about },
    { href: `${localePrefix(locale)}/faq`, label: t.nav.faq },
  ];
};

export function Header({ locale = 'he' }: HeaderProps) {
  const t = COPY[locale];
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 16);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    if (isMobileMenuOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isMobileMenuOpen]);

  const navLinks = getNavLinks(locale);
  const closeMenu = () => setIsMobileMenuOpen(false);
  const switchLocale: Locale = locale === 'he' ? 'en' : 'he';
  const switchHref = localeSwitchPath(pathname, switchLocale);

  return (
    <motion.header
      className={clsx(styles.header, isScrolled && styles.scrolled)}
      initial={reducedMotion ? false : { y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={styles.bar}>
        <div className={styles.container}>
          <Link href={localePath(locale)} className={styles.logo} aria-label={t.logoAria}>
            <span className={`${styles.logoText} logo-text`}>{t.logo}</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className={styles.desktopNav} aria-label={t.desktopNavAria}>
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className={styles.navLink}>
                <span className={styles.navLabel}>{link.label}</span>
              </Link>
            ))}
          </nav>

          {/* Primary CTA */}
          <div className={styles.actions}>
            <Link href={switchHref} className={styles.langSwitch}>
              {t.langSwitch}
            </Link>

            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.ctaLink}
            >
              <RippleButton size="md">{t.cta}</RippleButton>
            </a>

            {/* Mobile Menu Button */}
            <button
              type="button"
              className={styles.mobileMenuButton}
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              aria-label={isMobileMenuOpen ? t.closeMenu : t.openMenu}
              aria-expanded={isMobileMenuOpen}
            >
              <span className={clsx(styles.hamburger, isMobileMenuOpen && styles.open)} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            className={styles.mobileNav}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <nav className={styles.mobileNavContent} aria-label={t.mobileNavAria}>
              {navLinks.map((link, index) => (
                <motion.div
                  key={link.href}
                  initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reducedMotion ? 0 : 0.05 + index * 0.05, duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Link href={link.href} className={styles.mobileNavLink} onClick={closeMenu}>
                    <span className={styles.navLabel}>{link.label}</span>
                  </Link>
                </motion.div>
              ))}

              <div className={styles.mobileCta}>
                <a
                  href={WHATSAPP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeMenu}
                  className={styles.mobileCtaLink}
                >
                  <RippleButton size="lg" isFullWidth>
                    {t.cta}
                  </RippleButton>
                </a>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
