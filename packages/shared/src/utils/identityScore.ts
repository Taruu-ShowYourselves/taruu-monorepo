/**
 * Identity Score Calculator
 *
 * Calculates user's identity verification score from connected social
 * accounts and verification evidence. Higher scores indicate higher
 * confidence in user's authentic identity (Sybil-resistance).
 *
 * Score Breakdown (issue #71 final model; canonical writer is the database -
 * migration 20260807000001 - this mirror exists for client-side display):
 * - Google: 40 points (primary auth, REQUIRED)
 * - Identity document: 40 points (operator-approved OCR; inert until PR-10)
 * - GPS Verification: 20 points (21-day location proof)
 * - Phone: 10 points (server-verified SMS OTP)
 * - Facebook: 10 points (social proof)
 * - Instagram: 10 points (social proof)
 * Maximum: 140.
 *
 * Levels (identity_score only - security_score never feeds these):
 * - basic: 40-79 points
 * - verified: 80-119 points
 * - trusted: 120-140 points
 *
 * Ballot: identity_score >= 40 AND explicitly verified GPS residency - see
 * MINIMUM_IDENTITY_SCORE_FOR_VOTING and votingGate below.
 */

import type { SocialProof, IdentityScore, SocialPlatform } from '../types/user';

// === Score Constants ===

export const GPS_SCORE_WEIGHT = 20;
export const PHONE_SCORE_WEIGHT = 10;
export const ID_DOCUMENT_SCORE_WEIGHT = 40;

export const IDENTITY_SCORE_WEIGHTS: Record<SocialPlatform, number> = {
  google: 40,
  facebook: 10,
  instagram: 10,
};

export const IDENTITY_SCORE_MAX = 140;
export const VERIFIED_THRESHOLD = 80;
export const TRUSTED_THRESHOLD = 120;

/**
 * Minimum identity score to cast a ballot: the Google sign-in baseline (40).
 *
 * The number alone is NOT sufficient. Ballot eligibility is
 *   identity_score >= MINIMUM_IDENTITY_SCORE_FOR_VOTING
 *   AND explicitly verified residency
 * (see {@link votingGate}). The two requirements are deliberately separate:
 * the aggregate score measures accumulated identity evidence, while the
 * mandatory residency evidence is checked explicitly as a boolean - the GPS
 * +20 stays in the score for identity/trust purposes but is NOT what grants
 * ballot eligibility, and no evidence (phone, socials, an operator-approved
 * identity document, X) substitutes for residency. Deliberately NOT derived
 * from TRUSTED_THRESHOLD: identity levels and ballot eligibility are
 * separate concepts.
 */
export const MINIMUM_IDENTITY_SCORE_FOR_VOTING = 40;

// === Score Calculation ===

/** Non-social verification evidence feeding the identity score. */
export interface IdentityEvidence {
  /** Server-verified SMS OTP completed (users.phone_verified). */
  phoneVerified?: boolean;
  /** Operator-approved identity document (users.identity_verified_at). */
  idDocumentApproved?: boolean;
}

/** Map a total onto the level bands (identity_score only, never security_score). */
export function getIdentityLevelForTotal(total: number): IdentityScore['level'] {
  if (total >= TRUSTED_THRESHOLD) return 'trusted';
  if (total >= VERIFIED_THRESHOLD) return 'verified';
  return 'basic';
}

/**
 * Calculate identity score from social proofs and verification evidence.
 * @param socialProofs - Array of connected social proof objects
 * @param gpsVerified - Whether GPS verification is completed (21-day verification passed)
 * @param evidence - Phone / identity-document evidence (issue #71 final model)
 */
export function calculateIdentityScore(
  socialProofs: SocialProof[],
  gpsVerified: boolean = false,
  evidence: IdentityEvidence = {}
): IdentityScore {
  const breakdown = {
    gps: gpsVerified ? GPS_SCORE_WEIGHT : 0,
    google: 0,
    facebook: 0,
    instagram: 0,
    phone: evidence.phoneVerified ? PHONE_SCORE_WEIGHT : 0,
    idDocument: evidence.idDocumentApproved ? ID_DOCUMENT_SCORE_WEIGHT : 0,
  };

  // Calculate points for each verified platform
  for (const proof of socialProofs) {
    const weight = IDENTITY_SCORE_WEIGHTS[proof.platform];
    if (weight) {
      breakdown[proof.platform] = weight;
    }
  }

  const total = Math.min(
    breakdown.gps +
      breakdown.google +
      breakdown.facebook +
      breakdown.instagram +
      breakdown.phone +
      breakdown.idDocument,
    IDENTITY_SCORE_MAX
  );

  return {
    total,
    breakdown,
    level: getIdentityLevelForTotal(total),
  };
}

/**
 * Score-floor check only - NECESSARY but NOT SUFFICIENT for a ballot.
 * Eligibility additionally requires explicitly verified residency; callers
 * deciding anything ballot-shaped must go through {@link votingGate}.
 */
export function canVote(identityScore: IdentityScore): boolean {
  return identityScore.total >= MINIMUM_IDENTITY_SCORE_FOR_VOTING;
}

/** What a resident still owes the ballot box. */
export interface VotingGate {
  /** 0-140; the stored identity score, residency points already included. */
  readonly total: number;
  /** {@link MINIMUM_IDENTITY_SCORE_FOR_VOTING}, carried so a caller can print it. */
  readonly required: number;
  /** Points still missing toward `required`. Zero once satisfied. */
  readonly missing: number;
  /** Residency is a hard requirement of its own, never a point substitute. */
  readonly residencyVerified: boolean;
  readonly canVote: boolean;
}

/**
 * The one voting gate, shared by the server that enforces it and the surfaces
 * that explain it.
 *
 * `identityPoints` is the stored, database-owned identity score. Since the
 * Issue #71 unification that score already CONTAINS the GPS residency points
 * (+20), this gate adds nothing on top - re-adding them here would count
 * residency twice. Residency participates ONLY as an explicit boolean
 * requirement: a ballot needs the 40-point Google baseline AND verified
 * residency. The +20 GPS contribution stays in the score for identity/trust
 * display, but it is the boolean - not those points - that grants
 * eligibility, so no other evidence (phone, socials, an approved identity
 * document, X) can substitute for living in the municipality, and a verified
 * resident whose stored score has not yet been backfilled past 40 is still
 * eligible. security_score and the displayed combined trust score never
 * participate. Server enforcement and desk display must both come through
 * here or the desk will promise a ballot the server refuses.
 */
export function votingGate(input: {
  readonly identityPoints: number;
  readonly residencyVerified: boolean;
}): VotingGate {
  const total = Math.min(IDENTITY_SCORE_MAX, Math.max(0, input.identityPoints));

  return {
    total,
    required: MINIMUM_IDENTITY_SCORE_FOR_VOTING,
    missing: Math.max(0, MINIMUM_IDENTITY_SCORE_FOR_VOTING - total),
    residencyVerified: input.residencyVerified,
    canVote: total >= MINIMUM_IDENTITY_SCORE_FOR_VOTING && input.residencyVerified,
  };
}

/**
 * Check if user has Google verification (required)
 */
export function hasGoogleVerification(socialProofs: SocialProof[]): boolean {
  return socialProofs.some((proof) => proof.platform === 'google');
}

/**
 * Get missing verifications for trusted status
 */
export function getMissingVerifications(
  socialProofs: SocialProof[]
): SocialPlatform[] {
  const verifiedPlatforms = new Set(socialProofs.map((p) => p.platform));
  const allPlatforms: SocialPlatform[] = ['google', 'facebook', 'instagram'];
  return allPlatforms.filter((platform) => !verifiedPlatforms.has(platform));
}

/**
 * Get points needed for next level
 */
export function getPointsToNextLevel(identityScore: IdentityScore): {
  currentLevel: IdentityScore['level'];
  nextLevel: IdentityScore['level'] | null;
  pointsNeeded: number;
} {
  const { total, level } = identityScore;

  if (level === 'trusted') {
    return {
      currentLevel: level,
      nextLevel: null,
      pointsNeeded: 0,
    };
  }

  if (level === 'verified') {
    return {
      currentLevel: level,
      nextLevel: 'trusted',
      pointsNeeded: TRUSTED_THRESHOLD - total,
    };
  }

  // basic level
  return {
    currentLevel: level,
    nextLevel: 'verified',
    pointsNeeded: VERIFIED_THRESHOLD - total,
  };
}

/**
 * Create initial identity score (before any verification)
 */
export function createInitialIdentityScore(): IdentityScore {
  return {
    total: 0,
    breakdown: {
      gps: 0,
      google: 0,
      facebook: 0,
      instagram: 0,
      phone: 0,
      idDocument: 0,
    },
    level: 'basic',
  };
}

/**
 * Create social proof for a newly verified platform
 */
export function createSocialProof(
  platform: SocialPlatform,
  providerId: string,
  displayName: string,
  options?: {
    profileUrl?: string;
    profileImage?: string;
    email?: string;
  }
): SocialProof {
  return {
    platform,
    providerId,
    displayName,
    profileUrl: options?.profileUrl,
    profileImage: options?.profileImage,
    email: options?.email,
    connectedAt: new Date(),
    stampWeight: IDENTITY_SCORE_WEIGHTS[platform],
  };
}

/**
 * Get Hebrew label for identity level
 */
export function getIdentityLevelLabel(level: IdentityScore['level']): string {
  const labels: Record<IdentityScore['level'], string> = {
    basic: 'בסיסי',
    verified: 'מאומת',
    trusted: 'מהימן',
  };
  return labels[level];
}

/**
 * Get Hebrew label for social platform
 */
export function getSocialPlatformLabel(platform: SocialPlatform): string {
  const labels: Record<SocialPlatform, string> = {
    google: 'גוגל',
    facebook: 'פייסבוק',
    instagram: 'אינסטגרם',
  };
  return labels[platform];
}

/**
 * Get description for identity level
 */
export function getIdentityLevelDescription(
  level: IdentityScore['level']
): string {
  const descriptions: Record<IdentityScore['level'], string> = {
    basic: 'אימות Google בלבד - מומלץ להוסיף אימותים נוספים',
    verified: 'אימות מורחב (GPS, טלפון או רשתות חברתיות) - רמת אמון גבוהה',
    trusted: 'אימות מלא כולל מסמך זהות - רמת אמון מקסימלית',
  };
  return descriptions[level];
}

/**
 * Check if GPS verification contributes to identity score
 */
export function hasGpsVerification(identityScore: IdentityScore): boolean {
  return identityScore.breakdown.gps > 0;
}

/**
 * Get Hebrew label for verification type (GPS or social platform)
 */
export function getVerificationTypeLabel(
  type: SocialPlatform | 'gps'
): string {
  const labels: Record<SocialPlatform | 'gps', string> = {
    gps: 'אימות מיקום',
    google: 'גוגל',
    facebook: 'פייסבוק',
    instagram: 'אינסטגרם',
  };
  return labels[type];
}
