/**
 * POST /api/merch/webhook
 *
 * Green Invoice notifies this endpoint after a payment completes (the `custom`
 * field carries our order id). Acknowledge fast (200), then mark the order paid
 * idempotently and store the issued document id.
 *
 * TODO (POD wiring): hand a freshly-paid order to the POD partner
 * (Printful/Printify) for fulfilment and advance it to `fulfilling`.
 */

import { NextResponse } from 'next/server';
import { getMerchOrderById, updateMerchOrder } from '@/lib/supabase/db';
import { logger } from '@/lib/logger';

/** Statuses past 'pending' — a notification for these is a duplicate. */
const SETTLED = new Set(['paid', 'fulfilling', 'shipped', 'cancelled']);

export async function POST(request: Request) {
  let payload: Record<string, unknown> = {};
  try {
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      payload = (await request.json()) as Record<string, unknown>;
    } else {
      const form = await request.formData();
      payload = Object.fromEntries(form.entries());
    }
  } catch {
    // Green Invoice expects a 200 ack regardless; log and move on.
    logger.warn('Merch webhook: unparseable body');
    return NextResponse.json({ received: true });
  }

  const orderId = (payload.custom as string) || undefined;
  logger.info('Merch webhook received', {
    orderId,
    // Avoid logging PII / full payloads in production.
    keys: Object.keys(payload),
  });

  if (!orderId) {
    logger.warn('Merch webhook: no order id in payload');
    return NextResponse.json({ received: true });
  }

  try {
    const order = await getMerchOrderById(orderId);
    if (!order) {
      logger.warn('Merch webhook: unknown order', { orderId });
      return NextResponse.json({ received: true });
    }
    if (SETTLED.has(order.status)) {
      // Idempotent — already handled; ignore the duplicate notification.
      return NextResponse.json({ received: true });
    }

    // The issued document / payment id, defensive across Green Invoice fields.
    const paymentId =
      (payload.id as string) ||
      (payload.documentId as string) ||
      (payload.paymentId as string) ||
      order.payment_id ||
      null;

    const updated = await updateMerchOrder(orderId, {
      status: 'paid',
      payment_id: paymentId,
    });
    if (!updated) {
      // The write failed (transient DB error). Do NOT ack 200 — return 500 so
      // Green Invoice retries the notification rather than dropping a paid order.
      logger.error('Merch webhook: order update returned no row', { orderId });
      return NextResponse.json({ error: 'update failed' }, { status: 500 });
    }
    logger.info('Merch order marked paid', { orderId });
    // TODO(J6+): hand the paid order to the POD partner → status 'fulfilling'.
  } catch (error) {
    // Log but still ack — the order stays 'pending' and can be reconciled.
    logger.error('Merch webhook processing failed', {
      error: String(error),
      orderId,
    });
  }

  return NextResponse.json({ received: true });
}
