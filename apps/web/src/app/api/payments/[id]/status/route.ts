import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import { getPaymentById, getUserById } from '@/lib/supabase/db';
import { greenInvoiceService } from '@/services/payments/greenInvoice';

/**
 * GET /api/payments/:id/status
 * Get payment status from our database (persisted state)
 */
export async function GET(
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

    // Get receipt URL from Green Invoice if payment completed
    let receiptUrl = null;
    if (payment.status === 'completed' && payment.provider_id) {
      try {
        const providerStatus = await greenInvoiceService.getPaymentStatus(payment.provider_id);
        receiptUrl = providerStatus.receiptUrl || null;
      } catch {
        // Ignore - receipt URL is optional
      }
    }

    const amountILS = payment.amount / 100; // Convert from agorot

    return NextResponse.json({
      id: payment.id,
      status: payment.status,
      amount: amountILS,
      currency: payment.currency,
      type: payment.type,
      receiptUrl,
      succeeded: payment.status === 'completed',
      tokensEarned: payment.status === 'completed' ? amountILS : 0,
      createdAt: payment.created_at,
      updatedAt: payment.updated_at,
      voteId: payment.vote_id,
    });
  } catch (error) {
    console.error('Error fetching payment status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment status' },
      { status: 500 }
    );
  }
}
