import Link from 'next/link';
import { NewsButton } from '@/components/press/NewsButton';
import { CountdownClock } from '@/components/press/Countdown/Countdown';
import { SubscribeForm } from './SubscribeForm';
import type { Locale } from '@/lib/i18n';
import styles from './Colophon.module.css';
import { CONTACT_EMAIL, WHATSAPP_FOUNDERS_LINK } from '@sync/shared';
import { localePath, localePrefix } from '@/lib/i18n';

const WHATSAPP_LINK = WHATSAPP_FOUNDERS_LINK;

interface ColophonProps {
  locale?: Locale;
}

interface ColophonCopy {
  kicker: string;
  subHead: string;
  subHeadRed: string;
  wordmark: string;
  tagline: string;
  foundersCta: string;
  contactLabel: string;
  arrow: string;
  navLabel: string;
  productHead: string;
  about: string;
  votes: string;
  economics: string;
  treasury: string;
  supportHead: string;
  faq: string;
  pricing: string;
  contact: string;
  legalHead: string;
  privacy: string;
  terms: string;
  refund: string;
  copyright: string;
  credit: string;
}

const COPY: Record<Locale, ColophonCopy> = {
  he: {
    kicker: 'הישארו מעודכנים · SUBSCRIBE',
    subHead: 'אל תפספסו את',
    subHeadRed: 'ההצבעה הראשונה.',
    wordmark: 'תַּרְאוּ',
    tagline: 'עיתון אזרחי. מודדים, מאמתים, מנגישים.',
    foundersCta: 'קבוצת המייסדים',
    contactLabel: 'כתבו לנו',
    arrow: '←',
    navLabel: 'ניווט תחתון',
    productHead: 'המוצר',
    about: 'אודות',
    votes: 'הצבעות',
    economics: 'כלכלה אזרחית',
    treasury: 'שקיפות הקרן',
    supportHead: 'תמיכה',
    faq: 'שאלות נפוצות',
    pricing: 'תמחור',
    contact: 'יצירת קשר',
    legalHead: 'משפטי',
    privacy: 'מדיניות פרטיות',
    terms: 'תנאי שימוש',
    refund: 'מדיניות החזרים',
    copyright: '© 2026 תַּרְאוּ · כל הזכויות שמורות',
    credit: 'נבנה באהבה · saharbarak.dev',
  },
  en: {
    kicker: 'Stay updated · הישארו מעודכנים',
    subHead: 'Don’t miss',
    subHeadRed: 'the first vote.',
    wordmark: 'Taruu',
    tagline: 'A civic newspaper. We measure, we verify, we make it public.',
    foundersCta: 'The founders’ group',
    contactLabel: 'Write to us',
    arrow: '→',
    navLabel: 'Footer navigation',
    productHead: 'Product',
    about: 'About',
    votes: 'Votes',
    economics: 'Civic economics',
    treasury: 'Treasury transparency',
    supportHead: 'Support',
    faq: 'FAQ',
    pricing: 'Pricing',
    contact: 'Contact',
    legalHead: 'Legal',
    privacy: 'Privacy policy',
    terms: 'Terms of use',
    refund: 'Refund policy',
    copyright: '© 2026 Taruu · All rights reserved',
    credit: 'Built with love · saharbarak.dev',
  },
};

export function Colophon({ locale = 'he' }: ColophonProps) {
  const t = COPY[locale];
  return (
    <footer id="subscribe" className={styles.colophon}>
      {/* Subscribe */}
      <div className={styles.subscribe}>
        <div className={styles.subLeft}>
          <span className={styles.kicker}><span aria-hidden className={styles.tick} />{t.kicker}</span>
          <h2 className={styles.subHead}>{t.subHead} <span className={styles.red}>{t.subHeadRed}</span></h2>
        </div>
        <div className={styles.subRight}>
          <CountdownClock className={styles.countdown} locale={locale} />
          <SubscribeForm locale={locale} />
        </div>
      </div>

      <div className={styles.ruleMast} />

      {/* Colophon / imprint */}
      <div className={styles.imprint}>
        <div className={styles.brand}>
          <Link href={localePath(locale)} className={styles.wordmark}>{t.wordmark}</Link>
          <p className={styles.tagline}>{t.tagline}</p>
          <NewsButton
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            variant="red"
            size="sm"
            className={styles.foundersCta}
            trailing={<span aria-hidden>{t.arrow}</span>}
          >
            {t.foundersCta}
          </NewsButton>

          <div className={styles.contact}>
            <span className={styles.contactLabel}>{t.contactLabel}</span>
            <a href={`mailto:${CONTACT_EMAIL}`} className={styles.contactMail}>
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>

        <nav className={styles.cols} aria-label={t.navLabel}>
          <div className={styles.col}>
            <span className={styles.colHead}>{t.productHead}</span>
            <Link href={`${localePrefix(locale)}/about`}>{t.about}</Link>
            <Link href={`${localePrefix(locale)}/votes`}>{t.votes}</Link>
            <Link href={`${localePrefix(locale)}/economics`}>{t.economics}</Link>
            <Link href={`${localePrefix(locale)}/treasury`}>{t.treasury}</Link>
          </div>
          <div className={styles.col}>
            <span className={styles.colHead}>{t.supportHead}</span>
            <Link href={`${localePrefix(locale)}/faq`}>{t.faq}</Link>
            <Link href={`${localePrefix(locale)}/pricing`}>{t.pricing}</Link>
            <Link href={`${localePrefix(locale)}/support`}>{t.contact}</Link>
          </div>
          <div className={styles.col}>
            <span className={styles.colHead}>{t.legalHead}</span>
            <Link href={`${localePrefix(locale)}/privacy`}>{t.privacy}</Link>
            <Link href={`${localePrefix(locale)}/terms`}>{t.terms}</Link>
            <Link href={`${localePrefix(locale)}/refund`}>{t.refund}</Link>
          </div>
        </nav>
      </div>

      <div className={styles.ruleHair} />
      <div className={styles.bottom}>
        <span>{t.copyright}</span>
        <span>{t.credit}</span>
      </div>
    </footer>
  );
}
