/**
 * Shared Constants
 */

// Payment amounts in ILS
/**
 * What a resident pays to participate in a vote, in ILS. Participation became
 * free in cfa5d25 (2026-07-29); this constant exists so every surface reads one
 * number instead of hardcoding a price that no longer applies.
 */
export const VOTE_PARTICIPATION_COST = 0;
export const CREATE_VOTE_COST = 50;

// Merch store (ILS, settled via Green Invoice)
export const MERCH_CURRENCY = 'ILS' as const;
/** Flat print-on-demand shipping fee in ILS. */
export const MERCH_SHIPPING_FLAT_ILS = 25;
/** Order subtotal (ILS) at/above which shipping is free. */
export const MERCH_FREE_SHIPPING_THRESHOLD_ILS = 250;
/** Max units of a single variant per cart line. */
export const MERCH_MAX_QTY_PER_LINE = 10;

// Token conversion rate (1 ILS = 1 SYNC token)
export const TOKEN_RATE = 1;

/**
 * Founders' WhatsApp group — the single persistent join CTA (קבוצת המייסדים)
 * across the site. Centralized so the invite can be rotated in one place.
 */
export const WHATSAPP_FOUNDERS_LINK =
  'https://chat.whatsapp.com/FITvea9IVsn2Ljie1yCrAc';

// Vote duration limits (in days)
export const MIN_VOTE_DURATION = 3;
export const MAX_VOTE_DURATION = 30;

// Vote options limits
export const MIN_VOTE_OPTIONS = 2;
export const MAX_VOTE_OPTIONS = 5;

// Character limits
export const VOTE_TITLE_MAX_LENGTH = 100;
export const VOTE_DESCRIPTION_MAX_LENGTH = 2000;
export const VOTE_OPTION_LABEL_MAX_LENGTH = 100;
export const VOTE_OPTION_DESCRIPTION_MAX_LENGTH = 500;

// GPS accuracy threshold (in meters)
export const GPS_ACCURACY_THRESHOLD = 100;

// Israeli municipalities (sample list)
export const MUNICIPALITIES = [
  'תל אביב-יפו',
  'ירושלים',
  'חיפה',
  'ראשון לציון',
  'פתח תקווה',
  'אשדוד',
  'נתניה',
  'באר שבע',
  'חולון',
  'בני ברק',
  'רמת גן',
  'אשקלון',
  'רחובות',
  'בת ים',
  'הרצליה',
  'כפר סבא',
  'חדרה',
  'מודיעין-מכבים-רעות',
  'לוד',
  'רעננה',
  'קריית טבעון',
] as const;

export * from './geo';

export type Municipality = (typeof MUNICIPALITIES)[number];

/**
 * National scope pseudo-municipality — votes carrying this municipality_id
 * are Knesset-agenda topics (majority decision at the national desk), not
 * local ones. Kept out of MUNICIPALITIES so municipal pickers never list it.
 */
export const KNESSET_SCOPE = 'כנסת ישראל';

// API endpoints
export const API_ENDPOINTS = {
  votes: '/api/votes',
  user: '/api/user',
  payments: '/api/payments',
  auth: '/api/auth',
  verification: '/api/verification',
  social: '/api/social',
} as const;

// Re-export error messages
export * from './errors';
