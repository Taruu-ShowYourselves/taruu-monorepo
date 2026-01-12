'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { Heading, Text } from '@/components/ui/Typography';
import type { Locale } from '@/lib/i18n';
import styles from './HowItWorks.module.css';

interface HowItWorksProps {
  locale?: Locale;
}

const getSteps = (locale: Locale) => [
  {
    number: '01',
    title: locale === 'en' ? 'Easy Registration' : 'נרשמים בקלות',
    description: locale === 'en'
      ? 'Email or phone, quick verification — that\'s it, you\'re part of the influential community.'
      : 'אימייל או טלפון, אימות קצר — וזהו, אתם חלק מהקהילה המשפיעה.',
  },
  {
    number: '02',
    title: locale === 'en' ? 'See What\'s Happening (Or Propose a Topic)' : 'רואים מה קורה (או מציעים נושא)',
    description: locale === 'en'
      ? 'Discover active votes in Kiryat Tivon, or propose a new topic you want to bring to the agenda.'
      : 'מגלים הצבעות פעילות בקריית טבעון, או מציעים נושא חדש שחשוב לכם להעלות לסדר היום.',
  },
  {
    number: '03',
    title: locale === 'en' ? 'Vote and Participate' : 'מצביעים ומשתתפים',
    description: locale === 'en'
      ? 'Choose a position, verify presence (GPS), and participate with ₪3 fee that backs your position professionally.'
      : 'בוחרים עמדה, מאמתים נוכחות (GPS) ומשתתפים ב-₪3 דמי השתתפות שנותנים גב מקצועי לעמדה שלכם.',
  },
  {
    number: '04',
    title: locale === 'en' ? 'Follow the Results' : 'עוקבים אחרי התוצאות',
    description: locale === 'en'
      ? 'Watch data in real time. Results are presented to the council as a clear, transparent, data-backed community position.'
      : 'צופים בנתונים בזמן אמת. התוצאות מוגשות למועצה כעמדה קהילתית ברורה, שקופה ומגובה בנתונים.',
  },
];

export function HowItWorks({ locale = 'he' }: HowItWorksProps) {
  const steps = getSteps(locale);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const t = {
    label: locale === 'en' ? 'How It Works' : 'איך זה עובד',
    title: locale === 'en' ? 'Four Simple Steps' : 'ארבעה צעדים פשוטים',
    subtitle: locale === 'en'
      ? 'From registration to real impact on your community'
      : 'מההרשמה ועד להשפעה אמיתית על הקהילה שלכם',
  };
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  // Horizontal scroll: cards slide in from off-screen as user scrolls (desktop only)
  // On mobile, use native touch scroll instead
  const x = useTransform(scrollYProgress, [0, 0.5], ['100%', '0%']);

  // Progress bar width based on scroll
  const progressWidth = useTransform(scrollYProgress, [0.15, 0.85], ['0%', '100%']);

  return (
    <section className={styles.howItWorks} ref={containerRef}>
      {/* Header - Fixed at top */}
      <div className={styles.header}>
        <Text size="lg" color="accent" weight="semibold" align="center">
          {t.label}
        </Text>
        <Heading level={2} align="center">
          {t.title}
        </Heading>
        <Text size="xl" color="secondary" align="center" className={styles.description}>
          {t.subtitle}
        </Text>
      </div>

      {/* Horizontal Progress Line */}
      <div className={styles.progressLine}>
        <motion.div className={styles.progressFill} style={{ width: progressWidth }} />
      </div>

      {/* Horizontal Marquee Track */}
      <div className={styles.trackWrapper}>
        <motion.div
          className={styles.track}
          style={isMobile ? undefined : { x }}
        >
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
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
