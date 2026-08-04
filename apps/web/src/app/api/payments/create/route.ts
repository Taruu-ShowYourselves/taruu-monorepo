import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/services/auth/session';
import {
  getUserById,
  createPayment,
  getPaymentByIdempotencyKey,
} from '@/lib/supabase/db';
import {
  paymentService,
  getPaymentAmounts,
} from '@/services/payments/greenInvoice';

/** The only payment this product can create. Participation is free (cfa5d25). */
const CREATABLE_PAYMENT_TYPE = 'vote_creation' as const;

/**
 * Retired rail. `payments.type` keeps this value in its database enum because
 * historical rows exist, but no new participation payment can be created.
 */
const RETIRED_PAYMENT_TYPE = 'vote_participation';

interface CreatePaymentRequest {
  type: 'vote_creation';
  voteId?: string;
  optionId?: string;
  voteTitle?: string;
  idempotencyKey?: string;
}

/**
 * POST /api/payments/create
 * Create a Green Invoice hosted payment page for a ₪50 vote creation.
 * Participation is free, so `vote_participation` is rejected rather than priced.
 * Supports idempotency via idempotency_key
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreatePaymentRequest = await request.json();
    const { voteId, optionId, voteTitle, idempotencyKey } = body;
    const requestedType: string = body.type;

    // The participation rail is retired, not merely unpriced: say so instead of
    // quoting ₪0, so a stale client learns the contract changed.
    if (requestedType === RETIRED_PAYMENT_TYPE) {
      return NextResponse.json(
        { error: 'ההשתתפות בהצבעה חינם - אין תשלום ליצור.' },
        { status: 400 }
      );
    }

    // Validate payment type
    if (requestedType !== CREATABLE_PAYMENT_TYPE) {
      return NextResponse.json(
        { error: 'Invalid payment type' },
        { status: 400 }
      );
    }

    const type = CREATABLE_PAYMENT_TYPE;

    const user = await getUserById(session.userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // No identity/verification gate here. Those were participation gates and they
    // now live on the free path (services/verification/eligibility.ts). Vote
    // creation has its own, stricter server-side gate at publish time
    // (server/app/votes/create-vote.ts) requiring a verified user with a municipality.

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
    const amount = amounts.voteCreation;

    // Create payment record in Supabase first (with pending status)
    const payment = await createPayment({
      user_id: user.id,
      type,
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

    // Create Green Invoice hosted payment page
    const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;

    const paymentIntent = await paymentService.createVoteCreationPayment({
      orderId: payment.id, // Use our payment ID as the order ID
      voteTitle: voteTitle || 'הצבעה חדשה',
      userId: user.id,
      email: user.email,
      name: userName,
      municipality: user.municipality_id || undefined,
    });

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
        description: 'יצירת הצבעה חדשה',
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
 * Get payment pricing information. Creation is the only priced action - there is
 * no participation price to publish, because participation is free.
 */
export async function GET() {
  const amounts = getPaymentAmounts();

  return NextResponse.json({
    pricing: {
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
