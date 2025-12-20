import { NextRequest, NextResponse } from 'next/server';
import { greenInvoiceService } from '@/services/payments/greenInvoice';
import { qubikService } from '@/services/qubik';
import { convergeService } from '@/services/converge';
import { emailService } from '@/services/email';
import { growService } from '@/services/payments/grow';

/**
 * POST /api/payments/webhook
 * Handle Green Invoice payment webhooks
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signature = request.headers.get('x-gi-signature') || '';

    // Verify webhook signature
    const isValid = greenInvoiceService.verifyWebhookSignature(payload, signature);

    if (!isValid) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const data = JSON.parse(payload);
    const event = greenInvoiceService.parseWebhookEvent(data);

    if (event.type === 'payment.succeeded') {
      const { oderId, voteId, type } = event.metadata;

      // Get user profile
      const user = await convergeService.getUserByClerkId(oderId);

      if (!user) {
        console.error('User not found for payment:', oderId);
        return NextResponse.json(
          { error: 'User not found' },
          { status: 400 }
        );
      }

      if (type === 'vote') {
        // Vote participation payment - tokens minting handled in participate route
        console.log(`Vote payment processed for user ${oderId}, vote ${voteId}`);
      } else if (type === 'create_vote') {
        // Vote creation payment - mint 50 tokens
        await qubikService.mintTokens({
          walletAddress: user.qubikWalletAddress,
          amount: 50,
          reason: 'create_vote',
        });

        // Update user token balance
        await convergeService.updateUser(user.id, {
          syncTokenBalance: user.syncTokenBalance + 50,
        });

        // Track payment
        await growService.trackPayment({
          oderId,
          amount: 50,
          type: 'create_vote',
        });

        // Get payment receipt URL
        const paymentDetails = await greenInvoiceService.getPaymentStatus(
          event.paymentId
        );

        // Send receipt email
        await emailService.sendPaymentReceiptEmail({
          to: user.email,
          firstName: user.firstName,
          amount: 50,
          type: 'create_vote',
          receiptUrl: paymentDetails.receiptUrl || '',
          tokensEarned: 50,
        });

        console.log(`Vote creation payment processed for user ${oderId}`);
      }
    } else if (event.type === 'payment.failed') {
      console.error('Payment failed:', event.paymentId);
      // Handle failed payment - could notify user, clean up pending records, etc.
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
