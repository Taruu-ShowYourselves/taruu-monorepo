'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Text } from '@/components/ui/Typography';
import { AnimatedFadeInUp } from '@/components/animations';
import styles from './Footer.module.css';

const footerLinks = {
  product: {
    title: 'המוצר',
    links: [
      { href: '/about', label: 'אודות' },
      { href: '/votes', label: 'הצבעות פומביות' },
      { href: '/download', label: 'הורדת האפליקציה' },
      { href: '/pricing', label: 'מחירון' },
    ],
  },
  support: {
    title: 'תמיכה',
    links: [
      { href: '/help', label: 'מרכז עזרה' },
      { href: '/contact', label: 'יצירת קשר' },
      { href: '/faq', label: 'שאלות נפוצות' },
    ],
  },
  legal: {
    title: 'משפטי',
    links: [
      { href: '/privacy', label: 'מדיניות פרטיות' },
      { href: '/terms', label: 'תנאי שימוש' },
      { href: '/cookies', label: 'מדיניות עוגיות' },
    ],
  },
};

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.grid}>
          {/* Brand Column */}
          <AnimatedFadeInUp className={styles.brandColumn}>
            <Link href="/" className={styles.logo}>
              <span className={styles.logoText}>סינק</span>
            </Link>
            <Text size="base" color="muted" className={styles.tagline}>
              הקול שלך. הקהילה שלך.
              <br />
              העתיד שלנו.
            </Text>
            <div className={styles.socialLinks}>
              <a
                href="https://twitter.com/sync_il"
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
                href="https://facebook.com/sync.il"
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
                href="https://linkedin.com/company/sync-il"
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
                    <Link href={link.href} className={styles.link}>
                      {link.label}
                    </Link>
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
            {currentYear} סינק. כל הזכויות שמורות.
          </Text>
          <Text size="sm" color="muted">
            נבנה באהבה בישראל
          </Text>
        </motion.div>
      </div>
    </footer>
  );
}
