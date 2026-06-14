'use client';

import styles from './FAQHero.module.css';

export function FAQHero() {
  return (
    <section className={styles.hero}>
      <div className={styles.container}>
        <span className={styles.kicker}>
          <span aria-hidden className={styles.kickerTick} />
          מרכז העזרה · שאלות ותשובות
        </span>

        <h1 className={styles.headline}>
          יש שאלה? <span className={styles.red}>יש תשובה.</span>
        </h1>

        <p className={styles.standfirst}>
          כל מה שרציתם לדעת על הצבעה, אימות, כסף ופרטיות — במקום אחד.
        </p>
      </div>
    </section>
  );
}
