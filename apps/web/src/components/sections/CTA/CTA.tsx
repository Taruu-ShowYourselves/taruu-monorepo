'use client';

import { motion } from 'framer-motion';
import { Heading, Text } from '@/components/ui/Typography';
import { AnimatedFadeInUp, AnimatedLetters } from '@/components/animations';
import { NewsletterForm } from '@/components/forms/NewsletterForm';
import type { Locale } from '@/lib/i18n';
import styles from './CTA.module.css';

interface CTAProps {
  locale?: Locale;
}

export function CTA({ locale = 'he' }: CTAProps) {
  const t = {
    label: locale === 'en' ? 'Join Now' : 'הצטרפו עכשיו',
    title1: locale === 'en' ? "It's Time" : 'הגיע הזמן',
    title2: locale === 'en' ? 'To Make Your Voice Heard' : 'להראות את הקול שלכם',
    description: locale === 'en'
      ? 'Join residents already shaping the future of their community.'
      : 'הצטרפו לתושבים שכבר מעצבים את העתיד של הקהילה שלהם.',
    appNotice: locale === 'en'
      ? 'App will be available for download soon on App Store and Google Play'
      : 'האפליקציה תהיה זמינה להורדה בקרוב ב-App Store ו-Google Play',
  };

  return (
    <section className={styles.cta}>
      <div className={styles.container}>
        {/* Background Elements */}
        <motion.div
          className={styles.backgroundCircle}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.1, 0.15, 0.1],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        <div className={styles.content}>
          <AnimatedFadeInUp>
            <Text size="lg" color="accent" weight="semibold" align="center">
              {t.label}
            </Text>
          </AnimatedFadeInUp>

          <AnimatedFadeInUp delay={0.1}>
            <Heading level={2} align="center" className={styles.heading}>
              <AnimatedLetters text={t.title1} delay={0.2} />
              <br />
              <span className={styles.headingAccent}>
                <AnimatedLetters text={t.title2} delay={0.5} />
              </span>
            </Heading>
          </AnimatedFadeInUp>

          <AnimatedFadeInUp delay={0.3}>
            <Text size="xl" color="secondary" align="center" className={styles.description}>
              {t.description}
            </Text>
          </AnimatedFadeInUp>

          {/* Newsletter Signup Form */}
          <motion.div
            className={styles.newsletterWrapper}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <NewsletterForm source="homepage_cta" locale={locale} />
          </motion.div>

          {/* App Store Notice */}
          <motion.div
            className={styles.stores}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Text size="sm" color="muted" align="center">
              {t.appNotice}
            </Text>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
