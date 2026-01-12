'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Typography';
import {
  AnimatedLetters,
  AnimatedWords,
  AnimatedFadeInUp,
} from '@/components/animations';
import { useReducedMotion } from '@/hooks';
import { HeroParallax } from './HeroParallax';
import type { Locale } from '@/lib/i18n';
import styles from './Hero.module.css';

interface HeroProps {
  locale?: Locale;
}

export function Hero({ locale = 'he' }: HeroProps) {
  const reducedMotion = useReducedMotion();

  const t = {
    backgroundText: locale === 'en' ? 'Democracy' : 'דמוקרטיה',
    title1: locale === 'en' ? 'The Local Voice,' : 'הקול המקומי,',
    title2: locale === 'en' ? 'In a Measurable Way.' : 'בצורה שאפשר\u00A0למדוד.',
    subtitle: locale === 'en'
      ? 'Taro helps communities form a transparent civic majority on issues that truly matter. We create an objective picture that helps authorities understand residents\' wishes and act in coordination with the community.'
      : 'תַּרְאוּ עוזרת לקהילות לגבש רוב אזרחי שקוף בנושאים שבאמת חשובים לנו. אנחנו מייצרים תמונת מצב אובייקטיבית שעוזרת לרשויות להבין את רצון התושבים לעומק ולפעול בתיאום עם הקהילה.',
    downloadBtn: locale === 'en' ? 'Download App - Coming Soon!' : 'הורדת האפליקציה - בקרוב!',
    viewVotesBtn: locale === 'en' ? 'View Public Votes' : 'צפייה בהצבעות פומביות',
    pilot: locale === 'en' ? 'Pilot running in Kiryat Tivon. Features and procedures evolve with the community.' : 'פיילוט בהרצה בקריית טבעון. התכונות והנהלים מתפתחים יחד עם הקהילה.',
  };

  return (
    <section className={styles.hero}>
      {/* Parallax Background Layers */}
      <HeroParallax />

      <div className={styles.container}>
        {/* Background Typography */}
        <motion.div
          className={styles.backgroundText}
          initial={{ opacity: reducedMotion ? 0.03 : 0 }}
          animate={{ opacity: 0.03 }}
          transition={{ duration: reducedMotion ? 0 : 1, delay: reducedMotion ? 0 : 0.5 }}
        >
          {t.backgroundText}
        </motion.div>

        <div className={styles.content}>
          {/* Main Heading */}
          <h1 className={styles.heading}>
            <AnimatedLetters text={t.title1} delay={0.2} />
            <br />
            <span className={styles.headingAccent}>
              <AnimatedLetters text={t.title2} delay={0.5} />
            </span>
          </h1>

          {/* Subtitle */}
          <motion.div
            className={styles.subtitle}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.2 }}
          >
            <Text size="xl" color="secondary" align="center">
              <AnimatedWords
                text={t.subtitle}
                delay={1.4}
              />
            </Text>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            className={styles.cta}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.6 }}
          >
            <Button size="xl" disabled>
              {t.downloadBtn}
            </Button>
            <Link href={`/${locale}/votes`}>
              <Button variant="outline" size="xl">
                {t.viewVotesBtn}
              </Button>
            </Link>
          </motion.div>

          {/* Beta Disclaimer */}
          <motion.div
            className={styles.betaDisclaimer}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 2.2 }}
          >
            <Text size="xs" color="muted" align="center">
              {t.pilot}
            </Text>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
