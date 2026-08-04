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
import { resolveIdempotencyKey } from '@/services/payments/idempotency';

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
  // No `idempotencyKey`. A client-supplied key is deliberately NOT accepted
  // (SEC-04): the server derives it from the request's own identity, so a caller
  // cannot pin a key belonging to somebody else's flow.
}

/**
 * POST /api/payments/create
 * Create a Green Invoice hosted payment page for a ₪50 vote creation.
 * Participation is free, so `vote_participation` is rejected rather than priced.
 * Idempotency is server-derived and deterministic - see services/payments/idempotency.ts.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreatePaymentRequest = await request.json();
    const { voteId, optionId, voteTitle } = body;
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

    // Derive the idempotency key from the request's own identity (SEC-04). Whatever
    // the client sent is ignored, and no clock is read, so a retry lands on the same
    // key and the UNIQUE constraint on payments.idempotency_key can do its job.
    const resolution = await resolveIdempotencyKey(getPaymentByIdempotencyKey, {
      userId: user.id,
      type,
      voteTitle,
    });

    if (resolution.kind === 'exhausted') {
      return NextResponse.json(
        { error: 'לא הצלחנו לפתוח תשלום חדש. נסו שוב עם כותרת אחרת או פנו לתמיכה.' },
        { status: 409 }
      );
    }

    if (resolution.kind === 'reuse') {
      // Idempotent retry: same draft, same user, payment still pending.
      return NextResponse.json({
        success: true,
        idempotent: true,
        payment: {
          id: resolution.existing.id,
          status: resolution.existing.status,
          amount: resolution.existing.amount,
          currency: resolution.existing.currency,
        },
      });
    }

    const paymentIdempotencyKey = resolution.key;

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
