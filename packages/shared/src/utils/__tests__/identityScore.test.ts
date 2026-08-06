/**
 * Identity Score Calculator Tests
 *
 * Tests for the identity score system per specs/auth-flow.md v77:
 * - GPS Verification: 40 points (location proof)
 * - Google: 40 points (primary auth, required)
 * - Facebook: 10 points (social proof)
 * - Instagram: 10 points (social proof)
 *
 * Levels:
 * - basic: 40-59 points (Google only)
 * - verified: 60-79 points (Google + both socials OR would need GPS partial)
 * - trusted: 80-100 points (Google + GPS + optional socials)
 */

import {
  calculateIdentityScore,
  canVote,
  hasGoogleVerification,
  getMissingVerifications,
  getPointsToNextLevel,
  createInitialIdentityScore,
  createSocialProof,
  getIdentityLevelLabel,
  getSocialPlatformLabel,
  getIdentityLevelDescription,
  hasGpsVerification,
  getVerificationTypeLabel,
  IDENTITY_SCORE_WEIGHTS,
  GPS_SCORE_WEIGHT,
  MINIMUM_VOTING_SCORE,
  VERIFIED_THRESHOLD,
  TRUSTED_THRESHOLD,
} from '../identityScore';
import type { SocialProof } from '../../types/user';

// Helper to create mock social proofs
const createMockProof = (platform: 'google' | 'facebook' | 'instagram'): SocialProof => ({
  platform,
  providerId: `${platform}-123`,
  displayName: `Test ${platform} User`,
  connectedAt: new Date(),
  stampWeight: IDENTITY_SCORE_WEIGHTS[platform],
});

describe('calculateIdentityScore', () => {
  it('should return 0 total with no social proofs and no GPS', () => {
    const result = calculateIdentityScore([]);
    expect(result.total).toBe(0);
    expect(result.level).toBe('basic');
    expect(result.breakdown).toEqual({ gps: 0, google: 0, facebook: 0, instagram: 0 });
  });

  it('should calculate score for Google only (basic level)', () => {
    const proofs = [createMockProof('google')];
    const result = calculateIdentityScore(proofs);

    expect(result.total).toBe(40);
    expect(result.level).toBe('basic');
    expect(result.breakdown.gps).toBe(0);
    expect(result.breakdown.google).toBe(40);
    expect(result.breakdown.facebook).toBe(0);
    expect(result.breakdown.instagram).toBe(0);
  });

  it('should calculate score for Google + Facebook (still basic level)', () => {
    const proofs = [createMockProof('google'), createMockProof('facebook')];
    const result = calculateIdentityScore(proofs);

    expect(result.total).toBe(50);
    expect(result.level).toBe('basic'); // 50 < 60 = basic
    expect(result.breakdown.google).toBe(40);
    expect(result.breakdown.facebook).toBe(10);
  });

  it('should calculate score for Google + Instagram (still basic level)', () => {
    const proofs = [createMockProof('google'), createMockProof('instagram')];
    const result = calculateIdentityScore(proofs);

    expect(result.total).toBe(50);
    expect(result.level).toBe('basic'); // 50 < 60 = basic
  });

  it('should calculate score for Google + Facebook + Instagram (verified level)', () => {
    const proofs = [
      createMockProof('google'),
      createMockProof('facebook'),
      createMockProof('instagram'),
    ];
    const result = calculateIdentityScore(proofs);

    expect(result.total).toBe(60);
    expect(result.level).toBe('verified'); // 60 >= VERIFIED_THRESHOLD
    expect(result.breakdown).toEqual({ gps: 0, google: 40, facebook: 10, instagram: 10 });
  });

  it('should calculate score for GPS only (basic level, no Google)', () => {
    const result = calculateIdentityScore([], true);

    expect(result.total).toBe(40);
    expect(result.level).toBe('basic');
    expect(result.breakdown.gps).toBe(40);
  });

  it('should calculate score for Google + GPS (trusted level)', () => {
    const proofs = [createMockProof('google')];
    const result = calculateIdentityScore(proofs, true);

    expect(result.total).toBe(80);
    expect(result.level).toBe('trusted'); // 80 >= TRUSTED_THRESHOLD
    expect(result.breakdown.gps).toBe(40);
    expect(result.breakdown.google).toBe(40);
  });

  it('should calculate score for all verifications (max trusted level)', () => {
    const proofs = [
      createMockProof('google'),
      createMockProof('facebook'),
      createMockProof('instagram'),
    ];
    const result = calculateIdentityScore(proofs, true);

    expect(result.total).toBe(100);
    expect(result.level).toBe('trusted');
    expect(result.breakdown).toEqual({ gps: 40, google: 40, facebook: 10, instagram: 10 });
  });

  it('should handle duplicate platforms (only count once)', () => {
    const proofs = [createMockProof('google'), createMockProof('google')];
    const result = calculateIdentityScore(proofs);

    // Second Google overwrites first, still 40 points
    expect(result.total).toBe(40);
  });

  it('should handle GPS false explicitly', () => {
    const proofs = [createMockProof('google')];
    const result = calculateIdentityScore(proofs, false);

    expect(result.total).toBe(40);
    expect(result.breakdown.gps).toBe(0);
  });
});

describe('canVote', () => {
  it('should return false when score is below minimum', () => {
    const score = calculateIdentityScore([]);
    expect(canVote(score)).toBe(false);
  });

  it('should return false for Google alone - half the threshold', () => {
    const score = calculateIdentityScore([createMockProof('google')]);
    expect(score.total).toBe(40);
    expect(canVote(score)).toBe(false);
  });

  it('should return true for Google plus the GPS residency check', () => {
    const score = calculateIdentityScore([createMockProof('google')], true);
    expect(score.total).toBe(MINIMUM_VOTING_SCORE);
    expect(canVote(score)).toBe(true);
  });
});

describe('votingGate', () => {
  it('adds the residency points to the stored identity score', () => {
    expect(votingGate({ identityPoints: 40, residencyVerified: true })).toEqual({
      total: 80,
      required: 80,
      missing: 0,
      residencyPoints: 40,
      canVote: true,
    });
  });

  it('leaves a signed-in resident 40 short until they check in', () => {
    const gate = votingGate({ identityPoints: 40, residencyVerified: false });
    expect(gate).toMatchObject({ total: 40, missing: 40, canVote: false });
  });

  it('cannot be reached by stacking social accounts alone', () => {
    // Google 40 + Facebook 10 + Instagram 10. The residency check is the only
    // way to 80, which is the whole point of the threshold.
    expect(votingGate({ identityPoints: 60, residencyVerified: false }).canVote).toBe(false);
  });

  it('caps at 100 and never reports negative points owed', () => {
    const gate = votingGate({ identityPoints: 100, residencyVerified: true });
    expect(gate.total).toBe(100);
    expect(gate.missing).toBe(0);
  });
});

describe('hasGoogleVerification', () => {
  it('should return false when no Google proof', () => {
    expect(hasGoogleVerification([])).toBe(false);
    expect(hasGoogleVerification([createMockProof('facebook')])).toBe(false);
  });

  it('should return true when Google proof exists', () => {
    expect(hasGoogleVerification([createMockProof('google')])).toBe(true);
    expect(
      hasGoogleVerification([
        createMockProof('facebook'),
        createMockProof('google'),
      ])
    ).toBe(true);
  });
});

describe('getMissingVerifications', () => {
  it('should return all platforms when no proofs', () => {
    const missing = getMissingVerifications([]);
    expect(missing).toContain('google');
    expect(missing).toContain('facebook');
    expect(missing).toContain('instagram');
    expect(missing).toHaveLength(3);
  });

  it('should return only missing platforms', () => {
    const missing = getMissingVerifications([createMockProof('google')]);
    expect(missing).not.toContain('google');
    expect(missing).toContain('facebook');
    expect(missing).toContain('instagram');
    expect(missing).toHaveLength(2);
  });

  it('should return empty array when all social platforms verified', () => {
    const missing = getMissingVerifications([
      createMockProof('google'),
      createMockProof('facebook'),
      createMockProof('instagram'),
    ]);
    expect(missing).toHaveLength(0);
  });
});

describe('getPointsToNextLevel', () => {
  it('should return points needed for verified from basic (Google only)', () => {
    const score = calculateIdentityScore([createMockProof('google')]);
    const result = getPointsToNextLevel(score);

    expect(result.currentLevel).toBe('basic');
    expect(result.nextLevel).toBe('verified');
    expect(result.pointsNeeded).toBe(VERIFIED_THRESHOLD - 40); // 60 - 40 = 20
  });

  it('should return points needed for trusted from verified', () => {
    // Google + FB + IG = 60 (verified)
    const score = calculateIdentityScore([
      createMockProof('google'),
      createMockProof('facebook'),
      createMockProof('instagram'),
    ]);
    const result = getPointsToNextLevel(score);

    expect(result.currentLevel).toBe('verified');
    expect(result.nextLevel).toBe('trusted');
    expect(result.pointsNeeded).toBe(TRUSTED_THRESHOLD - 60); // 80 - 60 = 20
  });

  it('should return null nextLevel when trusted', () => {
    const score = calculateIdentityScore([createMockProof('google')], true);
    const result = getPointsToNextLevel(score);

    expect(result.currentLevel).toBe('trusted');
    expect(result.nextLevel).toBeNull();
    expect(result.pointsNeeded).toBe(0);
  });
});

describe('createInitialIdentityScore', () => {
  it('should create score with all zeros', () => {
    const score = createInitialIdentityScore();

    expect(score.total).toBe(0);
    expect(score.level).toBe('basic');
    expect(score.breakdown).toEqual({ gps: 0, google: 0, facebook: 0, instagram: 0 });
  });
});

describe('createSocialProof', () => {
  it('should create valid social proof', () => {
    const proof = createSocialProof('google', 'user-123', 'Test User', {
      email: 'test@example.com',
      profileUrl: 'https://google.com/user',
    });

    expect(proof.platform).toBe('google');
    expect(proof.providerId).toBe('user-123');
    expect(proof.displayName).toBe('Test User');
    expect(proof.email).toBe('test@example.com');
    expect(proof.profileUrl).toBe('https://google.com/user');
    expect(proof.stampWeight).toBe(40);
    expect(proof.connectedAt).toBeInstanceOf(Date);
  });

  it('should use correct stamp weight for each platform', () => {
    expect(createSocialProof('google', '1', 'Test').stampWeight).toBe(40);
    expect(createSocialProof('facebook', '1', 'Test').stampWeight).toBe(10);
    expect(createSocialProof('instagram', '1', 'Test').stampWeight).toBe(10);
  });
});

describe('Hebrew labels', () => {
  it('should return correct level labels', () => {
    expect(getIdentityLevelLabel('basic')).toBe('בסיסי');
    expect(getIdentityLevelLabel('verified')).toBe('מאומת');
    expect(getIdentityLevelLabel('trusted')).toBe('מהימן');
  });

  it('should return correct platform labels', () => {
    expect(getSocialPlatformLabel('google')).toBe('גוגל');
    expect(getSocialPlatformLabel('facebook')).toBe('פייסבוק');
    expect(getSocialPlatformLabel('instagram')).toBe('אינסטגרם');
  });

  it('should return correct level descriptions', () => {
    expect(getIdentityLevelDescription('basic')).toContain('Google');
    expect(getIdentityLevelDescription('basic')).toContain('GPS');
    expect(getIdentityLevelDescription('verified')).toContain('GPS');
    expect(getIdentityLevelDescription('trusted')).toContain('מקסימלית');
  });

  it('should return correct verification type labels', () => {
    expect(getVerificationTypeLabel('gps')).toBe('אימות מיקום');
    expect(getVerificationTypeLabel('google')).toBe('גוגל');
    expect(getVerificationTypeLabel('facebook')).toBe('פייסבוק');
    expect(getVerificationTypeLabel('instagram')).toBe('אינסטגרם');
  });
});

describe('hasGpsVerification', () => {
  it('should return false when GPS is not verified', () => {
    const score = calculateIdentityScore([createMockProof('google')]);
    expect(hasGpsVerification(score)).toBe(false);
  });

  it('should return true when GPS is verified', () => {
    const score = calculateIdentityScore([createMockProof('google')], true);
    expect(hasGpsVerification(score)).toBe(true);
  });
});

describe('Constants', () => {
  it('should have correct GPS weight', () => {
    expect(GPS_SCORE_WEIGHT).toBe(40);
  });

  it('should have correct social score weights', () => {
    expect(IDENTITY_SCORE_WEIGHTS.google).toBe(40);
    expect(IDENTITY_SCORE_WEIGHTS.facebook).toBe(10);
    expect(IDENTITY_SCORE_WEIGHTS.instagram).toBe(10);
  });

  it('should have correct thresholds per auth-flow.md v77', () => {
    expect(MINIMUM_VOTING_SCORE).toBe(40); // Google required
    expect(VERIFIED_THRESHOLD).toBe(60); // Google + both socials OR partial GPS combo
    expect(TRUSTED_THRESHOLD).toBe(80); // Google + GPS
  });

  it('should ensure all weights add up to 100', () => {
    const totalWeights =
      GPS_SCORE_WEIGHT +
      IDENTITY_SCORE_WEIGHTS.google +
      IDENTITY_SCORE_WEIGHTS.facebook +
      IDENTITY_SCORE_WEIGHTS.instagram;
    expect(totalWeights).toBe(100);
  });
});

describe('Level boundaries', () => {
  it('basic level: 0-59 points', () => {
    // 0 points = basic
    expect(calculateIdentityScore([]).level).toBe('basic');

    // 40 points (Google only) = basic
    expect(calculateIdentityScore([createMockProof('google')]).level).toBe('basic');

    // 50 points (Google + FB or Google + IG) = basic
    expect(
      calculateIdentityScore([createMockProof('google'), createMockProof('facebook')]).level
    ).toBe('basic');
  });

  it('verified level: 60-79 points', () => {
    // 60 points (Google + FB + IG) = verified
    expect(
      calculateIdentityScore([
        createMockProof('google'),
        createMockProof('facebook'),
        createMockProof('instagram'),
      ]).level
    ).toBe('verified');
  });

  it('trusted level: 80-100 points', () => {
    // 80 points (Google + GPS) = trusted
    expect(calculateIdentityScore([createMockProof('google')], true).level).toBe('trusted');

    // 90 points (Google + GPS + FB) = trusted
    expect(
      calculateIdentityScore([createMockProof('google'), createMockProof('facebook')], true)
        .level
    ).toBe('trusted');

    // 100 points (all verifications) = trusted
    expect(
      calculateIdentityScore(
        [
          createMockProof('google'),
          createMockProof('facebook'),
          createMockProof('instagram'),
        ],
        true
      ).level
    ).toBe('trusted');
  });
});
