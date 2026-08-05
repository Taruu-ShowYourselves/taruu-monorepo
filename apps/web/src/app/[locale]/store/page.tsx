import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MERCH_CATALOG } from '@/lib/merch/catalog';
import type { Locale } from '@/lib/i18n';
import { ProductImage } from './components/ProductImage';
import { CartLink } from './components/CartLink';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'חנות המערכת | תַּרְאוּ',
  description:
    'מרצ׳נדייז המערכת: חולצות, מדבקות, כרזות וספלים בהדפס דו-צבעי. משלוח חינם מעל ₪250.',
};

const CATEGORY_LABEL: Record<string, string> = {
  apparel: 'הלבשה',
  sticker: 'מדבקות',
  accessory: 'אביזרים',
  print: 'הדפסים',
};

interface StorePageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function StorePage({ params }: StorePageProps) {
  const { locale } = await params;
  const products = MERCH_CATALOG.filter((p) => p.active);

  return (
    <>
      <Header locale={locale} />
      <main className={styles.store}>
        <div className={styles.inner}>
          <header className={styles.head}>
            <div className={styles.headTop}>
              <span className={styles.kicker}>
                <span aria-hidden className={styles.kickerTick} />
                חנות המערכת · THE STORE
              </span>
              <CartLink href={`/${locale}/store/cart`} />
            </div>

            <h1 className={styles.headline}>
              לובשים את הקהילה. <span className={styles.red}>במספרים.</span>
            </h1>

            <p className={styles.standfirst}>
              מחלקת המודעות של תַּרְאוּ: הדפס מערכת על כותנה כבדה, ויניל ונייר
              ארכיון. דו-צבעי, חד פינות, בלי גרדיאנטים. כל פריט הוא הצהרת אזרחות
              שאפשר ללבוש, להדביק או למסגר. משלוח חינם מעל ₪250.
            </p>
          </header>

          <div className={styles.ruleHeavy} aria-hidden />

          <ul className={styles.grid}>
            {products.map((p) => (
              <li key={p.id} className={styles.cardItem}>
                <Link href={`/${locale}/store/${p.slug}`} className={styles.card}>
                  <div className={styles.cardFig}>
                    <ProductImage
                      src={p.images[0] ?? ''}
                      alt={p.name}
                      name={p.name}
                      size="card"
                    />
                  </div>
                  <div className={styles.cardBody}>
                    <span className={styles.cardCat}>
                      {CATEGORY_LABEL[p.category] ?? p.category}
                    </span>
                    <h2 className={styles.cardName}>{p.name}</h2>
                    <p className={styles.cardDesc}>{p.description}</p>
                    <div className={styles.cardFoot}>
                      <span className={styles.cardPrice}>מ-₪{p.basePriceILS}</span>
                      <span className={styles.cardMore} aria-hidden>
                        לפרטים ←
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <Footer locale={locale} />
    </>
  );
}
