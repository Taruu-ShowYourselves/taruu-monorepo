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
import { useReducedMotion } from '@/hooks';
import { HeroParallax } from './HeroParallax';
import styles from './Hero.module.css';

export function Hero() {
  const reducedMotion = useReducedMotion();

  return (
    <section className={styles.hero}>
      {/* Parallax Background Layers */}
      <HeroParallax />

      <div className={styles.container}>
        {/* Background Typography */}
        <motion.div
          className={styles.backgroundText}
          initial={{ opacity: reducedMotion ? 0.03 : 0 }}
          animate={{ opacity: 0.03 }}
          transition={{ duration: reducedMotion ? 0 : 1, delay: reducedMotion ? 0 : 0.5 }}
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
            <AnimatedLetters text="הקול המקומי," delay={0.2} />
            <br />
            <span className={styles.headingAccent}>
              <AnimatedLetters text="בצורה שאפשר למדוד." delay={0.5} />
            </span>
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
                text="תֵּרָאוּ עוזרת לקהילות ליצור רוב אזרחי מקומי ושקוף—שמציג תמונת מצב לצד הנרטיב הרשמי, ומסייע לרשויות להתיישר עם הדאגות והדעות של התושבים."
                delay={1.4}
              />
            </Text>
          </motion.div>

          {/* Why Now Line */}
          <motion.p
            className={styles.whyNow}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.6 }}
          >
            היום קל למדוד דעת קהל—השאלה היא אם עושים את זה הוגן ומקומי.
          </motion.p>

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

          {/* Trust Badges */}
          <motion.div
            className={styles.trustBadges}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 2.2 }}
          >
            <div className={styles.trustBadge}>
              <span className={styles.badgeIcon}>✦</span>
              <span>שקיפות תוצאות</span>
            </div>
            <div className={styles.trustBadge}>
              <span className={styles.badgeIcon}>✦</span>
              <span>₪3 דמי השתתפות להצבעה</span>
            </div>
            <div className={styles.trustBadge}>
              <span className={styles.badgeIcon}>✦</span>
              <span>אימות תושב לפי מיקום</span>
            </div>
          </motion.div>

          {/* Beta Disclaimer */}
          <motion.div
            className={styles.betaDisclaimer}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 2.4 }}
          >
            <Text size="xs" color="muted" align="center">
              פיילוט בהרצה. התכונות והנהלים עשויים להשתנות עם הקהילה והרשות.
            </Text>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
