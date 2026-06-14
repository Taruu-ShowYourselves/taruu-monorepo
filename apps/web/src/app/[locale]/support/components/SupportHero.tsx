'use client';

import styles from './SupportHero.module.css';

export function SupportHero() {
  return (
    <section className={styles.hero}>
      <div className={styles.container}>
        <span className={styles.kicker}>
          <span aria-hidden className={styles.kickerTick} />
          מרכז התמיכה · אנשים אמיתיים
        </span>

        <h1 className={styles.headline}>
          יש שאלה? <span className={styles.red}>יש תשובה.</span>
        </h1>

        <p className={styles.standfirst}>
          כל מה שרציתם לדעת על הצבעה, אימות, כסף ופרטיות — במקום אחד. לא מצאתם?
          כתבו לנו בוואטסאפ, אנחנו אנשים אמיתיים.
        </p>
      </div>
    </section>
  );
}
