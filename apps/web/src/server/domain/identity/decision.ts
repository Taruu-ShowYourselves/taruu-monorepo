/**
 * Identity-document domain — pure functions only. No IO, no framework.
 *
 * Decides what happens to a submitted document: auto-verify, queue for
 * manual review, or reject. The caller has already zod-validated shape;
 * this layer owns the business rules.
 */

import { isDocumentDateValid, isValidIsraeliId } from '@sync/shared';
import type { SubmitIdentityDocumentRequest } from '@sync/shared/contracts';

export type DocumentDecision =
  | { outcome: 'verified' }
  | { outcome: 'pending_review'; reasons: string[] }
  | { outcome: 'rejected'; reasons: string[] };

/** OCR confidence at or above which an unedited, number-matched scan auto-passes. */
const AUTO_VERIFY_MIN_CONFIDENCE = 60;

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

  if (reviewReasons.length > 0) {
    return { outcome: 'pending_review', reasons: reviewReasons };
  }

  return { outcome: 'verified' };
}

/** Mask an ID number for UI display: keep only the last 2 digits. */
export function maskIdNumber(idNumber: string): string {
  return `•••••••${idNumber.slice(-2)}`;
}
