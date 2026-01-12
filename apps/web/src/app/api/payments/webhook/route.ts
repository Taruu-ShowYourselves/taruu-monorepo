import { NextRequest, NextResponse } from 'next/server';
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
} from '@/lib/supabase/db';

/**
 * POST /api/payments/webhook
 * Handle Green Invoice payment webhooks
 * Implements idempotency - multiple webhook calls for same payment are safe
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signature = request.headers.get('x-green-invoice-signature') || '';

    // Verify webhook signature
    if (!greenInvoiceService.verifyWebhookSignature(payload, signature)) {
      console.error('Webhook signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse the webhook event
    const rawPayload = JSON.parse(payload);
    const event: PaymentWebhookEvent = greenInvoiceService.parseWebhookEvent(rawPayload);

    // Handle the event
    switch (event.type) {
      case 'payment.succeeded': {
        // The paymentId from Green Invoice is our orderId (which is our payment.id)
        const ourPaymentId = event.metadata.orderId || event.paymentId;

        // Look up payment in our database
        const payment = await getPaymentById(ourPaymentId);

        if (!payment) {
          console.error('Payment not found:', ourPaymentId);
          return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        }

        // Idempotency check - if already completed, return success
        if (payment.status === 'completed') {
          console.log('Payment already processed (idempotent):', payment.id);
          return NextResponse.json({ received: true, idempotent: true });
        }

        // Update payment status to completed
        await updatePaymentStatus(payment.id, 'completed', event.paymentId);

        // Get user
        const user = await getUserById(payment.user_id);
        if (!user) {
          console.error('User not found for payment:', payment.user_id);
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
        if (tokensToMint > 0) {
          try {
            await qubikService.mintTokens({
              walletAddress: '', // TODO: Get from user profile when implemented
              amount: tokensToMint,
              reason: payment.type,
            });
            console.log(`Minted ${tokensToMint} SYNC tokens for user ${user.id}`);
          } catch (mintError) {
            console.error('Error minting tokens:', mintError);
            // Don't fail - tokens can be minted manually later
          }
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
          console.error('Error sending receipt email:', emailError);
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

            console.log(`Vote recorded for vote ${payment.vote_id}, option ${payment.option_id}`);
          } catch (voteError) {
            console.error('Error recording vote:', voteError);
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

        console.error('Payment failed:', event.paymentId);
        break;
      }

      case 'refund.created': {
        const ourPaymentId = event.metadata.orderId || event.paymentId;
        const payment = await getPaymentById(ourPaymentId);

        if (payment && payment.status !== 'refunded') {
          await updatePaymentStatus(payment.id, 'refunded', event.paymentId);
        }

        console.log('Refund processed:', event.paymentId);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
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
