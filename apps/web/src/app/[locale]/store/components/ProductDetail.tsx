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
import { localePrefix } from '@/lib/i18n';

interface ProductDetailCopy {
  crumb: string;
  categoryLabel: Record<string, string>;
  figCapSuffix: string;
  variantLabel: string;
  qtyLabel: string;
  addToCart: string;
  added: string;
  addedLink: string;
  trustFulfilment: string;
  trustPayment: string;
  arrow: string;
}

const COPY: Record<Locale, ProductDetailCopy> = {
  he: {
    crumb: '→ חזרה לחנות',
    categoryLabel: {
      apparel: 'הלבשה',
      sticker: 'מדבקות',
      accessory: 'אביזרים',
      print: 'הדפסים',
    },
    figCapSuffix: 'הדפס מערכת',
    variantLabel: 'בחירת גרסה',
    qtyLabel: 'כמות',
    addToCart: 'הוסיפו לעגלה',
    added: 'נוסף ·',
    addedLink: 'לעגלה',
    trustFulfilment: 'הדפסה לפי הזמנה. נשלח תוך 7–14 ימי עסקים.',
    trustPayment: 'תשלום מאובטח בשקלים · חשבונית מס נשלחת במייל.',
    arrow: '←',
  },
  en: {
    crumb: '← Back to the store',
    categoryLabel: {
      apparel: 'Apparel',
      sticker: 'Stickers',
      accessory: 'Accessories',
      print: 'Prints',
    },
    figCapSuffix: 'Editorial print',
    variantLabel: 'Choose a version',
    qtyLabel: 'Quantity',
    addToCart: 'Add to cart',
    added: 'Added ·',
    addedLink: 'to the cart',
    trustFulfilment: 'Printed to order. Ships within 7–14 business days.',
    trustPayment: 'Secure payment in shekels · A tax invoice is sent by email.',
    arrow: '→',
  },
};

interface ProductDetailProps {
  product: Product;
  locale: Locale;
}

export function ProductDetail({ product, locale }: ProductDetailProps) {
  const addItem = useMerchCartStore((s) => s.addItem);
  const t = COPY[locale];

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
          <Link href={`${localePrefix(locale)}/store`} className={styles.crumb}>
            {t.crumb}
          </Link>
          <CartLink href={`${localePrefix(locale)}/store/cart`} locale={locale} />
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
              {t.categoryLabel[product.category] ?? product.category} · {t.figCapSuffix}
            </figcaption>
          </figure>

          {/* Details */}
          <div className={styles.body}>
            <span className={styles.cat}>
              {t.categoryLabel[product.category] ?? product.category}
            </span>
            <h1 className={styles.name}>{product.name}</h1>

            <p className={styles.price}>
              ₪{variant?.priceILS ?? product.basePriceILS}
            </p>

            <p className={styles.desc}>{product.description}</p>

            {segments.length > 1 ? (
              <div className={styles.control}>
                <span className={styles.controlLabel}>{t.variantLabel}</span>
                <Segmented
                  segments={segments}
                  value={variantId}
                  onChange={setVariantId}
                  variant="ink"
                  aria-label={t.variantLabel}
                />
              </div>
            ) : null}

            <div className={styles.control}>
              <span className={styles.controlLabel}>{t.qtyLabel}</span>
              <QtyStepper
                value={qty}
                onChange={setQty}
                min={1}
                max={MERCH_MAX_QTY_PER_LINE}
                locale={locale}
              />
            </div>

            <div className={styles.actions}>
              <NewsButton
                variant="red"
                size="lg"
                onClick={handleAdd}
                trailing={<span aria-hidden>{t.arrow}</span>}
              >
                {t.addToCart}
              </NewsButton>
              {added ? (
                <span className={styles.added} role="status">
                  <span aria-hidden>✓ </span>{t.added}
                  <Link href={`${localePrefix(locale)}/store/cart`} className={styles.addedLink}>
                    {' '}{t.addedLink}
                  </Link>
                </span>
              ) : null}
            </div>

            <ul className={styles.trust}>
              <li className={styles.trustRow}>
                <span aria-hidden className={styles.trustMark}>
                  ■
                </span>
                {t.trustFulfilment}
              </li>
              <li className={styles.trustRow}>
                <span aria-hidden className={styles.trustMark}>
                  ■
                </span>
                {t.trustPayment}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
