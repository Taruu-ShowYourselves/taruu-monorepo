/**
 * Solana compressed-NFT minter (Metaplex Bubblegum).
 *
 * Mints commemorative certificates as compressed NFTs to an existing merkle
 * tree, signed by the master keypair. RPC is Helius (also serves the DAS API for
 * reads). Helius's old `mintCompressedNft` REST endpoint is deprecated, so we
 * mint with Bubblegum directly.
 *
 * Config (all required to mint; otherwise the caller skips and leaves records
 * pending):
 *   SOLANA_RPC_URL                  Helius mainnet RPC (?api-key=...)
 *   SOLANA_MERKLE_TREE              the Bubblegum tree to mint into
 *   BAGS_MASTER_WALLET_PRIVATE_KEY  tree authority / minter (base58 or JSON array)
 */

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { keypairIdentity, publicKey, none, type Umi } from '@metaplex-foundation/umi';
import { base58 } from '@metaplex-foundation/umi/serializers';
import {
  mplBubblegum,
  mintV1,
  parseLeafFromMintV1Transaction,
  findLeafAssetIdPda,
} from '@metaplex-foundation/mpl-bubblegum';

function readConfig() {
  return {
    rpcUrl: process.env.SOLANA_RPC_URL,
    secretKey: process.env.BAGS_MASTER_WALLET_PRIVATE_KEY,
    merkleTree: process.env.SOLANA_MERKLE_TREE,
  };
}

/** True when RPC + tree + minter key are all present. */
export function isSolanaMintConfigured(): boolean {
  const { rpcUrl, secretKey, merkleTree } = readConfig();
  return Boolean(rpcUrl && secretKey && merkleTree);
}

/** Decode a secret key given as a base58 string or a JSON byte array. */
function decodeSecretKey(raw: string): Uint8Array {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) return Uint8Array.from(JSON.parse(trimmed) as number[]);
  return base58.serialize(trimmed);
}

let umiSingleton: Umi | null = null;

function getUmi(): Umi {
  if (umiSingleton) return umiSingleton;
  const { rpcUrl, secretKey } = readConfig();
  if (!rpcUrl || !secretKey) throw new Error('Solana mint is not configured');
  const umi = createUmi(rpcUrl).use(mplBubblegum());
  const keypair = umi.eddsa.createKeypairFromSecretKey(decodeSecretKey(secretKey));
  umi.use(keypairIdentity(keypair));
  umiSingleton = umi;
  return umi;
}

export interface CompressedMintResult {
  /** The compressed-NFT asset id (DAS-queryable). */
  assetId: string;
  /** The mint transaction signature (base58). */
  signature: string;
}

/**
 * Mint one compressed NFT to `recipient`, pointing at `metadataUri`.
 * @throws if unconfigured, the recipient is invalid, or the mint fails.
 */
export async function mintCompressedNft(params: {
  recipient: string;
  name: string;
  metadataUri: string;
}): Promise<CompressedMintResult> {
  const { merkleTree } = readConfig();
  if (!merkleTree) throw new Error('SOLANA_MERKLE_TREE is not configured');

  const umi = getUmi();
  const tree = publicKey(merkleTree);

  const { signature } = await mintV1(umi, {
    leafOwner: publicKey(params.recipient),
    merkleTree: tree,
    metadata: {
      name: params.name,
      uri: params.metadataUri,
      sellerFeeBasisPoints: 0,
      collection: none(),
      creators: [],
    },
  }).sendAndConfirm(umi);

  const leaf = await parseLeafFromMintV1Transaction(umi, signature);
  const [assetId] = findLeafAssetIdPda(umi, { merkleTree: tree, leafIndex: leaf.nonce });

  return {
    assetId: assetId.toString(),
    signature: base58.deserialize(signature)[0],
  };
}
