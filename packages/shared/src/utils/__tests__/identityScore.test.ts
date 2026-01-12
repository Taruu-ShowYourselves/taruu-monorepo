/**
 * Identity Score Calculator Tests
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
  IDENTITY_SCORE_WEIGHTS,
  MINIMUM_VOTING_SCORE,
  VERIFIED_THRESHOLD,
  TRUSTED_THRESHOLD,
} from '../identityScore';
import type { SocialProof } from '../../types/user';

// Helper to create mock social proofs
const createMockProof = (platform: 'google' | 'facebook' | 'instagram'): SocialProof => ({
  platform,
  platformUserId: `${platform}-123`,
  displayName: `Test ${platform} User`,
  verifiedAt: new Date(),
  stampWeight: IDENTITY_SCORE_WEIGHTS[platform],
});

describe('calculateIdentityScore', () => {
  it('should return 0 total with no social proofs', () => {
    const result = calculateIdentityScore([]);
    expect(result.total).toBe(0);
    expect(result.level).toBe('basic');
    expect(result.breakdown).toEqual({ google: 0, facebook: 0, instagram: 0 });
  });

  it('should calculate score for Google only (basic level)', () => {
    const proofs = [createMockProof('google')];
    const result = calculateIdentityScore(proofs);

    expect(result.total).toBe(40);
    expect(result.level).toBe('basic');
    expect(result.breakdown.google).toBe(40);
    expect(result.breakdown.facebook).toBe(0);
    expect(result.breakdown.instagram).toBe(0);
  });

  it('should calculate score for Google + Facebook (verified level)', () => {
    const proofs = [createMockProof('google'), createMockProof('facebook')];
    const result = calculateIdentityScore(proofs);

    expect(result.total).toBe(70);
    expect(result.level).toBe('verified');
    expect(result.breakdown.google).toBe(40);
    expect(result.breakdown.facebook).toBe(30);
  });

  it('should calculate score for Google + Instagram (verified level)', () => {
    const proofs = [createMockProof('google'), createMockProof('instagram')];
    const result = calculateIdentityScore(proofs);

    expect(result.total).toBe(70);
    expect(result.level).toBe('verified');
  });

  it('should calculate score for all platforms (trusted level)', () => {
    const proofs = [
      createMockProof('google'),
      createMockProof('facebook'),
      createMockProof('instagram'),
    ];
    const result = calculateIdentityScore(proofs);

    expect(result.total).toBe(100);
    expect(result.level).toBe('trusted');
    expect(result.breakdown).toEqual({ google: 40, facebook: 30, instagram: 30 });
  });

  it('should handle duplicate platforms (only count once)', () => {
    const proofs = [createMockProof('google'), createMockProof('google')];
    const result = calculateIdentityScore(proofs);

    // Second Google overwrites first, still 40 points
    expect(result.total).toBe(40);
  });
});

describe('canVote', () => {
  it('should return false when score is below minimum', () => {
    const score = calculateIdentityScore([]);
    expect(canVote(score)).toBe(false);
  });

  it('should return true when score equals minimum', () => {
    const score = calculateIdentityScore([createMockProof('google')]);
    expect(score.total).toBe(MINIMUM_VOTING_SCORE);
    expect(canVote(score)).toBe(true);
  });

  it('should return true when score is above minimum', () => {
    const score = calculateIdentityScore([
      createMockProof('google'),
      createMockProof('facebook'),
    ]);
    expect(canVote(score)).toBe(true);
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

  it('should return empty array when all verified', () => {
    const missing = getMissingVerifications([
      createMockProof('google'),
      createMockProof('facebook'),
      createMockProof('instagram'),
    ]);
    expect(missing).toHaveLength(0);
  });
});

describe('getPointsToNextLevel', () => {
  it('should return points needed for verified from basic', () => {
    const score = calculateIdentityScore([createMockProof('google')]);
    const result = getPointsToNextLevel(score);

    expect(result.currentLevel).toBe('basic');
    expect(result.nextLevel).toBe('verified');
    expect(result.pointsNeeded).toBe(VERIFIED_THRESHOLD - 40);
  });

  it('should return points needed for trusted from verified', () => {
    const score = calculateIdentityScore([
      createMockProof('google'),
      createMockProof('facebook'),
    ]);
    const result = getPointsToNextLevel(score);

    expect(result.currentLevel).toBe('verified');
    expect(result.nextLevel).toBe('trusted');
    expect(result.pointsNeeded).toBe(TRUSTED_THRESHOLD - 70);
  });

  it('should return null nextLevel when trusted', () => {
    const score = calculateIdentityScore([
      createMockProof('google'),
      createMockProof('facebook'),
      createMockProof('instagram'),
    ]);
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
    expect(score.breakdown).toEqual({ google: 0, facebook: 0, instagram: 0 });
  });
});

describe('createSocialProof', () => {
  it('should create valid social proof', () => {
    const proof = createSocialProof('google', 'user-123', 'Test User', {
      email: 'test@example.com',
      profileUrl: 'https://google.com/user',
    });

    expect(proof.platform).toBe('google');
    expect(proof.platformUserId).toBe('user-123');
    expect(proof.displayName).toBe('Test User');
    expect(proof.email).toBe('test@example.com');
    expect(proof.profileUrl).toBe('https://google.com/user');
    expect(proof.stampWeight).toBe(40);
    expect(proof.verifiedAt).toBeInstanceOf(Date);
  });

  it('should use correct stamp weight for each platform', () => {
    expect(createSocialProof('google', '1', 'Test').stampWeight).toBe(40);
    expect(createSocialProof('facebook', '1', 'Test').stampWeight).toBe(30);
    expect(createSocialProof('instagram', '1', 'Test').stampWeight).toBe(30);
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
    expect(getIdentityLevelDescription('verified')).toContain('אמון גבוהה');
    expect(getIdentityLevelDescription('trusted')).toContain('מקסימלית');
  });
});

describe('Constants', () => {
  it('should have correct score weights', () => {
    expect(IDENTITY_SCORE_WEIGHTS.google).toBe(40);
    expect(IDENTITY_SCORE_WEIGHTS.facebook).toBe(30);
    expect(IDENTITY_SCORE_WEIGHTS.instagram).toBe(30);
  });

  it('should have correct thresholds', () => {
    expect(MINIMUM_VOTING_SCORE).toBe(40);
    expect(VERIFIED_THRESHOLD).toBe(70);
    expect(TRUSTED_THRESHOLD).toBe(100);
  });

  it('should ensure weights add up to trusted threshold', () => {
    const totalWeights =
      IDENTITY_SCORE_WEIGHTS.google +
      IDENTITY_SCORE_WEIGHTS.facebook +
      IDENTITY_SCORE_WEIGHTS.instagram;
    expect(totalWeights).toBe(TRUSTED_THRESHOLD);
  });
});
