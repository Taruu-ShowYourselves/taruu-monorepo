'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Heading, Text } from '@/components/ui/Typography';
import { AnimatedFadeInUp, AnimatedLetters } from '@/components/animations';
import styles from './CTA.module.css';

export function CTA() {
  return (
    <section className={styles.cta}>
      <div className={styles.container}>
        {/* Background Elements */}
        <motion.div
          className={styles.backgroundCircle}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.1, 0.15, 0.1],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        <div className={styles.content}>
          <AnimatedFadeInUp>
            <Text size="lg" color="accent" weight="semibold" align="center">
              הצטרפו עכשיו
            </Text>
          </AnimatedFadeInUp>

          <AnimatedFadeInUp delay={0.1}>
            <Heading level={2} align="center" className={styles.heading}>
              <AnimatedLetters text="הגיע הזמן" delay={0.2} />
              <br />
              <span className={styles.headingAccent}>
                <AnimatedLetters text="להשמיע את קולכם" delay={0.5} />
              </span>
            </Heading>
          </AnimatedFadeInUp>

          <AnimatedFadeInUp delay={0.3}>
            <Text size="xl" color="secondary" align="center" className={styles.description}>
              הצטרפו לאלפי אזרחים שכבר משפיעים על העתיד של הקהילה שלהם.
              ההצבעה הבאה מחכה לכם.
            </Text>
          </AnimatedFadeInUp>

          <motion.div
            className={styles.buttons}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Link href="/download">
              <Button size="xl">
                הורידו את האפליקציה
              </Button>
            </Link>
            <Link href="/about">
              <Button variant="outline" size="xl">
                למדו עוד
              </Button>
            </Link>
          </motion.div>

          {/* App Store Badges */}
          <motion.div
            className={styles.stores}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <Text size="sm" color="muted" align="center">
              זמין ב-App Store ו-Google Play
            </Text>
            <div className={styles.storeLogos}>
              <a
                href="https://apps.apple.com/app/sync"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.storeBadge}
                aria-label="הורידו מ-App Store"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=il.co.sync"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.storeBadge}
                aria-label="הורידו מ-Google Play"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.25-.84-.76-.84-1.35m13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27m3.35-4.31c.34.27.59.69.59 1.19s-.22.9-.57 1.18l-2.29 1.32-2.5-2.5 2.5-2.5 2.27 1.31M6.05 2.66l10.76 6.22-2.27 2.27L6.05 2.66z" />
                </svg>
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
