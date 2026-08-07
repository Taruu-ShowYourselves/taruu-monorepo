/**
 * Use-case: submit an on-device-scanned identity document (issue #32).
 *
 * The client sends extracted fields only - the document image never leaves
 * the device. This use-case re-runs every check the server can perform
 * (checksum, dates, age), dedups the ID number across accounts via HMAC, and
 * persists the document row + audit event. It never verifies: submissions
 * queue for the PR-10 operator-approval flow, the sole future writer of a
 * non-null users.identity_verified_at (F-1, issue #71).
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
  // F-1 (issue #71): this client-controlled flow does not touch
  // users.identity_verified_at AT ALL - it neither sets it (no client-asserted
  // evidence may earn the +40) nor clears it (a re-submission must not erase a
  // legitimate operator approval). The ONLY writer of that column is the
  // PR-10 server-controlled operator approval/revocation flow. `verifiedAt`
  // below is the identity_documents row's own timestamp, null while the new
  // submission awaits operator review.
  const verifiedAt = null;

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
        face_checked: submission.face.checked,
        face_doc_found: submission.face.docFaceFound,
        face_match_score:
          submission.face.matchScore === null
            ? null
            : Math.round(submission.face.matchScore),
        face_liveness_passed: submission.face.livenessPassed,
        face_antispoof_score:
          submission.face.antispoofScore === null
            ? null
            : Math.round(submission.face.antispoofScore),
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
    .map(() => ({
      status,
      documentType: submission.documentType,
      idNumberMasked: maskIdNumber(submission.idNumber),
      verifiedAt,
    }));
}
