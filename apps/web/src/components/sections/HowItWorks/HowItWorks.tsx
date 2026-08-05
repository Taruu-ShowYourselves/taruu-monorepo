'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { GradientText } from '@/components/ui/GradientText';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Heading, Text } from '@/components/ui/Typography';
import { AnimatedFadeInUp } from '@/components/animations';
import { useReducedMotion } from '@/hooks';
import { StoryScene, type StorySceneVariant } from '@/components/illustrations';
import type { Locale } from '@/lib/i18n';
import styles from './HowItWorks.module.css';

interface HowItWorksProps {
  locale?: Locale;
}

type Accent = 'blue' | 'green' | 'purple' | 'amber';

interface Step {
  number: string;
  accent: Accent;
  scene: StorySceneVariant;
  title: string;
  description: string;
}

const STEPS: readonly Step[] = [
  {
    number: '01',
    accent: 'blue',
    scene: 'verify',
    title: 'נרשמים בקלות',
    description: 'אימייל או טלפון, אימות קצר. אתם בפנים.',
  },
  {
    number: '02',
    accent: 'green',
    scene: 'vote',
    title: 'רואים מה על הפרק',
    description: 'הצבעות פעילות בקריית טבעון, או מציעים נושא חדש משלכם.',
  },
  {
    number: '03',
    accent: 'purple',
    scene: 'proof',
    title: 'מצביעים ומאמתים',
    description: 'בוחרים עמדה, מאמתים נוכחות (GPS), ומצביעים. חינם.',
  },
  {
    number: '04',
    accent: 'amber',
    scene: 'impact',
    title: 'עוקבים אחרי התוצאה',
    description: 'נתונים בזמן אמת, שמוגשים למועצה כעמדה קהילתית מגובה.',
  },
] as const;

export function HowItWorks({ locale: _locale = 'he' }: HowItWorksProps) {
  const reducedMotion = useReducedMotion();
  const railRef = useRef<HTMLDivElement>(null);

  // Vertical brand rail fills as the reader moves through the steps.
  const { scrollYProgress } = useScroll({
    target: railRef,
    offset: ['start 0.75', 'end 0.6'],
  });
  const railHeight = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  return (
    <section id="how" className={styles.howItWorks}>
      <div className={styles.aura} aria-hidden />

      <div className={styles.container}>
        <header className={styles.header}>
          <Eyebrow>איך זה עובד</Eyebrow>
          <Heading level={2} align="center" className={styles.title}>
            מהרשמה ועד השפעה,{' '}
            <GradientText>בארבעה צעדים.</GradientText>
          </Heading>
        </header>

        <div className={styles.timeline} ref={railRef}>
          {/* Brand progress rail */}
          <div className={styles.rail} aria-hidden>
            <motion.div
              className={styles.railFill}
              style={reducedMotion ? { height: '100%' } : { height: railHeight }}
            />
          </div>

          <ol className={styles.steps}>
            {STEPS.map((step, index) => (
              <li key={step.number} className={styles.stepItem}>
                <AnimatedFadeInUp delay={reducedMotion ? 0 : index * 0.08}>
                  <article className={`${styles.step} ${styles[`accent-${step.accent}`]}`}>
                    <span className={styles.node} aria-hidden />

                    <div className={styles.sceneWrap}>
                      <StoryScene variant={step.scene} title={step.title} />
                    </div>

                    <div className={styles.body}>
                      <span className={styles.number}>{step.number}</span>
                      <h3 className={styles.stepTitle}>{step.title}</h3>
                      <Text size="base" color="secondary" className={styles.stepDescription}>
                        {step.description}
                      </Text>
                    </div>
                  </article>
                </AnimatedFadeInUp>
              </li>
            ))}
          </ol>
        </div>

        <p className={styles.microcopy}>כל התהליך לוקח פחות מדקה.</p>
      </div>
    </section>
  );
}
