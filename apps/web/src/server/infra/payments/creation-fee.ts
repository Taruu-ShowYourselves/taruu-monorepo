import 'server-only';

/**
 * The creation fee, implemented against the rails that exist today.
 *
 * WHAT THIS DOES: records that ₪50 is owed by the submitter — one `payments`
 * row, `type: 'vote_creation'`, `status: 'pending'`, keyed so a retry reuses it.
 *
 * WHAT THIS DOES NOT DO: move money. Nothing is captured, no provider is
 * contacted, no invoice is issued. `outcome: 'obligation'` says exactly that,
 * and it is the only outcome this implementation can return. Do not read
 * `'captured'` into a row this file wrote.
 *
 * WHAT CHANGES WHEN PAY-06 LANDS: the body of `charge` in this file, and
 * nothing else. The port interface, `decide-proposal.ts`, the audit row and the
 * approve dialog's copy are all already written against the eventual behaviour
 * — a token charge that either captures or declines. PAY-06 swaps the insert
 * for a capture and starts returning `'captured'`; every caller is unchanged.
 *
 * PAY-06 also inherits a reconciliation job it cannot skip: an approval whose
 * charge succeeded but whose publish then lost a concurrency race leaves a
 * `pending` `vote_creation` row against a proposal that may end up rejected.
 * Nothing is owed today because nothing captures, but a rail that captures must
 * settle those rows before it runs.
 */

import { ResultAsync, errAsync, okAsync } from 'neverthrow';
import {
  createPayment,
  getPaymentByIdempotencyKey,
} from '@/lib/supabase/db';
import type { Payment } from '@/lib/supabase/types';
import { paymentInvalid, type AppError } from '@/server/http/errors';
import type {
  CreationFeeCharge,
  CreationFeePort,
} from '@/server/app/space-admin/ports/creation-fee';

/**
 * SEC-04: server-side and deterministic, `{userId}:{type}:{voteId}`. A clock
 * reading or a fresh uuid is forbidden here — the `payments.idempotency_key`
 * UNIQUE constraint is what makes a retried approval reuse the original row
 * instead of recording a second obligation, and a key that varies from call to
 * call disables that constraint entirely.
 */
const idempotencyKeyFor = (submitterUserId: string, voteId: string): string =>
  `${submitterUserId}:vote_creation:${voteId}`;

/** A completed row is a real capture; anything else is still just owed. */
const toCharge = (row: Payment): CreationFeeCharge => ({
  paymentId: row.id,
  outcome: row.status === 'completed' ? 'captured' : 'obligation',
});

/**
 * Every database failure here becomes `paymentInvalid`, not `dbError`.
 *
 * `dbError` is a 500 and reads to the admin as "the dashboard broke". This is
 * the charge step, and the approve dialog has copy written for exactly one
 * outcome — the fee could not be requested, nothing was published, nothing was
 * collected. A 402 carries that; a 500 does not.
 */
const chargeFailed = (): AppError => paymentInvalid('התשלום נכשל');

function findExisting(key: string): ResultAsync<Payment | null, AppError> {
  return ResultAsync.fromPromise(getPaymentByIdempotencyKey(key), chargeFailed);
}

export function createCreationFeePort(): CreationFeePort {
  return {
    charge({ submitterUserId, voteId, amountAgorot }) {
      const idempotency_key = idempotencyKeyFor(submitterUserId, voteId);

      // Look up before inserting. This is what makes a second approval attempt
      // after a lost race safe: the key already exists, so the original
      // obligation is returned rather than a second one recorded.
      return findExisting(idempotency_key).andThen((existing) => {
        if (existing) return okAsync<CreationFeeCharge, AppError>(toCharge(existing));

        return ResultAsync.fromPromise(
          createPayment({
            user_id: submitterUserId,
            type: 'vote_creation',
            amount: amountAgorot,
            currency: 'ILS',
            status: 'pending',
            vote_id: voteId,
            idempotency_key,
            metadata: {
              chargedAt: 'approval',
              phase: '05',
              note: 'capture pending PAY-06',
            },
          }),
          chargeFailed
        )
          .map(toCharge)
          .orElse(() =>
            // Two approvals racing both read null and both insert; the loser
            // hits the UNIQUE constraint. That is the idempotency key doing its
            // job, not a failure — re-read and return the row that won, so the
            // caller sees one obligation instead of a spurious 402.
            findExisting(idempotency_key).andThen((row) =>
              row
                ? okAsync<CreationFeeCharge, AppError>(toCharge(row))
                : errAsync<CreationFeeCharge, AppError>(chargeFailed())
            )
          );
      });
    },
  };
}
