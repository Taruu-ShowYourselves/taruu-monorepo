/**
 * Pure OCR-text → document-field extraction for Israeli documents.
 *
 * No DOM, no tesseract — plain string processing so it unit-tests in node.
 *
 * Anchors (per document research, issue #32):
 *  - Neither the biometric ID card nor the driver's license carries an MRZ;
 *    the only checksum-verifiable anchor is the 9-digit ID number, printed
 *    grouped `1 2345678 9` on the ID card and after `ID` (field 4d) on the
 *    license.
 *  - Dates print as DD.MM.YYYY: the earliest is the birth date, the latest
 *    the expiry, a middle one (when present) the issue date.
 *  - The license prints names in Latin capitals as well; the ID card is
 *    Hebrew-only, so names come prefilled from the profile and OCR is only a
 *    soft cross-signal.
 */

import { isValidIsraeliId, normalizeIsraeliId, parseDocumentDate } from '@sync/shared';

/** Checksum-valid 9-digit ID numbers found in raw OCR text. */
export function extractIdCandidates(text: string): string[] {
  const found = new Set<string>();

  // Exact 9-digit runs.
  for (const match of text.matchAll(/(?<!\d)(\d{9})(?!\d)/g)) {
    if (isValidIsraeliId(match[1])) found.add(match[1]);
  }

  // Grouped print form `1 2345678 9` (also tolerates hyphens).
  for (const match of text.matchAll(/(?<!\d)(\d)[\s-](\d{7})[\s-](\d)(?!\d)/g)) {
    const candidate = `${match[1]}${match[2]}${match[3]}`;
    if (isValidIsraeliId(candidate)) found.add(candidate);
  }

  return Array.from(found);
}

/** All DD.MM.YYYY-style dates in the text, as ISO strings, ascending. */
export function extractDates(text: string): string[] {
  const dates = new Set<string>();
  for (const match of text.matchAll(/(?<!\d)(\d{1,2}[./-]\d{1,2}[./-](?:19|20)\d{2})(?!\d)/g)) {
    const iso = parseDocumentDate(match[1]);
    if (iso) dates.add(iso);
  }
  return Array.from(dates).sort();
}

/** Latin-capital name lines (driver's license prints EN under the Hebrew). */
export function extractLatinNameLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[A-Z][A-Z' -]{1,30}$/.test(line))
    .filter((line) => !/^(ID|STATE|OF|ISRAEL|DRIVING|LICENCE|LICENSE)$/.test(line));
}

export interface DerivedFields {
  /** The candidate that matches the user-typed number, if OCR saw it. */
  idNumberMatched: boolean;
  /** ISO dates derived from the printed Gregorian dates. */
  dateOfBirth: string | null;
  documentExpiry: string | null;
}

/**
 * Derive structured fields from one OCR pass.
 *
 * `typedId` is the user-typed ID number (ground truth, checksum-validated
 * before OCR runs); extraction only needs to confirm the document shows the
 * same number.
 */
export function deriveFields(text: string, typedId: string): DerivedFields {
  const normalizedTyped = normalizeIsraeliId(typedId);
  const candidates = extractIdCandidates(text);
  const dates = extractDates(text);

  return {
    idNumberMatched:
      normalizedTyped !== null && candidates.includes(normalizedTyped),
    dateOfBirth: dates.length >= 2 ? dates[0] : null,
    documentExpiry: dates.length >= 2 ? dates[dates.length - 1] : null,
  };
}
