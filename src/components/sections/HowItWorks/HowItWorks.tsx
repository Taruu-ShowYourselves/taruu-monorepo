'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { Heading, Text } from '@/components/ui/Typography';
import { AnimatedFadeInUp, AnimatedWords } from '@/components/animations';
import styles from './HowItWorks.module.css';

const steps = [
  {
    number: '01',
    title: 'הירשמו והתחברו',
    description:
      'צרו חשבון באמצעות Clerk, חברו את הרשתות החברתיות שלכם לאימות החתימה החברתית, ואמתו את זהותכם.',
    details: [
      'הרשמה מהירה עם אימייל או טלפון',
      'חיבור חשבונות רשתות חברתיות',
      'אימות זהות מאובטח',
    ],
  },
  {
    number: '02',
    title: 'גלו הצבעות מקומיות',
    description:
      'צפו בהצבעות פעילות ברשות המקומית שלכם, קראו על הנושאים השונים, והבינו את ההשלכות של כל החלטה.',
    details: [
      'סינון לפי רשות מקומית אוטומטי',
      'מידע מפורט על כל הצבעה',
      'תגובות ודיונים קהילתיים',
    ],
  },
  {
    number: '03',
    title: 'הצביעו ותרמו ₪1',
    description:
      'בחרו את האפשרות המועדפת עליכם, אמתו את מיקומכם באמצעות GPS, ותרמו ₪1 כאות רצינות והוכחת אזרחות.',
    details: [
      'אימות GPS בזמן אמת',
      'תשלום מאובטח דרך Green Invoice',
      'קבלת טוקני Sync כתמורה',
    ],
  },
  {
    number: '04',
    title: 'עקבו אחרי התוצאות',
    description:
      'צפו בתוצאות בזמן אמת, קבלו עדכונים על החלטות שהתקבלו, ועקבו אחרי יישום ההחלטות ברשות המקומית.',
    details: [
      'תוצאות שקופות על הבלוקצ׳יין',
      'התראות על עדכונים חשובים',
      'מעקב אחרי יישום החלטות',
    ],
  },
];

export function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const lineHeight = useTransform(scrollYProgress, [0.1, 0.9], ['0%', '100%']);

  return (
    <section className={styles.howItWorks} ref={containerRef}>
      <div className={styles.container}>
        {/* Section Header */}
        <div className={styles.header}>
          <AnimatedFadeInUp>
            <Text size="lg" color="accent" weight="semibold" align="center">
              איך זה עובד
            </Text>
          </AnimatedFadeInUp>
          <AnimatedFadeInUp delay={0.1}>
            <Heading level={2} align="center">
              <AnimatedWords text="ארבעה צעדים פשוטים" delay={0.2} />
            </Heading>
          </AnimatedFadeInUp>
          <AnimatedFadeInUp delay={0.2}>
            <Text size="xl" color="secondary" align="center" className={styles.description}>
              מההרשמה ועד להשפעה אמיתית על הקהילה שלכם - התהליך פשוט, מאובטח ושקוף.
            </Text>
          </AnimatedFadeInUp>
        </div>

        {/* Steps */}
        <div className={styles.steps}>
          {/* Progress Line */}
          <div className={styles.progressLine}>
            <motion.div className={styles.progressFill} style={{ height: lineHeight }} />
          </div>

          {steps.map((step, index) => (
            <AnimatedFadeInUp
              key={step.number}
              delay={0.1 * index}
              className={styles.step}
            >
              <div className={styles.stepNumber}>
                <span>{step.number}</span>
              </div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <Text size="lg" color="secondary" className={styles.stepDescription}>
                  {step.description}
                </Text>
                <ul className={styles.stepDetails}>
                  {step.details.map((detail, detailIndex) => (
                    <motion.li
                      key={detailIndex}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + detailIndex * 0.1 }}
                    >
                      <span className={styles.checkIcon}>✓</span>
                      {detail}
                    </motion.li>
                  ))}
                </ul>
              </div>
            </AnimatedFadeInUp>
          ))}
        </div>
      </div>
    </section>
  );
}
