'use client';

import { motion } from 'framer-motion';
import { Heading, Text } from '@/components/ui/Typography';
import { AnimatedLetters, AnimatedFadeInUp } from '@/components/animations';
import styles from './HeroSection.module.css';

export function HeroSection() {
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
          כלכלה
        </motion.div>

        <div className={styles.content}>
          <AnimatedFadeInUp>
            <Text size="lg" color="accent" weight="semibold" align="center">
              הכלכלה של תַּרְאוּ
            </Text>
          </AnimatedFadeInUp>

          <h1 className={styles.heading}>
            <AnimatedLetters text="כסף מקומי" delay={0.2} />
            <br />
            <span className={styles.headingAccent}>
              <AnimatedLetters text="× תמיכה גלובלית" delay={0.5} />
            </span>
            <br />
            <span className={styles.headingSecondary}>
              <AnimatedLetters text="= שינוי אמיתי" delay={0.8} />
            </span>
          </h1>

          <AnimatedFadeInUp delay={1.0}>
            <Text
              size="xl"
              color="secondary"
              align="center"
              className={styles.description}
            >
              איך תַּרְאוּ הופכת כל שקל להשפעה מוכפלת
            </Text>
          </AnimatedFadeInUp>

          <AnimatedFadeInUp delay={1.2}>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.statValue}>₪3</span>
                <span className={styles.statLabel}>עלות הצבעה</span>
              </div>
              <div className={styles.statDivider}>→</div>
              <div className={styles.stat}>
                <span className={styles.statValue}>₪300+</span>
                <span className={styles.statLabel}>השפעה פוטנציאלית</span>
              </div>
            </div>
          </AnimatedFadeInUp>
        </div>
      </div>
    </section>
  );
}
