import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSessionFromRequest } from '@/services/auth/session';
import {
  getUserById,
  createPayment,
  getPaymentByIdempotencyKey,
} from '@/lib/supabase/db';
import {
  greenInvoiceService,
  getPaymentAmounts,
} from '@/services/payments/greenInvoice';

interface CreatePaymentRequest {
  type: 'vote_participation' | 'vote_creation';
  voteId?: string;
  optionId?: string;
  voteTitle?: string;
  idempotencyKey?: string;
}

/**
 * POST /api/payments/create
 * Create a Green Invoice payment form for vote participation or creation
 * Supports idempotency via idempotency_key
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreatePaymentRequest = await request.json();
    const { type, voteId, optionId, voteTitle, idempotencyKey } = body;

    // Validate payment type
    if (!type || !['vote_participation', 'vote_creation'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid payment type' },
        { status: 400 }
      );
    }

    // For vote participation, voteId is required
    if (type === 'vote_participation' && !voteId) {
      return NextResponse.json(
        { error: 'Vote ID is required for participation payment' },
        { status: 400 }
      );
    }

    const user = await getUserById(session.userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check identity score for voting
    if (type === 'vote_participation' && user.identity_score < 40) {
      return NextResponse.json(
        { error: 'Insufficient identity score to vote. Minimum 40 required.' },
        { status: 403 }
      );
    }

    // Check verification status for voting
    if (type === 'vote_participation' && user.verification_status !== 'verified') {
      return NextResponse.json(
        { error: 'GPS verification required before voting' },
        { status: 403 }
      );
    }

    // Generate or use provided idempotency key
    const paymentIdempotencyKey = idempotencyKey || `${user.id}-${type}-${voteId || 'create'}-${Date.now()}`;

    // Check for existing payment with same idempotency key
    const existingPayment = await getPaymentByIdempotencyKey(paymentIdempotencyKey);
    if (existingPayment) {
      // Return existing payment (idempotent response)
      return NextResponse.json({
        success: true,
        idempotent: true,
        payment: {
          id: existingPayment.id,
          status: existingPayment.status,
          amount: existingPayment.amount,
          currency: existingPayment.currency,
        },
      });
    }

    const amounts = getPaymentAmounts();
    const amount = type === 'vote_participation'
      ? amounts.voteParticipation
      : amounts.voteCreation;

    // Create payment record in Supabase first (with pending status)
    const payment = await createPayment({
      user_id: user.id,
      type: type as 'vote_participation' | 'vote_creation',
      amount: amount * 100, // Store in agorot (cents)
      currency: 'ILS',
      status: 'pending',
      idempotency_key: paymentIdempotencyKey,
      vote_id: voteId || null,
      option_id: optionId || null,
      metadata: {
        voteTitle,
        userEmail: user.email,
        userName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      },
    });

    // Create Green Invoice payment form
    const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;

    let paymentIntent;
    if (type === 'vote_participation') {
      paymentIntent = await greenInvoiceService.createVotePayment({
        orderId: payment.id, // Use our payment ID as the order ID
        voteId: voteId!,
        voteTitle,
        userId: user.id,
        email: user.email,
        name: userName,
        municipality: user.municipality_id || undefined,
      });
    } else {
      paymentIntent = await greenInvoiceService.createVoteCreationPayment({
        orderId: payment.id,
        voteTitle: voteTitle || 'הצבעה חדשה',
        userId: user.id,
        email: user.email,
        name: userName,
        municipality: user.municipality_id || undefined,
      });
    }

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        orderId: payment.id,
        paymentUrl: paymentIntent.paymentUrl,
        amount,
        currency: 'ILS',
        expiresAt: paymentIntent.expiresAt.toISOString(),
      },
      pricing: {
        amount,
        currency: amounts.currency,
        syncTokens: amount,
        description:
          type === 'vote_participation'
            ? 'השתתפות בהצבעה'
            : 'יצירת הצבעה חדשה',
      },
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/payments/create
 * Get payment pricing information
 */
export async function GET() {
  const amounts = getPaymentAmounts();

  return NextResponse.json({
    pricing: {
      voteParticipation: {
        amount: amounts.voteParticipation,
        currency: amounts.currency,
        syncTokens: amounts.voteParticipation,
        description: 'השתתפות בהצבעה',
      },
      voteCreation: {
        amount: amounts.voteCreation,
        currency: amounts.currency,
        syncTokens: amounts.voteCreation,
        description: 'יצירת הצבעה חדשה',
      },
    },
    tokenRate: {
      rate: 1,
      description: '1 ILS = 1 SYNC token',
    },
    paymentProvider: 'green_invoice',
  });
}
