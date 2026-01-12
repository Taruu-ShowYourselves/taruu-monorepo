'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Heading, Text } from '@/components/ui/Typography';
import { AnimatedFadeInUp } from '@/components/animations';
import styles from './Pilot.module.css';

export function Pilot() {
  return (
    <section className={styles.pilot}>
      {/* Background Typography */}
      <div className={styles.backgroundText}>פיילוט</div>

      <div className={styles.container}>
        {/* Section Header */}
        <div className={styles.header}>
          <AnimatedFadeInUp>
            <Text size="lg" color="inverse" weight="semibold" align="center">
              מתחילים
            </Text>
          </AnimatedFadeInUp>
          <AnimatedFadeInUp delay={0.1}>
            <Heading level={2} color="inverse" align="center">
              פיילוט ראשון: קריית טבעון
            </Heading>
          </AnimatedFadeInUp>
          <AnimatedFadeInUp delay={0.2}>
            <Text size="xl" color="muted" align="center" className={styles.subtitle}>
              מתחילים מקומית, בונים אמון, ומתרחבים רשות-רשות.
            </Text>
          </AnimatedFadeInUp>
        </div>

        {/* Info Cards */}
        <motion.div
          className={styles.grid}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren: 0.15,
              },
            },
          }}
        >
          <motion.div
            className={styles.infoCard}
            variants={{
              hidden: { opacity: 0, y: 30 },
              visible: {
                opacity: 1,
                y: 0,
                transition: {
                  duration: 0.5,
                  ease: [0.25, 0.1, 0.25, 1],
                },
              },
            }}
          >
            <div className={styles.cardIcon}>📍</div>
            <div className={styles.cardLabel}>הרשות הראשונה בסקופ</div>
            <Text size="lg" color="inverse" weight="semibold" align="center">
              קריית טבעון
            </Text>
          </motion.div>

          <motion.div
            className={styles.infoCard}
            variants={{
              hidden: { opacity: 0, y: 30 },
              visible: {
                opacity: 1,
                y: 0,
                transition: {
                  duration: 0.5,
                  ease: [0.25, 0.1, 0.25, 1],
                },
              },
            }}
          >
            <div className={styles.cardIcon}>📅</div>
            <div className={styles.cardLabel}>ההצבעה הבאה</div>
            <Text size="lg" color="inverse" weight="semibold" align="center">
              23.01.26
            </Text>
          </motion.div>
        </motion.div>

        {/* CTA Button */}
        <motion.div
          className={styles.cta}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Link href="/votes">
            <Button size="xl" variant="secondary">
              צפו בפרטי ההצבעה
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
