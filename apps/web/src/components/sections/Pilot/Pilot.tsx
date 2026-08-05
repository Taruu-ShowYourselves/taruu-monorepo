'use client';

import { motion } from 'framer-motion';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { RippleButton } from '@/components/ui/RippleButton';
import { GradientText } from '@/components/ui/GradientText';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { AnimatedFadeInUp } from '@/components/animations';
import { useReducedMotion } from '@/hooks';
import type { Locale } from '@/lib/i18n';
import styles from './Pilot.module.css';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';

const WHATSAPP_LINK = WHATSAPP_FOUNDERS_LINK;

const EASE_BRAND = [0.22, 1, 0.36, 1] as const;

interface PilotProps {
  locale?: Locale;
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden focusable="false">
      <path
        d="M12 22s7-5.686 7-12a7 7 0 1 0-14 0c0 6.314 7 12 7 12z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden focusable="false">
      <rect x="3.5" y="5" width="17" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 9.5h17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 3v3.5M16 3v3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="14.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function Pilot({ locale: _locale = 'he' }: PilotProps) {
  const reducedMotion = useReducedMotion();

  return (
    <section className={styles.pilot}>
      <div className={styles.mesh} aria-hidden />

      <div className={styles.container}>
        {/* Lead column: the human pitch */}
        <div className={styles.lead}>
          <AnimatedFadeInUp>
            <Eyebrow live>פיילוט חי · מתחילים מהבית</Eyebrow>
          </AnimatedFadeInUp>

          <AnimatedFadeInUp delay={0.08}>
            <h2 className={styles.heading}>
              קריית טבעון פותחת.
              <span className={styles.headingAccent}> בואו להיות שותפים מהיום הראשון.</span>
            </h2>
          </AnimatedFadeInUp>

          <AnimatedFadeInUp delay={0.16}>
            <p className={styles.body}>
              כדי שהכלי הזה יהיה מדויק עבורנו, פתחנו קבוצת וואטסאפ שקטה. שם נדייק
              יחד את שלבי הפיתוח, את חוויית המשתמש, ואת הנושאים הראשונים שיעלו
              להצבעה. אתם לא מצטרפים למוצר מוגמר. אתם מעצבים אותו.
            </p>
          </AnimatedFadeInUp>

          <AnimatedFadeInUp delay={0.24}>
            <blockquote className={styles.pullquote}>
              <span className={styles.pullquoteBar} aria-hidden />
              אתם לא מספר 10,000. אתם מהמייסדים.
            </blockquote>
          </AnimatedFadeInUp>

          <motion.div
            className={styles.cta}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: 0.3, ease: EASE_BRAND }}
          >
            <MagneticButton>
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.ctaPrimary}
              >
                <RippleButton size="lg">
                  <span className={styles.ctaInner}>
                    <svg viewBox="0 0 24 24" className={styles.waIcon} aria-hidden focusable="false">
                      <path
                        fill="currentColor"
                        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884"
                      />
                    </svg>
                    להצטרפות לקבוצת הוואטסאפ של הפיילוט
                  </span>
                </RippleButton>
              </a>
            </MagneticButton>
            <a href="#join" className={styles.ctaSecondary}>
              הירשמו לעדכון במייל
            </a>
          </motion.div>
        </div>

        {/* Aside column: the proof facts */}
        <div className={styles.facts}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: 0.1, ease: EASE_BRAND }}
          >
            <GlassCard variant="interactive" glow="blue" className={styles.factCard}>
              <div className={styles.factBody}>
                <span className={styles.factIcon} data-tone="blue">
                  <PinIcon />
                </span>
                <span className={styles.factLabel}>הרשות הראשונה</span>
                <span className={styles.factValue}>קריית טבעון</span>
              </div>
            </GlassCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: 0.2, ease: EASE_BRAND }}
          >
            <GlassCard variant="interactive" glow="purple" className={styles.dateCard}>
              <div className={styles.dateBody}>
                <span className={styles.factHead}>
                  <span className={styles.factIcon} data-tone="purple">
                    <CalendarIcon />
                  </span>
                  <span className={styles.factLabel}>מועד ההצבעה הראשונה</span>
                </span>
                <span className={styles.dateValue}>
                  <GradientText animated={!reducedMotion}>23.01.26</GradientText>
                </span>
                <span className={styles.dateNote}>
                  <span className={styles.dateDot} aria-hidden />
                  התאריך נקבע. הספירה לאחור התחילה.
                </span>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
