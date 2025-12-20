'use client';

import { motion } from 'framer-motion';
import { Heading, Text } from '@/components/ui/Typography';
import { AnimatedLetters, AnimatedFadeInUp } from '@/components/animations';
import styles from './DownloadHero.module.css';

export function DownloadHero() {
  return (
    <section className={styles.hero}>
      <div className={styles.container}>
        <div className={styles.content}>
          <AnimatedFadeInUp>
            <Text size="lg" color="accent" weight="semibold" align="center">
              הורידו עכשיו
            </Text>
          </AnimatedFadeInUp>

          <h1 className={styles.heading}>
            <AnimatedLetters text="סינק בכיס שלכם" delay={0.2} />
          </h1>

          <AnimatedFadeInUp delay={0.5}>
            <Text size="xl" color="secondary" align="center" className={styles.description}>
              הורידו את האפליקציה והתחילו להשפיע על החלטות מקומיות
              בכל מקום ובכל זמן. הצביעו, עקבו, והיו חלק מהשינוי.
            </Text>
          </AnimatedFadeInUp>

          {/* App Store Buttons */}
          <motion.div
            className={styles.storeButtons}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <a
              href="https://apps.apple.com/app/sync"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.storeButton}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className={styles.storeIcon}>
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              <div className={styles.storeText}>
                <span className={styles.storeLabel}>הורידו מ-</span>
                <span className={styles.storeName}>App Store</span>
              </div>
            </a>

            <a
              href="https://play.google.com/store/apps/details?id=il.co.sync"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.storeButton}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className={styles.storeIcon}>
                <path d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.25-.84-.76-.84-1.35m13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27m3.35-4.31c.34.27.59.69.59 1.19s-.22.9-.57 1.18l-2.29 1.32-2.5-2.5 2.5-2.5 2.27 1.31M6.05 2.66l10.76 6.22-2.27 2.27L6.05 2.66z" />
              </svg>
              <div className={styles.storeText}>
                <span className={styles.storeLabel}>הורידו מ-</span>
                <span className={styles.storeName}>Google Play</span>
              </div>
            </a>
          </motion.div>

          {/* QR Codes */}
          <motion.div
            className={styles.qrSection}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            <Text size="sm" color="muted" align="center">
              או סרקו את הקוד עם הטלפון שלכם
            </Text>
            <div className={styles.qrCodes}>
              <div className={styles.qrCode}>
                <div className={styles.qrPlaceholder}>QR</div>
                <span>iOS</span>
              </div>
              <div className={styles.qrCode}>
                <div className={styles.qrPlaceholder}>QR</div>
                <span>Android</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Phone Mockup */}
        <motion.div
          className={styles.mockup}
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        >
          <div className={styles.phone}>
            <div className={styles.phoneScreen}>
              <div className={styles.screenContent}>
                <div className={styles.appHeader}>סינק</div>
                <div className={styles.appCard} />
                <div className={styles.appCard} />
                <div className={styles.appNav} />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
