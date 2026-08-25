import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSessionFromRequest } from '@/services/auth/session';
import {
  getUserById,
  createPayment,
  getPaymentByIdempotencyKey,
  getVoteWithOptions,
} from '@/lib/supabase/db';
import {
  paymentService,
  getPaymentAmounts,
} from '@/services/payments/greenInvoice';
import { MINIMUM_IDENTITY_SCORE_FOR_VOTING, votingGate } from '@sync/shared';
import { z } from 'zod';

interface CreatePaymentRequest {
  type: 'vote_participation' | 'vote_creation';
  voteId?: string;
  optionId?: string;
  voteTitle?: string;
  idempotencyKey?: string;
}

const UuidSchema = z.string().uuid();

/**
 * `payments.vote_id` and `payments.option_id` are UUID columns - option_id only
 * since migration 20260904000006, before which it was TEXT and stored whatever
 * string arrived in this request body.
 *
 * That mattered because the value is not read back until the Green Invoice
 * webhook hands it to `cast_vote`, whose parameter is UUID. A non-UUID option
 * id was therefore accepted here, charged, and only rejected after
 * `markPaymentCompleted` had atomically claimed the payment - the point past
 * which the provider's retry no longer reaches fulfilment. The ballot was not
 * late, it was unrecoverable without hand reconciliation.
 *
 * Absent, null and the empty string all mean "not supplied", which is what the
 * `optionId || null` this replaces already did. A blank or malformed string is
 * NOT absence: it is a bad id, and is refused rather than nulled, because
 * silently dropping the ballot choice would charge the caller for a vote and
 * record no option at all.
 *
 * The accepted id is lowercased. A UUID's hex digits are case-insensitive and
 * zod accepts either case, but PostgreSQL normalises on the way in and hands
 * every uuid back lowercase - so an id sent as ...FEE3 would be stored
 * correctly and then fail a string comparison against the same option read out
 * of the database. Canonicalising here means the two are always comparable.
 */
function readOptionalId(
  value: unknown
): { ok: true; id: string | null } | { ok: false } {
  if (value === undefined || value === null || value === '') {
    return { ok: true, id: null };
  }
  const parsed = UuidSchema.safeParse(value);
  return parsed.success
    ? { ok: true, id: parsed.data.toLowerCase() }
    : { ok: false };
}

/**
 * POST /api/payments/create
 * Create a Green Invoice hosted payment page for vote participation or creation
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

    // Both ids are checked before anything else happens, so a malformed one
    // costs the caller a 400 rather than a payment page and a charge. voteId is
    // validated alongside optionId even though its column was always UUID: it
    // reaches the same insert on the same statement, and guarding one of two
    // adjacent id columns would be arbitrary.
    const voteIdField = readOptionalId(voteId);
    const optionIdField = readOptionalId(optionId);
    if (!voteIdField.ok || !optionIdField.ok) {
      return NextResponse.json(
        {
          error: `Invalid field: ${!voteIdField.ok ? 'voteId' : 'optionId'}`,
          code: 'INVALID_BODY',
        },
        { status: 400 }
      );
    }

    // For vote participation, voteId is required
    if (type === 'vote_participation' && !voteIdField.id) {
      return NextResponse.json(
        { error: 'Vote ID is required for participation payment' },
        { status: 400 }
      );
    }

    const user = await getUserById(session.userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Ballot gate (issue #71): the stored score already CONTAINS the GPS
    // residency points, so nothing is added on top here. Residency is a hard
    // requirement of its own - no other evidence substitutes for it.
    const gate = votingGate({
      identityPoints: user.identity_score ?? 0,
      residencyVerified: user.verification_status === 'verified',
    });

    if (type === 'vote_participation' && gate.total < gate.required) {
      return NextResponse.json(
        {
          error: `Insufficient identity score to vote. Minimum ${MINIMUM_IDENTITY_SCORE_FOR_VOTING} required.`,
        },
        { status: 403 }
      );
    }

    // Check verification status for voting
    if (type === 'vote_participation' && !gate.residencyVerified) {
      return NextResponse.json(
        { error: 'GPS verification required before voting' },
        { status: 403 }
      );
    }

    // Generate or use provided idempotency key
    const paymentIdempotencyKey = idempotencyKey || `${user.id}-${type}-${voteIdField.id || 'create'}-${Date.now()}`;

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

    // A well-formed UUID is not yet a ballot choice. `payments.option_id` has
    // no foreign key and no composite key tying it to `payments.vote_id` (see
    // migration 20260904000006 for why that is a product decision rather than
    // an oversight), so a syntactically valid id naming nothing, or naming an
    // option in a different vote, would still be stored and charged and would
    // still only be rejected by `cast_vote` in the webhook - past the point
    // where the provider's retry can reach fulfilment.
    //
    // This is the same check POST /api/votes/[id]/participate already makes
    // before recording a free ballot. Making it here too means the shape guard
    // above and this one together cover every option id that cannot produce a
    // ballot, not just the malformed ones.
    //
    // It runs after the idempotency short-circuit: a replay resolves to the
    // payment that was already created under this check and does not need to
    // re-read the vote.
    if (optionIdField.id) {
      const vote = voteIdField.id
        ? await getVoteWithOptions(voteIdField.id)
        : null;
      const optionBelongsToVote =
        vote?.options.some((option) => option.id === optionIdField.id) ?? false;

      if (!optionBelongsToVote) {
        return NextResponse.json(
          { error: 'Invalid field: optionId', code: 'INVALID_BODY' },
          { status: 400 }
        );
      }
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
      vote_id: voteIdField.id,
      option_id: optionIdField.id,
      metadata: {
        voteTitle,
        userEmail: user.email,
        userName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      },
    });

    // Create Green Invoice hosted payment page
    const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;

    let paymentIntent;
    if (type === 'vote_participation') {
      paymentIntent = await paymentService.createVotePayment({
        orderId: payment.id, // Use our payment ID as the order ID
        voteId: voteIdField.id!,
        voteTitle,
        userId: user.id,
        email: user.email,
        name: userName,
        municipality: user.municipality_id || undefined,
      });
    } else {
      paymentIntent = await paymentService.createVoteCreationPayment({
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
