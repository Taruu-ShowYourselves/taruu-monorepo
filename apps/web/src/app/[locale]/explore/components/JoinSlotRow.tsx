import Link from 'next/link';
import { MERCH_CATALOG } from '@/lib/merch/catalog';
import type { Locale } from '@/lib/i18n';
import { GateTile } from './GateTile';
import { formatIls } from './format';
import styles from './JoinSlotRow.module.css';
import { localePrefix } from '@/lib/i18n';

interface JoinSlotRowCopy {
  fromStore: string;
  appTitle: string;
  appCaption: string;
}

const COPY: Record<Locale, JoinSlotRowCopy> = {
  he: {
    fromStore: 'מהחנות',
    appTitle: 'האפליקציה',
    appCaption: 'בקרוב · COMING SOON',
  },
  en: {
    fromStore: 'From the store',
    appTitle: 'The app',
    appCaption: 'Coming soon',
  },
};

/**
 * The tertiary strip inside ActNow's explore slot (S8): the gated
 * create-a-vote tile, a two-product store teaser (static catalogue import,
 * no fetch) and the coming-soon download link. Everything subordinated to
 * the one primary action above it.
 */
export function JoinSlotRow({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const teaser = MERCH_CATALOG.filter((p) => p.active).slice(0, 2);

  return (
    <div className={styles.row}>
      <GateTile locale={locale} />

      {teaser.map((product) => (
        <Link
          key={product.id}
          href={`${localePrefix(locale)}/store/${product.slug}`}
          className={styles.slotTile}
        >
          <span className={styles.slotTitle}>{product.name}</span>
          <span className={styles.slotCaption}>
            {t.fromStore} · {formatIls(product.basePriceILS)}
          </span>
        </Link>
      ))}

      <Link href={`${localePrefix(locale)}/download`} className={styles.slotTile}>
        <span className={styles.slotTitle}>{t.appTitle}</span>
        <span className={styles.slotCaption}>{t.appCaption}</span>
      </Link>
    </div>
  );
}
