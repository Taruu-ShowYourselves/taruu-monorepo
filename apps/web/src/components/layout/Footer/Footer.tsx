'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { AnimatedFadeInUp } from '@/components/animations';
import type { Locale } from '@/lib/i18n';
import styles from './Footer.module.css';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';

const WHATSAPP_LINK = WHATSAPP_FOUNDERS_LINK;

interface FooterProps {
  locale?: Locale;
}

interface FooterLink {
  href: string;
  label: string;
  external?: boolean;
}

interface FooterSection {
  title: string;
  links: FooterLink[];
}

const getFooterLinks = (locale: Locale): FooterSection[] => [
  {
    title: 'המוצר',
    links: [
      { href: `/${locale}/about`, label: 'אודות' },
      { href: `/${locale}/votes`, label: 'הצבעות' },
      { href: `/${locale}/economics`, label: 'כלכלה אזרחית' },
      { href: `/${locale}/treasury`, label: 'שקיפות הקרן' },
    ],
  },
  {
    title: 'תמיכה',
    links: [
      { href: `/${locale}/faq`, label: 'שאלות נפוצות' },
      { href: `/${locale}/pricing`, label: 'תמחור' },
      { href: WHATSAPP_LINK, label: 'יצירת קשר · וואטסאפ', external: true },
    ],
  },
  {
    title: 'משפטי',
    links: [
      { href: `/${locale}/privacy`, label: 'מדיניות פרטיות' },
      { href: `/${locale}/terms`, label: 'תנאי שימוש' },
      { href: `/${locale}/refund`, label: 'מדיניות החזרים' },
    ],
  },
];

const SOCIAL_LINKS = [
  {
    href: 'https://twitter.com/taro_il',
    label: 'X (Twitter)',
    path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  },
  {
    href: 'https://facebook.com/taro.il',
    label: 'Facebook',
    path: 'M9.198 21.5h4v-8.01h3.604l.396-3.98h-4V7.5a1 1 0 0 1 1-1h3v-4h-3a5 5 0 0 0-5 5v2.01h-2l-.396 3.98h2.396v8.01Z',
  },
  {
    href: 'https://linkedin.com/company/taro-il',
    label: 'LinkedIn',
    path: 'M6.94 5a2 2 0 1 1-4-.002 2 2 0 0 1 4 .002ZM7 8.48H3V21h4V8.48Zm6.32 0H9.34V21h3.94v-6.57c0-3.66 4.77-4 4.77 0V21H22v-7.93c0-6.17-7.06-5.94-8.72-2.91l.04-1.68Z',
  },
];

export function Footer({ locale = 'he' }: FooterProps) {
  const footerSections = getFooterLinks(locale);
  const tagline = 'הקול שלכם. הקהילה שלכם. העתיד שלנו.';
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      {/* Brand-gradient consensus line - recurring divider motif */}
      <span aria-hidden className={`${styles.rule} lc-rule`} />

      <div className={styles.container}>
        <div className={styles.grid}>
          {/* Brand Column */}
          <AnimatedFadeInUp className={styles.brandColumn}>
            <Link href={`/${locale}`} className={styles.logo} aria-label="תַּרְאוּ, דף הבית">
              <span className={`${styles.logoText} logo-text`}>תַּרְאוּ</span>
            </Link>
            <p className={styles.tagline}>{tagline}</p>
            <div className={styles.socialLinks}>
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.href}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  aria-label={social.label}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d={social.path} />
                  </svg>
                </a>
              ))}
            </div>
          </AnimatedFadeInUp>

          {/* Link Columns */}
          {footerSections.map((section, index) => (
            <AnimatedFadeInUp
              key={section.title}
              delay={0.08 * (index + 1)}
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
                        <span className={styles.linkLabel}>{link.label}</span>
                      </a>
                    ) : (
                      <Link href={link.href} className={styles.link}>
                        <span className={styles.linkLabel}>{link.label}</span>
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
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <p className={styles.copyright}>
            {currentYear} · תַּרְאוּ. כל הזכויות שמורות.
          </p>
          <p className={styles.credit}>
            נבנה על ידי{' '}
            <a
              href="https://saharbarak.dev"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.signatureLink}
            >
              <span className={styles.linkLabel}>saharbarak.dev</span>
            </a>
          </p>
        </motion.div>
      </div>
    </footer>
  );
}
