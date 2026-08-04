/**
 * Green Invoice (morning) Payment Service - vote fees
 *
 * Green Invoice is the Israeli merchant of record for vote payments: it collects
 * ILS on a hosted payment page and auto-issues a tax document on success. This
 * replaces the former Paddle integration; card data never touches our servers.
 *
 * Flow:
 * - createVotePayment / createVoteCreationPayment -> POST /payments/form (a hosted
 *   payment page, `type: 320` = payment request issuing a receipt/invoice). Our
 *   internal payment id rides along in the `custom` field. Returns the page URL.
 * - On success Green Invoice issues the document and calls our notifyUrl webhook
 *   (`/api/payments/webhook?token=<secret>`), which marks the payment completed,
 *   accrues ILS into the per-vote treasury ledger, mints SYNC tokens, records the
 *   vote. The accrued ILS is later batch-seeded into a Bags.fm bag at resolution.
 * - Refunds are issued as Green Invoice credit-note documents (חשבונית זיכוי).
 *
 * Auth (JWT) and the account/base URL are shared with the merch integration
 * (services/greenInvoice). Endpoint/field shapes follow the public morning API;
 * verify field names against your account's API console before going live.
 *
 * @see https://greeninvoice.docs.apiary.io/
 */

import { timingSafeEqual } from 'node:crypto';
import type { PaymentWebhookEvent } from '@sync/shared';
import { CREATE_VOTE_COST } from '@sync/shared';
import { getToken, isGreenInvoiceConfigured } from '@/services/greenInvoice';
import { logger } from '@/lib/logger';

// === Configuration ===

// Payment amounts in ILS (source of truth lives in @sync/shared constants)
/**
 * LEGACY ₪3 vote-participation charge. Participation is free since cfa5d25 and
 * no web surface creates this payment any more, but the `vote_participation`
 * rail is still wired through /api/payments/create. The amount is pinned here
 * rather than imported from @sync/shared so the free-participation constant can
 * never be mistaken for a live price. Retiring this rail belongs to the Phase 3
 * payment re-scope.
 */
const VOTE_PARTICIPATION_AMOUNT = 3;
const VOTE_CREATION_AMOUNT = CREATE_VOTE_COST; // ₪50

/** Green Invoice document type for a hosted payment request (issues a receipt/invoice). */
const DOC_TYPE_PAYMENT_REQUEST = 320;
/** Green Invoice document type for a credit note (חשבונית זיכוי). Verify against the account. */
const DOC_TYPE_CREDIT_NOTE = 330;

function resolveBaseUrl(): string {
  const env = (process.env.GREENINVOICE_ENV || 'sandbox').toLowerCase();
  return env === 'production'
    ? 'https://api.greeninvoice.co.il/api/v1'
    : 'https://sandbox.d.greeninvoice.co.il/api/v1';
}

// === Types ===

interface PaymentIntent {
  /** Our internal payment id - Green Invoice issues no transaction id up front. */
  id: string;
  amount: number;
  currency: 'ILS';
  status: 'pending';
  paymentUrl: string;
  expiresAt: Date;
}

interface PaymentResult {
  id: string;
  amount: number;
  currency: 'ILS';
  status: 'succeeded' | 'failed' | 'pending';
  receiptUrl?: string;
  txHash: string;
  processedAt: Date;
}

// === Error Class ===

export class PaymentServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'PaymentServiceError';
  }
}

// === Helpers ===

/** True when real Green Invoice credentials are present. */
export function isConfigured(): boolean {
  return isGreenInvoiceConfigured();
}

async function giRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${resolveBaseUrl()}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    logger.error('Green Invoice API error', { endpoint, status: res.status });
    throw new PaymentServiceError(
      `Green Invoice request failed (${res.status}): ${detail}`,
      'API_ERROR',
      res.status
    );
  }
  return (await res.json().catch(() => ({}))) as T;
}

/**
 * Create a hosted Green Invoice payment page for a single vote fee and return its
 * URL. `custom` carries our internal payment id so the webhook can correlate the
 * notification back to the payment row (which already holds all other metadata).
 */
async function createPaymentForm(params: {
  orderId: string;
  amount: number;
  description: string;
  email: string;
  name: string;
}): Promise<PaymentIntent> {
  if (!isGreenInvoiceConfigured()) {
    throw new PaymentServiceError('Green Invoice is not configured', 'NOT_CONFIGURED');
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const secret = process.env.GREENINVOICE_WEBHOOK_SECRET || '';
  // Green Invoice's hosted-form notify supports only a URL (no custom headers), so
  // the shared secret rides as `?token=` - matched by the webhook, which also
  // accepts an `x-greeninvoice-token` header. (Header/HMAC transport is tracked in
  // CONCERNS.md; the hosted-form flow can't attach a header.)
  const notifyUrl = `${appUrl}/api/payments/webhook${secret ? `?token=${encodeURIComponent(secret)}` : ''}`;

  const payload = {
    description: params.description,
    type: DOC_TYPE_PAYMENT_REQUEST,
    lang: 'he',
    currency: 'ILS',
    sum: params.amount,
    client: { name: params.name, emails: [params.email] },
    income: [
      {
        description: params.description,
        quantity: 1,
        price: params.amount,
        currency: 'ILS',
        vatType: 0,
      },
    ],
    remarks: `Payment ${params.orderId}`,
    successUrl: `${appUrl}/he/payments/return?payment=${params.orderId}`,
    failureUrl: `${appUrl}/he/payments/return?payment=${params.orderId}&status=failed`,
    notifyUrl,
    custom: params.orderId,
  };

  const data = await giRequest<{ url?: string; errorCode?: number; errorMessage?: string }>(
    '/payments/form',
    { method: 'POST', body: JSON.stringify(payload) }
  );

  if (!data.url) {
    throw new PaymentServiceError(
      `Green Invoice payment form returned no url (code ${data.errorCode ?? '?'})`,
      'NO_FORM_URL'
    );
  }

  logger.info('Green Invoice payment form created', { orderId: params.orderId });
  return {
    id: params.orderId,
    amount: params.amount,
    currency: 'ILS',
    status: 'pending',
    paymentUrl: data.url,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  };
}

// === Service Methods ===

/** Create a hosted payment page for vote participation (₪3). */
export async function createVotePayment(params: {
  orderId: string;
  voteId: string;
  voteTitle?: string;
  userId: string;
  email: string;
  name: string;
  municipality?: string;
}): Promise<PaymentIntent> {
  return createPaymentForm({
    orderId: params.orderId,
    amount: VOTE_PARTICIPATION_AMOUNT,
    description: `השתתפות בהצבעה: ${params.voteTitle || params.voteId}`,
    email: params.email,
    name: params.name,
  });
}

/** Create a hosted payment page for vote creation (₪50). */
export async function createVoteCreationPayment(params: {
  orderId: string;
  voteTitle: string;
  userId: string;
  email: string;
  name: string;
  municipality?: string;
}): Promise<PaymentIntent> {
  return createPaymentForm({
    orderId: params.orderId,
    amount: VOTE_CREATION_AMOUNT,
    description: `יצירת הצבעה: ${params.voteTitle || 'הצבעה חדשה'}`,
    email: params.email,
    name: params.name,
  });
}

/**
 * Look up an issued Green Invoice document (by its id, stored as the payment's
 * provider id after the webhook fires) to recover the hosted receipt URL.
 * Best-effort - used only to attach a receipt link, never to gate money.
 */
export async function getPaymentStatus(documentId: string): Promise<PaymentResult> {
  const doc = await giRequest<{ url?: { origin?: string; he?: string } | string }>(
    `/documents/${encodeURIComponent(documentId)}`,
    { method: 'GET' }
  );
  const receiptUrl =
    typeof doc.url === 'string' ? doc.url : doc.url?.origin || doc.url?.he || undefined;
  return {
    id: documentId,
    amount: 0,
    currency: 'ILS',
    status: 'succeeded',
    receiptUrl,
    txHash: documentId,
    processedAt: new Date(),
  };
}

/** Fetch the hosted document (receipt/invoice) URL for a completed payment. */
export async function getInvoiceUrl(documentId: string): Promise<string> {
  const status = await getPaymentStatus(documentId);
  if (!status.receiptUrl) {
    throw new PaymentServiceError('Green Invoice document has no URL', 'NO_DOCUMENT_URL');
  }
  return status.receiptUrl;
}

/**
 * Issue a Green Invoice credit note (חשבונית זיכוי) against an original document.
 * Admin/support use only - the user-facing flow only *records* a refund request.
 * Verify the credit-note document type + field names against your account before
 * relying on this in production.
 */
export async function createRefund(params: {
  documentId: string;
  amount: number;
  reason: string;
}): Promise<{ id: string; status: string }> {
  const data = await giRequest<{ id?: string; number?: string }>('/documents', {
    method: 'POST',
    body: JSON.stringify({
      type: DOC_TYPE_CREDIT_NOTE,
      lang: 'he',
      currency: 'ILS',
      linkedDocumentIds: [params.documentId],
      remarks: params.reason,
      income: [
        {
          description: `זיכוי: ${params.reason}`.slice(0, 200),
          quantity: 1,
          price: params.amount,
          currency: 'ILS',
          vatType: 0,
        },
      ],
    }),
  });
  const id = data.id || data.number || '';
  logger.info('Green Invoice credit note created', { documentId: params.documentId, creditNoteId: id });
  return { id, status: 'created' };
}

/**
 * Authenticate a Green Invoice webhook against the shared secret. The notify URL
 * is registered with `?token=<secret>`; we also accept an `x-greeninvoice-token`
 * header. Fails CLOSED in production when the secret is unset; fails open in dev so
 * local mock checkout works without creds.
 */
export function verifyWebhook(request: Request): boolean {
  const secret = process.env.GREENINVOICE_WEBHOOK_SECRET || '';
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('Payments webhook: GREENINVOICE_WEBHOOK_SECRET unset in production - rejecting');
      return false;
    }
    logger.warn('Payments webhook: GREENINVOICE_WEBHOOK_SECRET unset - UNAUTHENTICATED (dev only)');
    return true;
  }
  const provided =
    new URL(request.url).searchParams.get('token') ||
    request.headers.get('x-greeninvoice-token') ||
    '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Normalize a Green Invoice notify payload into our internal event shape. Green
 * Invoice notifies on a successful payment (document issued); failed payments
 * redirect the buyer to the failureUrl and send no notify. `custom` is our
 * internal payment id; the document id is read defensively across GI's fields.
 */
export function parseWebhookEvent(payload: Record<string, unknown>): PaymentWebhookEvent {
  const orderId = (payload.custom as string) || '';
  const documentId =
    (payload.id as string) ||
    (payload.documentId as string) ||
    (payload.paymentId as string) ||
    '';
  return {
    type: 'payment.succeeded',
    paymentId: documentId || orderId,
    amount: 0,
    metadata: { orderId },
  };
}

// === Exports ===

export function getPaymentAmounts() {
  return {
    voteParticipation: VOTE_PARTICIPATION_AMOUNT, // ₪3
    voteCreation: VOTE_CREATION_AMOUNT, // ₪50
    currency: 'ILS' as const,
  };
}

export const paymentService = {
  isConfigured,
  createVotePayment,
  createVoteCreationPayment,
  getPaymentStatus,
  getInvoiceUrl,
  createRefund,
  verifyWebhook,
  parseWebhookEvent,
};

export { VOTE_PARTICIPATION_AMOUNT, VOTE_CREATION_AMOUNT };
export type { PaymentIntent, PaymentResult };
export default paymentService;
