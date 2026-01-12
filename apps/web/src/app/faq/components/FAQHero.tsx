'use client';

import { motion } from 'framer-motion';
import { Text } from '@/components/ui/Typography';
import { AnimatedLetters, AnimatedFadeInUp } from '@/components/animations';
import styles from './FAQHero.module.css';

export function FAQHero() {
  return (
    <section className={styles.hero}>
      <div className={styles.container}>
        <motion.div
          className={styles.backgroundText}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.03 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          שאלות
        </motion.div>

        <div className={styles.content}>
          <AnimatedFadeInUp>
            <Text size="lg" color="accent" weight="semibold" align="center">
              מרכז עזרה
            </Text>
          </AnimatedFadeInUp>

          <h1 className={styles.heading}>
            <AnimatedLetters text="שאלות נפוצות" delay={0.2} />
          </h1>

          <AnimatedFadeInUp delay={0.5}>
            <Text size="xl" color="secondary" align="center" className={styles.description}>
              כל מה שצריך לדעת על תֵּרָאוּ - מההרשמה ועד להשפעה על הקהילה שלכם
            </Text>
          </AnimatedFadeInUp>
        </div>
      </div>
    </section>
  );
}
