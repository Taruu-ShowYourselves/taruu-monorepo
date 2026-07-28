/**
 * Israeli identity-document utilities.
 *
 * Pure functions shared by the client scan pipeline (pre-submit validation)
 * and the server document-verification use-case (authoritative re-check).
 *
 * The Israeli ID number (מספר זהות) is 9 digits where the last digit is a
 * check digit computed with a weighted-Luhn scheme: digits are weighted
 * 1,2,1,2,… from the left, products above 9 reduce by 9, and the grand total
 * must be divisible by 10. Numbers issued with fewer digits are conventionally
 * left-padded with zeros to 9.
 */

/** Strip non-digits and left-pad to 9. Returns null when it cannot be an ID. */
export function normalizeIsraeliId(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 0 || digits.length > 9) return null;
  return digits.padStart(9, '0');
}

/** Weighted-Luhn sum over the given digit string (weights 1,2,1,2,… from left). */
function weightedSum(digits: string): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    const digit = digits.charCodeAt(i) - 48;
    const product = digit * (i % 2 === 0 ? 1 : 2);
    sum += product > 9 ? product - 9 : product;
  }
  return sum;
}

/** Check digit that makes an 8-digit prefix a valid 9-digit Israeli ID. */
export function computeIsraeliIdCheckDigit(first8: string): number | null {
  if (!/^\d{8}$/.test(first8)) return null;
  return (10 - (weightedSum(first8) % 10)) % 10;
}

/**
 * Validate a 9-digit Israeli ID number (accepts unpadded/formatted input).
 * All-zero IDs are rejected even though they satisfy the checksum.
 */
export function isValidIsraeliId(input: string): boolean {
  const id = normalizeIsraeliId(input);
  if (id === null) return false;
  if (id === '000000000') return false;
  return weightedSum(id) % 10 === 0;
}

/**
 * Israeli driver's license numbers are 7 digits (no public check digit).
 * Accepts formatted input; validates shape only.
 */
export function isValidIsraeliLicenseNumber(input: string): boolean {
  return /^\d{7}$/.test(input.replace(/\D/g, ''));
}

/**
 * Parse a document date as printed on Israeli documents (dd.mm.yyyy or
 * dd/mm/yyyy or dd-mm-yyyy) into an ISO date string. Returns null when the
 * text is not a real calendar date.
 */
export function parseDocumentDate(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  if (!real) return null;
  return date.toISOString().slice(0, 10);
}

/** True when the (ISO yyyy-mm-dd) expiry date is today or later. */
export function isDocumentDateValid(isoExpiry: string, now: Date = new Date()): boolean {
  const expiry = new Date(`${isoExpiry}T23:59:59.999Z`);
  if (Number.isNaN(expiry.getTime())) return false;
  return expiry.getTime() >= now.getTime();
}
