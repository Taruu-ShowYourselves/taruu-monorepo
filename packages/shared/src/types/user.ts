/**
 * User Types - SEL-DID (Social Evidence-Linked Decentralized Identity)
 */

// === Verification Types ===

export type VerificationPhase = 'not_started' | 'in_progress' | 'completed' | 'failed';
export type CheckInStatus = 'pending' | 'notified' | 'completed' | 'missed';

// === Social Proof Types (NEW - Identity Scoring) ===

export type SocialPlatform = 'google' | 'facebook' | 'instagram';

export interface SocialProof {
  platform: SocialPlatform;
  providerId: string;
  displayName: string;
  profileUrl?: string;
  profileImage?: string;
  email?: string;
  connectedAt: Date;
  stampWeight: number; // Points contribution (Google: 40, Facebook: 10, Instagram: 10)
}

export interface IdentityScore {
  total: number; // 0-140 (issue #71 final model)
  breakdown: {
    gps: number; // 20 points (21-day location proof)
    google: number; // 40 points (primary auth, required)
    facebook: number; // 10 points (social proof)
    instagram: number; // 10 points (social proof)
    phone: number; // 10 points (server-verified SMS OTP)
    idDocument: number; // 40 points (operator-approved identity document; inert until PR-10)
  };
  level: 'basic' | 'verified' | 'trusted'; // basic: 40-79, verified: 80-119, trusted: 120-140
  lastCalculated?: Date; // When the score was last calculated
}

// === GPS Verification Types (NEW - 21-Day Verification) ===

export interface GpsCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: Date;
}

export interface ScheduledCheckIn {
  id: string;
  scheduledAt: Date;
  windowStart: Date;
  windowEnd: Date; // +30 minutes
  status: CheckInStatus;
  completedAt?: Date;
  location?: GpsCoordinates;
  municipalityVerified?: boolean;
}

export interface VerificationSchedule {
  id: string;
  userId: string;
  municipality: string;
  periodStart: Date;
  periodEnd: Date; // +21 days
  scheduledCheckIns: ScheduledCheckIn[];
  status: 'active' | 'completed' | 'failed' | 'cancelled';
  completedCheckIns: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface VerificationStatus {
  phase: VerificationPhase;
  startedAt?: Date;
  completedAt?: Date;
  scheduleId?: string;
  checkInsCompleted?: number;
  checkInsTotal?: number;
  nextCheckIn?: Date;
}

// === DID Types (NEW - Decentralized Identity) ===

export interface DIDRecord {
  id: string;
  did: string; // did:sync:xxx
  userId: string;
  publicKey: string; // JWK format
  encryptedPrivateKeyBackup?: string; // For recovery
  recoveryMethod: 'google_oauth';
  status: 'active' | 'revoked' | 'recovered';
  createdAt: Date;
  lastUsedAt: Date;
  recoveredAt?: Date;
}

// === Notification Settings ===

export interface NotificationSettings {
  newVotes: boolean;
  voteEnding: boolean;
  voteResults: boolean;
  marketing: boolean;
}

// === User Profile Types (ENHANCED) ===

export interface UserProfile {
  id: string;

  // === SEL-DID Identity (REPLACES clerkId) ===
  did: string; // did:sync:xxx
  publicKey: string; // JWK format

  // === Auth (REPLACES clerkId) ===
  googleId: string; // Primary auth
  email: string;
  emailVerified: boolean;

  // === Profile ===
  firstName: string;
  lastName: string;
  phone?: string;
  municipality: string;
  city?: string | null; // Free-text city (single-country pilot - country is implicitly ישראל)
  avatarUrl?: string | null; // Profile photo URL from Google OAuth

  // === Social Proofs (ENHANCED) ===
  socialProofs: SocialProof[];
  identityScore: IdentityScore;

  // === Verification (ENHANCED) ===
  verificationStatus: VerificationStatus;

  // === Blockchain ===
  qubikWalletAddress: string;
  syncTokenBalance: number;

  // === Notifications ===
  notificationSettings?: NotificationSettings;

  // === Timestamps ===
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfileInput {
  municipality: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface UserProfileUpdate {
  firstName?: string;
  lastName?: string;
  phone?: string;
  municipality?: string;
  city?: string | null;
  notificationSettings?: NotificationSettings;
}

// === Auth Session Types (NEW) ===

export interface AuthSession {
  userId: string;
  googleId: string;
  did: string;
  email: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface GoogleOAuthTokens {
  accessToken: string;
  refreshToken?: string;
  idToken: string;
  expiresAt: Date;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
}
