/**
 * Use-case: submit an on-device-scanned identity document (issue #32).
 *
 * The client sends extracted fields only — the document image never leaves
 * the device. This use-case re-runs every check the server can perform
 * (checksum, dates, age), dedups the ID number across accounts via HMAC,
 * persists the document row + audit event, and flips the user's cheap
 * eligibility flag when the document auto-verifies.
 */

import { errAsync, okAsync, type ResultAsync } from 'neverthrow';
import type {
  SubmitIdentityDocumentRequest,
  SubmitIdentityDocumentResponse,
} from '@sync/shared/contracts';
import { decideDocument, maskIdNumber } from '@/server/domain/identity/decision';
import { hmacIdentifier } from '@/server/infra/crypto/hmac';
import {
  idHashClaimedByOther,
  insertDocumentEvent,
  setUserIdentityVerifiedAt,
  upsertDocument,
} from '@/server/infra/supabase/identity.repo';
import { conflict, validation, type AppError } from '@/server/http/errors';

export interface SubmitDocumentDeps {
  now?: () => Date;
}

export function submitIdentityDocument(
  deps: SubmitDocumentDeps,
  userId: string,
  submission: SubmitIdentityDocumentRequest
): ResultAsync<SubmitIdentityDocumentResponse, AppError> {
  const now = deps.now?.() ?? new Date();
  const decision = decideDocument(submission, now);

  if (decision.outcome === 'rejected') {
    return errAsync(validation(decision.reasons));
  }

  const status = decision.outcome;
  const verifiedAt = status === 'verified' ? now.toISOString() : null;

  return hmacIdentifier(submission.idNumber)
    .andThen((idNumberHash) =>
      idHashClaimedByOther(idNumberHash, userId).andThen((claimed) =>
        claimed
          ? errAsync<string, AppError>(
              conflict('This ID number is already verified on another account')
            )
          : okAsync<string, AppError>(idNumberHash)
      )
    )
    .andThen((idNumberHash) =>
      upsertDocument({
        user_id: userId,
        document_type: submission.documentType,
        id_number_hash: idNumberHash,
        id_number_last2: submission.idNumber.slice(-2),
        first_name: submission.firstName,
        last_name: submission.lastName,
        date_of_birth: submission.dateOfBirth,
        document_expiry: submission.documentExpiry,
        ocr_id_number_matched: submission.ocr.idNumberMatched,
        ocr_confidence: Math.round(submission.ocr.confidence),
        ocr_fields_edited: submission.ocr.fieldsEdited,
        status,
        consent_version: submission.consentVersion,
        consent_at: now.toISOString(),
        verified_at: verifiedAt,
        updated_at: now.toISOString(),
      })
    )
    .andThen(() =>
      insertDocumentEvent({
        user_id: userId,
        event: status === 'verified' ? 'auto_verified' : 'queued_review',
        detail:
          decision.outcome === 'pending_review' ? { reasons: decision.reasons } : null,
      })
    )
    .andThen(() => setUserIdentityVerifiedAt(userId, verifiedAt))
    .map(() => ({
      status,
      documentType: submission.documentType,
      idNumberMasked: maskIdNumber(submission.idNumber),
      verifiedAt,
    }));
}
