'use client';

import { motion } from 'framer-motion';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { GradientText } from '@/components/ui/GradientText';
import { AnimatedWords, AnimatedFadeInUp } from '@/components/animations';
import { useReducedMotion } from '@/hooks';
import { NoiseSignalVisual } from './NoiseSignalVisual';
import type { Locale } from '@/lib/i18n';
import styles from './Problem.module.css';

interface ProblemProps {
  locale?: Locale;
}

/**
 * Problem - the quieter, emotional "why this exists" beat.
 *
 * Asymmetric split: argument inline-start, the NOISE -> SIGNAL visual inline-end.
 * Climax is the bridge line (the single gradient moment of the viewport),
 * set larger so the visitor lands on "yes, exactly".
 *
 * Hebrew-only content; `locale` kept for section-API compatibility.
 */
export function Problem(_props: ProblemProps) {
  const reducedMotion = useReducedMotion();

  return (
    <section className={`${styles.section} lc-band-tint`} aria-labelledby="problem-title">
      <div className={styles.container}>
        <div className={styles.content}>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <Eyebrow>למה זה קיים</Eyebrow>
          </motion.div>

          <h2 id="problem-title" className={styles.heading}>
            <AnimatedWords
              text="כולם מדברים. אף אחד לא יודע מה הרוב באמת רוצה."
              delay={0.1}
            />
          </h2>

          <AnimatedFadeInUp delay={0.2}>
            <p className={styles.body}>
              תנועה, חינוך, שטחים ירוקים, תקציב: ההחלטות הכי משפיעות על היום-יום
              שלנו נופלות לפי מי שצעק הכי חזק בקבוצת הפייסבוק, או מי שהגיע לישיבה.
              רוב התושבים השקטים? לא נספרים. התוצאה: מועצה שמנחשת, וקהילה שמרגישה
              שלא שומעים אותה.
            </p>
          </AnimatedFadeInUp>

          <motion.p
            className={styles.bridge}
            initial={reducedMotion ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{
              duration: 0.7,
              delay: reducedMotion ? 0 : 0.45,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <span className={styles.bridgeRule} aria-hidden />
            <GradientText animated>
              תַּרְאוּ נותנת לרוב השקט הזה מספר.
            </GradientText>
          </motion.p>
        </div>

        <div className={styles.visual}>
          <NoiseSignalVisual />
        </div>
      </div>
    </section>
  );
}
