/**
 * Identity Score Calculator
 *
 * Calculates user's identity verification score based on connected social accounts.
 * Higher scores indicate higher confidence in user's authentic identity (Sybil-resistance).
 *
 * Score Breakdown:
 * - Google: 40 points (REQUIRED)
 * - Facebook: 30 points (optional)
 * - Instagram: 30 points (optional)
 *
 * Levels:
 * - basic: 40-69 points (Google only)
 * - verified: 70-99 points (Google + one other)
 * - trusted: 100 points (all three)
 *
 * Minimum to vote: 40 points (Google verification required)
 * Recommended: 70+ points (verified status)
 */

import type { SocialProof, IdentityScore, SocialPlatform } from '../types/user';

// === Score Constants ===

export const IDENTITY_SCORE_WEIGHTS: Record<SocialPlatform, number> = {
  google: 40,
  facebook: 30,
  instagram: 30,
};

export const MINIMUM_VOTING_SCORE = 40;
export const VERIFIED_THRESHOLD = 70;
export const TRUSTED_THRESHOLD = 100;

// === Score Calculation ===

/**
 * Calculate identity score from social proofs
 */
export function calculateIdentityScore(socialProofs: SocialProof[]): IdentityScore {
  const breakdown = {
    google: 0,
    facebook: 0,
    instagram: 0,
  };

  // Calculate points for each verified platform
  for (const proof of socialProofs) {
    const weight = IDENTITY_SCORE_WEIGHTS[proof.platform];
    if (weight) {
      breakdown[proof.platform] = weight;
    }
  }

  // Calculate total score
  const total = breakdown.google + breakdown.facebook + breakdown.instagram;

  // Determine level
  let level: IdentityScore['level'];
  if (total >= TRUSTED_THRESHOLD) {
    level = 'trusted';
  } else if (total >= VERIFIED_THRESHOLD) {
    level = 'verified';
  } else {
    level = 'basic';
  }

  return {
    total,
    breakdown,
    level,
  };
}

/**
 * Check if user has minimum score to vote
 */
export function canVote(identityScore: IdentityScore): boolean {
  return identityScore.total >= MINIMUM_VOTING_SCORE;
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
      google: 0,
      facebook: 0,
      instagram: 0,
    },
    level: 'basic',
  };
}

/**
 * Create social proof for a newly verified platform
 */
export function createSocialProof(
  platform: SocialPlatform,
  platformUserId: string,
  displayName: string,
  options?: {
    profileUrl?: string;
    profileImage?: string;
    email?: string;
  }
): SocialProof {
  return {
    platform,
    platformUserId,
    displayName,
    profileUrl: options?.profileUrl,
    profileImage: options?.profileImage,
    email: options?.email,
    verifiedAt: new Date(),
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
    basic: 'אימות Google בלבד - מומלץ להוסיף חשבונות נוספים',
    verified: 'אימות עם מספר חשבונות - רמת אמון גבוהה',
    trusted: 'אימות מלא - רמת אמון מקסימלית',
  };
  return descriptions[level];
}
