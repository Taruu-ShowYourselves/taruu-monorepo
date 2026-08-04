/**
 * Green Invoice (morning) Payment Service - vote fees
 *
 * Green Invoice is the Israeli merchant of record for vote payments: it collects
 * ILS on a hosted payment page and auto-issues a tax document on success. This
 * replaces the former Paddle integration; card data never touches our servers.
 *
 * Flow:
 * - createVoteCreationPayment -> POST /payments/form (a hosted payment page,
 *   `type: 320` = payment request issuing a receipt/invoice). Our internal payment
 *   id rides along in the `custom` field. Returns the page URL.
 * - On success Green Invoice issues the document and calls our notifyUrl webhook
 *   (`/api/payments/webhook`, which carries NO secret), which marks the payment
 *   completed, mints SYNC tokens and emails a receipt.
 * - Refunds are issued as Green Invoice credit-note documents (חשבונית זיכוי).
 *
 * Participation is FREE (cfa5d25) and this service has no participation rail.
 * The ₪50 creation fee is 100% platform - it credits no civic pool (PAY-06).
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
  // The notify URL carries NO secret. Green Invoice's hosted form cannot attach a
  // custom header (see GI-PRIME-CHECKLIST.md - confirm with the rep), so instead of
  // putting a shared secret in a URL, the webhook treats an unauthenticated notify
  // as an untrusted PING: it re-fetches the document from Green Invoice over the
  // authenticated API before mutating anything. See verifyWebhook / confirmDocumentIssued.
  const notifyUrl = `${appUrl}/api/payments/webhook`;

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

/** Create a hosted payment page for vote creation (₪50). The only payment we create. */
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
 * Authenticate a Green Invoice webhook against the shared secret (SEC-03).
 *
 * The `x-greeninvoice-token` HTTP header is the ONLY accepted transport for the
 * secret, compared in constant time. The notify URL carries no secret: a shared
 * secret in a URL leaks through referrers, proxy logs, browser history and the
 * edge platform's own request logging, so a secret arriving as a query parameter
 * is not read and can never match. The hosted form cannot set a header, so a genuine Green
 * Invoice notify authenticates on the second factor instead - see
 * `confirmDocumentIssued`, which the webhook route requires when this returns false.
 *
 * Fails CLOSED in production when the secret is unset; fails open outside
 * production so local mock checkout works without creds.
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
  const provided = request.headers.get('x-greeninvoice-token') || '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Ask Green Invoice whether this document exists, over the authenticated API.
 *
 * This is the authenticity proof for the hosted-form path, which cannot present
 * a header. An attacker who guesses an order id cannot make GI vouch for a
 * document that was never issued. Best-effort by design: on any transport or
 * auth failure this returns false, and the caller fails closed in production.
 */
export async function confirmDocumentIssued(documentId: string): Promise<boolean> {
  if (!documentId) return false;
  try {
    const doc = await giRequest<{ id?: string }>(
      `/documents/${encodeURIComponent(documentId)}`,
      { method: 'GET' }
    );
    return Boolean(doc);
  } catch {
    // Deliberately logs the document id only - never the secret, never GI's
    // response body, which is attacker-influenced on an unauthenticated notify.
    logger.warn('Green Invoice document confirmation failed', { documentId });
    return false;
  }
}

/**
 * The Green Invoice document id from a notify payload, or null.
 *
 * Deliberately does NOT fall back to our own order id. `parseWebhookEvent` does,
 * because it needs SOMETHING to correlate on - but that value must never reach
 * `payments.provider_id`, which is meant to hold a GI document reference.
 * Phase 4's reconciliation compares that column against GI's settlement report;
 * seeding it with our own id would make the comparison trivially "reconcile"
 * while holding no document at all.
 */
export function extractDocumentId(payload: Record<string, unknown>): string | null {
  for (const key of ['id', 'documentId', 'paymentId'] as const) {
    const value = payload[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

/**
 * Normalize a Green Invoice notify payload into our internal event shape. Green
 * Invoice notifies on a successful payment (document issued); failed payments
 * redirect the buyer to the failureUrl and send no notify. `custom` is our
 * internal payment id; the document id is read defensively across GI's fields.
 *
 * WARNING: `paymentId` below falls back to our own order id on purpose, because
 * the route needs some correlation key to find the payment row. That value is
 * therefore NOT a proof of a Green Invoice document and must never be persisted
 * as one - `payments.provider_id` is written from `extractDocumentId`, which has
 * no fallback and returns null when GI sent no document id (PAY-07).
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
    voteCreation: VOTE_CREATION_AMOUNT, // ₪50
    currency: 'ILS' as const,
  };
}

export const paymentService = {
  isConfigured,
  createVoteCreationPayment,
  getPaymentStatus,
  getInvoiceUrl,
  createRefund,
  verifyWebhook,
  confirmDocumentIssued,
  extractDocumentId,
  parseWebhookEvent,
};

export { VOTE_CREATION_AMOUNT };
export type { PaymentIntent, PaymentResult };
export default paymentService;
