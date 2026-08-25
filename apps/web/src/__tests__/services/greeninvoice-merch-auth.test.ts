import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const ORIGINAL_ENV = {
  GREENINVOICE_API_KEY_ID: process.env.GREENINVOICE_API_KEY_ID,
  GREENINVOICE_API_SECRET: process.env.GREENINVOICE_API_SECRET,
  GREENINVOICE_ENV: process.env.GREENINVOICE_ENV,
};

async function loadService() {
  vi.resetModules();
  process.env.GREENINVOICE_API_KEY_ID = 'key-id';
  process.env.GREENINVOICE_API_SECRET = 'key-secret';
  process.env.GREENINVOICE_ENV = 'sandbox';
  return import('@/services/greenInvoice');
}

function mockGreenInvoice(documentBody: Record<string, unknown>, documentOk = true) {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'X-Authorization-Bearer': 'jwt-token' }),
      json: async () => ({}),
    })
    .mockResolvedValueOnce({
      ok: documentOk,
      json: async () => documentBody,
    });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('Green Invoice merch document confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    process.env.GREENINVOICE_API_KEY_ID = ORIGINAL_ENV.GREENINVOICE_API_KEY_ID;
    process.env.GREENINVOICE_API_SECRET = ORIGINAL_ENV.GREENINVOICE_API_SECRET;
    process.env.GREENINVOICE_ENV = ORIGINAL_ENV.GREENINVOICE_ENV;
    vi.unstubAllGlobals();
  });

  it('confirms a document whose provider record correlates to the order and amount', async () => {
    mockGreenInvoice({
      id: 'doc-1',
      sum: 99,
      metadata: { custom: 'order-1' },
    });
    const { confirmMerchDocumentForOrder } = await loadService();

    await expect(
      confirmMerchDocumentForOrder('doc-1', { orderId: 'order-1', totalILS: 99 })
    ).resolves.toBe(true);
  });

  it('rejects a real document that belongs to a different order', async () => {
    mockGreenInvoice({
      id: 'doc-1',
      sum: 99,
      custom: 'other-order',
    });
    const { confirmMerchDocumentForOrder } = await loadService();

    await expect(
      confirmMerchDocumentForOrder('doc-1', { orderId: 'order-1', totalILS: 99 })
    ).resolves.toBe(false);
  });

  it('rejects a correlated document when Green Invoice exposes a mismatched total', async () => {
    mockGreenInvoice({
      id: 'doc-1',
      sum: 12,
      custom: 'order-1',
    });
    const { confirmMerchDocumentForOrder } = await loadService();

    await expect(
      confirmMerchDocumentForOrder('doc-1', { orderId: 'order-1', totalILS: 99 })
    ).resolves.toBe(false);
  });

  it('fails closed when Green Invoice cannot vouch for the document', async () => {
    mockGreenInvoice({}, false);
    const { confirmMerchDocumentForOrder } = await loadService();

    await expect(
      confirmMerchDocumentForOrder('doc-1', { orderId: 'order-1', totalILS: 99 })
    ).resolves.toBe(false);
  });
});
