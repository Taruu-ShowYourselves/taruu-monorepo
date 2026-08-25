/**
 * Green Invoice (morning) Payment Service
 *
 * Green Invoice is the Israeli merchant of record + invoicing rail for the
 * merch store: it collects ILS, hosts the payment page, and auto-issues a tax
 * document (receipt/invoice) on success. The same Green Invoice account also
 * backs the vote-fee payments service (services/payments/greenInvoice).
 *
 * Flow:
 * - getToken(): exchange API key id + secret for a short-lived JWT.
 * - createPaymentForm(order): create a hosted payment page; returns its URL.
 *   The buyer is redirected there; on success Green Invoice issues the document
 *   and calls our notifyUrl webhook, which marks the order paid + triggers POD.
 *
 * Endpoint shapes follow the public morning/Green Invoice API. The payment-form
 * endpoint requires an approved account; verify field names against your
 * account's API console before going live.
 *
 * @see https://greeninvoice.docs.apiary.io/
 */

import type { MerchOrder } from '@sync/shared';
import { logger } from '@/lib/logger';

// === Configuration ===

interface GreenInvoiceConfig {
  apiKeyId: string;
  apiSecret: string;
  baseUrl: string;
  /** Optional payment plugin/terminal id from the account. */
  pluginId: string;
}

function resolveBaseUrl(): string {
  const env = (process.env.GREENINVOICE_ENV || 'sandbox').toLowerCase();
  return env === 'production'
    ? 'https://api.greeninvoice.co.il/api/v1'
    : 'https://sandbox.d.greeninvoice.co.il/api/v1';
}

const config: GreenInvoiceConfig = {
  apiKeyId: process.env.GREENINVOICE_API_KEY_ID || '',
  apiSecret: process.env.GREENINVOICE_API_SECRET || '',
  baseUrl: resolveBaseUrl(),
  pluginId: process.env.GREENINVOICE_PLUGIN_ID || '',
};

/** True when real Green Invoice credentials are present. */
export function isGreenInvoiceConfigured(): boolean {
  return Boolean(config.apiKeyId && config.apiSecret);
}

// === Auth ===

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

let cachedToken: CachedToken | null = null;

/**
 * Exchange the API key id + secret for a JWT. The token arrives either in the
 * `X-Authorization-Bearer` response header or the JSON body, depending on the
 * account; we read both. Cached in-memory until shortly before expiry.
 */
export async function getToken(): Promise<string> {
  if (!isGreenInvoiceConfigured()) {
    throw new Error('Green Invoice is not configured');
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }

  const res = await fetch(`${config.baseUrl}/account/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: config.apiKeyId, secret: config.apiSecret }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Green Invoice token request failed (${res.status}): ${detail}`);
  }

  const headerToken = res.headers.get('X-Authorization-Bearer');
  const body = (await res.json().catch(() => ({}))) as {
    token?: string;
    bearer?: string;
    expires?: number;
  };
  const token = headerToken || body.token || body.bearer;
  if (!token) {
    throw new Error('Green Invoice token missing from response');
  }

  // Tokens are short-lived; honour `expires` (epoch seconds) when present,
  // otherwise assume a conservative 50 minutes.
  const expiresAt = body.expires ? body.expires * 1000 : Date.now() + 50 * 60_000;
  cachedToken = { token, expiresAt };
  return token;
}

// === Payment form ===

export interface PaymentFormUrls {
  successUrl: string;
  failureUrl: string;
  notifyUrl: string;
}

interface PaymentFormResponse {
  url?: string;
  errorCode?: number;
  errorMessage?: string;
}

async function giRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    throw new Error(`Green Invoice request failed (${res.status})`);
  }

  return (await res.json()) as T;
}

/**
 * Create a hosted Green Invoice payment page for an order and return its URL.
 * Income lines mirror the cart so the issued document itemises the purchase.
 */
export async function createPaymentForm(
  order: MerchOrder,
  urls: PaymentFormUrls
): Promise<string> {
  const token = await getToken();

  const income = order.items.map((item) => ({
    description: `${item.name} · ${item.variantLabel}`,
    quantity: item.quantity,
    price: item.unitPriceILS,
    currency: 'ILS',
    vatType: 0,
  }));

  if (order.shippingILS > 0) {
    income.push({
      description: 'משלוח',
      quantity: 1,
      price: order.shippingILS,
      currency: 'ILS',
      vatType: 0,
    });
  }

  const payload = {
    description: `הזמנת חנות תַּרְאוּ · ${order.id}`,
    type: 320, // payment request that issues a receipt/invoice on success
    lang: 'he',
    currency: 'ILS',
    sum: order.totalILS,
    pluginId: config.pluginId || undefined,
    client: {
      name: order.shipping.fullName,
      emails: [order.shipping.email],
      phone: order.shipping.phone,
      address: order.shipping.street,
      city: order.shipping.city,
      zip: order.shipping.zip,
      country: order.shipping.country || 'IL',
    },
    income,
    remarks: `Order ${order.id}`,
    successUrl: urls.successUrl,
    failureUrl: urls.failureUrl,
    notifyUrl: urls.notifyUrl,
    custom: order.id,
  };

  const res = await fetch(`${config.baseUrl}/payments/form`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Green Invoice payment form failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as PaymentFormResponse;
  if (!data.url) {
    throw new Error(
      `Green Invoice payment form returned no url (code ${data.errorCode ?? '?'})`
    );
  }

  logger.info('Green Invoice payment form created', { orderId: order.id });
  return data.url;
}

export function extractDocumentId(payload: Record<string, unknown>): string | null {
  for (const key of ['id', 'documentId', 'paymentId'] as const) {
    const value = payload[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

type UnknownRecord = Record<string, unknown>;

const CORRELATION_KEYS = new Set([
  'custom',
  'description',
  'remarks',
  'notes',
  'orderId',
  'order_id',
  'paymentRemarks',
]);

function hasOrderCorrelation(value: unknown, orderId: string): boolean {
  if (typeof value === 'string') return value.includes(orderId);
  if (Array.isArray(value)) return value.some((item) => hasOrderCorrelation(item, orderId));
  if (!value || typeof value !== 'object') return false;

  const record = value as UnknownRecord;
  return Object.entries(record).some(([key, nested]) => {
    if (CORRELATION_KEYS.has(key) && hasOrderCorrelation(nested, orderId)) return true;
    return typeof nested === 'object' && nested !== null && hasOrderCorrelation(nested, orderId);
  });
}

function numericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function documentTotalMatches(doc: UnknownRecord, totalILS: number): boolean {
  for (const key of ['sum', 'total', 'amount', 'totalAmount'] as const) {
    const value = numericValue(doc[key]);
    if (value !== null) return Math.abs(value - totalILS) < 0.01;
  }
  return true;
}

/**
 * Ask Green Invoice whether the issued document really belongs to this merch
 * order. A forged notify must not be able to pair someone else's valid document
 * with a guessed order id, so existence alone is not enough: the authenticated
 * document must carry the order correlation we wrote at checkout (`custom`,
 * `remarks`, or `description`) and, when GI exposes a total field, the amount
 * must match the pending order.
 */
export async function confirmMerchDocumentForOrder(
  documentId: string,
  expected: { orderId: string; totalILS: number }
): Promise<boolean> {
  if (!documentId || !expected.orderId) return false;

  try {
    const doc = await giRequest<UnknownRecord>(
      `/documents/${encodeURIComponent(documentId)}`,
      { method: 'GET' }
    );
    return hasOrderCorrelation(doc, expected.orderId) && documentTotalMatches(doc, expected.totalILS);
  } catch {
    logger.warn('Green Invoice merch document confirmation failed', { documentId });
    return false;
  }
}

// === Token charge (off-session MIT) ===

export interface TokenChargeInput {
  tokenId: string;           // GI saved-card token id (path param)
  sum: number;               // amount in ILS (e.g. 6 or 50)
  description: string;       // document description (Hebrew)
  client: { name: string; emails?: string[]; taxId?: string };
  custom?: string;           // correlation id, mirrors merch `custom` field
}

export interface TokenChargeResult {
  chargeId: string | null;      // transaction/charge id
  documentId: string | null;    // issued tax-document id
  raw: Record<string, unknown>; // full response for SPIKE-RESULT capture
}

/**
 * Charge a saved card token off-session (MIT - merchant-initiated transaction).
 * This is the surface the merch flow never exercises: POST /payments/tokens/{id}/charge
 * issues an ILS charge against a previously-stored card and, on success, auto-issues
 * a tax document (receipt/חשבונית קבלה) in one response.
 *
 * Use for the monthly membership fee (₪6) and vote-creation fee (₪50).
 */
export async function chargeToken(input: TokenChargeInput): Promise<TokenChargeResult> {
  if (!isGreenInvoiceConfigured()) {
    throw new Error('Green Invoice is not configured');
  }

  const token = await getToken();

  const body = {
    sum: input.sum,
    currency: 'ILS',
    lang: 'he',
    description: input.description,
    client: input.client,
    custom: input.custom,
    type: 320, // payment request that issues a receipt/invoice on success (same as createPaymentForm)
  };

  const res = await fetch(
    `${config.baseUrl}/payments/tokens/${encodeURIComponent(input.tokenId)}/charge`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Green Invoice token charge failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as Record<string, unknown>;

  // Derive ids defensively, mirroring the webhook route's payload.id || documentId || paymentId pattern.
  const chargeId =
    (data.transactionId as string | undefined) ||
    (data.chargeId as string | undefined) ||
    (data.id as string | undefined) ||
    null;

  // Defensive id read - mirrors webhook route: data.documentId || data.id || data.paymentId
  const documentId =
    ((data.documentId || data.id || data.paymentId) as string | null | undefined) ?? null;

  // Log correlation id only - never the tokenId or raw payload.
  logger.info('Green Invoice token charge issued', { custom: input.custom });

  return { chargeId, documentId, raw: data };
}
