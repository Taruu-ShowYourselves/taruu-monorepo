import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import {
  greenInvoiceService,
  type PaymentWebhookEvent,
} from '@/services/payments/greenInvoice';
import { qubikService } from '@/services/qubik';
import { emailService } from '@/services/email';
import {
  getPaymentById,
  updatePaymentStatus,
  createEntitlement,
  getUserById,
  recordUserVote,
  incrementVoteOption,
  getWebhookEventByEventId,
  createWebhookEvent,
  updateWebhookEventStatus,
  isWebhookStale,
} from '@/lib/supabase/db';
import { webhookLogger as log } from '@/lib/logger';

// Maximum webhook age: 5 minutes (300 seconds)
const MAX_WEBHOOK_AGE_SECONDS = 5 * 60;

/**
 * POST /api/payments/webhook
 * Handle Green Invoice payment webhooks
 *
 * Security features:
 * - HMAC signature verification (authenticity)
 * - Timestamp validation (freshness - rejects events > 5 min old)
 * - Event ID tracking (uniqueness - prevents replay attacks)
 * - Idempotent payment processing (safe retries)
 */
export async function POST(request: NextRequest) {
  let eventId: string | null = null;

  try {
    const payload = await request.text();
    const signature = request.headers.get('x-green-invoice-signature') || '';

    // Verify webhook signature (proves authenticity)
    if (!greenInvoiceService.verifyWebhookSignature(payload, signature)) {
      log.error('Webhook signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse the webhook event
    const rawPayload = JSON.parse(payload);
    const event: PaymentWebhookEvent = greenInvoiceService.parseWebhookEvent(rawPayload);

    // === REPLAY ATTACK PREVENTION ===

    // 1. Timestamp validation (if provided by Green Invoice)
    // Check header first, then payload timestamp
    const timestampHeader = request.headers.get('x-green-invoice-timestamp');
    const webhookTimestamp = timestampHeader
      ? parseInt(timestampHeader, 10)
      : rawPayload.createdAt
        ? Math.floor(new Date(rawPayload.createdAt).getTime() / 1000)
        : null;

    if (webhookTimestamp && isWebhookStale(webhookTimestamp, MAX_WEBHOOK_AGE_SECONDS)) {
      log.error('Webhook rejected: timestamp too old', {
        timestamp: webhookTimestamp,
        age: Math.floor(Date.now() / 1000) - webhookTimestamp,
        maxAge: MAX_WEBHOOK_AGE_SECONDS,
      });
      return NextResponse.json(
        { error: 'Webhook too old - possible replay attack' },
        { status: 401 }
      );
    }

    // 2. Generate unique event ID for replay detection
    // Use Green Invoice's event ID if available, otherwise create from payload hash
    const eventIdHeader = request.headers.get('x-green-invoice-event-id');
    const payloadHash = createHash('sha256').update(payload).digest('hex');
    // Ensure eventId is always a string - use fallback if all sources are null/undefined
    const generatedEventId = eventIdHeader || rawPayload.id || `gi_${event.paymentId}_${payloadHash.substring(0, 16)}`;
    eventId = generatedEventId;

    // 3. Check if this event has already been processed
    const existingEvent = await getWebhookEventByEventId(generatedEventId);
    if (existingEvent) {
      if (existingEvent.status === 'processed') {
        log.info('Webhook already processed (replay detected)', { eventId: generatedEventId });
        return NextResponse.json({ received: true, idempotent: true, replay: true });
      }
      // If previous processing failed, allow retry
      if (existingEvent.status === 'failed') {
        log.info('Retrying previously failed webhook', { eventId: generatedEventId });
      }
    } else {
      // 4. Record new webhook event before processing
      await createWebhookEvent({
        event_id: generatedEventId,
        provider: 'green_invoice',
        event_type: event.type,
        payload_hash: payloadHash,
        idempotency_key: event.metadata.orderId || event.paymentId,
        status: 'pending',
      });
    }

    // Handle the event
    switch (event.type) {
      case 'payment.succeeded': {
        // The paymentId from Green Invoice is our orderId (which is our payment.id)
        const ourPaymentId = event.metadata.orderId || event.paymentId;

        // Look up payment in our database
        const payment = await getPaymentById(ourPaymentId);

        if (!payment) {
          log.error('Payment not found', { paymentId: ourPaymentId });
          return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        }

        // Idempotency check - if already completed, return success
        if (payment.status === 'completed') {
          log.info('Payment already processed (idempotent)', { paymentId: payment.id });
          return NextResponse.json({ received: true, idempotent: true });
        }

        // Update payment status to completed
        await updatePaymentStatus(payment.id, 'completed', event.paymentId);

        // Get user
        const user = await getUserById(payment.user_id);
        if (!user) {
          log.error('User not found for payment', { paymentId: payment.id, userId: payment.user_id });
          break;
        }

        // Calculate tokens to mint (1 ILS = 1 token, amount is in agorot)
        const tokensToMint = Math.floor(payment.amount / 100);

        // Create entitlement record
        await createEntitlement({
          user_id: user.id,
          type: payment.type === 'vote_participation' ? 'vote' : 'create_vote',
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
            // Don't fail - tokens can be minted manually later
          }
        } else if (tokensToMint > 0 && !user.qubik_wallet_address) {
          log.warn('User has no wallet address - cannot mint tokens', { userId: user.id, tokensToMint });
        }

        // Send receipt email
        try {
          const paymentStatus = await greenInvoiceService.getPaymentStatus(event.paymentId);
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

        // If vote participation, record the vote
        if (payment.type === 'vote_participation' && payment.vote_id && payment.option_id) {
          try {
            // Record user vote
            await recordUserVote({
              user_id: user.id,
              vote_id: payment.vote_id,
              option_id: payment.option_id,
              payment_id: payment.id,
            });

            // Increment vote option count
            await incrementVoteOption(payment.option_id);

            log.info('Vote recorded', { voteId: payment.vote_id, optionId: payment.option_id, userId: user.id });
          } catch (voteError) {
            log.error('Error recording vote', { error: voteError, voteId: payment.vote_id, optionId: payment.option_id });
          }
        }

        break;
      }

      case 'payment.failed': {
        const ourPaymentId = event.metadata.orderId || event.paymentId;
        const payment = await getPaymentById(ourPaymentId);

        if (payment && payment.status !== 'failed') {
          await updatePaymentStatus(payment.id, 'failed', event.paymentId);
        }

        log.error('Payment failed', { paymentId: event.paymentId });
        break;
      }

      case 'refund.created': {
        const ourPaymentId = event.metadata.orderId || event.paymentId;
        const payment = await getPaymentById(ourPaymentId);

        if (payment && payment.status !== 'refunded') {
          await updatePaymentStatus(payment.id, 'refunded', event.paymentId);
        }

        log.info('Refund processed', { paymentId: event.paymentId });
        break;
      }

      default:
        log.info('Unhandled event type', { eventType: event.type });
    }

    // Mark webhook event as successfully processed
    if (eventId) {
      await updateWebhookEventStatus(eventId, 'processed');
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    log.error('Webhook error', { error });

    // Mark webhook event as failed for potential retry
    if (eventId) {
      await updateWebhookEventStatus(
        eventId,
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Disable body parsing for webhook signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};
