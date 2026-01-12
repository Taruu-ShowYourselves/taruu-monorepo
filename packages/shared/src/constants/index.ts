/**
 * Shared Constants
 */

// Payment amounts in ILS
export const VOTE_COST = 3;
export const CREATE_VOTE_COST = 200;

// Token conversion rate (1 ILS = 1 SYNC token)
export const TOKEN_RATE = 1;

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
] as const;

export type Municipality = (typeof MUNICIPALITIES)[number];

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
