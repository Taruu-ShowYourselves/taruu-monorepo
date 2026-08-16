'use client';

import { motion } from 'framer-motion';
import { NewsButton } from '@/components/press';
import type { Locale } from '@/lib/i18n';
import styles from './SupportFlow.module.css';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';
import { localePrefix } from '@/lib/i18n';

const WHATSAPP_LINK = WHATSAPP_FOUNDERS_LINK;

const EASE_BRAND = [0.2, 0, 0, 1] as const;

interface SupportFlowProps {
  locale?: Locale;
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884"
      />
    </svg>
  );
}

function QuestionIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden focusable="false">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M9.3 9.2a2.7 2.7 0 0 1 5.2 1c0 1.8-2.5 2-2.5 3.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17" r="1.1" fill="currentColor" />
    </svg>
  );
}

function VoteIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.topicIcon} aria-hidden focusable="false">
      <path d="M5 12.5 10 17.5 19 7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.topicIcon} aria-hidden focusable="false">
      <path d="M12 3 19 6v5c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CoinIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.topicIcon} aria-hidden focusable="false">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5v9M14.3 9.4c-.5-.8-1.4-1.2-2.4-1.2-1.3 0-2.3.7-2.3 1.8 0 2.4 4.8 1.3 4.8 3.8 0 1.1-1 1.9-2.5 1.9-1.1 0-2-.5-2.5-1.3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.topicIcon} aria-hidden focusable="false">
      <rect x="5" y="10.5" width="14" height="9.5" rx="0" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="15" r="1.4" fill="currentColor" />
    </svg>
  );
}

const TOPIC_ICONS: (() => React.ReactElement)[] = [VoteIcon, ShieldIcon, CoinIcon, LockIcon];

interface SupportFlowCopy {
  waKicker: string;
  waTitle: string;
  waText: string;
  waCta: string;
  faqKicker: string;
  faqTitle: string;
  faqText: string;
  faqMore: string;
  topicsKicker: string;
  topics: { label: string; blurb: string }[];
  arrow: string;
}

const COPY: Record<Locale, SupportFlowCopy> = {
  he: {
    waKicker: 'קו חי · אנשים אמיתיים',
    waTitle: 'דברו איתנו בוואטסאפ',
    waText: 'אין רובוטים ואין תורים. כתבו לנו בקבוצת הפיילוט. אנשים אמיתיים עונים, בדרך כלל מהר.',
    waCta: 'פתחו שיחה בוואטסאפ',
    faqKicker: 'ארכיון · שאלות ותשובות',
    faqTitle: 'שאלות נפוצות',
    faqText: 'תשובות ברורות לשאלות שכולם שואלים: הצבעה, אימות, כסף ופרטיות, בלי ז\'רגון.',
    faqMore: 'למאגר השאלות הנפוצות',
    topicsKicker: 'קיצורי דרך לפי נושא',
    topics: [
      { label: 'הצבעה', blurb: 'איך מצביעים, מתי, וכמה זה עולה.' },
      { label: 'אימות', blurb: 'איך מוודאים שכל קול הוא תושב אמיתי.' },
      { label: 'כסף', blurb: 'ההצבעה חינם. מה כן עולה ולאן הכסף הולך.' },
      { label: 'פרטיות', blurb: 'מה אנחנו יודעים עליכם ומה לא.' },
    ],
    arrow: '←',
  },
  en: {
    waKicker: 'Live line · Real people',
    waTitle: 'Talk to us on WhatsApp',
    waText: 'No robots and no queues. Write to us in the pilot group. Real people answer, usually fast.',
    waCta: 'Open a WhatsApp chat',
    faqKicker: 'Archive · Questions and answers',
    faqTitle: 'Frequently asked questions',
    faqText: 'Clear answers to the questions everyone asks: voting, verification, money and privacy, without the jargon.',
    faqMore: 'To the FAQ archive',
    topicsKicker: 'Shortcuts by topic',
    topics: [
      { label: 'Voting', blurb: 'How to vote, when, and what it costs.' },
      { label: 'Verification', blurb: 'How we make sure every vote is one real resident.' },
      { label: 'Money', blurb: 'Voting is free. What does cost, and where the money goes.' },
      { label: 'Privacy', blurb: 'What we know about you, and what we do not.' },
    ],
    arrow: '→',
  },
};

export function SupportFlow({ locale = 'he' }: SupportFlowProps) {
  const t = COPY[locale];
  const faqHref = `${localePrefix(locale)}/faq`;

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        {/* Primary paths: WhatsApp + FAQ */}
        <div className={styles.paths}>
          <motion.article
            className={styles.path}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.45, delay: 0.05, ease: EASE_BRAND }}
          >
            <span className={styles.pathKicker}>
              <span aria-hidden className={styles.pathTick} />
              {t.waKicker}
            </span>
            <span className={styles.pathIcon}>
              <WhatsAppIcon />
            </span>
            <h2 className={styles.pathTitle}>{t.waTitle}</h2>
            <p className={styles.pathText}>
              {t.waText}
            </p>
            <NewsButton
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              variant="red"
              size="lg"
              className={styles.pathCta}
              trailing={<span aria-hidden>{t.arrow}</span>}
            >
              {t.waCta}
            </NewsButton>
          </motion.article>

          <motion.div
            className={styles.path}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.45, delay: 0.15, ease: EASE_BRAND }}
          >
            <a href={faqHref} className={styles.pathLinkCard}>
              <span className={styles.pathKicker}>
                <span aria-hidden className={styles.pathTick} />
                {t.faqKicker}
              </span>
              <span className={styles.pathIcon}>
                <QuestionIcon />
              </span>
              <h2 className={styles.pathTitle}>{t.faqTitle}</h2>
              <p className={styles.pathText}>
                {t.faqText}
              </p>
              <span className={styles.pathMore}>
                {t.faqMore}
                <span aria-hidden> {t.arrow}</span>
              </span>
            </a>
          </motion.div>
        </div>

        {/* Quick topics */}
        <div className={styles.topicsHead}>
          <span className={styles.topicsKicker}>
            <span aria-hidden className={styles.pathTick} />
            {t.topicsKicker}
          </span>
        </div>

        <div className={styles.topics}>
          {t.topics.map((topic, i) => {
            const Icon = TOPIC_ICONS[i];
            return (
              <motion.a
                key={topic.label}
                href={faqHref}
                className={styles.topic}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.4, delay: 0.05 + i * 0.06, ease: EASE_BRAND }}
              >
                <span className={styles.topicNum} aria-hidden>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className={styles.topicIconWrap}>
                  <Icon />
                </span>
                <span className={styles.topicLabel}>{topic.label}</span>
                <span className={styles.topicBlurb}>{topic.blurb}</span>
              </motion.a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
