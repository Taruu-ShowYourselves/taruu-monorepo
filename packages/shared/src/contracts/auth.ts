/**
 * Auth API Contracts
 * Zod schemas for auth-related API endpoints
 */

import { z } from 'zod';

// === Session ===

export const SessionUserSchema = z.object({
  id: z.string().uuid(),
  did: z.string().nullable(),
  email: z.string().email(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  avatarUrl: z.string().url().nullable().optional(),
  identityScore: z.number().min(0).max(100),
  verificationStatus: z.enum(['none', 'pending', 'verified', 'failed']),
  municipality: z.string().nullable(),
  socialProofs: z.array(z.enum(['google', 'facebook', 'instagram'])),
});

export const SessionInfoSchema = z.object({
  userId: z.string().uuid(),
  did: z.string().nullable(),
  expiresAt: z.string().datetime(),
});

export const SessionResponseSchema = z.object({
  valid: z.literal(true),
  user: SessionUserSchema,
  session: SessionInfoSchema,
});

export const SessionErrorSchema = z.object({
  error: z.string(),
  code: z.enum(['INVALID_SESSION', 'USER_NOT_FOUND', 'VALIDATION_FAILED']),
});

export type SessionUser = z.infer<typeof SessionUserSchema>;
export type SessionInfo = z.infer<typeof SessionInfoSchema>;
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
export type SessionError = z.infer<typeof SessionErrorSchema>;

// === Auth Callback ===

export const AuthCallbackRequestSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export const AuthCallbackResponseSchema = z.object({
  success: z.literal(true),
  redirectUrl: z.string(),
});

export const AuthCallbackErrorSchema = z.object({
  error: z.string(),
  code: z.enum(['INVALID_STATE', 'TOKEN_EXCHANGE_FAILED', 'USER_CREATION_FAILED']),
});

export type AuthCallbackRequest = z.infer<typeof AuthCallbackRequestSchema>;
export type AuthCallbackResponse = z.infer<typeof AuthCallbackResponseSchema>;
export type AuthCallbackError = z.infer<typeof AuthCallbackErrorSchema>;

// === DID ===

export const JWKSchema = z.object({
  kty: z.string(),
  crv: z.string().optional(),
  x: z.string().optional(),
  y: z.string().optional(),
  d: z.string().optional(),
});

export const DIDGetResponseSchema = z.object({
  did: z.string().startsWith('did:sync:'),
  publicKey: JWKSchema.nullable(),
});

export const DIDGenerateRequestSchema = z.object({
  action: z.literal('generate'),
  oauthToken: z.string().min(1),
});

export const DIDRecoverRequestSchema = z.object({
  action: z.literal('recover'),
  oauthToken: z.string().min(1),
});

export const DIDRequestSchema = z.discriminatedUnion('action', [
  DIDGenerateRequestSchema,
  DIDRecoverRequestSchema,
]);

export const DIDGenerateResponseSchema = z.object({
  success: z.literal(true),
  did: z.string().startsWith('did:sync:'),
  publicKey: JWKSchema,
});

export const DIDRecoverResponseSchema = z.object({
  success: z.literal(true),
  did: z.string().startsWith('did:sync:'),
  publicKey: JWKSchema.nullable(),
  privateKey: JWKSchema,
  message: z.string(),
});

export const DIDErrorSchema = z.object({
  error: z.string(),
  code: z.enum([
    'UNAUTHORIZED',
    'USER_NOT_FOUND',
    'DID_NOT_FOUND',
    'DID_EXISTS',
    'MISSING_TOKEN',
    'DID_INVALID',
    'RECOVERY_FAILED',
    'INVALID_ACTION',
    'DID_ERROR',
  ]),
  did: z.string().optional(),
  details: z.string().optional(),
});

export type JWK = z.infer<typeof JWKSchema>;
export type DIDGetResponse = z.infer<typeof DIDGetResponseSchema>;
export type DIDGenerateRequest = z.infer<typeof DIDGenerateRequestSchema>;
export type DIDRecoverRequest = z.infer<typeof DIDRecoverRequestSchema>;
export type DIDRequest = z.infer<typeof DIDRequestSchema>;
export type DIDGenerateResponse = z.infer<typeof DIDGenerateResponseSchema>;
export type DIDRecoverResponse = z.infer<typeof DIDRecoverResponseSchema>;
export type DIDError = z.infer<typeof DIDErrorSchema>;
