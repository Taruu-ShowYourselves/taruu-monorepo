/**
 * Merch catalogue.
 *
 * Static source of truth for the store. Prices are absolute ILS per variant.
 * The checkout route re-prices every line against this catalogue, so the
 * client can never set its own price. Images live under /public/images/merch/
 * (press art - generate/replace as needed).
 */

import type { Product } from '@sync/shared';
import type { Locale } from '@/lib/i18n';

export const MERCH_CATALOG: Product[] = [
  {
    id: 'tee-press',
    slug: 'press-tee',
    name: 'חולצת "הקול של האזרחים"',
    description:
      'חולצת כותנה כבדה בהדפס מערכת: כותרת ראשית על החזה, דיו על קרם.',
    category: 'apparel',
    basePriceILS: 89,
    images: ['/images/merch/press-tee.png'],
    active: true,
    variants: [
      { id: 's', label: 'S · קרם', sku: 'TEE-PRESS-S', priceILS: 89, inStock: true },
      { id: 'm', label: 'M · קרם', sku: 'TEE-PRESS-M', priceILS: 89, inStock: true },
      { id: 'l', label: 'L · קרם', sku: 'TEE-PRESS-L', priceILS: 89, inStock: true },
      { id: 'xl', label: 'XL · קרם', sku: 'TEE-PRESS-XL', priceILS: 95, inStock: true },
    ],
  },
  {
    id: 'sticker-pack',
    slug: 'sticker-pack',
    name: 'חבילת מדבקות ■',
    description:
      'שש מדבקות ויניל עמידות: גליפים, כותרות וטיק אדום. להדביק על המחשב, על הקלמר, על הקיר.',
    category: 'sticker',
    basePriceILS: 24,
    images: ['/images/merch/sticker-pack.png'],
    active: true,
    variants: [
      { id: 'single', label: 'גיליון אחד', sku: 'STK-PACK-1', priceILS: 24, inStock: true },
      { id: 'triple', label: 'שלושה גיליונות', sku: 'STK-PACK-3', priceILS: 60, inStock: true },
    ],
  },
  {
    id: 'tote',
    slug: 'tote-bag',
    name: 'תיק הבד · THE LEDGER',
    description:
      'תיק בד אורגני עם הדפס שתי-צבעים. נושאים בו את הקניות, נושאים את הקהילה.',
    category: 'accessory',
    basePriceILS: 49,
    images: ['/images/merch/tote-bag.png'],
    active: true,
    variants: [
      { id: 'natural', label: 'טבעי', sku: 'TOTE-NAT', priceILS: 49, inStock: true },
      { id: 'black', label: 'שחור', sku: 'TOTE-BLK', priceILS: 49, inStock: true },
    ],
  },
  {
    id: 'mug',
    slug: 'press-mug',
    name: 'ספל המערכת',
    description:
      'ספל קרמיקה למהדורת הבוקר. כותרת אחת, קפה אחד, יום אחד של דמוקרטיה מקומית.',
    category: 'accessory',
    basePriceILS: 39,
    images: ['/images/merch/press-mug.png'],
    active: true,
    variants: [
      { id: 'standard', label: '330 מ״ל', sku: 'MUG-330', priceILS: 39, inStock: true },
    ],
  },
  {
    id: 'poster',
    slug: 'manifesto-poster',
    name: 'כרזת המניפסט',
    description:
      'הדפס ארכיון A2: כותרת ענק, חיתוך לינו אזרחי, דיו אדום. למסגר ולתלות.',
    category: 'print',
    basePriceILS: 69,
    images: ['/images/merch/manifesto-poster.png'],
    active: true,
    variants: [
      { id: 'a2', label: 'A2 · 42×59 ס״מ', sku: 'POSTER-A2', priceILS: 69, inStock: true },
      { id: 'a1', label: 'A1 · 59×84 ס״מ', sku: 'POSTER-A1', priceILS: 99, inStock: true },
    ],
  },
];

/**
 * English display copy, keyed by product id. Hebrew stays the canonical
 * source above; SKUs, prices and images are shared and never localized.
 */
interface ProductCopyEn {
  name: string;
  description: string;
  variantLabels: Record<string, string>;
}

const CATALOG_EN: Record<string, ProductCopyEn> = {
  'tee-press': {
    name: 'The “Voice of the Citizens” Tee',
    description:
      'A heavy cotton tee with an editorial print: a front-page headline across the chest, ink on cream.',
    variantLabels: {
      s: 'S · Cream',
      m: 'M · Cream',
      l: 'L · Cream',
      xl: 'XL · Cream',
    },
  },
  'sticker-pack': {
    name: 'Sticker Pack ■',
    description:
      'Six durable vinyl stickers: glyphs, headlines and the red tick. For the laptop, the pencil case, the wall.',
    variantLabels: {
      single: 'One sheet',
      triple: 'Three sheets',
    },
  },
  tote: {
    name: 'The Tote Bag · THE LEDGER',
    description:
      'An organic cotton tote with a two-colour print. Carry the shopping, carry the community.',
    variantLabels: {
      natural: 'Natural',
      black: 'Black',
    },
  },
  mug: {
    name: 'The Editors’ Mug',
    description:
      'A ceramic mug for the morning edition. One headline, one coffee, one day of local democracy.',
    variantLabels: {
      standard: '330 ml',
    },
  },
  poster: {
    name: 'The Manifesto Poster',
    description:
      'An A2 archival print: an oversized headline, a civic linocut, red ink. To frame and hang.',
    variantLabels: {
      a2: 'A2 · 42×59 cm',
      a1: 'A1 · 59×84 cm',
    },
  },
};

/**
 * Return the product with locale-appropriate display copy (name, description,
 * variant labels). Identity, SKUs, prices and images are untouched; Hebrew
 * returns the catalogue entry as-is.
 */
export function localizeProduct(product: Product, locale: Locale): Product {
  if (locale === 'he') return product;
  const copy = CATALOG_EN[product.id];
  if (!copy) return product;
  return {
    ...product,
    name: copy.name,
    description: copy.description,
    variants: product.variants.map((v) => ({
      ...v,
      label: copy.variantLabels[v.id] ?? v.label,
    })),
  };
}

/** Look up an active product by slug. */
export function getProductBySlug(slug: string): Product | undefined {
  return MERCH_CATALOG.find((p) => p.slug === slug && p.active);
}

/** Resolve a (slug, variantId) pair to its product + variant, or null. */
export function resolveVariant(slug: string, variantId: string) {
  const product = getProductBySlug(slug);
  if (!product) return null;
  const variant = product.variants.find((v) => v.id === variantId);
  if (!variant) return null;
  return { product, variant };
}
