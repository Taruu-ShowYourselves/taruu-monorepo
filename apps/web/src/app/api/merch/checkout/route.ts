/**
 * POST /api/merch/checkout
 *
 * Re-prices the requested cart against the server catalogue (the client can
 * never set its own price), builds an order, and creates a hosted Green Invoice
 * payment page. Returns the URL to redirect the buyer to.
 *
 * Without Green Invoice credentials (dev), returns a mock thank-you URL so the
 * flow is exercisable end-to-end.
 */

import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import {
  MERCH_SHIPPING_FLAT_ILS,
  MERCH_FREE_SHIPPING_THRESHOLD_ILS,
  MERCH_MAX_QTY_PER_LINE,
} from '@sync/shared';
import type {
  CheckoutRequest,
  CheckoutResponse,
  CartItem,
  MerchOrder,
  ShippingAddress,
} from '@sync/shared';
import { resolveVariant } from '@/lib/merch/catalog';
import {
  isGreenInvoiceConfigured,
  createPaymentForm,
} from '@/services/greenInvoice';
import { getSessionFromRequest } from '@/services/auth/session';
import { createMerchOrder } from '@/lib/supabase/db';
import { logger } from '@/lib/logger';
import {
  paymentsEnabled,
  PAYMENTS_DISABLED_CODE,
  PAYMENTS_DISABLED_MESSAGE,
} from '@/lib/payments-flag';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validShipping(s: unknown): s is ShippingAddress {
  if (!s || typeof s !== 'object') return false;
  const a = s as Record<string, unknown>;
  return (
    typeof a.fullName === 'string' && a.fullName.trim().length > 1 &&
    typeof a.email === 'string' && EMAIL_RE.test(a.email) &&
    typeof a.phone === 'string' && a.phone.trim().length >= 6 &&
    typeof a.street === 'string' && a.street.trim().length > 1 &&
    typeof a.city === 'string' && a.city.trim().length > 1 &&
    typeof a.zip === 'string' && a.zip.trim().length > 0
  );
}

export async function POST(request: Request) {
  // Payments kill switch, checked FIRST - before auth, before the body is read,
  // before an order row is written. An order persisted here while the store
  // cannot charge would be a pending row nobody can ever settle.
  if (!paymentsEnabled()) {
    return NextResponse.json(
      { error: PAYMENTS_DISABLED_MESSAGE, code: PAYMENTS_DISABLED_CODE },
      { status: 503 }
    );
  }

  // Checkout requires sign-in - every order is tied to a buyer.
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: 'Sign in to complete checkout' },
      { status: 401 }
    );
  }

  let body: CheckoutRequest;
  try {
    body = (await request.json()) as CheckoutRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
  }
  if (!validShipping(body.shipping)) {
    return NextResponse.json({ error: 'Invalid shipping details' }, { status: 400 });
  }

  // Re-price every line against the catalogue.
  const items: CartItem[] = [];
  for (const line of body.items) {
    const qty = Math.floor(Number(line.quantity));
    if (!Number.isFinite(qty) || qty < 1 || qty > MERCH_MAX_QTY_PER_LINE) {
      return NextResponse.json(
        { error: `Invalid quantity for ${line.slug}` },
        { status: 400 }
      );
    }
    const resolved = resolveVariant(line.slug, line.variantId);
    if (!resolved || !resolved.variant.inStock) {
      return NextResponse.json(
        { error: `Unavailable item: ${line.slug}/${line.variantId}` },
        { status: 409 }
      );
    }
    const { product, variant } = resolved;
    items.push({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      variantId: variant.id,
      variantLabel: variant.label,
      unitPriceILS: variant.priceILS,
      quantity: qty,
      image: product.images[0] ?? '',
    });
  }

  const subtotalILS = items.reduce((sum, i) => sum + i.unitPriceILS * i.quantity, 0);
  const shippingILS =
    subtotalILS >= MERCH_FREE_SHIPPING_THRESHOLD_ILS ? 0 : MERCH_SHIPPING_FLAT_ILS;
  const totalILS = subtotalILS + shippingILS;

  const now = new Date();
  const order: MerchOrder = {
    id: randomUUID(),
    userId: session.userId,
    items,
    subtotalILS,
    shippingILS,
    totalILS,
    currency: 'ILS',
    status: 'pending',
    shipping: { ...body.shipping, country: body.shipping.country || 'IL' },
    createdAt: now,
    updatedAt: now,
  };

  // Persist the order (status 'pending') BEFORE creating the payment page, so
  // the Green Invoice webhook can find it by id. In dev without a database the
  // mock flow stays exercisable; a persist failure only hard-fails when a real
  // payment provider is configured (we must never lose a real order).
  try {
    await createMerchOrder({
      id: order.id,
      user_id: order.userId ?? null,
      items: order.items as unknown as Record<string, unknown>[],
      subtotal_ils: order.subtotalILS,
      shipping_ils: order.shippingILS,
      total_ils: order.totalILS,
      currency: order.currency,
      status: 'pending',
      shipping: order.shipping as unknown as Record<string, unknown>,
    });
  } catch (error) {
    if (isGreenInvoiceConfigured()) {
      logger.error('Merch order persist failed', {
        error: String(error),
        orderId: order.id,
      });
      return NextResponse.json(
        { error: 'Could not record order. Please try again.' },
        { status: 500 }
      );
    }
    logger.warn('Merch order persist skipped (dev / no database)', {
      orderId: order.id,
    });
  }

  // Resolve redirect/notify URLs from the request origin (locale-aware).
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  // The webhook authenticates Green Invoice by a shared secret carried on the
  // notify URL; without it the endpoint runs unauthenticated (dev only).
  const webhookSecret = process.env.GREENINVOICE_WEBHOOK_SECRET || '';
  const notifyUrl = webhookSecret
    ? `${origin}/api/merch/webhook?token=${encodeURIComponent(webhookSecret)}`
    : `${origin}/api/merch/webhook`;
  const urls = {
    successUrl: `${origin}/he/store/thank-you?order=${order.id}`,
    failureUrl: `${origin}/he/store/cart?payment=failed`,
    notifyUrl,
  };

  // Dev / unconfigured: skip the real provider, return a mock thank-you URL.
  if (!isGreenInvoiceConfigured()) {
    logger.warn('Green Invoice not configured - returning mock checkout URL', {
      orderId: order.id,
      totalILS,
    });
    const res: CheckoutResponse = {
      url: `${urls.successUrl}&mock=1`,
      orderId: order.id,
      mock: true,
    };
    return NextResponse.json(res);
  }

  try {
    const url = await createPaymentForm(order, urls);
    const res: CheckoutResponse = { url, orderId: order.id };
    return NextResponse.json(res);
  } catch (error) {
    logger.error('Merch checkout failed', { error: String(error), orderId: order.id });
    return NextResponse.json(
      { error: 'Payment provider error. Please try again.' },
      { status: 502 }
    );
  }
}
