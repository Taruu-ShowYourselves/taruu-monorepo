/**
 * Merch Store Types
 *
 * Physical merch (apparel, stickers, accessories, prints). Payments settle
 * through Green Invoice (morning) as the Israeli merchant of record +
 * invoicing rail - the same rail that handles the vote fees.
 * We hold the catalogue + orders; orders settle at `paid` with no fulfilment
 * handoff.
 */

// === Catalogue ===

export type MerchCategory = 'apparel' | 'sticker' | 'accessory' | 'print';

/**
 * A single buyable variant of a product (size / colour). Price is absolute
 * ILS, not a delta, so the cart never has to resolve base + modifier.
 */
export interface ProductVariant {
  /** Stable variant id, unique within the product. */
  id: string;
  /** Human label, e.g. "M · שחור". */
  label: string;
  /** Stock-keeping unit. */
  sku: string;
  /** Absolute price in ILS. */
  priceILS: number;
  inStock: boolean;
}

export interface Product {
  /** Stable product id. */
  id: string;
  /** URL slug under /store. */
  slug: string;
  /** Hebrew display name. */
  name: string;
  /** Short editorial description. */
  description: string;
  category: MerchCategory;
  /** Headline "from" price in ILS (usually the cheapest variant). */
  basePriceILS: number;
  /** Image URLs (first is the lead). */
  images: string[];
  variants: ProductVariant[];
  /** Hidden from the storefront when false. */
  active: boolean;
}

// === Cart ===

/** A resolved line in the cart - self-contained for display + checkout. */
export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  variantId: string;
  variantLabel: string;
  unitPriceILS: number;
  quantity: number;
  image: string;
}

// === Orders ===

export type MerchOrderStatus =
  | 'pending' // created, awaiting payment
  | 'paid' // Green Invoice payment confirmed
  | 'fulfilling' // handed to POD partner
  | 'shipped'
  | 'cancelled'
  | 'failed';

/** Shipping destination collected at checkout. */
export interface ShippingAddress {
  fullName: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  /** Postal code. */
  zip: string;
  /** ISO-3166 alpha-2; defaults to IL. */
  country: string;
}

export interface MerchOrder {
  id: string;
  /** Buyer's user id - checkout requires sign-in, so this is set on real orders. */
  userId?: string;
  items: CartItem[];
  subtotalILS: number;
  shippingILS: number;
  totalILS: number;
  /** Always 'ILS' for now. */
  currency: 'ILS';
  status: MerchOrderStatus;
  shipping: ShippingAddress;
  /** Green Invoice payment / document id once issued. */
  paymentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// === Checkout API contract ===

/** One requested line; the server re-prices against the catalogue. */
export interface CheckoutLineInput {
  slug: string;
  variantId: string;
  quantity: number;
}

export interface CheckoutRequest {
  items: CheckoutLineInput[];
  shipping: ShippingAddress;
}

export interface CheckoutResponse {
  /** Hosted Green Invoice payment URL to redirect the buyer to. */
  url: string;
  orderId: string;
  /** True when running without Green Invoice creds (dev mock). */
  mock?: boolean;
}
