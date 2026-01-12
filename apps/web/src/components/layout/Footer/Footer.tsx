'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Text } from '@/components/ui/Typography';
import { AnimatedFadeInUp } from '@/components/animations';
import type { Locale } from '@/lib/i18n';
import styles from './Footer.module.css';

const WHATSAPP_LINK = 'https://chat.whatsapp.com/FITvea9IVsn2Ljie1yCrAc';
const ISRAELGIVES_LINK = 'https://my.israelgives.org/he/fundme/taroo';

interface FooterProps {
  locale?: Locale;
}

const getFooterLinks = (locale: Locale) => ({
  product: {
    title: locale === 'en' ? 'Product' : 'המוצר',
    links: [
      { href: `/${locale}/about`, label: locale === 'en' ? 'About' : 'אודות' },
      { href: `/${locale}/votes`, label: locale === 'en' ? 'Votes' : 'הצבעות' },
      { href: WHATSAPP_LINK, label: locale === 'en' ? 'Pilot WhatsApp' : 'וואטסאפ הפיילוט', external: true },
      { href: ISRAELGIVES_LINK, label: locale === 'en' ? 'Support Project' : 'תמכו בפרויקט', external: true },
    ],
  },
  support: {
    title: locale === 'en' ? 'Support' : 'תמיכה',
    links: [
      { href: `/${locale}/faq`, label: locale === 'en' ? 'FAQ' : 'שאלות נפוצות' },
      { href: `/${locale}/contact`, label: locale === 'en' ? 'Contact' : 'יצירת קשר' },
    ],
  },
  legal: {
    title: locale === 'en' ? 'Legal' : 'משפטי',
    links: [
      { href: `/${locale}/privacy`, label: locale === 'en' ? 'Privacy Policy' : 'מדיניות פרטיות' },
      { href: `/${locale}/terms`, label: locale === 'en' ? 'Terms of Use' : 'תנאי שימוש' },
    ],
  },
});

export function Footer({ locale = 'he' }: FooterProps) {
  const footerLinks = getFooterLinks(locale);

  const t = {
    tagline: locale === 'en' ? 'Your Voice. Your Community.\nOur Future.' : 'הקול שלך. הקהילה שלך.\nהעתיד שלנו.',
    copyright: locale === 'en' ? 'Taro. All rights reserved.' : 'תַּרְאוּ. כל הזכויות שמורות.',
    builtBy: locale === 'en' ? 'Built with love by' : 'נבנה באהבה על ידי',
  };
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.grid}>
          {/* Brand Column */}
          <AnimatedFadeInUp className={styles.brandColumn}>
            <Link href={`/${locale}`} className={styles.logo}>
              <span className={`${styles.logoText} logo-text`}>תַּרְאוּ</span>
            </Link>
            <Text size="base" color="muted" className={styles.tagline}>
              {t.tagline.split('\n')[0]}
              <br />
              {t.tagline.split('\n')[1]}
            </Text>
            <div className={styles.socialLinks}>
              <a
                href="https://twitter.com/taro_il"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialLink}
                aria-label="Twitter"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://facebook.com/taro.il"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialLink}
                aria-label="Facebook"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9.198 21.5h4v-8.01h3.604l.396-3.98h-4V7.5a1 1 0 0 1 1-1h3v-4h-3a5 5 0 0 0-5 5v2.01h-2l-.396 3.98h2.396v8.01Z" />
                </svg>
              </a>
              <a
                href="https://linkedin.com/company/taro-il"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialLink}
                aria-label="LinkedIn"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6.94 5a2 2 0 1 1-4-.002 2 2 0 0 1 4 .002ZM7 8.48H3V21h4V8.48Zm6.32 0H9.34V21h3.94v-6.57c0-3.66 4.77-4 4.77 0V21H22v-7.93c0-6.17-7.06-5.94-8.72-2.91l.04-1.68Z" />
                </svg>
              </a>
            </div>
          </AnimatedFadeInUp>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([key, section], index) => (
            <AnimatedFadeInUp
              key={key}
              delay={0.1 * (index + 1)}
              className={styles.linkColumn}
            >
              <h4 className={styles.columnTitle}>{section.title}</h4>
              <ul className={styles.linkList}>
                {section.links.map((link) => (
                  <li key={link.href}>
                    {link.external ? (
                      <a
                        href={link.href}
                        className={styles.link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className={styles.link}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </AnimatedFadeInUp>
          ))}
        </div>

        {/* Bottom Bar */}
        <motion.div
          className={styles.bottomBar}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
        >
          <Text size="sm" color="muted">
            {currentYear} {t.copyright}
          </Text>
          <Text size="sm" color="muted">
            {t.builtBy}{' '}
            <a
              href="https://saharbarak.dev"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.signatureLink}
            >
              saharbarak.dev
            </a>
          </Text>
        </motion.div>
      </div>
    </footer>
  );
}
