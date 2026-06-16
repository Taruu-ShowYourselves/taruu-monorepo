/**
 * Pinata IPFS service tests — pins NFT metadata JSON, returns ipfs:// URI.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NftMetadata } from '@sync/shared';

const METADATA: NftMetadata = {
  name: 'Taruu Verified Voter: Test',
  symbol: 'TARUU',
  description: 'commemorative',
  image: 'https://taruu.co.il/images/certificates/verified_voter.png',
  external_url: 'https://taruu.co.il/votes/v1',
  attributes: [],
};

describe('Pinata IPFS service', () => {
  const ORIGINAL = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env.PINATA_JWT = 'jwt-token';
  });
  afterEach(() => {
    process.env = { ...ORIGINAL };
    vi.unstubAllGlobals();
  });

  it('reports configured only when PINATA_JWT is set', async () => {
    const { isPinataConfigured } = await import('@/services/nft/pinata');
    expect(isPinataConfigured()).toBe(true);
    delete process.env.PINATA_JWT;
    vi.resetModules();
    const reload = await import('@/services/nft/pinata');
    expect(reload.isPinataConfigured()).toBe(false);
  });

  it('pins JSON and returns an ipfs:// URI', async () => {
    let captured: { url: string; body: string; auth: string } | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: { body: string; headers: Record<string, string> }) => {
        captured = { url, body: init.body, auth: init.headers.authorization };
        return { ok: true, json: async () => ({ IpfsHash: 'Qm123abc' }) } as unknown as Response;
      })
    );
    const { pinMetadata } = await import('@/services/nft/pinata');
    const uri = await pinMetadata(METADATA, METADATA.name);
    expect(uri).toBe('ipfs://Qm123abc');
    expect(captured!.auth).toBe('Bearer jwt-token');
    expect(JSON.parse(captured!.body).pinataContent.name).toBe(METADATA.name);
  });

  it('throws when unconfigured', async () => {
    delete process.env.PINATA_JWT;
    vi.resetModules();
    const { pinMetadata } = await import('@/services/nft/pinata');
    await expect(pinMetadata(METADATA, 'x')).rejects.toThrow(/not configured/);
  });

  it('throws on a non-OK Pinata response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 401, text: async () => 'bad jwt' }) as unknown as Response)
    );
    const { pinMetadata } = await import('@/services/nft/pinata');
    await expect(pinMetadata(METADATA, 'x')).rejects.toThrow(/Pinata pin failed 401/);
  });

  it('throws when no IpfsHash is returned', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({}) }) as unknown as Response)
    );
    const { pinMetadata } = await import('@/services/nft/pinata');
    await expect(pinMetadata(METADATA, 'x')).rejects.toThrow(/no IpfsHash/);
  });
});
