/**
 * Payment verification - Result-typed wrappers over the legacy helpers.
 */

import { ResultAsync, errAsync, okAsync } from 'neverthrow';
import {
  verifyPaymentCompleted,
  isPaymentAlreadyUsed,
} from '@/lib/supabase/db';
import { dbError, paymentInvalid, type AppError } from '@/server/http/errors';

type PaymentPurpose = 'vote_creation' | 'vote_participation';

/** Payment must exist, be completed, belong to the user, and be unused. */
export function assertPaymentUsable(
  paymentTxId: string,
  userId: string,
  purpose: PaymentPurpose
): ResultAsync<void, AppError> {
  return ResultAsync.fromPromise(
    verifyPaymentCompleted(paymentTxId, userId, purpose),
    (cause) => dbError('payments.verify', cause)
  )
    .andThen((verification) =>
      verification.valid
        ? okAsync<void, AppError>(undefined)
        : errAsync<void, AppError>(
            paymentInvalid(verification.error ?? 'Payment verification failed')
          )
    )
    .andThen(() =>
      ResultAsync.fromPromise(isPaymentAlreadyUsed(paymentTxId, purpose), (cause) =>
        dbError('payments.checkUsed', cause)
      )
    )
    .andThen((used) =>
      used
        ? errAsync<void, AppError>(paymentInvalid('Payment has already been used'))
        : okAsync<void, AppError>(undefined)
    );
}
