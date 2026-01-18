'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import styles from './CTASection.module.css';

interface CTASectionProps {
  locale: Locale;
}

export function CTASection({ locale }: CTASectionProps) {
  return (
    <section className={styles.cta}>
      <div className={styles.container}>
        <motion.div
          className={styles.content}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className={styles.title}>מוכנים להצטרף?</h2>
          <p className={styles.subtitle}>
            הורידו את האפליקציה והתחילו להשפיע על הקהילה שלכם
          </p>

          <div className={styles.buttons}>
            <Link href={`/${locale}/download`} className={styles.primaryButton}>
              <span className={styles.buttonIcon}>📱</span>
              <span className={styles.buttonText}>
                <span className={styles.buttonLabel}>הורידו את האפליקציה</span>
                <span className={styles.buttonSub}>iOS & Android</span>
              </span>
            </Link>

            <Link href={`/${locale}/support`} className={styles.secondaryButton}>
              <span className={styles.buttonIcon}>🌍</span>
              <span className={styles.buttonText}>
                <span className={styles.buttonLabel}>Connect Wallet</span>
                <span className={styles.buttonSub}>Support from anywhere</span>
              </span>
            </Link>
          </div>

          <motion.div
            className={styles.stats}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className={styles.statItem}>
              <span className={styles.statValue}>₪3</span>
              <span className={styles.statLabel}>עלות הצבעה</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>
              <span className={styles.statValue}>70%</span>
              <span className={styles.statLabel}>לקרן הרשות</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>
              <span className={styles.statValue}>NFT</span>
              <span className={styles.statLabel}>לכל משתתף</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Background decoration */}
        <div className={styles.backgroundPattern} />
      </div>
    </section>
  );
}
