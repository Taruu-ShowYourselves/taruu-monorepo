/**
 * Enrollment start + confirm (engineering model §5.3).
 *
 * The crypto path is REAL - secrets are encrypted with the real AES-GCM
 * module and codes computed with the real RFC 6238 implementation under a
 * stubbed AUTH_MASTER_KEY. Only the DB layer, events writer, and mailer are
 * mocked; the atomic activation itself is the DB's job and is proven in
 * supabase/tests/security_mfa.sql.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/auth/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/auth/session')>()),
  getSessionFromRequest: vi.fn(),
}));

vi.mock('@/lib/supabase/mfa', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/mfa')>()),
  getActiveFactor: vi.fn(),
  getPendingFactor: vi.fn(),
  deleteStalePendingFactor: vi.fn(),
  deletePendingFactor: vi.fn(),
  insertPendingFactor: vi.fn(),
  incrementConfirmAttempts: vi.fn(),
  activateFactor: vi.fn(),
}));

vi.mock('@/server/infra/supabase/security-events.repo', () => ({
  recordSecurityEvent: vi.fn(async () => true),
  countSecurityEventsSince: vi.fn(async () => 0),
}));

vi.mock('@/services/email/security', () => ({
  sendMfaEnabledEmail: vi.fn(async () => true),
}));

vi.mock('@/lib/supabase/db', () => ({
  getUserById: vi.fn(async () => ({ id: 'user-123', email: 'u@example.com', first_name: 'U' })),
}));

import { getSessionFromRequest } from '@/services/auth/session';
import {
  getActiveFactor,
  getPendingFactor,
  insertPendingFactor,
  deletePendingFactor,
  incrementConfirmAttempts,
  activateFactor,
} from '@/lib/supabase/mfa';
import {
  recordSecurityEvent,
  countSecurityEventsSince,
} from '@/server/infra/supabase/security-events.repo';
import { encryptTotpSecret, bytesToPgHex } from '@/services/auth/mfa-secret';
import { totpCodeForStep, totpStep } from '@/services/auth/totp';
import { resetDerivedKeyCache } from '@/services/auth/keys';

const SESSION = { userId: 'user-123', email: 'u@example.com', googleId: 'g', did: '', sv: 1, amr: ['google'], asr: 'sf' as const, expiresAt: new Date() };

function req(body?: unknown) {
  return new NextRequest('http://localhost:3000/api/security/mfa/enroll', {
    method: 'POST',
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }
      : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv('AUTH_MASTER_KEY', 'test-master-key-of-sufficient-length-123456');
  vi.stubEnv('MFA_ENROLLMENT_ENABLED', 'true');
  resetDerivedKeyCache();
  (getSessionFromRequest as Mock).mockResolvedValue(SESSION);
  (countSecurityEventsSince as Mock).mockResolvedValue(0);
  // deletePendingFactor now reports success/failure; default to success.
  (deletePendingFactor as Mock).mockResolvedValue(true);
});

describe('POST /api/security/mfa/enroll', () => {
  async function loadRoute() {
    return (await import('@/app/api/security/mfa/enroll/route')).POST;
  }

  it('404s when the enrollment flag is off - default state', async () => {
    vi.stubEnv('MFA_ENROLLMENT_ENABLED', '');
    const POST = await loadRoute();
    expect((await POST(req())).status).toBe(404);
  });

  it('401s without a session', async () => {
    (getSessionFromRequest as Mock).mockResolvedValue(null);
    const POST = await loadRoute();
    expect((await POST(req())).status).toBe(401);
  });

  it('409s when a factor is already active - disable first', async () => {
    (getActiveFactor as Mock).mockResolvedValue({ id: 'f1', status: 'active' });
    const POST = await loadRoute();
    const res = await POST(req());
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('ALREADY_ENROLLED');
  });

  it('429s at the durable start ceiling, and when the counter is unreadable (fail closed)', async () => {
    (getActiveFactor as Mock).mockResolvedValue(null);
    const POST = await loadRoute();

    (countSecurityEventsSince as Mock).mockResolvedValue(5);
    expect((await POST(req())).status).toBe(429);

    (countSecurityEventsSince as Mock).mockResolvedValue(null);
    expect((await POST(req())).status).toBe(429);
  });

  it('500s when the pending-row delete fails - never inserts over a live row', async () => {
    (getActiveFactor as Mock).mockResolvedValue(null);
    (deletePendingFactor as Mock).mockResolvedValue(false);
    const POST = await loadRoute();

    const res = await POST(req());

    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe('ENROLLMENT_FAILED');
    expect(insertPendingFactor).not.toHaveBeenCalled();
  });

  it('replaces any pending row and answers ONCE with the otpauth URI + secret', async () => {
    (getActiveFactor as Mock).mockResolvedValue(null);
    (insertPendingFactor as Mock).mockImplementation(async (row) => row);
    const POST = await loadRoute();

    const res = await POST(req());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(deletePendingFactor).toHaveBeenCalledWith('user-123');
    expect(data.otpauthUri).toMatch(/^otpauth:\/\/totp\/Taruu%3Au%40example\.com\?secret=/);
    expect(data.otpauthUri).toContain('algorithm=SHA1');
    expect(data.otpauthUri).toContain('digits=6');
    expect(data.otpauthUri).toContain('period=30');
    expect(data.secret).toMatch(/^[A-Z2-7]{32}$/); // 20 bytes -> 32 base32 chars
    expect(recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'mfa_enrollment_started' })
    );
    // The stored blob is ciphertext, never the raw secret.
    const stored = (insertPendingFactor as Mock).mock.calls[0][0];
    expect(stored.secret_enc.startsWith('\\x')).toBe(true);
  });
});

describe('POST /api/security/mfa/enroll/confirm', () => {
  async function loadRoute() {
    return (await import('@/app/api/security/mfa/enroll/confirm/route')).POST;
  }

  const FACTOR_ID = '22222222-2222-4222-8222-222222222222';
  const secret = new Uint8Array(20).fill(7);

  async function pendingRow(createdAgoMs = 0) {
    const blob = await encryptTotpSecret(secret, 'user-123', FACTOR_ID);
    return {
      id: FACTOR_ID,
      user_id: 'user-123',
      status: 'pending',
      secret_enc: bytesToPgHex(blob),
      confirm_attempts: 0,
      created_at: new Date(Date.now() - createdAgoMs).toISOString(),
    };
  }

  it('404s with no enrollment in progress', async () => {
    (getPendingFactor as Mock).mockResolvedValue(null);
    const POST = await loadRoute();
    const res = await POST(req({ code: '123456' }));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe('NO_PENDING_ENROLLMENT');
  });

  it('treats a stale pending row (>15 min) as absent and deletes it', async () => {
    (getPendingFactor as Mock).mockResolvedValue(await pendingRow(16 * 60 * 1000));
    const POST = await loadRoute();
    const res = await POST(req({ code: '123456' }));
    expect(res.status).toBe(404);
    expect(deletePendingFactor).toHaveBeenCalledWith('user-123');
  });

  it('counts a wrong code and stays generic', async () => {
    (getPendingFactor as Mock).mockResolvedValue(await pendingRow());
    (incrementConfirmAttempts as Mock).mockResolvedValue(1);
    const POST = await loadRoute();

    const res = await POST(req({ code: '000000' }));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.code).toBe('INVALID_CODE');
    expect(incrementConfirmAttempts).toHaveBeenCalled();
    expect(activateFactor).not.toHaveBeenCalled();
  });

  it('deletes the pending row at the 5th failure and demands a restart', async () => {
    (getPendingFactor as Mock).mockResolvedValue(await pendingRow());
    (incrementConfirmAttempts as Mock).mockResolvedValue(5);
    const POST = await loadRoute();

    const res = await POST(req({ code: '000000' }));

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('ENROLLMENT_RESTART_REQUIRED');
    expect(deletePendingFactor).toHaveBeenCalledWith('user-123');
    expect(recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'mfa_enrollment_failed' })
    );
  });

  it('activates atomically on a correct code and returns the codes ONCE', async () => {
    (getPendingFactor as Mock).mockResolvedValue(await pendingRow());
    (activateFactor as Mock).mockResolvedValue(true);
    const POST = await loadRoute();

    const code = await totpCodeForStep(secret, totpStep());
    const res = await POST(req({ code }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.recoveryCodes).toHaveLength(10);
    for (const rc of data.recoveryCodes) {
      expect(rc).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    }
    // The DB transaction received hashes, never plaintext codes.
    const [, , step, , hashes] = (activateFactor as Mock).mock.calls[0];
    expect(typeof step).toBe('number');
    for (const h of hashes) expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'mfa_enrollment_confirmed' })
    );
    expect(recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'recovery_codes_regenerated' })
    );
  });

  it('treats a lost activation race as a restart, not a success', async () => {
    (getPendingFactor as Mock).mockResolvedValue(await pendingRow());
    (activateFactor as Mock).mockResolvedValue(false);
    const POST = await loadRoute();

    const code = await totpCodeForStep(secret, totpStep());
    const res = await POST(req({ code }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('ENROLLMENT_RESTART_REQUIRED');
  });
});
