/**
 * Identity Document API Contracts
 *
 * Zod schemas for the document-verification step (issue #32): the client
 * scans an Israeli ID card / driver's license on-device, extracts fields via
 * OCR, and submits ONLY the extracted fields - never the image. The server
 * re-validates everything it can (checksum, dates) before persisting.
 */

import { z } from 'zod';

// === Document types ===

export const IdentityDocumentTypeSchema = z.enum(['id_card', 'drivers_license']);
export type IdentityDocumentType = z.infer<typeof IdentityDocumentTypeSchema>;

export const IdentityDocumentStatusSchema = z.enum([
  'verified',
  'pending_review',
  'rejected',
]);
export type IdentityDocumentStatus = z.infer<typeof IdentityDocumentStatusSchema>;

// === POST /api/verification/document ===

/** OCR provenance - how trustworthy the submitted fields are. */
export const OcrProvenanceSchema = z.object({
  /** Did OCR find the typed ID number on the document image? */
  idNumberMatched: z.boolean(),
  /** Mean OCR confidence (0-100) over the extracted region. */
  confidence: z.number().min(0).max(100),
  /** Did the user hand-edit the OCR name/date fields before submit? */
  fieldsEdited: z.boolean(),
});
export type OcrProvenance = z.infer<typeof OcrProvenanceSchema>;

/**
 * Face-match provenance - derived scores only. The selfie, the document
 * portrait and both embeddings never leave the device; the server sees
 * exactly these numbers.
 */
export const FaceProvenanceSchema = z.object({
  /** Did the face pipeline run at all (camera present, models loaded)? */
  checked: z.boolean(),
  /** Was a portrait detected on the document image? */
  docFaceFound: z.boolean(),
  /** Normalized selfie↔document similarity (0-100), null when unavailable. */
  matchScore: z.number().min(0).max(100).nullable(),
  /** Did the randomized active-liveness challenges pass? */
  livenessPassed: z.boolean(),
  /** Antispoof "real" score (0-100), null when the model gave none. */
  antispoofScore: z.number().min(0).max(100).nullable(),
});
export type FaceProvenance = z.infer<typeof FaceProvenanceSchema>;

export const SubmitIdentityDocumentRequestSchema = z.object({
  documentType: IdentityDocumentTypeSchema,
  /** 9-digit Israeli ID number (server re-validates the check digit). */
  idNumber: z.string().regex(/^\d{9}$/),
  firstName: z.string().trim().min(1).max(64),
  lastName: z.string().trim().min(1).max(64),
  /** ISO yyyy-mm-dd as printed on the document. */
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** ISO yyyy-mm-dd document expiry (both card types carry one). */
  documentExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ocr: OcrProvenanceSchema,
  face: FaceProvenanceSchema,
  /** Consent text version the user approved (audit trail, §11 notice). */
  consentVersion: z.string().min(1).max(64),
});
export type SubmitIdentityDocumentRequest = z.infer<
  typeof SubmitIdentityDocumentRequestSchema
>;

export const SubmitIdentityDocumentResponseSchema = z.object({
  status: IdentityDocumentStatusSchema,
  documentType: IdentityDocumentTypeSchema,
  /** Masked hint for UI display, e.g. "•••••••82". */
  idNumberMasked: z.string(),
  verifiedAt: z.string().datetime().nullable(),
});
export type SubmitIdentityDocumentResponse = z.infer<
  typeof SubmitIdentityDocumentResponseSchema
>;

// === GET /api/verification/document ===

export const GetIdentityDocumentResponseSchema = z.object({
  document: z
    .object({
      status: IdentityDocumentStatusSchema,
      documentType: IdentityDocumentTypeSchema,
      idNumberMasked: z.string(),
      verifiedAt: z.string().datetime().nullable(),
    })
    .nullable(),
});
export type GetIdentityDocumentResponse = z.infer<
  typeof GetIdentityDocumentResponseSchema
>;
