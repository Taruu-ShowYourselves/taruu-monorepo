import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { NewsButton } from '@/components/press/NewsButton';
import styles from './not-found.module.css';

/**
 * Localized 404 boundary for the /he tree. Reached via notFound() — including
 * the [...rest] catch-all that covers unmatched paths such as the removed
 * money-only routes (/he/economics, /he/coin, …). Press chrome, Hebrew, RTL.
 */
export default function NotFound() {
  return (
    <>
      <Header />
      <main className={styles.main}>
        <section className={styles.panel}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            404 · הדף לא נמצא
          </span>
          <h1 className={styles.headline}>העמוד הזה כבר לא כאן</h1>
          <p className={styles.body}>
            העמוד שחיפשתם הוסר או הועבר. אפשר לחזור לעמוד הראשי ולהמשיך משם.
          </p>
          <div className={styles.actions}>
            <NewsButton href="/he" variant="red" size="lg" trailing={<span aria-hidden>←</span>}>
              חזרה לעמוד הראשי
            </NewsButton>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
