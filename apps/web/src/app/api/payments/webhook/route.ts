import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { paymentService } from '@/services/payments/greenInvoice';
import type { PaymentWebhookEvent } from '@sync/shared';
import { qubikService } from '@/services/qubik';
import { emailService } from '@/services/email';
import {
  getPaymentById,
  getPaymentByProviderId,
  markPaymentCompleted,
  updatePaymentStatus,
  createEntitlement,
  getUserById,
  getWebhookEventByEventId,
  createWebhookEvent,
  updateWebhookEventStatus,
} from '@/lib/supabase/db';
import { webhookLogger as log } from '@/lib/logger';

/**
 * POST /api/payments/webhook
 * Handle Green Invoice payment notifications.
 *
 * Security:
 * - Shared-secret token auth (`?token=` query or `x-greeninvoice-token` header;
 *   constant-time compare, fail-closed in production). Green Invoice's hosted-form
 *   notify supports only a URL, so the secret rides in the query string.
 * - event_id tracking (uniqueness - prevents duplicate processing).
 * - Idempotent payment processing (safe retries).
 *
 * Fulfilment on a successful payment notification (document issued):
 * - mark payment completed
 * - create the create_vote entitlement
 * - mint SYNC tokens and email a receipt
 *
 * The only payment that can reach this route is a ₪50 vote creation. It credits no
 * civic pool and records no ballot - free ballots are recorded by
 * /api/votes/[id]/participate, never by a payment.
 */
export async function POST(request: NextRequest) {
  let eventId: string | null = null;

  try {
    // Verify webhook authenticity (shared secret) BEFORE reading the body.
    if (!paymentService.verifyWebhook(request)) {
      log.error('Webhook auth failed - bad or missing token');
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const payload = await request.text();
    const rawPayload = JSON.parse(payload);
    const event: PaymentWebhookEvent = paymentService.parseWebhookEvent(rawPayload);

    // === REPLAY / DUPLICATE PREVENTION ===
    const payloadHash = createHash('sha256').update(payload).digest('hex');
    const generatedEventId =
      rawPayload.event_id ||
      rawPayload.notification_id ||
      `gi_${event.paymentId}_${payloadHash.substring(0, 16)}`;
    eventId = generatedEventId;

    const existingEvent = await getWebhookEventByEventId(generatedEventId);
    if (existingEvent) {
      if (existingEvent.status === 'processed') {
        log.info('Webhook already processed (replay detected)', { eventId: generatedEventId });
        return NextResponse.json({ received: true, idempotent: true, replay: true });
      }
      if (existingEvent.status === 'failed') {
        log.info('Retrying previously failed webhook', { eventId: generatedEventId });
      }
    } else {
      try {
        await createWebhookEvent({
          event_id: generatedEventId,
          provider: 'green_invoice',
          event_type: rawPayload.event_type || event.type,
          payload_hash: payloadHash,
          idempotency_key: event.metadata.orderId || event.paymentId,
          status: 'pending',
        });
      } catch (insertError) {
        // Unique-constraint race: a concurrent delivery of the same event won the
        // insert. Treat this delivery as a replay and let the winner process it.
        log.info('Concurrent webhook insert detected - treating as replay', {
          eventId: generatedEventId,
          error: insertError instanceof Error ? insertError.message : insertError,
        });
        return NextResponse.json({ received: true, idempotent: true, replay: true });
      }
    }

    switch (event.type) {
      case 'payment.succeeded': {
        // custom_data.orderId is our internal payment id
        const ourPaymentId = event.metadata.orderId || event.paymentId;
        const payment =
          (await getPaymentById(ourPaymentId)) ||
          (await getPaymentByProviderId(event.paymentId));

        if (!payment) {
          log.error('Payment not found', { paymentId: ourPaymentId });
          return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        }

        // Atomic claim: pending→completed in one statement. Only the delivery
        // that flips the row runs fulfilment - Green Invoice retries the notify on
        // any non-2xx, so a TOCTOU status read would double-credit treasury +
        // double-mint tokens. The loser is idempotent.
        const claimed = await markPaymentCompleted(payment.id, event.paymentId);
        if (!claimed) {
          log.info('Payment already processed (idempotent)', { paymentId: payment.id });
          return NextResponse.json({ received: true, idempotent: true });
        }

        const user = await getUserById(payment.user_id);
        if (!user) {
          log.error('User not found for payment', { paymentId: payment.id, userId: payment.user_id });
          break;
        }

        if (payment.type === 'vote_participation') {
          // Participation has been free since cfa5d25; this rail can no longer create
          // payments. A settled row here is a pre-cfa5d25 leftover. Mark it complete
          // (already done by the atomic claim above) and fulfil nothing - the ballot,
          // if any, was recorded by /api/votes/[id]/participate, not by this webhook.
          log.warn('Legacy vote_participation payment settled - no fulfilment', { paymentId: payment.id });
          break;
        }

        // 1 ILS = 1 SYNC token; payment.amount is in agorot
        const tokensToMint = Math.floor(payment.amount / 100);

        // No treasury accrual here. The ₪50 creation fee is 100% platform (PAY-06);
        // the civic pool is funded by the vote's Bags.fm token, not by fees. Wiring a
        // pool credit to a creation charge is what PAY-04 used to say and it is retired.

        // Entitlement
        await createEntitlement({
          user_id: user.id,
          type: 'create_vote',
          payment_id: payment.id,
          vote_id: payment.vote_id || null,
          amount: tokensToMint,
          granted_at: new Date().toISOString(),
        });

        // Mint SYNC tokens
        if (tokensToMint > 0 && user.qubik_wallet_address) {
          try {
            await qubikService.mintTokens({
              walletAddress: user.qubik_wallet_address,
              amount: tokensToMint,
              reason: payment.type,
            });
            log.info('Minted SYNC tokens', { tokensToMint, userId: user.id });
          } catch (mintError) {
            log.error('Error minting tokens', { error: mintError, userId: user.id, tokensToMint });
          }
        } else if (tokensToMint > 0 && !user.qubik_wallet_address) {
          log.warn('User has no wallet address - cannot mint tokens', { userId: user.id, tokensToMint });
        }

        // Receipt email (best-effort)
        try {
          const paymentStatus = await paymentService.getPaymentStatus(event.paymentId);
          await emailService.sendPaymentReceiptEmail({
            to: user.email,
            firstName: user.first_name || 'משתמש',
            amount: payment.amount / 100,
            type: payment.type,
            receiptUrl: paymentStatus.receiptUrl || '',
            tokensEarned: tokensToMint,
          });
        } catch (emailError) {
          log.error('Error sending receipt email', { error: emailError, userId: user.id });
        }

        break;
      }

      case 'payment.failed': {
        const ourPaymentId = event.metadata.orderId || event.paymentId;
        const payment =
          (await getPaymentById(ourPaymentId)) ||
          (await getPaymentByProviderId(event.paymentId));

        if (payment && payment.status !== 'failed') {
          await updatePaymentStatus(payment.id, 'failed', event.paymentId);
        }
        log.error('Payment failed', { paymentId: event.paymentId });
        break;
      }

      case 'refund.created': {
        const ourPaymentId = event.metadata.orderId || event.paymentId;
        const payment =
          (await getPaymentById(ourPaymentId)) ||
          (await getPaymentByProviderId(event.paymentId));

        if (payment && payment.status !== 'refunded') {
          await updatePaymentStatus(payment.id, 'refunded', event.paymentId);
        }
        log.info('Refund processed', { paymentId: event.paymentId });
        break;
      }

      default:
        log.info('Unhandled event type', { eventType: event.type });
    }

    if (eventId) {
      await updateWebhookEventStatus(eventId, 'processed');
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    log.error('Webhook error', { error });
    if (eventId) {
      await updateWebhookEventStatus(
        eventId,
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
