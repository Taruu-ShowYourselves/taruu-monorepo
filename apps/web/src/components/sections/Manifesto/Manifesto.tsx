'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Heading } from '@/components/ui/Typography';
import { AnimatedFadeInUp } from '@/components/animations';
import { useReducedMotion } from '@/hooks';
import type { Locale } from '@/lib/i18n';
import styles from './Manifesto.module.css';

interface ManifestoProps {
  locale?: Locale;
}

type Accent = 'blue' | 'green' | 'purple';

interface Pillar {
  key: string;
  index: string;
  title: string;
  line: string;
  accent: Accent;
  glyph: React.ReactNode;
}

const PILLARS: Pillar[] = [
  {
    key: 'measure',
    index: '01',
    title: 'מודדים',
    line: 'כמה באמת תומכים, כמה מתנגדים. לא תחושת בטן ולא מי שצועק חזק, אלא מספר מדויק.',
    accent: 'blue',
    glyph: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <rect x="6" y="28" width="7" height="14" rx="2" fill="currentColor" opacity="0.35" />
        <rect x="20.5" y="18" width="7" height="24" rx="2" fill="currentColor" opacity="0.6" />
        <rect x="35" y="8" width="7" height="34" rx="2" fill="currentColor" />
      </svg>
    ),
  },
  {
    key: 'verify',
    index: '02',
    title: 'מאמתים',
    line: 'כל קול הוא תושב אמיתי אחד: זהות ו-GPS, חתום בבלוקצ׳יין. בלי בוטים, בלי כפילויות, בלי לערער.',
    accent: 'green',
    glyph: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path
          d="M24 5l15 6v11c0 10-6.5 17-15 21-8.5-4-15-11-15-21V11z"
          fill="currentColor"
          opacity="0.16"
        />
        <path
          d="M24 5l15 6v11c0 10-6.5 17-15 21-8.5-4-15-11-15-21V11z"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="M17 24l5 5 10-11" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'surface',
    index: '03',
    title: 'מנגישים',
    line: 'התמונה המלאה פתוחה לכולם, לתושבים ולמועצה כאחד. שקיפות מלאה, בלי חדרים סגורים.',
    accent: 'purple',
    glyph: (
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <circle cx="14" cy="34" r="6" fill="currentColor" />
        <path d="M14 28V14a20 20 0 0 1 20 20" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none" opacity="0.7" />
        <path d="M14 22V14a8 8 0 0 1 8 8" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
];

export function Manifesto(_props: ManifestoProps) {
  const reducedMotion = useReducedMotion();
  const railRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: railRef,
    offset: ['start 0.85', 'end 0.45'],
  });
  const rawScale = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const lineScale = reducedMotion ? 1 : rawScale;

  return (
    <section className={`${styles.manifesto} lc-band-tint`} aria-label="מנגנון הקונצנזוס">
      <div className={styles.inner}>
        {/* Editorial lead - asymmetric, anchored to inline-start */}
        <div className={styles.lead}>
          <Eyebrow className={styles.eyebrow}>מנגנון קונצנזוס ציבורי</Eyebrow>
          <AnimatedFadeInUp>
            <Heading level={2} weight="extrabold" className={styles.headline}>
              שלושה דברים שהופכים דעה לכוח.
            </Heading>
          </AnimatedFadeInUp>
          <AnimatedFadeInUp delay={0.1}>
            <p className={styles.sub}>
              תַּרְאוּ הופכת רצון ציבורי מעורפל למספר אחד, ברור ובלתי ניתן לערעור, ומעבירה
              אותו מקולה של עיר אל קולה של מדינה.
            </p>
          </AnimatedFadeInUp>
        </div>

        {/* Three pillars - scroll-drawn rail + hue-owned glass cards */}
        <div className={styles.pillars} ref={railRef}>
          <span className={styles.railTrack} aria-hidden="true" />
          <motion.span
            className={styles.rail}
            style={{ scaleY: lineScale }}
            aria-hidden="true"
          />

          {PILLARS.map((p, i) => (
            <motion.div
              key={p.key}
              className={styles.pillarSlot}
              initial={reducedMotion ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.55, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className={`${styles.node} ${styles[`node_${p.accent}`]}`} aria-hidden="true" />
              <GlassCard
                variant="interactive"
                glow={p.accent}
                className={`${styles.pillar} ${styles[`accent_${p.accent}`]}`}
              >
                <article className={styles.pillarBody}>
                  <span className={styles.glyph}>{p.glyph}</span>
                  <div className={styles.pillarText}>
                    <div className={styles.pillarHead}>
                      <span className={styles.pillarIndex}>{p.index}</span>
                      <h3 className={styles.pillarTitle}>{p.title}</h3>
                    </div>
                    <p className={styles.pillarLine}>{p.line}</p>
                  </div>
                </article>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
