'use client';

import { motion } from 'framer-motion';
import { Heading, Text } from '@/components/ui/Typography';
import { AnimatedLetters, AnimatedFadeInUp } from '@/components/animations';
import styles from './AboutHero.module.css';

export function AboutHero() {
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
          החזון
        </motion.div>

        <div className={styles.content}>
          <AnimatedFadeInUp>
            <Text size="lg" color="accent" weight="semibold" align="center">
              אודות תַּרְאוּ
            </Text>
          </AnimatedFadeInUp>

          <h1 className={styles.heading}>
            <AnimatedLetters text="אנחנו מאמינים" delay={0.2} />
            <br />
            <span className={styles.headingAccent}>
              <AnimatedLetters text="בכוח הקהילה" delay={0.5} />
            </span>
          </h1>

          <AnimatedFadeInUp delay={0.8}>
            <Text size="xl" color="secondary" align="center" className={styles.description}>
              תַּרְאוּ נוסדה מתוך אמונה עמוקה שכל אזרח צריך להיות שותף אמיתי
              בקבלת ההחלטות המשפיעות על חייו. אנחנו בונים את הכלים שיאפשרו
              לכם להשפיע על העתיד של הקהילה שלכם.
            </Text>
          </AnimatedFadeInUp>
        </div>
      </div>
    </section>
  );
}
