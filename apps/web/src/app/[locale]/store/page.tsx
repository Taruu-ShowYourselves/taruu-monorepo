import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MERCH_CATALOG, localizeProduct } from '@/lib/merch/catalog';
import type { Locale } from '@/lib/i18n';
import { ProductImage } from './components/ProductImage';
import { CartLink } from './components/CartLink';
import styles from './page.module.css';
import { localePrefix } from '@/lib/i18n';

const METADATA: Record<Locale, Metadata> = {
  he: {
    title: 'חנות המערכת | תַּרְאוּ',
    description:
      'מרצ׳נדייז המערכת: חולצות, מדבקות, כרזות וספלים בהדפס דו-צבעי. משלוח חינם מעל ₪250.',
  },
  en: {
    title: 'The Store | Taruu',
    description:
      'Editorial merchandise: tees, stickers, posters and mugs in a two-colour print. Free shipping over ₪250.',
  },
};

interface StorePageCopy {
  kicker: string;
  headline: string;
  headlineRed: string;
  standfirst: string;
  categoryLabel: Record<string, string>;
  fromPrice: (n: number) => string;
  cardMore: string;
}

const COPY: Record<Locale, StorePageCopy> = {
  he: {
    kicker: 'חנות המערכת · THE STORE',
    headline: 'לובשים את הקהילה.',
    headlineRed: 'במספרים.',
    standfirst:
      'מחלקת המודעות של תַּרְאוּ: הדפס מערכת על כותנה כבדה, ויניל ונייר ארכיון. דו-צבעי, חד פינות, בלי גרדיאנטים. כל פריט הוא הצהרת אזרחות שאפשר ללבוש, להדביק או למסגר. משלוח חינם מעל ₪250.',
    categoryLabel: {
      apparel: 'הלבשה',
      sticker: 'מדבקות',
      accessory: 'אביזרים',
      print: 'הדפסים',
    },
    fromPrice: (n) => `מ-₪${n}`,
    cardMore: 'לפרטים ←',
  },
  en: {
    kicker: 'The Merchandise Desk · THE STORE',
    headline: 'Wear the community.',
    headlineRed: 'In numbers.',
    standfirst:
      'Taruu’s advertising department: editorial print on heavy cotton, vinyl and archival paper. Two-colour, hard-edged, no gradients. Every item is a statement of citizenship you can wear, stick or frame. Free shipping over ₪250.',
    categoryLabel: {
      apparel: 'Apparel',
      sticker: 'Stickers',
      accessory: 'Accessories',
      print: 'Prints',
    },
    fromPrice: (n) => `From ₪${n}`,
    cardMore: 'Details →',
  },
};

interface StorePageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({
  params,
}: StorePageProps): Promise<Metadata> {
  const { locale } = await params;
  return METADATA[locale];
}

export default async function StorePage({ params }: StorePageProps) {
  const { locale } = await params;
  const t = COPY[locale];
  const products = MERCH_CATALOG.filter((p) => p.active).map((p) =>
    localizeProduct(p, locale)
  );

  return (
    <>
      <Header locale={locale} />
      <main className={styles.store}>
        <div className={styles.inner}>
          <header className={styles.head}>
            <div className={styles.headTop}>
              <span className={styles.kicker}>
                <span aria-hidden className={styles.kickerTick} />
                {t.kicker}
              </span>
              <CartLink href={`${localePrefix(locale)}/store/cart`} locale={locale} />
            </div>

            <h1 className={styles.headline}>
              {t.headline} <span className={styles.red}>{t.headlineRed}</span>
            </h1>

            <p className={styles.standfirst}>
              {t.standfirst}
            </p>
          </header>

          <div className={styles.ruleHeavy} aria-hidden />

          <ul className={styles.grid}>
            {products.map((p) => (
              <li key={p.id} className={styles.cardItem}>
                <Link href={`${localePrefix(locale)}/store/${p.slug}`} className={styles.card}>
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
                      {t.categoryLabel[p.category] ?? p.category}
                    </span>
                    <h2 className={styles.cardName}>{p.name}</h2>
                    <p className={styles.cardDesc}>{p.description}</p>
                    <div className={styles.cardFoot}>
                      <span className={styles.cardPrice}>{t.fromPrice(p.basePriceILS)}</span>
                      <span className={styles.cardMore} aria-hidden>
                        {t.cardMore}
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
