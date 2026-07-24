import { Metadata } from 'next';
import Link from 'next/link';
import { Masthead } from '@/components/press';
import { Colophon } from '@/components/press/sections';
import { NewsButton } from '@/components/press/NewsButton';
import { WHATSAPP_FOUNDERS_LINK } from '@sync/shared';
import type { Locale } from '@/lib/i18n';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'כנסת ישראל',
  description:
    'המהדורה הארצית של תַּרְאוּ — מדידת עמדת הרוב האזרחי על הנושאים שעל סדר יומה של הכנסת.',
};

interface KnessetPageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function KnessetPage({ params }: KnessetPageProps) {
  const { locale } = await params;

  return (
    <div className="np-page">
      <Masthead locale={locale} />
      <main>
        <section className={styles.desk} aria-labelledby="knesset-headline">
          <div className={styles.inner}>
            <header className={styles.header}>
              <span className={styles.kicker}>
                <span aria-hidden className={styles.kickerTick} />
                המהדורה הארצית · THE NATIONAL DESK
              </span>

              <h1 id="knesset-headline" className={styles.headline}>
                כנסת ישראל — <span className={styles.red}>הרוב קובע.</span>
              </h1>

              <p className={styles.standfirst}>
                הדסק הארצי של תַּרְאוּ ימדוד את עמדת הרוב האזרחי על הנושאים
                שעל סדר יומה של הכנסת — חוק אחר חוק, ועדה אחר ועדה. אותו מנגנון
                אימות, אותה ספירה שקופה, בקנה מידה ארצי.
              </p>
            </header>

            <div className={styles.ruleHeavy} aria-hidden />

            <div className={styles.notice}>
              <span className={styles.noticeStamp}>בהכנה · דפוס</span>
              <p className={styles.noticeLede}>
                המהדורה הארצית נמצאת עכשיו בהכנה במערכת.
              </p>
              <p className={styles.noticeNote}>
                מתחילים ברשויות המקומיות — הקונצנזוס העירוני הוא בית הדפוס של
                הדמוקרטיה הישירה. משם עולים לירושלים.
              </p>
              <div className={styles.noticeActions}>
                <NewsButton
                  href={WHATSAPP_FOUNDERS_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="red"
                  size="md"
                  trailing={<span aria-hidden>←</span>}
                >
                  הצטרפו למייסדים
                </NewsButton>
                <Link href={`/${locale}#consensus-desk`} className={styles.backLink}>
                  לנושאי הרשויות המקומיות ←
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Colophon locale={locale} />
    </div>
  );
}
