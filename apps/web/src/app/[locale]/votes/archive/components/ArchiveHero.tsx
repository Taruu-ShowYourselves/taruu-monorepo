'use client';

import styles from './ArchiveHero.module.css';

const heroStats = [
  { value: '—', label: 'הצבעות שהסתיימו' },
  { value: '—', label: 'NFTs שהונפקו' },
  { value: '—', label: 'כספים שנאספו' },
];

export function ArchiveHero() {
  return (
    <section className={styles.hero}>
      <div className={styles.container}>
        <span className={styles.kicker}>
          <span aria-hidden className={styles.kickerTick} />
          רשומות סגורות · קריית טבעון
        </span>

        <h1 className={styles.heading}>
          ארכיון <span className={styles.red}>ההצבעות.</span>
        </h1>

        <p className={styles.deck}>
          הצבעות שהסתיימו, תוצאות שהושגו. כל רשומה חתומה בבלוקצ׳יין —
          מהרעיון הראשוני ועד להחלטה הסופית, פתוחה לכולם.
        </p>

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
