'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { Heading, Text } from '@/components/ui/Typography';
import styles from './HowItWorks.module.css';

const steps = [
  {
    number: '01',
    title: 'נרשמים בקלות',
    description:
      'אימייל או טלפון, ואז אימות קצר - וזהו, אתם בפנים.',
    details: [
      'הרשמה פשוטה תוך דקה',
      'אימות קצר לאבטחת החשבון',
      'מוכנים להשתתף',
    ],
  },
  {
    number: '02',
    title: 'רואים מה פתוח באזור שלכם',
    description:
      'הצבעות פעילות לפי הרשות המקומית שלכם - תראו על מה מצביעים ומה ההשלכות.',
    details: [
      'הצבעות רלוונטיות לאזור שלכם',
      'מידע ברור על כל נושא',
      'דיונים עם תושבים אחרים',
    ],
  },
  {
    number: '03',
    title: 'מצביעים ומשתתפים',
    description:
      'בוחרים את העמדה שלכם, מאמתים שאתם באזור, ומשלמים ₪3 דמי השתתפות.',
    details: [
      'אימות מיקום פשוט',
      'תשלום מאובטח',
      'ההצבעה נרשמת מיד',
    ],
  },
  {
    number: '04',
    title: 'עוקבים אחרי התוצאות והעדכונים',
    description:
      'תמונה ברורה לאורך זמן - תראו את התוצאות, תקבלו עדכונים, ותעקבו אחרי מה שקורה.',
    details: [
      'תוצאות שקופות ומאומתות',
      'התראות על עדכונים חשובים',
      'מעקב אחרי יישום ההחלטות',
    ],
  },
];

export function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  // Horizontal scroll: move track from right to left as user scrolls (RTL layout)
  // Start with cards visible on right, scroll reveals more to the left
  const x = useTransform(scrollYProgress, [0, 1], ['0%', '-60%']);

  // Progress bar width based on scroll
  const progressWidth = useTransform(scrollYProgress, [0.15, 0.85], ['0%', '100%']);

  return (
    <section className={styles.howItWorks} ref={containerRef}>
      {/* Header - Fixed at top */}
      <div className={styles.header}>
        <Text size="lg" color="accent" weight="semibold" align="center">
          איך זה עובד
        </Text>
        <Heading level={2} align="center">
          ארבעה צעדים פשוטים
        </Heading>
        <Text size="xl" color="secondary" align="center" className={styles.description}>
          מההרשמה ועד להשפעה אמיתית על הקהילה שלכם
        </Text>
      </div>

      {/* Horizontal Progress Line */}
      <div className={styles.progressLine}>
        <motion.div className={styles.progressFill} style={{ width: progressWidth }} />
      </div>

      {/* Horizontal Marquee Track */}
      <div className={styles.trackWrapper}>
        <motion.div className={styles.track} style={{ x }}>
          {steps.map((step) => (
            <div key={step.number} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.stepNumber}>
                  <span>{step.number}</span>
                </div>
                <h3 className={styles.stepTitle}>{step.title}</h3>
              </div>
              <Text size="base" color="secondary" className={styles.stepDescription}>
                {step.description}
              </Text>
              <ul className={styles.stepDetails}>
                {step.details.map((detail, detailIndex) => (
                  <li key={detailIndex}>
                    <span className={styles.checkIcon}>✓</span>
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
