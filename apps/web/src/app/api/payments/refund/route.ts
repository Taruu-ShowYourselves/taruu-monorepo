import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import {
  getPaymentById,
  getLatestRefundablePayment,
  requestPaymentRefund,
} from '@/lib/supabase/db';
import { emailService } from '@/services/email';
import { logger } from '@/lib/logger';

const MAX_REASON_LENGTH = 500;

/**
 * POST /api/payments/refund
 *
 * Records a user's refund request for one of their completed payments and
 * notifies support. Per the published policy, refunds are issued manually in
 * Green Invoice - this endpoint does NOT move money; it captures the request (on
 * the payment metadata) and emails support, who issue a credit note (חשבונית
 * זיכוי) via `paymentService.createRefund` and flip the payment to `refunded`.
 *
 * Body: { paymentId: string, reason: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      paymentId?: unknown;
      reason?: unknown;
    };
    const requestedId = typeof body.paymentId === 'string' ? body.paymentId.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (reason.length === 0 || reason.length > MAX_REASON_LENGTH) {
      return NextResponse.json(
        { error: 'A refund reason (up to 500 chars) is required', code: 'INVALID_REASON' },
        { status: 400 }
      );
    }

    // A specific payment was named → fetch + ownership-check it. Otherwise resolve
    // the user's latest refundable payment (the generic dashboard form path).
    const payment = requestedId
      ? await getPaymentById(requestedId)
      : await getLatestRefundablePayment(session.userId);
    if (!payment || payment.user_id !== session.userId) {
      return NextResponse.json(
        { error: 'No refundable payment found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }
    const paymentId = payment.id;

    // Authoritative, ownership- + status-guarded write.
    const result = await requestPaymentRefund(paymentId, session.userId, reason);
    switch (result) {
      case 'not_found':
        return NextResponse.json({ error: 'Payment not found', code: 'NOT_FOUND' }, { status: 404 });
      case 'not_refundable':
        return NextResponse.json(
          { error: 'Only completed payments can be refunded', code: 'NOT_REFUNDABLE' },
          { status: 409 }
        );
      case 'already_requested':
        return NextResponse.json(
          { error: 'A refund has already been requested for this payment', code: 'ALREADY_REQUESTED' },
          { status: 409 }
        );
      case 'error':
        return NextResponse.json(
          { error: 'Could not record the refund request', code: 'SERVER_ERROR' },
          { status: 500 }
        );
    }

    // Best-effort support notification - the request is already recorded, so a
    // mail failure (or missing Resend creds in dev) must not fail the request.
    if (emailService.isConfigured()) {
      try {
        await emailService.sendRefundRequestNotification({
          paymentId: payment.id,
          providerId: payment.provider_id,
          userId: session.userId,
          userEmail: session.email,
          amountILS: Math.round((payment.amount ?? 0) / 100),
          type: payment.type,
          reason,
        });
      } catch (error) {
        logger.error('Refund request: support email failed', {
          error: String(error),
          paymentId: payment.id,
        });
      }
    }

    logger.info('Refund requested', { paymentId: payment.id, userId: session.userId });
    return NextResponse.json({ success: true, status: 'requested' });
  } catch (error) {
    logger.error('Refund request failed', { error: String(error) });
    return NextResponse.json(
      { error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
