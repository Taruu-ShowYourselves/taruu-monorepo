/**
 * Identity Score Calculator Tests
 *
 * Pins the issue #71 final model (mirrors DB migration 20260807000001):
 * - Google: 40 points (primary auth, required)
 * - Identity document: 40 points (operator-approved OCR; inert until PR-10)
 * - GPS Verification: 20 points (21-day location proof)
 * - Phone: 10 points (server-verified SMS OTP)
 * - Facebook: 10 points / Instagram: 10 points
 * Maximum: 140.
 *
 * Levels (identity_score only, never security_score):
 * - basic: 40-79 / verified: 80-119 / trusted: 120-140
 */

import {
  calculateIdentityScore,
  getIdentityLevelForTotal,
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
  PHONE_SCORE_WEIGHT,
  ID_DOCUMENT_SCORE_WEIGHT,
  IDENTITY_SCORE_MAX,
  MINIMUM_IDENTITY_SCORE_FOR_VOTING,
  votingGate,
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

const allSocial = () => [
  createMockProof('google'),
  createMockProof('facebook'),
  createMockProof('instagram'),
];

describe('calculateIdentityScore', () => {
  it('should return 0 total with no social proofs and no evidence', () => {
    const result = calculateIdentityScore([]);
    expect(result.total).toBe(0);
    expect(result.level).toBe('basic');
    expect(result.breakdown).toEqual({
      gps: 0,
      google: 0,
      facebook: 0,
      instagram: 0,
      phone: 0,
      idDocument: 0,
    });
  });

  it('should calculate score for Google only (basic level)', () => {
    const result = calculateIdentityScore([createMockProof('google')]);

    expect(result.total).toBe(40);
    expect(result.level).toBe('basic');
    expect(result.breakdown.google).toBe(40);
    expect(result.breakdown.gps).toBe(0);
    expect(result.breakdown.phone).toBe(0);
    expect(result.breakdown.idDocument).toBe(0);
  });

  it('should calculate score for Google + Facebook (basic level)', () => {
    const result = calculateIdentityScore([
      createMockProof('google'),
      createMockProof('facebook'),
    ]);

    expect(result.total).toBe(50);
    expect(result.level).toBe('basic');
    expect(result.breakdown.facebook).toBe(10);
  });

  it('should calculate score for Google + Facebook + Instagram (still basic: 60 < 80)', () => {
    const result = calculateIdentityScore(allSocial());

    expect(result.total).toBe(60);
    expect(result.level).toBe('basic');
  });

  it('should score GPS at 20 points', () => {
    const result = calculateIdentityScore([createMockProof('google')], true);

    expect(result.total).toBe(60);
    expect(result.level).toBe('basic');
    expect(result.breakdown.gps).toBe(20);
  });

  it('should score phone at 10 points', () => {
    const result = calculateIdentityScore([createMockProof('google')], false, {
      phoneVerified: true,
    });

    expect(result.total).toBe(50);
    expect(result.breakdown.phone).toBe(10);
  });

  it('should score an approved identity document at 40 points', () => {
    const result = calculateIdentityScore([createMockProof('google')], false, {
      idDocumentApproved: true,
    });

    expect(result.total).toBe(80);
    expect(result.level).toBe('verified');
    expect(result.breakdown.idDocument).toBe(40);
  });

  it('reaches verified at Google + GPS + phone + one social (80)', () => {
    const result = calculateIdentityScore(
      [createMockProof('google'), createMockProof('facebook')],
      true,
      { phoneVerified: true }
    );

    expect(result.total).toBe(80);
    expect(result.level).toBe('verified');
  });

  it('reaches trusted at Google + document + GPS + phone + one social (120)', () => {
    const result = calculateIdentityScore(
      [createMockProof('google'), createMockProof('facebook')],
      true,
      { phoneVerified: true, idDocumentApproved: true }
    );

    expect(result.total).toBe(120);
    expect(result.level).toBe('trusted');
  });

  it('full house totals 130 (the X provider is dormant until PR-X; scale max stays 140)', () => {
    const result = calculateIdentityScore(allSocial(), true, {
      phoneVerified: true,
      idDocumentApproved: true,
    });

    expect(result.total).toBe(130);
    expect(result.level).toBe('trusted');
    expect(result.breakdown).toEqual({
      gps: 20,
      google: 40,
      facebook: 10,
      instagram: 10,
      phone: 10,
      idDocument: 40,
    });
  });

  it('should handle duplicate platforms (only count once)', () => {
    const result = calculateIdentityScore([
      createMockProof('google'),
      createMockProof('google'),
    ]);
    expect(result.total).toBe(40);
  });

  it('should handle GPS false and empty evidence explicitly', () => {
    const result = calculateIdentityScore([createMockProof('google')], false, {});
    expect(result.total).toBe(40);
    expect(result.breakdown.gps).toBe(0);
  });
});

describe('getIdentityLevelForTotal', () => {
  it('maps the ratified bands (basic 40-79, verified 80-119, trusted 120-140)', () => {
    expect(getIdentityLevelForTotal(0)).toBe('basic');
    expect(getIdentityLevelForTotal(40)).toBe('basic');
    expect(getIdentityLevelForTotal(79)).toBe('basic');
    expect(getIdentityLevelForTotal(80)).toBe('verified');
    expect(getIdentityLevelForTotal(119)).toBe('verified');
    expect(getIdentityLevelForTotal(120)).toBe('trusted');
    expect(getIdentityLevelForTotal(140)).toBe('trusted');
  });
});

describe('canVote (score floor only - residency is votingGate business)', () => {
  it('should return false when score is below the floor', () => {
    expect(canVote(calculateIdentityScore([]))).toBe(false);
  });

  it('should return true for Google alone - exactly the 40-point floor', () => {
    const score = calculateIdentityScore([createMockProof('google')]);
    expect(score.total).toBe(MINIMUM_IDENTITY_SCORE_FOR_VOTING);
    expect(canVote(score)).toBe(true);
  });

  it('should return true above the floor', () => {
    expect(canVote(calculateIdentityScore([createMockProof('google')], true))).toBe(true);
  });
});

describe('votingGate (ballot eligibility - issue #71 ruling)', () => {
  it('does not re-add residency points - the stored score already contains them', () => {
    expect(votingGate({ identityPoints: 60, residencyVerified: true })).toEqual({
      total: 60,
      required: 40,
      missing: 0,
      residencyVerified: true,
      canVote: true,
    });
  });

  it('google 40 with verified residency is eligible', () => {
    expect(votingGate({ identityPoints: 40, residencyVerified: true }).canVote).toBe(true);
  });

  it('a verified resident still carrying a pre-backfill 40 is eligible (deploy window)', () => {
    // App-first rollout: the DB backfill adding the GPS +20 to the stored
    // score has not run yet. Residency is the boolean, not the points, so
    // the resident is not locked out of the ballot by migration ordering.
    expect(votingGate({ identityPoints: 40, residencyVerified: true })).toEqual({
      total: 40,
      required: 40,
      missing: 0,
      residencyVerified: true,
      canVote: true,
    });
  });

  it('google 40 + phone 10 + facebook 10 = 60 without residency is NOT eligible', () => {
    expect(votingGate({ identityPoints: 60, residencyVerified: false }).canVote).toBe(false);
  });

  it('google 40 + approved document 40 = 80 without residency is NOT eligible', () => {
    expect(votingGate({ identityPoints: 80, residencyVerified: false }).canVote).toBe(false);
  });

  it('google 40 + document 40 + phone 10 = 90 without residency is NOT eligible', () => {
    expect(votingGate({ identityPoints: 90, residencyVerified: false }).canVote).toBe(false);
  });

  it('even a maximal 140 score cannot substitute for residency', () => {
    expect(votingGate({ identityPoints: 140, residencyVerified: false }).canVote).toBe(false);
  });

  it('google 40 + GPS 20 + any extra evidence stays eligible', () => {
    expect(votingGate({ identityPoints: 130, residencyVerified: true }).canVote).toBe(true);
  });

  it('below the 40-point floor stays ineligible even with verified residency', () => {
    const gate = votingGate({ identityPoints: 30, residencyVerified: true });
    expect(gate.canVote).toBe(false);
    expect(gate.missing).toBe(10);
  });

  it('caps at 140 and never reports negative points owed', () => {
    const gate = votingGate({ identityPoints: 150, residencyVerified: true });
    expect(gate.total).toBe(140);
    expect(gate.missing).toBe(0);
  });

  it('the ballot floor is decoupled from TRUSTED_THRESHOLD and from residency points', () => {
    expect(MINIMUM_IDENTITY_SCORE_FOR_VOTING).toBe(40);
    expect(MINIMUM_IDENTITY_SCORE_FOR_VOTING).not.toBe(TRUSTED_THRESHOLD);
    // The floor is the Google baseline alone - it does NOT bake in GPS points.
    expect(MINIMUM_IDENTITY_SCORE_FOR_VOTING).toBe(IDENTITY_SCORE_WEIGHTS.google);
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
      hasGoogleVerification([createMockProof('facebook'), createMockProof('google')])
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
    expect(missing).toHaveLength(2);
  });

  it('should return empty array when all social platforms verified', () => {
    expect(getMissingVerifications(allSocial())).toHaveLength(0);
  });
});

describe('getPointsToNextLevel', () => {
  it('should return points needed for verified from basic (Google only)', () => {
    const result = getPointsToNextLevel(calculateIdentityScore([createMockProof('google')]));

    expect(result.currentLevel).toBe('basic');
    expect(result.nextLevel).toBe('verified');
    expect(result.pointsNeeded).toBe(VERIFIED_THRESHOLD - 40); // 80 - 40 = 40
  });

  it('should return points needed for trusted from verified', () => {
    // Google + document = 80 (verified)
    const score = calculateIdentityScore([createMockProof('google')], false, {
      idDocumentApproved: true,
    });
    const result = getPointsToNextLevel(score);

    expect(result.currentLevel).toBe('verified');
    expect(result.nextLevel).toBe('trusted');
    expect(result.pointsNeeded).toBe(TRUSTED_THRESHOLD - 80); // 120 - 80 = 40
  });

  it('should return null nextLevel when trusted', () => {
    const score = calculateIdentityScore(allSocial(), true, {
      phoneVerified: true,
      idDocumentApproved: true,
    });
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
    expect(score.breakdown).toEqual({
      gps: 0,
      google: 0,
      facebook: 0,
      instagram: 0,
      phone: 0,
      idDocument: 0,
    });
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
    expect(hasGpsVerification(calculateIdentityScore([createMockProof('google')]))).toBe(
      false
    );
  });

  it('should return true when GPS is verified', () => {
    expect(
      hasGpsVerification(calculateIdentityScore([createMockProof('google')], true))
    ).toBe(true);
  });
});

describe('Constants (issue #71 final model)', () => {
  it('should have the ratified evidence weights', () => {
    expect(GPS_SCORE_WEIGHT).toBe(20);
    expect(PHONE_SCORE_WEIGHT).toBe(10);
    expect(ID_DOCUMENT_SCORE_WEIGHT).toBe(40);
  });

  it('should have correct social score weights', () => {
    expect(IDENTITY_SCORE_WEIGHTS.google).toBe(40);
    expect(IDENTITY_SCORE_WEIGHTS.facebook).toBe(10);
    expect(IDENTITY_SCORE_WEIGHTS.instagram).toBe(10);
  });

  it('should have the ratified thresholds and the decoupled ballot floor', () => {
    expect(MINIMUM_IDENTITY_SCORE_FOR_VOTING).toBe(40); // Google baseline; residency ALSO required explicitly
    expect(VERIFIED_THRESHOLD).toBe(80);
    expect(TRUSTED_THRESHOLD).toBe(120);
  });

  it('all weights plus the dormant X arm (10, DB-side only) sum to IDENTITY_SCORE_MAX', () => {
    const X_PROVIDER_WEIGHT = 10; // DB migration only until PR-X adds the platform
    const totalWeights =
      GPS_SCORE_WEIGHT +
      PHONE_SCORE_WEIGHT +
      ID_DOCUMENT_SCORE_WEIGHT +
      IDENTITY_SCORE_WEIGHTS.google +
      IDENTITY_SCORE_WEIGHTS.facebook +
      IDENTITY_SCORE_WEIGHTS.instagram;
    expect(totalWeights + X_PROVIDER_WEIGHT).toBe(IDENTITY_SCORE_MAX);
    expect(IDENTITY_SCORE_MAX).toBe(140);
  });
});

describe('Level boundaries', () => {
  it('basic level: 0-79 points', () => {
    expect(calculateIdentityScore([]).level).toBe('basic');
    expect(calculateIdentityScore([createMockProof('google')]).level).toBe('basic');
    // 70 points (google + gps + phone) = basic
    expect(
      calculateIdentityScore([createMockProof('google')], true, { phoneVerified: true })
        .level
    ).toBe('basic');
  });

  it('verified level: 80-119 points', () => {
    // 80 points (google + document) = verified
    expect(
      calculateIdentityScore([createMockProof('google')], false, {
        idDocumentApproved: true,
      }).level
    ).toBe('verified');
    // 110 points (google + gps + phone + document) = still verified
    expect(
      calculateIdentityScore([createMockProof('google')], true, {
        phoneVerified: true,
        idDocumentApproved: true,
      }).level
    ).toBe('verified');
  });

  it('trusted level: 120-140 points', () => {
    // 120 points (google + fb + gps + phone + document)
    expect(
      calculateIdentityScore(
        [createMockProof('google'), createMockProof('facebook')],
        true,
        { phoneVerified: true, idDocumentApproved: true }
      ).level
    ).toBe('trusted');

    // 130 points (everything the client can model today)
    expect(
      calculateIdentityScore(allSocial(), true, {
        phoneVerified: true,
        idDocumentApproved: true,
      }).level
    ).toBe('trusted');
  });
});
