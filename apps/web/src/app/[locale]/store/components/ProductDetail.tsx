'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { NewsButton, Segmented } from '@/components/press';
import { useMerchCartStore } from '@/stores/merchCartStore';
import type { Product } from '@sync/shared';
import { MERCH_MAX_QTY_PER_LINE } from '@sync/shared';
import type { Locale } from '@/lib/i18n';
import { ProductImage } from './ProductImage';
import { CartLink } from './CartLink';
import { QtyStepper } from './QtyStepper';
import styles from './ProductDetail.module.css';

const CATEGORY_LABEL: Record<string, string> = {
  apparel: 'הלבשה',
  sticker: 'מדבקות',
  accessory: 'אביזרים',
  print: 'הדפסים',
};

interface ProductDetailProps {
  product: Product;
  locale: Locale;
}

export function ProductDetail({ product, locale }: ProductDetailProps) {
  const addItem = useMerchCartStore((s) => s.addItem);

  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? '');
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const variant = useMemo(
    () => product.variants.find((v) => v.id === variantId) ?? product.variants[0],
    [product.variants, variantId]
  );

  const segments = product.variants.map((v) => ({ value: v.id, label: v.label }));

  const handleAdd = () => {
    if (!variant) return;
    addItem(product, variant, qty);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2400);
  };

  return (
    <div className={styles.detail}>
      <div className={styles.inner}>
        <nav className={styles.crumbRow}>
          <Link href={`/${locale}/store`} className={styles.crumb}>
            → חזרה לחנות
          </Link>
          <CartLink href={`/${locale}/store/cart`} />
        </nav>

        <div className={styles.ruleHeavy} aria-hidden />

        <div className={styles.layout}>
          {/* Plate */}
          <figure className={styles.fig}>
            <ProductImage
              src={product.images[0] ?? ''}
              alt={product.name}
              name={product.name}
              size="detail"
              priority
            />
            <figcaption className={styles.figCap}>
              <span aria-hidden className={styles.figTick} />
              {CATEGORY_LABEL[product.category] ?? product.category} · הדפס מערכת
            </figcaption>
          </figure>

          {/* Details */}
          <div className={styles.body}>
            <span className={styles.cat}>
              {CATEGORY_LABEL[product.category] ?? product.category}
            </span>
            <h1 className={styles.name}>{product.name}</h1>

            <p className={styles.price}>
              ₪{variant?.priceILS ?? product.basePriceILS}
            </p>

            <p className={styles.desc}>{product.description}</p>

            {segments.length > 1 ? (
              <div className={styles.control}>
                <span className={styles.controlLabel}>בחירת גרסה</span>
                <Segmented
                  segments={segments}
                  value={variantId}
                  onChange={setVariantId}
                  variant="ink"
                  aria-label="בחירת גרסה"
                />
              </div>
            ) : null}

            <div className={styles.control}>
              <span className={styles.controlLabel}>כמות</span>
              <QtyStepper
                value={qty}
                onChange={setQty}
                min={1}
                max={MERCH_MAX_QTY_PER_LINE}
              />
            </div>

            <div className={styles.actions}>
              <NewsButton
                variant="red"
                size="lg"
                onClick={handleAdd}
                trailing={<span aria-hidden>←</span>}
              >
                הוסיפו לעגלה
              </NewsButton>
              {added ? (
                <span className={styles.added} role="status">
                  <span aria-hidden>✓ </span>נוסף ·
                  <Link href={`/${locale}/store/cart`} className={styles.addedLink}>
                    {' '}לעגלה
                  </Link>
                </span>
              ) : null}
            </div>

            <ul className={styles.trust}>
              <li className={styles.trustRow}>
                <span aria-hidden className={styles.trustMark}>
                  ■
                </span>
                הדפסה לפי הזמנה. נשלח תוך 7–14 ימי עסקים.
              </li>
              <li className={styles.trustRow}>
                <span aria-hidden className={styles.trustMark}>
                  ■
                </span>
                תשלום מאובטח בשקלים · חשבונית מס נשלחת במייל.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
