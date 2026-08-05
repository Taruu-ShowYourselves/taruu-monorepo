'use client';

import { motion } from 'framer-motion';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { RippleButton } from '@/components/ui/RippleButton';
import { GradientText } from '@/components/ui/GradientText';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { GlassCard } from '@/components/ui/GlassCard';
import { Text } from '@/components/ui/Typography';
import { AnimatedLetters } from '@/components/animations';
import { NewsletterForm } from '@/components/forms/NewsletterForm';
import { useReducedMotion } from '@/hooks';
import type { Locale } from '@/lib/i18n';
import styles from './CTA.module.css';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';

const WHATSAPP_LINK = WHATSAPP_FOUNDERS_LINK;

interface CTAProps {
  locale?: Locale;
}

export function CTA({ locale = 'he' }: CTAProps) {
  const reducedMotion = useReducedMotion();

  const ease = [0.22, 1, 0.36, 1] as const;

  return (
    <section id="join" className={styles.cta}>
      <div className={styles.mesh} aria-hidden />

      <div className={styles.container}>
        <div className={styles.content}>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease }}
          >
            <Eyebrow>הצטרפו עכשיו</Eyebrow>
          </motion.div>

          <h2 className={styles.heading}>
            <AnimatedLetters text="הקול שלכם" delay={0.1} />{' '}
            <span className={styles.accentLine}>
              <motion.span
                initial={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.6, delay: reducedMotion ? 0 : 0.45, ease }}
              >
                <GradientText animated>ייספר.</GradientText>
              </motion.span>
            </span>
          </h2>

          <motion.p
            className={styles.subhead}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: 0.2, ease }}
          >
            הצטרפו לתושבים שכבר נרשמו, לפני שההצבעה הראשונה
            יוצאת לדרך.
          </motion.p>

          <motion.div
            className={styles.primary}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: 0.32, ease }}
          >
            <MagneticButton>
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.primaryLink}
              >
                <RippleButton size="xl">
                  <span className={styles.primaryLabel}>
                    <svg
                      className={styles.whatsappIcon}
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                      aria-hidden
                    >
                      <path
                        fill="currentColor"
                        d="M17.47 14.38c-.3-.15-1.74-.86-2-.95-.27-.1-.47-.15-.66.15-.2.3-.76.95-.93 1.15-.17.2-.34.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.34.45-.51.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.66-1.6-.9-2.18-.24-.58-.48-.5-.66-.5-.17-.01-.37-.01-.56-.01-.2 0-.51.07-.78.37-.27.3-1.02 1-1.02 2.42 0 1.43 1.04 2.8 1.19 3 .15.2 2.05 3.13 4.96 4.39.69.3 1.23.48 1.65.61.69.22 1.32.19 1.82.12.56-.08 1.74-.71 1.98-1.4.24-.69.24-1.28.17-1.4-.07-.13-.27-.2-.57-.35M12.04 2.5C6.81 2.5 2.56 6.75 2.56 11.98c0 1.67.44 3.3 1.27 4.74L2.5 21.5l4.92-1.29a9.4 9.4 0 0 0 4.61 1.18h.01c5.23 0 9.48-4.25 9.48-9.48S17.27 2.5 12.04 2.5"
                      />
                    </svg>
                    הצטרפו לוואטסאפ הפיילוט
                  </span>
                </RippleButton>
              </a>
            </MagneticButton>
          </motion.div>

          <motion.p
            className={styles.microcopy}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: 0.5, ease }}
          >
            האפליקציה תהיה זמינה ב-App Store ו-Google Play לקראת ההצבעה הראשונה.
          </motion.p>
        </div>

        <motion.div
          className={styles.secondary}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, delay: 0.4, ease }}
        >
          <GlassCard variant="interactive" glow="brand" className={styles.formCard}>
            <span aria-hidden className={styles.formDivider} />
            <Text as="p" weight="semibold" className={styles.formTitle}>
              הירשמו לעדכונים במייל
            </Text>
            <Text size="sm" color="muted" className={styles.formHint}>
              נעדכן אתכם ברגע שההצבעה הראשונה תיפתח.
            </Text>
            <NewsletterForm source="homepage_cta" variant="compact" locale={locale} />
          </GlassCard>
        </motion.div>
      </div>
    </section>
  );
}
