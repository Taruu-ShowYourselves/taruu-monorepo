'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { RippleButton } from '@/components/ui/RippleButton';
import { useReducedMotion } from '@/hooks';
import type { Locale } from '@/lib/i18n';
import clsx from 'clsx';
import styles from './Header.module.css';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';

const WHATSAPP_LINK = WHATSAPP_FOUNDERS_LINK;

interface HeaderProps {
  locale?: Locale;
}

interface NavLink {
  href: string;
  label: string;
}

const getNavLinks = (locale: Locale): NavLink[] => [
  { href: `/${locale}`, label: 'בית' },
  { href: `/${locale}/votes`, label: 'הצבעות' },
  { href: `/${locale}/economics`, label: 'כלכלה אזרחית' },
  { href: `/${locale}/treasury`, label: 'שקיפות הקרן' },
  { href: `/${locale}/about`, label: 'אודות' },
  { href: `/${locale}/faq`, label: 'שאלות נפוצות' },
];

export function Header({ locale = 'he' }: HeaderProps) {
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

  return (
    <motion.header
      className={clsx(styles.header, isScrolled && styles.scrolled)}
      initial={reducedMotion ? false : { y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={styles.bar}>
        <div className={styles.container}>
          <Link href={`/${locale}`} className={styles.logo} aria-label="תַּרְאוּ, דף הבית">
            <span className={`${styles.logoText} logo-text`}>תַּרְאוּ</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className={styles.desktopNav} aria-label="ניווט ראשי">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className={styles.navLink}>
                <span className={styles.navLabel}>{link.label}</span>
              </Link>
            ))}
          </nav>

          {/* Primary CTA */}
          <div className={styles.actions}>
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.ctaLink}
            >
              <RippleButton size="md">הצטרפו לפיילוט</RippleButton>
            </a>

            {/* Mobile Menu Button */}
            <button
              type="button"
              className={styles.mobileMenuButton}
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              aria-label={isMobileMenuOpen ? 'סגירת תפריט' : 'פתיחת תפריט'}
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
            <nav className={styles.mobileNavContent} aria-label="ניווט נייד">
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
                    הצטרפו לפיילוט
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
