/**
 * POST /api/merch/webhook
 *
 * Green Invoice notifies this endpoint after a payment completes (the `custom`
 * field carries our order id). Acknowledge fast (200), then mark the order paid
 * idempotently and store the issued document id. Orders settle at `paid` and
 * stop there - there is no downstream fulfilment handoff.
 */

import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getMerchOrderById, markMerchOrderPaid } from '@/lib/supabase/db';
import { logger } from '@/lib/logger';

/**
 * Authenticate the caller against a shared secret. We register the notify URL
 * with Green Invoice carrying `?token=<secret>` (and accept the same value via
 * an `x-greeninvoice-token` header), so a forged POST without the secret can't
 * flip an order to paid.
 *
 * Returns `true` when authentic. When no secret is configured we fail OPEN so
 * local/dev mock checkout keeps working, but log loudly - production MUST set
 * `GREENINVOICE_WEBHOOK_SECRET`.
 */
function isAuthentic(request: Request): boolean {
  const secret = process.env.GREENINVOICE_WEBHOOK_SECRET || '';
  if (!secret) {
    // Fail CLOSED in production (a missing secret must not leave a forge-to-paid
    // hole); fail open only in dev so mock checkout works without creds.
    if (process.env.NODE_ENV === 'production') {
      logger.error('Merch webhook: GREENINVOICE_WEBHOOK_SECRET unset in production - rejecting');
      return false;
    }
    logger.warn('Merch webhook: GREENINVOICE_WEBHOOK_SECRET unset - UNAUTHENTICATED (dev only)');
    return true;
  }
  const provided =
    new URL(request.url).searchParams.get('token') ||
    request.headers.get('x-greeninvoice-token') ||
    '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  // Length-guard before timingSafeEqual (it throws on mismatched lengths).
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!isAuthentic(request)) {
    logger.warn('Merch webhook: rejected - bad or missing token');
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

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

    // The issued document / payment id, defensive across Green Invoice fields.
    const paymentId =
      (payload.id as string) ||
      (payload.documentId as string) ||
      (payload.paymentId as string) ||
      order.payment_id ||
      null;

    // Atomic `pending → paid` (guarded in-statement). Concurrent or replayed
    // deliveries can't double-process: only the first matches the pending row.
    const result = await markMerchOrderPaid(orderId, paymentId);
    if (result.kind === 'error') {
      // Transient DB failure. Do NOT ack 200 - return 500 so Green Invoice
      // retries the notification rather than dropping a paid order.
      logger.error('Merch webhook: paid transition failed', { orderId });
      return NextResponse.json({ error: 'update failed' }, { status: 500 });
    }
    if (result.kind === 'noop') {
      // No pending row matched - already settled or lost the race. Idempotent.
      return NextResponse.json({ received: true });
    }
    logger.info('Merch order marked paid', { orderId });
  } catch (error) {
    // Log but still ack - the order stays 'pending' and can be reconciled.
    logger.error('Merch webhook processing failed', {
      error: String(error),
      orderId,
    });
  }

  return NextResponse.json({ received: true });
}
