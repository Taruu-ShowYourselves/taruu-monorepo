'use client';

import { motion } from 'framer-motion';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { RippleButton } from '@/components/ui/RippleButton';
import { GradientText } from '@/components/ui/GradientText';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { AnimatedLetters } from '@/components/animations';
import { useReducedMotion } from '@/hooks';
import { ShaderBackground } from '@/components/effects';
import { ConsensusVisual } from './ConsensusVisual';
import type { Locale } from '@/lib/i18n';
import styles from './Hero.module.css';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';

const WHATSAPP_LINK = WHATSAPP_FOUNDERS_LINK;

interface HeroProps {
  locale?: Locale;
}

export function Hero(_props: HeroProps) {
  const reducedMotion = useReducedMotion();

  return (
    <section className={styles.hero}>
      <ShaderBackground />
      <div className={styles.mesh} aria-hidden />

      <div className={styles.container}>
        <div className={styles.content}>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <Eyebrow>מנגנון הקונצנזוס הציבורי של ישראל</Eyebrow>
          </motion.div>

          <h1 className={styles.heading}>
            <AnimatedLetters text="הקול של האזרחים," delay={0.15} />
            <span className={styles.accentLine}>
              <motion.span
                initial={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: reducedMotion ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                <GradientText animated>במספרים.</GradientText>
              </motion.span>
            </span>
          </h1>

          <motion.p
            className={styles.subtitle}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1 }}
          >
            תַּרְאוּ מודדת את עמדת רוב התושבים בנושאים המקומיים שחשובים לנו, בצורה
            מאומתת, שקופה ובלתי ניתנת לזיוף. במקום ויכוחים בלי סוף, תמונת מצב אחת
            ברורה שהמועצה לא יכולה להתעלם ממנה.
          </motion.p>

          <motion.div
            className={styles.cta}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.2 }}
          >
            <MagneticButton>
              <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className={styles.ctaPrimary}>
                <RippleButton size="xl">הצטרפו לפיילוט בקריית טבעון</RippleButton>
              </a>
            </MagneticButton>
            <a href="#how" className={styles.ctaSecondary}>
              איך זה עובד
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <path d="M12 5v14M6 13l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </motion.div>

          <motion.p
            className={styles.microcopy}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.5 }}
          >
            ההצבעה הראשונה יוצאת לדרך ב-23.01.26. הצטרפות חינם, בלי התחייבות.
          </motion.p>
        </div>

        <div className={styles.visual}>
          <ConsensusVisual />
        </div>
      </div>
    </section>
  );
}
