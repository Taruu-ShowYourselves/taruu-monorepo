/**
 * Payment API Contracts
 * Zod schemas for payment endpoints
 */

import { z } from 'zod';

// === Payment Types ===

export const PaymentTypeSchema = z.enum(['vote_participation', 'vote_creation']);
export const PaymentStatusSchema = z.enum(['pending', 'completed', 'failed', 'refunded']);

export type PaymentType = z.infer<typeof PaymentTypeSchema>;
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

// === POST /api/payments/create ===

export const CreatePaymentRequestSchema = z.object({
  type: PaymentTypeSchema,
  voteId: z.string().uuid().optional(),
  optionId: z.string().uuid().optional(),
  voteTitle: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export const CreatePaymentResponseSchema = z.object({
  success: z.literal(true),
  idempotent: z.boolean().optional(),
  payment: z.object({
    id: z.string().uuid(),
    orderId: z.string().uuid().optional(),
    paymentUrl: z.string().url().optional(),
    status: PaymentStatusSchema.optional(),
    amount: z.number().positive(),
    currency: z.literal('ILS'),
    expiresAt: z.string().datetime().optional(),
  }),
  pricing: z.object({
    amount: z.number().positive(),
    currency: z.literal('ILS'),
    syncTokens: z.number(),
    description: z.string(),
  }).optional(),
});

export const CreatePaymentErrorSchema = z.object({
  error: z.string(),
});

export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>;
export type CreatePaymentResponse = z.infer<typeof CreatePaymentResponseSchema>;
export type CreatePaymentError = z.infer<typeof CreatePaymentErrorSchema>;

// === GET /api/payments/create (pricing info) ===

export const GetPricingResponseSchema = z.object({
  pricing: z.object({
    voteParticipation: z.object({
      amount: z.number().positive(),
      currency: z.literal('ILS'),
      syncTokens: z.number(),
      description: z.string(),
    }),
    voteCreation: z.object({
      amount: z.number().positive(),
      currency: z.literal('ILS'),
      syncTokens: z.number(),
      description: z.string(),
    }),
  }),
  tokenRate: z.object({
    rate: z.number(),
    description: z.string(),
  }),
  paymentProvider: z.literal('green_invoice'),
});

export type GetPricingResponse = z.infer<typeof GetPricingResponseSchema>;

// === GET /api/payments/[id]/status ===

export const GetPaymentStatusResponseSchema = z.object({
  id: z.string().uuid(),
  status: PaymentStatusSchema,
  amount: z.number(),
  currency: z.literal('ILS'),
  type: PaymentTypeSchema,
  receiptUrl: z.string().url().nullable(),
  succeeded: z.boolean(),
  tokensEarned: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  voteId: z.string().uuid().nullable(),
});

export type GetPaymentStatusResponse = z.infer<typeof GetPaymentStatusResponseSchema>;

// === POST /api/payments/webhook ===

export const WebhookEventTypeSchema = z.enum([
  'payment.succeeded',
  'payment.failed',
  'refund.created',
]);

export const WebhookEventSchema = z.object({
  type: WebhookEventTypeSchema,
  paymentId: z.string(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const WebhookResponseSchema = z.object({
  received: z.literal(true),
  idempotent: z.boolean().optional(),
});

export type WebhookEventType = z.infer<typeof WebhookEventTypeSchema>;
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;
export type WebhookResponse = z.infer<typeof WebhookResponseSchema>;
