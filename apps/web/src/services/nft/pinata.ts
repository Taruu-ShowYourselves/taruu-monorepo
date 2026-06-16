/**
 * Pinata IPFS pinning for NFT metadata.
 *
 * Pins the Metaplex metadata JSON to IPFS and returns an `ipfs://<cid>` URI for
 * the on-chain `metadata_uri`. Configured via PINATA_JWT; when unconfigured the
 * caller skips minting (the record stays pending) rather than minting with a
 * placeholder URI.
 */

import type { NftMetadata } from '@sync/shared';

const PIN_JSON_ENDPOINT = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

/** True when a Pinata JWT is configured. */
export function isPinataConfigured(): boolean {
  return Boolean(process.env.PINATA_JWT);
}

/**
 * Pin a metadata JSON object to IPFS and return its `ipfs://<cid>` URI.
 * @throws if Pinata is unconfigured or the pin request fails.
 */
export async function pinMetadata(metadata: NftMetadata, name: string): Promise<string> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error('Pinata is not configured');

  const res = await fetch(PIN_JSON_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: { name },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Pinata pin failed ${res.status}: ${detail}`);
  }

  const data = (await res.json()) as { IpfsHash?: string };
  if (!data.IpfsHash) throw new Error('Pinata returned no IpfsHash');
  return `ipfs://${data.IpfsHash}`;
}
