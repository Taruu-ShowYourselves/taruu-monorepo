import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import { getPaymentById, updatePaymentStatus } from '@/lib/supabase/db';
import { paymentService } from '@/services/payments/greenInvoice';

/**
 * POST /api/payments/:id/verify
 * Verify payment completion after redirect from payment provider
 * Called after the user returns from the Green Invoice hosted payment page
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Invalid payment ID' },
        { status: 400 }
      );
    }

    // Get payment from our database
    const payment = await getPaymentById(id);

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Verify the payment belongs to the current user
    if (payment.user_id !== session.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // If payment already completed, return success with existing data
    if (payment.status === 'completed') {
      const amountILS = payment.amount / 100;
      let receiptUrl = null;

      if (payment.provider_id) {
        try {
          const providerStatus = await paymentService.getPaymentStatus(payment.provider_id);
          receiptUrl = providerStatus.receiptUrl || null;
        } catch {
          // Ignore - receipt URL is optional
        }
      }

      return NextResponse.json({
        success: true,
        receiptUrl,
        tokensEarned: Math.floor(amountILS),
      });
    }

    // If payment is pending, check with provider for actual status
    if (payment.status === 'pending' && payment.provider_id) {
      try {
        const providerStatus = await paymentService.getPaymentStatus(payment.provider_id);

        // If provider shows succeeded, update our database to completed
        if (providerStatus.status === 'succeeded') {
          await updatePaymentStatus(id, 'completed');

          const amountILS = payment.amount / 100;
          return NextResponse.json({
            success: true,
            receiptUrl: providerStatus.receiptUrl || null,
            tokensEarned: Math.floor(amountILS),
          });
        }

        // If provider shows failed, update our database
        if (providerStatus.status === 'failed') {
          await updatePaymentStatus(id, 'failed');

          return NextResponse.json({
            success: false,
            receiptUrl: null,
            tokensEarned: 0,
          });
        }
      } catch (error) {
        console.error('Error checking payment provider status:', error);
      }
    }

    // Payment still pending or unknown state
    return NextResponse.json({
      success: false,
      receiptUrl: null,
      tokensEarned: 0,
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 }
    );
  }
}
