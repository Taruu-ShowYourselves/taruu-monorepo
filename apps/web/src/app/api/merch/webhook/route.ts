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
import { confirmMerchDocumentForOrder, extractDocumentId } from '@/services/greenInvoice';
import { logger } from '@/lib/logger';

/**
 * Authenticate a caller that can send our shared secret. The secret is accepted
 * from the `x-greeninvoice-token` header only; a query-string token is ignored
 * because URLs end up in provider dashboards, request logs and proxies.
 *
 * Green Invoice's hosted form cannot attach custom notify headers, so real
 * provider notifies authenticate via `confirmMerchDocumentForOrder()` below.
 * When no secret is configured this fails open only outside production so local
 * mock checkout stays usable.
 */
function hasValidHeaderSecret(request: Request): boolean {
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
  const provided = request.headers.get('x-greeninvoice-token') || '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  // Length-guard before timingSafeEqual (it throws on mismatched lengths).
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const headerOk = hasValidHeaderSecret(request);

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
  const documentId = extractDocumentId(payload);
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

    const confirmedByProvider =
      documentId !== null &&
      (await confirmMerchDocumentForOrder(documentId, {
        orderId,
        totalILS: order.total_ils,
      }));
    if (!headerOk && !confirmedByProvider) {
      logger.warn('Merch webhook: rejected - no valid header and no confirmable document', {
        orderId,
        hasDocumentId: documentId !== null,
      });
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // Atomic `pending → paid` (guarded in-statement). Concurrent or replayed
    // deliveries can't double-process: only the first matches the pending row.
    const result = await markMerchOrderPaid(orderId, documentId ?? order.payment_id ?? null);
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
