'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import type { Locale } from '@/lib/i18n';
import clsx from 'clsx';
import styles from './Header.module.css';

const WHATSAPP_LINK = 'https://chat.whatsapp.com/FITvea9IVsn2Ljie1yCrAc';

interface HeaderProps {
  locale?: Locale;
}

const getNavLinks = (locale: Locale) => [
  { href: `/${locale}`, label: locale === 'en' ? 'Home' : 'בית' },
  { href: `/${locale}/about`, label: locale === 'en' ? 'About' : 'אודות' },
  { href: `/${locale}/votes`, label: locale === 'en' ? 'Votes' : 'הצבעות' },
  { href: WHATSAPP_LINK, label: locale === 'en' ? 'Pilot WhatsApp' : 'וואטסאפ הפיילוט', external: true },
];

export function Header({ locale = 'he' }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAuthenticated, user, signOut, isLoading } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // User avatar or initials
  const userInitials = user
    ? (user.firstName?.[0] || user.email?.[0] || '?').toUpperCase()
    : '?';

  const navLinks = getNavLinks(locale);

  // Localized text
  const t = {
    support: locale === 'en' ? 'Support Project' : 'תמכו בפרויקט',
    login: locale === 'en' ? 'Login' : 'התחברות',
    signup: locale === 'en' ? 'Sign Up' : 'הרשמה',
    comingSoon: locale === 'en' ? 'Coming Soon' : 'בקרוב',
    dashboard: locale === 'en' ? 'Dashboard' : 'לוח בקרה',
    user: locale === 'en' ? 'User' : 'משתמש',
    profile: locale === 'en' ? 'Profile' : 'פרופיל',
    settings: locale === 'en' ? 'Settings' : 'הגדרות',
    signOut: locale === 'en' ? 'Sign Out' : 'התנתקות',
    openMenu: locale === 'en' ? 'Open menu' : 'פתח תפריט',
    closeMenu: locale === 'en' ? 'Close menu' : 'סגור תפריט',
  };

  return (
    <motion.header
      className={clsx(styles.header, isScrolled && styles.scrolled)}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div className={styles.container}>
        <Link href={`/${locale}`} className={styles.logo}>
          <span className={`${styles.logoText} logo-text`}>תַּרְאוּ</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className={styles.desktopNav}>
          {navLinks.map((link) => (
            link.external ? (
              <a
                key={link.href}
                href={link.href}
                className={styles.navLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className={styles.navLink}>
                {link.label}
              </Link>
            )
          ))}
        </nav>

        {/* Auth Buttons */}
        <div className={styles.actions}>
          <LanguageToggle locale={locale} />
          <a
            href="https://my.israelgives.org/he/fundme/taroo"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.headstartLink}
          >
            <Button variant="secondary" size="sm">
              {t.support}
            </Button>
          </a>
          {!isLoading && (
            <>
              {!isAuthenticated ? (
                <>
                  <Button variant="ghost" size="sm" disabled title={t.comingSoon}>
                    {t.login}
                  </Button>
                  <Button variant="primary" size="sm" disabled title={t.comingSoon}>
                    {t.signup}
                  </Button>
                </>
              ) : (
                <>
                  <Link href={`/${locale}/dashboard`}>
                    <Button variant="ghost" size="sm">
                      {t.dashboard}
                    </Button>
                  </Link>
                  <div className={styles.userMenu}>
                    <button className={styles.avatarButton}>
                      <span className={styles.avatar}>{userInitials}</span>
                    </button>
                    <div className={styles.userDropdown}>
                      <div className={styles.userInfo}>
                        <span className={styles.userName}>
                          {user?.firstName || t.user}
                        </span>
                        <span className={styles.userEmail}>{user?.email}</span>
                      </div>
                      <hr className={styles.divider} />
                      <Link href={`/${locale}/profile`} className={styles.dropdownItem}>
                        {t.profile}
                      </Link>
                      <Link href={`/${locale}/settings`} className={styles.dropdownItem}>
                        {t.settings}
                      </Link>
                      <hr className={styles.divider} />
                      <button
                        className={styles.dropdownItem}
                        onClick={() => signOut()}
                      >
                        {t.signOut}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* Mobile Menu Button */}
          <button
            className={styles.mobileMenuButton}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? t.closeMenu : t.openMenu}
          >
            <span
              className={clsx(styles.hamburger, isMobileMenuOpen && styles.open)}
            />
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            className={styles.mobileNav}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <nav className={styles.mobileNavContent}>
              {navLinks.map((link, index) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  {link.external ? (
                    <a
                      href={link.href}
                      className={styles.mobileNavLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className={styles.mobileNavLink}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  )}
                </motion.div>
              ))}

              <div className={styles.mobileAuthButtons}>
                <div className={styles.mobileLanguageToggle}>
                  <LanguageToggle locale={locale} />
                </div>
                <a
                  href="https://my.israelgives.org/he/fundme/taroo"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Button variant="secondary" isFullWidth>
                    {t.support}
                  </Button>
                </a>
                {isAuthenticated && (
                  <>
                    <Link href={`/${locale}/dashboard`} onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="outline" isFullWidth>
                        {t.dashboard}
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      isFullWidth
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        signOut();
                      }}
                    >
                      {t.signOut}
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
