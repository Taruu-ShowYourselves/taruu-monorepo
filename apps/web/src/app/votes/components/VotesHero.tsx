'use client';

import { motion } from 'framer-motion';
import { Heading, Text } from '@/components/ui/Typography';
import { AnimatedFadeInUp, AnimatedWords } from '@/components/animations';
import styles from './VotesHero.module.css';

export function VotesHero() {
  return (
    <section className={styles.hero}>
      <div className={styles.container}>
        <AnimatedFadeInUp>
          <Text size="lg" color="accent" weight="semibold" align="center">
            הצבעות פומביות
          </Text>
        </AnimatedFadeInUp>

        <AnimatedFadeInUp delay={0.1}>
          <Heading level={1} align="center">
            <AnimatedWords text="כל הקולות. כל ההחלטות." delay={0.2} />
          </Heading>
        </AnimatedFadeInUp>

        <AnimatedFadeInUp delay={0.3}>
          <Text size="xl" color="secondary" align="center" className={styles.description}>
            צפו בהצבעות פעילות ברשויות המקומיות, עקבו אחרי תוצאות,
            וראו כיצד הקהילה מקבלת החלטות יחד.
          </Text>
        </AnimatedFadeInUp>

        {/* Filter Pills */}
        <motion.div
          className={styles.filters}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <button className={`${styles.filterPill} ${styles.active}`}>
            הכל
          </button>
          <button className={styles.filterPill}>פעילות</button>
          <button className={styles.filterPill}>הסתיימו</button>
          <button className={styles.filterPill}>ממתינות</button>
        </motion.div>
      </div>
    </section>
  );
}
