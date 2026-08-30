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
import { checkVoterEligibility } from '@/services/verification/eligibility';
import { decideParticipationOpen } from '@/server/domain/votes/vote';
import { decidePilotGate } from '@/server/domain/pilot/gate';
import { listActiveCohortIds } from '@/server/infra/supabase/pilot.repo';
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

    // ...and so is the option, for the same reason and with more force.
    //
    // A participation payment exists to buy exactly one thing: a ballot. The
    // webhook casts it only `if (payment.type === 'vote_participation' &&
    // payment.vote_id && payment.option_id)`. A row that reaches the provider
    // with no option therefore takes the resident's money, mints their tokens,
    // accrues the treasury deposit, emails a receipt - and casts no vote, with
    // nothing anywhere recording that a ballot was owed. It is not a failure
    // that retries; the payment completes successfully by every measure the
    // system has.
    //
    // Refused here, before the payment row and before the provider, because
    // this is the last point at which nothing has been charged.
    if (type === 'vote_participation' && !optionIdField.id) {
      return NextResponse.json(
        {
          error: 'Option ID is required for participation payment',
          code: 'INVALID_BODY',
        },
        { status: 400 }
      );
    }

    // The mirror of B, and the second half of the request-shape contract: an
    // option on a creation fee is meaningless - a creation fee buys the right to
    // open a vote, not a ballot inside one - and nothing downstream would ever
    // read it. Refused rather than ignored, so it cannot sit in the row looking
    // like a ballot choice that was somehow never cast.
    //
    // Both shape checks run BEFORE the idempotency lookup. Placed after it, a
    // caller replaying a key they had already used would be answered
    // `200 { idempotent: true }` for a request this route no longer accepts,
    // which reports success for a body that was never validated. Matching a
    // replay on the key alone is a separate, documented gap - the stored request
    // is never compared with the replayed one - but a request the route would
    // reject outright should not reach that comparison at all.
    if (type === 'vote_creation' && optionIdField.id) {
      return NextResponse.json(
        { error: 'Invalid field: optionId', code: 'INVALID_BODY' },
        { status: 400 }
      );
    }

    const user = await getUserById(session.userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Ballot gate (issue #71), through the same function the free ballot route
    // uses. It used to be spelled out here as
    // `residencyVerified: user.verification_status === 'verified'`, which is
    // STRICTER than the canonical rule: `hasVerifiedResidency` also accepts at
    // least one completed check-in against the active run. A resident who had
    // checked in once could therefore cast a free ballot in a vote and be
    // refused a paid one in the same vote, with a message telling them to go
    // and do the verification they had already started.
    //
    // Sharing the function rather than copying the condition is the point: this
    // is the third rule in this file that the two ballot paths must agree on,
    // after `decideParticipationOpen` and `decidePilotGate`, and the two that
    // were copied are exactly the two that had drifted.
    if (type === 'vote_participation') {
      const eligibility = await checkVoterEligibility(user);
      if (!eligibility.eligible) {
        return NextResponse.json(
          { error: eligibility.message, code: eligibility.code },
          { status: 403 }
        );
      }
    }

    // Generate or use provided idempotency key
    const paymentIdempotencyKey = idempotencyKey || `${user.id}-${type}-${voteIdField.id || 'create'}-${Date.now()}`;

    // Check for existing payment with same idempotency key
    // Scoped to this user. The key may be caller-supplied, and the generated
    // form is composed of ids a third party can hold, so an unscoped lookup
    // returned another resident's payment id, status, amount and currency in
    // the idempotent response below. See `getPaymentByIdempotencyKey`.
    const existingPayment = await getPaymentByIdempotencyKey(
      paymentIdempotencyKey,
      user.id
    );
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

    // Everything below runs AFTER the idempotency short-circuit, deliberately: a
    // replay resolves to the payment that was already created under these same
    // checks, and re-reading the vote to re-approve a charge that already
    // happened would only add a way for a retry to fail. The SHAPE checks are
    // the exception and sit above the short-circuit, because a replay is only
    // meaningfully a replay of a request the route would still accept.
    //
    // Everything below is the ballot contract, so it runs for participation
    // only. By this point B above guarantees both ids are present.
    if (type === 'vote_participation') {
      const vote = voteIdField.id
        ? await getVoteWithOptions(voteIdField.id)
        : null;

      if (!vote) {
        return NextResponse.json(
          { error: 'Vote not found', code: 'NOT_FOUND' },
          { status: 404 }
        );
      }

      // The vote must still be open. Same rule, same order, same codes as
      // POST /api/votes/[id]/participate and as `cast_vote` itself - see
      // `decideParticipationOpen`. Before this, a vote that was ALREADY closed
      // was payable: the charge went through and the ballot was refused by
      // `cast_vote` in the webhook, after `markPaymentCompleted` had claimed
      // the payment and past the point the provider's retry can reach
      // fulfilment. The resident paid for a vote that had already ended.
      //
      // What this does NOT close, and cannot: the payment settles
      // asynchronously. This endpoint hands back a hosted Green Invoice page,
      // and nothing stops the resident paying it after the vote ends - the
      // `expiresAt` in the response below is this route's own advertised
      // window, not something the provider enforces. A payment that settles
      // into a vote that has since closed still ends in a claimed payment and a
      // refused ballot. What happens to that money is a refund policy rather
      // than a check, and it is recorded in docs/DATA-MODEL-OPEN-DECISIONS.md
      // rather than guessed at here.
      const openness = decideParticipationOpen(vote, new Date());
      if (!openness.open) {
        return NextResponse.json(
          {
            error:
              openness.code === 'VOTE_ENDED'
                ? 'Vote has ended'
                : 'Vote is not open yet',
            code: openness.code,
          },
          { status: 400 }
        );
      }

      // A well-formed UUID is not yet a ballot choice. Migration
      // 20260904000007 now backs this with a composite foreign key, so an
      // option that does not belong to this vote is refused by the database
      // too; the check stays here because this is where a charge can still be
      // avoided, and a 400 says which field is wrong where a constraint
      // violation would surface as a 500.
      const optionBelongsToVote = vote.options.some(
        (option) => option.id === optionIdField.id
      );

      if (!optionBelongsToVote) {
        return NextResponse.json(
          { error: 'Invalid field: optionId', code: 'INVALID_BODY' },
          { status: 400 }
        );
      }

      // Pilot residency, the same municipality-level rule the free ballot route
      // applies. The exemption here was chronological, not deliberate: paid
      // participation predates the pilot gate (gate.ts, 4bc6392, 2026-08-06;
      // the fee was dropped from the vote flow in cfa5d25, 2026-07-29), so when
      // the gate was written this route was already off the product's ballot
      // path and was never revisited. It stayed reachable, and it still ends in
      // a ballot - the webhook calls `castVote` - so leaving it out means a
      // non-resident who posts directly to this endpoint votes in a pilot
      // municipality's vote by paying for it. Nothing in the repository states
      // an exemption; the gate's own comment calls the free route "the server's
      // ballot chokepoint", written when it was the only one.
      //
      // Unlike the participate route this carries no NODE_ENV escape hatch. That
      // one exists there for fixtures that predate the pilot tables; adding a
      // second copy would mean the paid gate is inert in exactly the runs that
      // are supposed to prove it.
      //
      // A snapshot, like the openness check above: cohort membership and the
      // resident's municipality are read now and the payment settles later.
      // Neither the webhook nor `cast_vote` re-applies the pilot rule, so a page
      // created before a municipality joined the pilot can still settle into a
      // ballot afterwards. Re-checking at fulfilment is the real fix and needs
      // the same refund answer as above.
      const activePilotResult = await listActiveCohortIds();
      if (activePilotResult.isErr()) throw new Error('could not resolve pilot cohort');
      const pilotGate = decidePilotGate(
        vote.municipality_id,
        new Set(activePilotResult.value),
        user.municipality_id
      );
      if (!pilotGate.allowed) {
        return NextResponse.json(
          {
            error: 'הצבעה זו פתוחה לתושבי הרשות המשתתפת בלבד.',
            code: 'PILOT_MUNICIPALITY_ONLY',
          },
          { status: 403 }
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
