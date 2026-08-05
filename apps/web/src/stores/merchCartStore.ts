/**
 * Merch Cart Store - Zustand state for the press storefront cart.
 *
 * Mirrors the persist pattern of authStore. Lines are self-contained
 * CartItem records (denormalised name/price/image) so the cart renders
 * without re-resolving the catalogue. The checkout API re-prices every
 * line server-side, so the persisted unit price is display-only.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Product, ProductVariant, CartItem } from '@sync/shared';
import {
  MERCH_SHIPPING_FLAT_ILS,
  MERCH_FREE_SHIPPING_THRESHOLD_ILS,
  MERCH_MAX_QTY_PER_LINE,
} from '@sync/shared';

// === Types ===

interface MerchCartState {
  items: CartItem[];

  // Actions
  addItem: (product: Product, variant: ProductVariant, quantity?: number) => void;
  updateQty: (productId: string, variantId: string, quantity: number) => void;
  removeItem: (productId: string, variantId: string) => void;
  clear: () => void;
}

// === Helpers ===

const clampQty = (n: number): number =>
  Math.max(1, Math.min(MERCH_MAX_QTY_PER_LINE, Math.floor(n)));

const sameLine = (item: CartItem, productId: string, variantId: string): boolean =>
  item.productId === productId && item.variantId === variantId;

// === Store ===

export const useMerchCartStore = create<MerchCartState>()(
  persist(
    (set) => ({
      items: [],

      addItem: (product, variant, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((i) =>
            sameLine(i, product.id, variant.id)
          );

          if (existing) {
            return {
              items: state.items.map((i) =>
                sameLine(i, product.id, variant.id)
                  ? { ...i, quantity: clampQty(i.quantity + quantity) }
                  : i
              ),
            };
          }

          const line: CartItem = {
            productId: product.id,
            slug: product.slug,
            name: product.name,
            variantId: variant.id,
            variantLabel: variant.label,
            unitPriceILS: variant.priceILS,
            quantity: clampQty(quantity),
            image: product.images[0] ?? '',
          };

          return { items: [...state.items, line] };
        }),

      updateQty: (productId, variantId, quantity) =>
        set((state) => ({
          items: state.items.map((i) =>
            sameLine(i, productId, variantId)
              ? { ...i, quantity: clampQty(quantity) }
              : i
          ),
        })),

      removeItem: (productId, variantId) =>
        set((state) => ({
          items: state.items.filter((i) => !sameLine(i, productId, variantId)),
        })),

      clear: () => set({ items: [] }),
    }),
    {
      name: 'taruu-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);

// === Derived totals ===

/** Items in the cart, summed across lines. */
export const cartCount = (items: CartItem[]): number =>
  items.reduce((sum, i) => sum + i.quantity, 0);

/** Pre-shipping subtotal in ILS. */
export const cartSubtotal = (items: CartItem[]): number =>
  items.reduce((sum, i) => sum + i.unitPriceILS * i.quantity, 0);

/** Flat shipping, waived once the subtotal clears the free-shipping threshold. */
export const cartShipping = (items: CartItem[]): number => {
  if (items.length === 0) return 0;
  return cartSubtotal(items) >= MERCH_FREE_SHIPPING_THRESHOLD_ILS
    ? 0
    : MERCH_SHIPPING_FLAT_ILS;
};

/** Subtotal + shipping. */
export const cartTotal = (items: CartItem[]): number =>
  cartSubtotal(items) + cartShipping(items);

// === Selectors (subscribe to the live cart) ===

export const useCartItems = () => useMerchCartStore((s) => s.items);
export const useCartCount = () => useMerchCartStore((s) => cartCount(s.items));
