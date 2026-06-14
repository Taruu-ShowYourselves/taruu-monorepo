'use client';

import styles from './AboutHero.module.css';

export function AboutHero() {
  return (
    <section className={styles.hero} aria-label="אודות תַּרְאוּ">
      <div className={styles.inner}>
        <div className={styles.dateline}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            אודות · המניפסט
          </span>
          <span className={styles.meta}>גיליון המערכת · קריית טבעון</span>
        </div>

        <hr className={styles.ruleHeavy} aria-hidden />

        <h1 className={styles.headline}>
          מקולה של עיר,
          <br />
          <span className={styles.red}>לקולה של מדינה.</span>
        </h1>

        <hr className={styles.rule} aria-hidden />

        <p className={`${styles.lead} np-dropcap`}>
          התחלנו מהבנה אחת — לדמוקרטיה המקומית אין כלי מדידה אמין. אנחנו בונים את
          התשתית שהופכת את הקול של הרוב למדיד, מאומת ושקוף, עיר אחר עיר.
        </p>
      </div>
    </section>
  );
}
