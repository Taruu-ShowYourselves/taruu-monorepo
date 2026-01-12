'use client';

import { motion } from 'framer-motion';
import { Heading, Text } from '@/components/ui/Typography';
import { AnimatedFadeInUp } from '@/components/animations';
import type { Locale } from '@/lib/i18n';
import styles from './Pilot.module.css';

const WHATSAPP_LINK = 'https://chat.whatsapp.com/FITvea9IVsn2Ljie1yCrAc';

interface PilotProps {
  locale?: Locale;
}

export function Pilot({ locale = 'he' }: PilotProps) {
  const t = {
    label: locale === 'en' ? 'Starting from Home' : 'מתחילים מהבית',
    title: locale === 'en' ? 'Kiryat Tivon Pilot' : 'פיילוט קריית טבעון',
    subtitle: locale === 'en'
      ? 'Join our pilot program and help shape the future of community voting. We\'re building this together with residents like you.'
      : 'הצטרפו לפיילוט ועזרו לנו לעצב את העתיד של הצבעות קהילתיות. אנחנו בונים את זה יחד איתכם.',
    municipality: locale === 'en' ? 'Kiryat Tivon' : 'קריית טבעון',
    launchDate: '23.01.26',
    municipalityLabel: locale === 'en' ? 'First Municipality' : 'הרשות הראשונה',
    dateLabel: locale === 'en' ? 'Launch Date' : 'תאריך השקה',
    whatsappBtn: locale === 'en' ? 'Join Pilot Group' : 'הצטרפו לקבוצת הפיילוט',
  };

  return (
    <section className={styles.pilot}>
      <div className={styles.container}>
        {/* Section Header */}
        <div className={styles.header}>
          <AnimatedFadeInUp>
            <Text size="lg" color="accent" weight="semibold" align="center">
              {t.label}
            </Text>
          </AnimatedFadeInUp>
          <AnimatedFadeInUp delay={0.1}>
            <Heading level={2} color="inverse" align="center">
              {t.title}
            </Heading>
          </AnimatedFadeInUp>
          <AnimatedFadeInUp delay={0.2}>
            <Text size="xl" color="muted" align="center" className={styles.subtitle}>
              {t.subtitle}
            </Text>
          </AnimatedFadeInUp>
        </div>

        {/* Info Row */}
        <motion.div
          className={styles.infoRow}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className={styles.infoItem}>
            <svg className={styles.infoIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <div className={styles.infoContent}>
              <span className={styles.infoLabel}>{t.municipalityLabel}</span>
              <span className={styles.infoValue}>{t.municipality}</span>
            </div>
          </div>

          <div className={styles.infoDivider} />

          <div className={styles.infoItem}>
            <svg className={styles.infoIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <div className={styles.infoContent}>
              <span className={styles.infoLabel}>{t.dateLabel}</span>
              <span className={styles.infoValue}>{t.launchDate}</span>
            </div>
          </div>
        </motion.div>

        {/* CTA Button */}
        <motion.div
          className={styles.cta}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className={styles.whatsappButton}>
            <svg viewBox="0 0 24 24" fill="currentColor" className={styles.whatsappIcon}>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            {t.whatsappBtn}
          </a>
        </motion.div>
      </div>
    </section>
  );
}
