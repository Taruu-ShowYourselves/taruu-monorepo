'use client';

import { motion } from 'framer-motion';
import { Heading, Text } from '@/components/ui/Typography';
import { AnimatedFadeInUp } from '@/components/animations';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import styles from './AppFeatures.module.css';

const features = [
  {
    icon: '📊',
    title: 'הצבעות בזמן אמת',
    description: 'עקבו אחרי התוצאות בזמן אמת וקבלו התראות על הצבעות חדשות.',
  },
  {
    icon: '📍',
    title: 'אימות מיקום',
    description: 'הצביעו רק על נושאים ברשות המקומית שלכם עם אימות פשוט.',
  },
  {
    icon: '🔒',
    title: 'אבטחה מקסימלית',
    description: 'אימות מאובטח שמבטיח שהקול שלכם נשמר ומאומת.',
  },
  {
    icon: '📈',
    title: 'מעקב אחרי השפעה',
    description: 'ראו איך ההצבעות שלכם משפיעות על ההחלטות בקהילה.',
  },
  {
    icon: '📱',
    title: 'חוויה חלקה',
    description: 'ממשק אינטואיטיבי ומותאם למובייל בעברית מלאה.',
  },
  {
    icon: '🌐',
    title: 'שקיפות מלאה',
    description: 'כל הצבעה נשמרת ופתוחה לביקורת ציבורית.',
  },
];

export function AppFeatures() {
  return (
    <section className={styles.features}>
      <div className={styles.container}>
        <div className={styles.header}>
          <AnimatedFadeInUp>
            <Heading level={2} align="center">
              מה תקבלו באפליקציה
            </Heading>
          </AnimatedFadeInUp>
          <AnimatedFadeInUp delay={0.1}>
            <Text size="lg" color="secondary" align="center" className={styles.description}>
              כל מה שצריך כדי להשתתף בקבלת החלטות מקומיות - בקצות האצבעות.
            </Text>
          </AnimatedFadeInUp>
        </div>

        <motion.div
          className={styles.grid}
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              className={styles.featureCard}
              variants={fadeInUp}
            >
              <span className={styles.featureIcon}>{feature.icon}</span>
              <h3 className={styles.featureTitle}>{feature.title}</h3>
              <Text size="sm" color="secondary">
                {feature.description}
              </Text>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
