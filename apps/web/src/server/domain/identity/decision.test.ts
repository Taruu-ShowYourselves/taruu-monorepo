import { describe, expect, it } from 'vitest';
import { decideDocument, maskIdNumber } from './decision';
import type { SubmitIdentityDocumentRequest } from '@sync/shared/contracts';

const NOW = new Date('2026-07-27T12:00:00Z');

function submission(
  overrides: Partial<SubmitIdentityDocumentRequest> = {},
  ocr: Partial<SubmitIdentityDocumentRequest['ocr']> = {},
  face: Partial<SubmitIdentityDocumentRequest['face']> = {}
): SubmitIdentityDocumentRequest {
  return {
    documentType: 'id_card',
    idNumber: '123456782',
    firstName: 'דוד',
    lastName: 'כהן',
    dateOfBirth: '1974-04-04',
    documentExpiry: '2031-03-15',
    consentVersion: 'v1',
    ...overrides,
    ocr: { idNumberMatched: true, confidence: 85, fieldsEdited: false, ...ocr },
    face: {
      checked: true,
      docFaceFound: true,
      matchScore: 72,
      livenessPassed: true,
      antispoofScore: 80,
      ...face,
    },
  };
}

describe('decideDocument', () => {
  it('never auto-verifies: a clean, matched, confident scan queues for operator approval (F-1)', () => {
    expect(decideDocument(submission(), NOW)).toEqual({
      outcome: 'pending_review',
      reasons: ['operator_approval_required'],
    });
  });

  it('rejects a failed checksum', () => {
    const decision = decideDocument(submission({ idNumber: '123456789' }), NOW);
    expect(decision).toEqual({ outcome: 'rejected', reasons: ['id_checksum_failed'] });
  });

  it('rejects an expired document', () => {
    const decision = decideDocument(submission({ documentExpiry: '2025-01-31' }), NOW);
    expect(decision).toEqual({ outcome: 'rejected', reasons: ['document_expired'] });
  });

  it('rejects out-of-range ages (under 17 and impossible)', () => {
    expect(decideDocument(submission({ dateOfBirth: '2011-01-01' }), NOW)).toEqual({
      outcome: 'rejected',
      reasons: ['age_out_of_range'],
    });
    expect(decideDocument(submission({ dateOfBirth: '1890-01-01' }), NOW)).toEqual({
      outcome: 'rejected',
      reasons: ['age_out_of_range'],
    });
  });

  it('accumulates every rejection reason', () => {
    const decision = decideDocument(
      submission({ idNumber: '123456789', documentExpiry: '2020-01-01' }),
      NOW
    );
    expect(decision.outcome).toBe('rejected');
    if (decision.outcome === 'rejected') {
      expect(decision.reasons).toEqual(['id_checksum_failed', 'document_expired']);
    }
  });

  it('queues for review when OCR never saw the typed number', () => {
    const decision = decideDocument(submission({}, { idNumberMatched: false }), NOW);
    expect(decision).toEqual({
      outcome: 'pending_review',
      reasons: ['ocr_id_number_not_found'],
    });
  });

  it('queues for review on low confidence or hand-edited fields', () => {
    expect(decideDocument(submission({}, { confidence: 40 }), NOW)).toEqual({
      outcome: 'pending_review',
      reasons: ['ocr_low_confidence'],
    });
    expect(decideDocument(submission({}, { fieldsEdited: true }), NOW)).toEqual({
      outcome: 'pending_review',
      reasons: ['fields_hand_edited'],
    });
  });

  it('allows a 17-year-old (municipal voting age) - queued, not rejected', () => {
    const decision = decideDocument(submission({ dateOfBirth: '2009-01-01' }), NOW);
    expect(decision).toEqual({
      outcome: 'pending_review',
      reasons: ['operator_approval_required'],
    });
  });

  it('queues for review when the face pipeline never ran', () => {
    expect(decideDocument(submission({}, {}, { checked: false }), NOW)).toEqual({
      outcome: 'pending_review',
      reasons: ['face_not_checked'],
    });
  });

  it('queues for review on low face match, failed liveness, or low antispoof', () => {
    expect(decideDocument(submission({}, {}, { matchScore: 40 }), NOW)).toEqual({
      outcome: 'pending_review',
      reasons: ['face_low_match'],
    });
    expect(decideDocument(submission({}, {}, { livenessPassed: false }), NOW)).toEqual({
      outcome: 'pending_review',
      reasons: ['liveness_failed'],
    });
    expect(decideDocument(submission({}, {}, { antispoofScore: 30 }), NOW)).toEqual({
      outcome: 'pending_review',
      reasons: ['antispoof_low'],
    });
  });

  it('treats a missing doc portrait as a review signal, not a rejection', () => {
    const decision = decideDocument(
      submission({}, {}, { docFaceFound: false, matchScore: null }),
      NOW
    );
    expect(decision.outcome).toBe('pending_review');
    if (decision.outcome === 'pending_review') {
      expect(decision.reasons).toEqual(['doc_face_missing', 'face_low_match']);
    }
  });

  it('face never causes rejection - hard failures still win', () => {
    const decision = decideDocument(
      submission({ documentExpiry: '2020-01-01' }, {}, { matchScore: 0 }),
      NOW
    );
    expect(decision.outcome).toBe('rejected');
  });

  it('null antispoof score is not a review flag of its own', () => {
    expect(decideDocument(submission({}, {}, { antispoofScore: null }), NOW)).toEqual({
      outcome: 'pending_review',
      reasons: ['operator_approval_required'],
    });
  });

  it("the 'verified' outcome is unreachable from any client submission (F-1)", () => {
    // Maximal client-controlled signals: perfect confidence, perfect face
    // match, liveness and antispoof asserted true. Still pending_review.
    const decision = decideDocument(
      submission({}, { confidence: 100 }, { matchScore: 100, antispoofScore: 100 }),
      NOW
    );
    expect(decision.outcome).toBe('pending_review');
  });
});

describe('maskIdNumber', () => {
  it('keeps only the last two digits', () => {
    expect(maskIdNumber('123456782')).toBe('•••••••82');
  });
});
