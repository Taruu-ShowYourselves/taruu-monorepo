/**
 * MFA login-challenge verification - the §6.4c case table's challenge rows
 * (cases 4-9) as route tests. The pending row is the authority: every branch
 * below manipulates row state, and a valid locator JWT alone never mints.
 * Concurrency (exactly-one-winner) is the DB's conditional UPDATE, proven in
 * supabase/tests/security_mfa.sql; here the "loser" path is exercised by a
 * consume that reports no win.
 *
 * The TOTP path is REAL crypto: the factor row carries a real AES-GCM blob
 * and codes are computed with the real RFC 6238 module.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

// In-memory cookie jar for next/headers - the route reads the pending cookie
// and clears it; session cookies are set through the mocked session service.
const cookieJar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined,
    set: (name: string, value: string) => void cookieJar.set(name, value),
    delete: (name: string) => void cookieJar.delete(name),
  }),
}));

vi.mock('@/services/auth/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/auth/session')>()),
  createSessionToken: vi.fn(async () => 'mf-session'),
  createRefreshToken: vi.fn(async () => 'mf-refresh'),
  setSessionCookies: vi.fn(),
}));

vi.mock('@/lib/supabase/mfa', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/mfa')>()),
  getPendingToken: vi.fn(),
  consumePendingToken: vi.fn(),
  recordPendingAttempt: vi.fn(),
  getActiveFactor: vi.fn(),
  acceptTotpStep: vi.fn(),
  consumeRecoveryCode: vi.fn(),
  countUnusedRecoveryCodes: vi.fn(async () => 7),
}));

vi.mock('@/server/infra/supabase/security-events.repo', () => ({
  recordSecurityEvent: vi.fn(async () => true),
  countSecurityEventsSince: vi.fn(async () => 0),
}));

vi.mock('@/services/email/security', () => ({
  sendRecoveryCodeUsedEmail: vi.fn(async () => true),
}));

vi.mock('@/lib/supabase/db', () => ({
  getUserById: vi.fn(async () => ({
    id: 'user-123',
    email: 'u@example.com',
    first_name: 'U',
    google_id: 'g-1',
    did: 'did:sync:x',
    session_version: 2,
  })),
  getSocialProofsByUserId: vi.fn(async () => []),
}));

vi.mock('@/services/qubik', () => ({
  qubikService: { getTokenBalance: vi.fn(async () => 0), createWallet: vi.fn() },
}));

import {
  getPendingToken,
  consumePendingToken,
  recordPendingAttempt,
  getActiveFactor,
  acceptTotpStep,
  consumeRecoveryCode,
} from '@/lib/supabase/mfa';
import { createSessionToken, createRefreshToken } from '@/services/auth/session';
import {
  recordSecurityEvent,
  countSecurityEventsSince,
} from '@/server/infra/supabase/security-events.repo';
import { sendRecoveryCodeUsedEmail } from '@/services/email/security';
import { resetDerivedKeyCache } from '@/services/auth/keys';
import { signPurposeToken } from '@/services/auth/tokens';
import { encryptTotpSecret, bytesToPgHex } from '@/services/auth/mfa-secret';
import { totpCodeForStep, totpStep } from '@/services/auth/totp';
import { hashRecoveryCode } from '@/services/auth/recovery-codes';

const USER_ID = 'user-123';
const ROW_ID = '33333333-3333-4333-8333-333333333333';
const FACTOR_ID = '22222222-2222-4222-8222-222222222222';
const secret = new Uint8Array(20).fill(9);

function liveRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ROW_ID,
    user_id: USER_ID,
    expires_at: new Date(Date.now() + 300_000).toISOString(),
    consumed_at: null,
    attempt_count: 0,
    ...overrides,
  };
}

async function factorRow() {
  const blob = await encryptTotpSecret(secret, USER_ID, FACTOR_ID);
  return { id: FACTOR_ID, user_id: USER_ID, status: 'active', secret_enc: bytesToPgHex(blob) };
}

async function pendingJwt(userId = USER_ID, rowId = ROW_ID) {
  return signPurposeToken('mfa_pending', { userId, jti_row: rowId }, 300);
}

function verifyReq(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/auth/mfa/verify', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

async function loadRoute() {
  return (await import('@/app/api/auth/mfa/verify/route')).POST;
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  cookieJar.clear();
  vi.stubEnv('AUTH_MASTER_KEY', 'test-master-key-of-sufficient-length-123456');
  resetDerivedKeyCache();
  (countSecurityEventsSince as Mock).mockResolvedValue(0);
  (getActiveFactor as Mock).mockResolvedValue(await factorRow());
  cookieJar.set('sync-mfa-pending', await pendingJwt());
});

describe('POST /api/auth/mfa/verify', () => {
  it('401s with no pending challenge anywhere', async () => {
    cookieJar.clear();
    const POST = await loadRoute();
    const res = await POST(verifyReq({ code: '123456' }));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('NO_PENDING_CHALLENGE');
  });

  it('refuses a valid JWT whose row is missing - the row is the authority', async () => {
    (getPendingToken as Mock).mockResolvedValue(null);
    const POST = await loadRoute();
    const res = await POST(verifyReq({ code: '123456' }));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('INVALID_CHALLENGE');
    expect(consumePendingToken).not.toHaveBeenCalled();
  });

  it('case 8: a consumed row is a replay - 401 + event', async () => {
    (getPendingToken as Mock).mockResolvedValue(liveRow({ consumed_at: new Date().toISOString() }));
    const POST = await loadRoute();
    const res = await POST(verifyReq({ code: '123456' }));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('CHALLENGE_REPLAYED');
    expect(recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'mfa_challenge_replayed' })
    );
  });

  it('case 7: an expired row - 401 CHALLENGE_EXPIRED + event, restart login', async () => {
    (getPendingToken as Mock).mockResolvedValue(
      liveRow({ expires_at: new Date(Date.now() - 1000).toISOString() })
    );
    const POST = await loadRoute();
    const res = await POST(verifyReq({ code: '123456' }));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('CHALLENGE_EXPIRED');
    expect(recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'mfa_challenge_expired' })
    );
  });

  it('case 5 at the ceiling: an attempt-exhausted row can never be consumed', async () => {
    (getPendingToken as Mock).mockResolvedValue(liveRow({ attempt_count: 5 }));
    const POST = await loadRoute();
    const res = await POST(verifyReq({ code: '123456' }));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('CHALLENGE_EXHAUSTED');
  });

  it('case 5: a wrong TOTP counts durably and stays generic', async () => {
    (getPendingToken as Mock).mockResolvedValue(liveRow());
    (recordPendingAttempt as Mock).mockResolvedValue(2);
    const POST = await loadRoute();

    const res = await POST(verifyReq({ code: '000000' }));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.code).toBe('INVALID_CODE');
    expect(data.attemptsRemaining).toBe(3);
    expect(recordPendingAttempt).toHaveBeenCalledWith(ROW_ID, USER_ID);
    expect(recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'totp_verification_failure' })
    );
    expect(consumePendingToken).not.toHaveBeenCalled();
  });

  it('case 4: correct TOTP mints mf ["google","totp"] with the stored sv', async () => {
    (getPendingToken as Mock).mockResolvedValue(liveRow());
    (acceptTotpStep as Mock).mockResolvedValue(true);
    (consumePendingToken as Mock).mockResolvedValue(true);
    const POST = await loadRoute();

    const code = await totpCodeForStep(secret, totpStep());
    const res = await POST(verifyReq({ code }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.accessToken).toBe('mf-session');
    expect(data.sessionToken).toBe('mf-session');
    expect(createSessionToken).toHaveBeenCalledWith(
      expect.objectContaining({ sv: 2, amr: ['google', 'totp'], asr: 'mf' })
    );
    expect(createRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({ sv: 2, amr: ['google', 'totp'], asr: 'mf' })
    );
    // Pending cookie cleared; code accepted through the DB step guard.
    expect(cookieJar.has('sync-mfa-pending')).toBe(false);
    expect(acceptTotpStep).toHaveBeenCalled();
    expect(recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'totp_verification_success' })
    );
  });

  it('case 9: a step the DB guard refuses is a failure even with a correct code', async () => {
    (getPendingToken as Mock).mockResolvedValue(liveRow());
    (acceptTotpStep as Mock).mockResolvedValue(false); // replay / concurrent winner
    (recordPendingAttempt as Mock).mockResolvedValue(1);
    const POST = await loadRoute();

    const code = await totpCodeForStep(secret, totpStep());
    const res = await POST(verifyReq({ code }));

    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('INVALID_CODE');
    expect(consumePendingToken).not.toHaveBeenCalled();
  });

  it('the concurrent-consume loser gets CHALLENGE_REPLAYED, never a session', async () => {
    (getPendingToken as Mock).mockResolvedValue(liveRow());
    (acceptTotpStep as Mock).mockResolvedValue(true);
    (consumePendingToken as Mock).mockResolvedValue(false); // other request won
    const POST = await loadRoute();

    const code = await totpCodeForStep(secret, totpStep());
    const res = await POST(verifyReq({ code }));

    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('CHALLENGE_REPLAYED');
    expect(createSessionToken).not.toHaveBeenCalled();
  });

  it('case 6: a recovery code mints mf ["google","recovery"] with banner+email consequences', async () => {
    (getPendingToken as Mock).mockResolvedValue(liveRow());
    (consumeRecoveryCode as Mock).mockResolvedValue(true);
    (consumePendingToken as Mock).mockResolvedValue(true);
    const POST = await loadRoute();

    const res = await POST(verifyReq({ code: 'AB12-CD34-EF56-GH78' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(createSessionToken).toHaveBeenCalledWith(
      expect.objectContaining({ amr: ['google', 'recovery'], asr: 'mf' })
    );
    // The spend went through the atomic RPC with a hash, never plaintext.
    expect(consumeRecoveryCode).toHaveBeenCalledWith(
      USER_ID,
      await hashRecoveryCode('AB12-CD34-EF56-GH78')
    );
    expect(recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'recovery_code_used' })
    );
    expect(sendRecoveryCodeUsedEmail).toHaveBeenCalled();
    expect(data.success).toBe(true);
  });

  it('enforces the durable account-hour failure ceilings (fail closed on unreadable count)', async () => {
    (getPendingToken as Mock).mockResolvedValue(liveRow());
    const POST = await loadRoute();

    (countSecurityEventsSince as Mock).mockResolvedValue(20);
    expect((await POST(verifyReq({ code: '123456' }))).status).toBe(429);

    (countSecurityEventsSince as Mock).mockResolvedValue(null);
    expect((await POST(verifyReq({ code: '123456' }))).status).toBe(429);
  });

  it('refuses a locator bound to a different user than the row', async () => {
    (getPendingToken as Mock).mockResolvedValue(liveRow({ user_id: 'someone-else' }));
    const POST = await loadRoute();
    const res = await POST(verifyReq({ code: '123456' }));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('INVALID_CHALLENGE');
  });
});
