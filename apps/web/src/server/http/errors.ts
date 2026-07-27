/**
 * The single error taxonomy for the server layer.
 *
 * Every use-case failure is one of these; `respond()` maps them exhaustively
 * to HTTP. Adding a variant without a mapping is a compile error.
 */

export type AppError =
  | { kind: 'UNAUTHORIZED' }
  | { kind: 'FORBIDDEN'; reason?: string }
  | { kind: 'NOT_FOUND'; entity: string }
  | { kind: 'VALIDATION'; issues: string[] }
  | { kind: 'CONFLICT'; reason: string }
  | { kind: 'PAYMENT_INVALID'; reason: string }
  | { kind: 'DB'; op: string; cause?: string }
  | { kind: 'INTERNAL'; cause?: string };

export const unauthorized = (): AppError => ({ kind: 'UNAUTHORIZED' });
export const forbidden = (reason?: string): AppError => ({ kind: 'FORBIDDEN', reason });
export const notFound = (entity: string): AppError => ({ kind: 'NOT_FOUND', entity });
export const validation = (issues: string[]): AppError => ({ kind: 'VALIDATION', issues });
export const conflict = (reason: string): AppError => ({ kind: 'CONFLICT', reason });
export const paymentInvalid = (reason: string): AppError => ({
  kind: 'PAYMENT_INVALID',
  reason,
});
export const dbError = (op: string, cause?: unknown): AppError => ({
  kind: 'DB',
  op,
  cause: cause instanceof Error ? cause.message : cause ? String(cause) : undefined,
});
export const internal = (cause?: unknown): AppError => ({
  kind: 'INTERNAL',
  cause: cause instanceof Error ? cause.message : cause ? String(cause) : undefined,
});

export interface HttpError {
  status: number;
  body: { error: string; code: string; details?: unknown };
}

/** Exhaustive AppError → HTTP mapping. */
export function toHttp(error: AppError): HttpError {
  switch (error.kind) {
    case 'UNAUTHORIZED':
      return { status: 401, body: { error: 'Unauthorized', code: 'UNAUTHORIZED' } };
    case 'FORBIDDEN':
      return {
        status: 403,
        body: { error: error.reason ?? 'Forbidden', code: 'FORBIDDEN' },
      };
    case 'NOT_FOUND':
      return {
        status: 404,
        body: { error: `${error.entity} not found`, code: 'NOT_FOUND' },
      };
    case 'VALIDATION':
      return {
        status: 400,
        body: {
          error: 'Invalid request',
          code: 'VALIDATION_ERROR',
          details: error.issues,
        },
      };
    case 'CONFLICT':
      return { status: 409, body: { error: error.reason, code: 'CONFLICT' } };
    case 'PAYMENT_INVALID':
      return {
        status: 402,
        body: { error: error.reason, code: 'PAYMENT_REQUIRED' },
      };
    case 'DB':
    case 'INTERNAL':
      return {
        status: 500,
        body: { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      };
  }
}
