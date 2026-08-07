/**
 * Identity-document domain - pure functions only. No IO, no framework.
 *
 * Decides what happens to a submitted document: queue for operator review or
 * reject. The caller has already zod-validated shape; this layer owns the
 * business rules. Auto-verification is disabled (F-1, issue #71): the OCR and
 * face signals are client-asserted, so they can flag a submission for extra
 * scrutiny but can never verify one.
 */

import { isDocumentDateValid, isValidIsraeliId } from '@sync/shared';
import type { SubmitIdentityDocumentRequest } from '@sync/shared/contracts';

export type DocumentDecision =
  /** Reserved for the PR-10 operator-approval flow; decideDocument never returns it (F-1). */
  | { outcome: 'verified' }
  | { outcome: 'pending_review'; reasons: string[] }
  | { outcome: 'rejected'; reasons: string[] };

/** OCR confidence at or above which an unedited, number-matched scan auto-passes. */
const AUTO_VERIFY_MIN_CONFIDENCE = 60;

/**
 * Selfie↔document similarity (0-100) at or above which the face check
 * auto-passes. faceres similarity ≥50 is the library's "same person" line;
 * 55 adds margin for old document photos.
 */
const AUTO_VERIFY_MIN_FACE_MATCH = 55;

/** Antispoof floor - below this the frame looks like a replay/print attack. */
const AUTO_VERIFY_MIN_ANTISPOOF = 50;

/** Voting-age floor (municipal elections in Israel allow voting from 17). */
const MIN_AGE_YEARS = 17;
const MAX_AGE_YEARS = 120;

function ageInYears(isoDob: string, now: Date): number {
  const dob = new Date(`${isoDob}T00:00:00Z`);
  const diff = now.getTime() - dob.getTime();
  return diff / (365.25 * 24 * 60 * 60 * 1000);
}

/**
 * Business decision for a submitted document.
 *
 * Hard failures (bad checksum, expired document, impossible age) reject.
 * Soft signals (low OCR confidence, user-edited fields, number not seen by
 * OCR) queue for manual review instead of auto-verifying.
 */
export function decideDocument(
  submission: SubmitIdentityDocumentRequest,
  now: Date = new Date()
): DocumentDecision {
  const rejections: string[] = [];

  if (!isValidIsraeliId(submission.idNumber)) {
    rejections.push('id_checksum_failed');
  }
  if (!isDocumentDateValid(submission.documentExpiry, now)) {
    rejections.push('document_expired');
  }

  const age = ageInYears(submission.dateOfBirth, now);
  if (Number.isNaN(age) || age < MIN_AGE_YEARS || age > MAX_AGE_YEARS) {
    rejections.push('age_out_of_range');
  }

  if (rejections.length > 0) {
    return { outcome: 'rejected', reasons: rejections };
  }

  const reviewReasons: string[] = [];
  if (!submission.ocr.idNumberMatched) reviewReasons.push('ocr_id_number_not_found');
  if (submission.ocr.confidence < AUTO_VERIFY_MIN_CONFIDENCE) {
    reviewReasons.push('ocr_low_confidence');
  }
  if (submission.ocr.fieldsEdited) reviewReasons.push('fields_hand_edited');

  // Face signals are soft: they route to manual review, never to rejection -
  // old document photos and low-end cameras produce honest false negatives.
  const { face } = submission;
  if (!face.checked) reviewReasons.push('face_not_checked');
  else {
    if (!face.docFaceFound) reviewReasons.push('doc_face_missing');
    if (face.matchScore === null || face.matchScore < AUTO_VERIFY_MIN_FACE_MATCH) {
      reviewReasons.push('face_low_match');
    }
    if (!face.livenessPassed) reviewReasons.push('liveness_failed');
    if (face.antispoofScore !== null && face.antispoofScore < AUTO_VERIFY_MIN_ANTISPOOF) {
      reviewReasons.push('antispoof_low');
    }
  }

  // F-1 (issue #71): every OCR/face/liveness/antispoof signal above is
  // client-asserted, and the document image never reaches the server, so a
  // clean submission is necessary but NOT sufficient for verification. Until
  // the PR-10 operator flow provides a non-client-controllable approval,
  // nothing on this path may auto-verify: a clean scan queues for operator
  // approval instead. The 'verified' outcome is reserved for that flow.
  if (reviewReasons.length === 0) {
    reviewReasons.push('operator_approval_required');
  }
  return { outcome: 'pending_review', reasons: reviewReasons };
}

/** Mask an ID number for UI display: keep only the last 2 digits. */
export function maskIdNumber(idNumber: string): string {
  return `•••••••${idNumber.slice(-2)}`;
}
