'use client';

import type { Locale } from '@/lib/i18n';
import styles from './ArchiveHero.module.css';

interface ArchiveHeroCopy {
  kicker: string;
  headingLead: string;
  headingEm: string;
  deck: string;
  statEnded: string;
  statNfts: string;
  statFunds: string;
}

const COPY: Record<Locale, ArchiveHeroCopy> = {
  he: {
    kicker: 'רשומות סגורות · כל הארץ',
    headingLead: 'ארכיון',
    headingEm: 'ההצבעות.',
    deck: 'הצבעות שהסתיימו והתוצאות שנקבעו. כל רשומה חתומה בבלוקצ׳יין, מהשאלה ועד ההחלטה, ופתוחה לכולם.',
    statEnded: 'הצבעות שהסתיימו',
    statNfts: 'NFTs שהונפקו',
    statFunds: 'כספים שנאספו',
  },
  en: {
    kicker: 'Closed records · Nationwide',
    headingLead: 'The vote',
    headingEm: 'archive.',
    deck: 'Concluded votes and the results they settled. Every record is blockchain-signed, from question to decision, and open to all.',
    statEnded: 'Votes concluded',
    statNfts: 'NFTs minted',
    statFunds: 'Funds raised',
  },
};

interface ArchiveHeroProps {
  locale?: Locale;
}

export function ArchiveHero({ locale = 'he' }: ArchiveHeroProps) {
  const t = COPY[locale];

  const heroStats = [
    { value: '-', label: t.statEnded },
    { value: '-', label: t.statNfts },
    { value: '-', label: t.statFunds },
  ];

  return (
    <section className={styles.hero}>
      <div className={styles.container}>
        <span className={styles.kicker}>
          <span aria-hidden className={styles.kickerTick} />
          {t.kicker}
        </span>

        <h1 className={styles.heading}>
          {t.headingLead} <span className={styles.red}>{t.headingEm}</span>
        </h1>

        <p className={styles.deck}>{t.deck}</p>

        <dl className={styles.stats}>
          {heroStats.map((stat) => (
            <div key={stat.label} className={styles.stat}>
              <dt className={styles.statValue}>{stat.value}</dt>
              <dd className={styles.statLabel}>{stat.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
