/**
 * Identity Document API Route Tests - /api/verification/document (issue #32).
 *
 * POST submits on-device-extracted fields (never images); GET reads status;
 * DELETE exercises the PPL §14 erasure right.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE, GET, POST } from '@/app/api/verification/document/route';

vi.mock('@/services/auth/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  identityDocumentLimiter: { check: vi.fn() },
  createRateLimitResponse: vi.fn(
    () => new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 })
  ),
}));

vi.mock('@/server/infra/supabase/identity.repo', async () => {
  const { okAsync } = await import('neverthrow');
  return {
    findDocumentByUserId: vi.fn(),
    idHashClaimedByOther: vi.fn(() => okAsync(false)),
    upsertDocument: vi.fn((row: Record<string, unknown>) => okAsync(row)),
    insertDocumentEvent: vi.fn((row: Record<string, unknown>) => okAsync(row)),
    setUserIdentityVerifiedAt: vi.fn(() => okAsync(true)),
    deleteDocumentByUserId: vi.fn(() => okAsync(true)),
  };
});

import { getSessionFromRequest } from '@/services/auth/session';
import { identityDocumentLimiter } from '@/lib/rate-limit';
import {
  deleteDocumentByUserId,
  findDocumentByUserId,
  idHashClaimedByOther,
  insertDocumentEvent,
  setUserIdentityVerifiedAt,
  upsertDocument,
} from '@/server/infra/supabase/identity.repo';
import { okAsync } from 'neverthrow';

const SESSION = {
  userId: 'user-123',
  googleId: 'google-123',
  email: 'test@example.com',
  did: `did:sync:${'a'.repeat(43)}`,
  expiresAt: Date.now() + 86_400_000,
};

const VALID_BODY = {
  documentType: 'id_card',
  idNumber: '123456782',
  firstName: 'דוד',
  lastName: 'כהן',
  dateOfBirth: '1974-04-04',
  documentExpiry: '2031-03-15',
  ocr: { idNumberMatched: true, confidence: 85, fieldsEdited: false },
  face: {
    checked: true,
    docFaceFound: true,
    matchScore: 72,
    livenessPassed: true,
    antispoofScore: 80,
  },
  consentVersion: 'v1',
};

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/verification/document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function bare(method: 'GET' | 'DELETE'): NextRequest {
  return new NextRequest('http://localhost/api/verification/document', { method });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.IDENTITY_HASH_SECRET = 'test-secret';
  (getSessionFromRequest as Mock).mockResolvedValue(SESSION);
  (identityDocumentLimiter.check as Mock).mockResolvedValue({
    limited: false,
    remaining: 4,
    resetIn: 60_000,
  });
  (idHashClaimedByOther as Mock).mockReturnValue(okAsync(false));
  (upsertDocument as Mock).mockImplementation((row: Record<string, unknown>) =>
    okAsync(row)
  );
  (insertDocumentEvent as Mock).mockImplementation((row: Record<string, unknown>) =>
    okAsync(row)
  );
  (setUserIdentityVerifiedAt as Mock).mockReturnValue(okAsync(true));
  (deleteDocumentByUserId as Mock).mockReturnValue(okAsync(true));
});

describe('POST /api/verification/document', () => {
  it('rejects unauthenticated requests', async () => {
    (getSessionFromRequest as Mock).mockResolvedValue(null);
    const res = await POST(post(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    (identityDocumentLimiter.check as Mock).mockResolvedValue({
      limited: true,
      remaining: 0,
      resetIn: 30_000,
    });
    const res = await POST(post(VALID_BODY));
    expect(res.status).toBe(429);
  });

  it('auto-verifies a clean submission and flips the user flag', async () => {
    const res = await POST(post(VALID_BODY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('verified');
    expect(body.idNumberMasked).toBe('•••••••82');
    expect(body.verifiedAt).toBeTruthy();

    const upserted = (upsertDocument as Mock).mock.calls[0][0];
    expect(upserted.id_number_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(upserted.id_number_last2).toBe('82');
    // Cleartext ID number must never reach the repo layer.
    expect(JSON.stringify(upserted)).not.toContain('123456782');
    expect((setUserIdentityVerifiedAt as Mock).mock.calls[0][1]).toBeTruthy();
  });

  it('queues hand-edited submissions for review without verifying the user', async () => {
    const res = await POST(
      post({
        ...VALID_BODY,
        ocr: { ...VALID_BODY.ocr, fieldsEdited: true },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('pending_review');
    expect(body.verifiedAt).toBeNull();
    expect((setUserIdentityVerifiedAt as Mock).mock.calls[0][1]).toBeNull();
    expect((insertDocumentEvent as Mock).mock.calls[0][0].event).toBe('queued_review');
  });

  it('400s a failed checksum before touching the database', async () => {
    const res = await POST(post({ ...VALID_BODY, idNumber: '123456789' }));
    expect(res.status).toBe(400);
    expect(upsertDocument).not.toHaveBeenCalled();
  });

  it('400s an expired document', async () => {
    const res = await POST(post({ ...VALID_BODY, documentExpiry: '2020-01-01' }));
    expect(res.status).toBe(400);
  });

  it('409s when the ID number belongs to another account', async () => {
    (idHashClaimedByOther as Mock).mockReturnValue(okAsync(true));
    const res = await POST(post(VALID_BODY));
    expect(res.status).toBe(409);
    expect(upsertDocument).not.toHaveBeenCalled();
  });

  it('400s malformed bodies', async () => {
    const res = await POST(post({ nope: true }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/verification/document', () => {
  it('returns null when no document exists', async () => {
    (findDocumentByUserId as Mock).mockReturnValue(okAsync(null));
    const res = await GET(bare('GET'));
    expect(res.status).toBe(200);
    expect((await res.json()).document).toBeNull();
  });

  it('returns masked status for an existing document', async () => {
    (findDocumentByUserId as Mock).mockReturnValue(
      okAsync({
        status: 'verified',
        document_type: 'id_card',
        id_number_last2: '82',
        verified_at: '2026-07-27T12:00:00.000Z',
      })
    );
    const res = await GET(bare('GET'));
    const body = await res.json();
    expect(body.document.status).toBe('verified');
    expect(body.document.idNumberMasked).toBe('•••••••82');
  });
});

describe('DELETE /api/verification/document', () => {
  it('erases the document, resets the flag, and audits the deletion', async () => {
    const res = await DELETE(bare('DELETE'));
    expect(res.status).toBe(200);
    expect(deleteDocumentByUserId).toHaveBeenCalledWith('user-123');
    expect((setUserIdentityVerifiedAt as Mock).mock.calls[0][1]).toBeNull();
    expect((insertDocumentEvent as Mock).mock.calls[0][0].event).toBe('deleted');
  });
});
