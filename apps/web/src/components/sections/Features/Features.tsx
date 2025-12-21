'use client';

import { motion } from 'framer-motion';
import { Heading, Text } from '@/components/ui/Typography';
import { Card, CardContent } from '@/components/ui/Card';
import { AnimatedFadeInUp, AnimatedWords } from '@/components/animations';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import styles from './Features.module.css';

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
    title: 'אימות רב-שכבתי',
    description:
      'שילוב ייחודי של אימות Clerk, חתימה חברתית, GPS ותשלום של ₪1 מבטיח שכל הצבעה אמיתית ומאומתת.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
    ),
    title: 'בלוקצ׳יין Qubik',
    description:
      'כל הצבעה נרשמת באופן בלתי הפיך על בלוקצ׳יין Qubik, מבטיחה שקיפות מלאה ומניעת זיוף.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    title: 'הצבעות בזמן אמת',
    description:
      'עקבו אחרי התוצאות בזמן אמת, קבלו התראות על הצבעות חדשות, וראו את השפעת הקול שלכם.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    title: 'אימות מיקום GPS',
    description:
      'ודאו שאתם מצביעים רק על נושאים הרלוונטיים לרשות המקומית שלכם באמצעות אימות מיקום מדויק.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
    title: 'טוקני Sync',
    description:
      'כל תרומה של ₪1 מזכה אתכם בטוקני Sync, שערכם צפוי לעלות ככל שהפלטפורמה גדלה.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: 'חתימה חברתית',
    description:
      'אלגוריתם ייחודי המאמת את זהותכם באמצעות חיבור חשבונות הרשתות החברתיות שלכם.',
  },
];

export function Features() {
  return (
    <section className={styles.features}>
      <div className={styles.container}>
        {/* Section Header */}
        <div className={styles.header}>
          <AnimatedFadeInUp>
            <Text size="lg" color="accent" weight="semibold" align="center">
              היתרונות שלנו
            </Text>
          </AnimatedFadeInUp>
          <AnimatedFadeInUp delay={0.1}>
            <Heading level={2} align="center">
              <AnimatedWords text="למה לבחור בסינק?" delay={0.2} />
            </Heading>
          </AnimatedFadeInUp>
          <AnimatedFadeInUp delay={0.2}>
            <Text size="xl" color="secondary" align="center" className={styles.description}>
              פלטפורמה מתקדמת המשלבת טכנולוגיה חדשנית עם ערכים דמוקרטיים,
              מאפשרת לכל אזרח להשמיע את קולו בצורה מאובטחת ושקופה.
            </Text>
          </AnimatedFadeInUp>
        </div>

        {/* Features Grid */}
        <motion.div
          className={styles.grid}
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
        >
          {features.map((feature, index) => (
            <motion.div key={feature.title} variants={fadeInUp}>
              <Card variant="default" padding="lg" interactive className={styles.card}>
                <CardContent>
                  <div className={styles.iconWrapper}>{feature.icon}</div>
                  <h3 className={styles.cardTitle}>{feature.title}</h3>
                  <Text size="base" color="secondary">
                    {feature.description}
                  </Text>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
