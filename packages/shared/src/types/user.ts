/**
 * User Types
 */

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export type SocialPlatform = 'facebook' | 'twitter' | 'instagram' | 'linkedin' | 'google' | 'apple';

export interface SocialConnection {
  platform: SocialPlatform;
  platformId: string;
  connected: boolean;
  displayName?: string;
  verifiedAt?: Date;
}

export interface UserProfile {
  id: string;
  clerkId: string;
  qubikWalletAddress: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  municipality: string;
  verificationStatus: VerificationStatus;
  socialConnections: SocialConnection[];
  syncTokenBalance: number;
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
}
