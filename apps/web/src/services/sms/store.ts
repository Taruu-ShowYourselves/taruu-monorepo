/**
 * OTP store - keyed, TTL'd storage for one-time codes.
 *
 * Primary backend is Cloudflare Workers KV (bound as `OTP_KV`), the idiomatic
 * primitive for short-lived keyed state: native per-key TTL, globally available
 * from the Worker. When no KV binding is present (next dev without the binding,
 * or Node unit tests) it falls back to a per-isolate in-memory map with manual
 * expiry, so the flow stays testable without infrastructure.
 *
 * Codes are never stored in plaintext - only a SHA-256 hash (see otp.ts).
 */

/** Minimal KV surface we use - avoids @cloudflare/workers-types (clashes with the Next DOM lib). */
interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface OtpRecord {
  /** SHA-256 hex of the issued code. */
  codeHash: string;
  /** Failed check attempts so far. */
  attempts: number;
  /** Epoch ms the code was issued (for remaining-TTL math on re-write). */
  createdAt: number;
}

export interface OtpStore {
  set(phone: string, record: OtpRecord, ttlSeconds: number): Promise<void>;
  get(phone: string): Promise<OtpRecord | null>;
  delete(phone: string): Promise<void>;
}

const PREFIX = 'otp:';

function kvStore(kv: KvLike): OtpStore {
  return {
    async set(phone, record, ttlSeconds) {
      await kv.put(PREFIX + phone, JSON.stringify(record), { expirationTtl: ttlSeconds });
    },
    async get(phone) {
      const raw = await kv.get(PREFIX + phone);
      return raw ? (JSON.parse(raw) as OtpRecord) : null;
    },
    async delete(phone) {
      await kv.delete(PREFIX + phone);
    },
  };
}

// Per-isolate fallback. Not shared across instances - fine for dev/test only.
const memory = new Map<string, { record: OtpRecord; expiresAt: number }>();

function memoryStore(): OtpStore {
  return {
    async set(phone, record, ttlSeconds) {
      memory.set(PREFIX + phone, { record, expiresAt: Date.now() + ttlSeconds * 1000 });
    },
    async get(phone) {
      const entry = memory.get(PREFIX + phone);
      if (!entry) return null;
      if (entry.expiresAt < Date.now()) {
        memory.delete(PREFIX + phone);
        return null;
      }
      return entry.record;
    },
    async delete(phone) {
      memory.delete(PREFIX + phone);
    },
  };
}

/**
 * Resolve the active store: Workers KV when the `OTP_KV` binding is available
 * via the OpenNext Cloudflare context, otherwise the in-memory fallback.
 */
export async function getOtpStore(): Promise<OtpStore> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const env = getCloudflareContext().env as { OTP_KV?: KvLike };
    if (env?.OTP_KV) return kvStore(env.OTP_KV);
  } catch {
    // No Cloudflare context (next dev without binding / Node test) - fall through.
  }
  return memoryStore();
}
