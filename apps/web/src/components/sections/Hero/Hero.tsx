'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Typography';
import {
  AnimatedLetters,
  AnimatedWords,
  AnimatedFadeInUp,
} from '@/components/animations';
import styles from './Hero.module.css';

export function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.container}>
        {/* Background Typography */}
        <motion.div
          className={styles.backgroundText}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.03 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          דמוקרטיה
        </motion.div>

        <div className={styles.content}>
          {/* Badge */}
          <AnimatedFadeInUp className={styles.badge}>
            <span className={styles.badgeIcon}>✦</span>
            <span>מופעל על בלוקצ׳יין Qubik</span>
          </AnimatedFadeInUp>

          {/* Main Heading */}
          <h1 className={styles.heading}>
            <AnimatedLetters text="הקול שלך." delay={0.2} />
            <br />
            <span className={styles.headingAccent}>
              <AnimatedLetters text="הקהילה שלך." delay={0.5} />
            </span>
            <br />
            <AnimatedLetters text="העתיד שלנו." delay={0.8} />
          </h1>

          {/* Subtitle */}
          <motion.div
            className={styles.subtitle}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.2 }}
          >
            <Text size="xl" color="secondary" align="center">
              <AnimatedWords
                text="סינק מאפשרת לתושבים להצביע על החלטות מקומיות, לעקוב אחרי התקדמות, ולהשפיע על העתיד של הקהילה שלהם - הכל באמצעות טכנולוגיית בלוקצ׳יין שקופה ומאובטחת."
                delay={1.4}
              />
            </Text>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            className={styles.cta}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.8 }}
          >
            <Link href="/download">
              <Button size="xl">
                הורידו את האפליקציה
              </Button>
            </Link>
            <Link href="/votes">
              <Button variant="outline" size="xl">
                צפו בהצבעות פומביות
              </Button>
            </Link>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            className={styles.trust}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 2.2 }}
          >
            <div className={styles.trustItem}>
              <span className={styles.trustNumber}>100%</span>
              <span className={styles.trustLabel}>שקיפות</span>
            </div>
            <div className={styles.trustDivider} />
            <div className={styles.trustItem}>
              <span className={styles.trustNumber}>₪1</span>
              <span className={styles.trustLabel}>להצבעה</span>
            </div>
            <div className={styles.trustDivider} />
            <div className={styles.trustItem}>
              <span className={styles.trustNumber}>GPS</span>
              <span className={styles.trustLabel}>מאומת</span>
            </div>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          className={styles.scrollIndicator}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 2.5 }}
        >
          <motion.div
            className={styles.scrollMouse}
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <div className={styles.scrollWheel} />
          </motion.div>
          <span className={styles.scrollText}>גללו למטה</span>
        </motion.div>
      </div>
    </section>
  );
}
