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
 * Security - a delivery must satisfy ONE of two independent factors (SEC-03):
 * - Factor 1: the shared secret in the `x-greeninvoice-token` header, compared in
 *   constant time. The header is the only accepted transport; no secret is ever
 *   placed in the notify URL, and a secret arriving as a query parameter is
 *   ignored. Unset secret = fail closed in production, open outside it (dev).
 * - Factor 2: Green Invoice vouches for the document. The hosted form cannot
 *   attach a header, so a real notify is treated as an untrusted ping: the route
 *   re-fetches the claimed document over the authenticated Green Invoice API
 *   before mutating anything. Guessing an order id achieves nothing, because an
 *   attacker cannot make Green Invoice produce a document that was never issued.
 * Neither factor holding is a 401 and nothing is mutated.
 *
 * Fail closed on the database too: only SQLSTATE 23505 (a concurrent delivery won
 * the `webhook_events` insert) is a replay. Any other database failure returns 5xx
 * so Green Invoice retries - a 200 would tell it to stop and the delivery would be
 * lost.
 *
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
    // The body must be read before the second factor can run: factor 2 needs the
    // document id the payload claims. A malformed body still lands in the catch.
    const payload = await request.text();
    const rawPayload = JSON.parse(payload);
    const event: PaymentWebhookEvent = paymentService.parseWebhookEvent(rawPayload);
    const documentId = paymentService.extractDocumentId(rawPayload) ?? null;

    // Factor 1: the shared secret, constant-time, HEADER ONLY (never a query
    // parameter). Factor 2: make Green Invoice vouch for the document over the
    // authenticated API. The hosted form cannot attach a header, so factor 2 is
    // what actually authenticates production notifies; factor 1 covers any caller
    // that can. verifyWebhook already fails open outside production when no secret
    // is configured, so local mock checkout keeps working without a Green Invoice
    // round-trip - there is deliberately no second dev escape hatch here.
    const headerOk = paymentService.verifyWebhook(request);
    const authenticated =
      headerOk ||
      (documentId !== null && (await paymentService.confirmDocumentIssued(documentId)));

    if (!authenticated) {
      log.error('Webhook auth failed - no valid header and no confirmable document');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
        const code = (insertError as { code?: string })?.code;
        if (code === '23505') {
          // A concurrent delivery of the same event won the insert. Let the winner
          // process it; this delivery is a genuine replay.
          log.info('Concurrent webhook insert - treating as replay', { eventId: generatedEventId });
          return NextResponse.json({ received: true, idempotent: true, replay: true });
        }
        // Any other database failure must NOT look like a replay: a 200 tells Green
        // Invoice to stop retrying and the delivery is lost. Fail closed and let it retry.
        log.error('Webhook event insert failed', { eventId: generatedEventId, code });
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 503 });
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
        // provider_id gets a REAL Green Invoice document id or nothing at all.
        // `event.paymentId` falls back to our own order id (see parseWebhookEvent),
        // and seeding the column with our own id would make Phase 4's
        // reconciliation match our id against itself (PAY-07).
        const claimed = await markPaymentCompleted(payment.id, documentId ?? undefined);
        if (!claimed) {
          log.info('Payment already processed (idempotent)', { paymentId: payment.id });
          return NextResponse.json({ received: true, idempotent: true });
        }

        if (!documentId) {
          log.warn('Settled payment has no Green Invoice document id - reconciliation will flag it', {
            paymentId: payment.id,
          });
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

        // Receipt email (best-effort). getPaymentStatus expects a Green Invoice
        // document id, so prefer the real one; `event.paymentId` may be our own
        // order id, which GI cannot resolve.
        try {
          const paymentStatus = await paymentService.getPaymentStatus(documentId ?? event.paymentId);
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
