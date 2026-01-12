/**
 * Newsletter/Signup Types
 */

export type SignupStatus = 'pending' | 'verified' | 'unsubscribed';

export type SignupSource =
  | 'homepage_cta'
  | 'footer'
  | 'landing_page'
  | 'blog'
  | 'campaign'
  | 'other';

export interface NewsletterSignup {
  id: string;
  email: string;
  status: SignupStatus;
  source: SignupSource;
  sourcePage?: string;
  verificationToken?: string;
  verifiedAt?: Date;
  unsubscribedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewsletterSignupInput {
  email: string;
  source: SignupSource;
  sourcePage?: string;
}

export interface NewsletterSignupResponse {
  success: boolean;
  message: string;
  requiresVerification?: boolean;
}
