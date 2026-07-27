import styles from './BackedBy.module.css';

/**
 * BackedBy — institutional endorsements band. Runs directly under the lead.
 * Honest by design: every slot is empty until a real parliament, municipality
 * or organization signs on. No fake logos, no borrowed credibility.
 */
const SLOTS = [
  'הכנסת',
  'עיריות',
  'מועצות מקומיות',
  'משרדי ממשלה',
  'ארגוני חברה אזרחית',
  'אקדמיה',
];

export function BackedBy() {
  return (
    <section className={styles.backed} aria-labelledby="backed-by-headline">
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            בגיבוי · BACKED BY
          </span>
          <h2 id="backed-by-headline" className={styles.headline}>
            נכון להיום: <span className={styles.red}>אף אחד.</span>
          </h2>
          <p className={styles.standfirst}>
            אף פרלמנט, רשות או ארגון עדיין לא עומד מאחורינו. אנחנו רק מתחילים —
            והמקומות האלה שמורים לראשונים שיצטרפו. בלי לוגואים מושאלים, בלי
            אמינות בהשאלה.
          </p>
        </header>

        <ul className={styles.slots}>
          {SLOTS.map((label) => (
            <li key={label} className={styles.slot}>
              <span className={styles.slotStamp}>פנוי</span>
              <span className={styles.slotLabel}>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
