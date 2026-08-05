'use client';

import { motion } from 'framer-motion';
import type { Locale } from '@/lib/i18n';
import styles from './TrustBar.module.css';

interface TrustBarProps {
  locale?: Locale;
}

const ITEMS = [
  {
    key: 'gps',
    label: 'אימות תושב לפי מיקום (GPS)',
    icon: (
      <path
        d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z M12 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    ),
  },
  {
    key: 'chain',
    label: 'כל קול חתום בבלוקצ׳יין',
    icon: (
      <path
        d="M10 13a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5l-1 1 M14 11a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5l1-1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    key: 'live',
    label: 'פיילוט חי: קריית טבעון, 23.01.26',
    live: true,
    icon: (
      <path
        d="M9 12.5l2 2 4-4.5 M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

export function TrustBar(_props: TrustBarProps) {
  return (
    <section className={styles.section} aria-label="אמון ואבטחה">
      <div className={styles.container}>
        <motion.ul
          className={styles.bar}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
          variants={{ show: { transition: { staggerChildren: 0.08 } } }}
        >
          {ITEMS.map((item) => (
            <motion.li
              key={item.key}
              className={styles.item}
              variants={{
                hidden: { opacity: 0, y: 10 },
                show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
              }}
            >
              <span className={`${styles.icon} ${item.live ? styles.iconLive : ''}`}>
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                  {item.icon}
                </svg>
                {item.live ? <span className={styles.pulse} aria-hidden /> : null}
              </span>
              <span className={styles.label}>{item.label}</span>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
