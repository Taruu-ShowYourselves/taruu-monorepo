/**
 * DID (Decentralized Identity) Generation Utilities
 * Format: did:sync:{hash-of-public-key}
 *
 * SEL-DID does NOT use social data as key entropy (insecure).
 * Instead:
 * 1. Gmail OAuth is the primary authentication factor
 * 2. DID/keypair generated with proper cryptographic randomness
 * 3. Private key encrypted and stored locally, recoverable via OAuth
 * 4. Social accounts provide verification "stamps" for Sybil-resistance
 */

// === Web Crypto Types ===

export interface JWK {
  kty: string;
  crv?: string;
  x?: string;
  y?: string;
  d?: string; // Private key component
  kid?: string;
  use?: string;
  alg?: string;
}

export interface DIDKeyPair {
  did: string;
  publicKey: JWK;
  privateKey: JWK;
}

export interface EncryptedDIDKeyPair {
  did: string;
  publicKey: JWK;
  encryptedPrivateKey: string;
  salt: string;
  iv: string;
}

// === DID Format Constants ===

const DID_METHOD = 'sync';
const DID_PREFIX = `did:${DID_METHOD}:`;

// === Helper Functions ===

/**
 * Convert ArrayBuffer to base64url string
 */
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Convert base64url string to ArrayBuffer
 */
function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Hash a JWK public key to create DID identifier
 */
async function hashPublicKey(publicKey: JWK): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify({ x: publicKey.x, y: publicKey.y }));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return arrayBufferToBase64Url(hashBuffer);
}

/**
 * Derive encryption key from OAuth token
 * Uses PBKDF2 to derive a strong key from the token
 */
async function deriveKeyFromToken(
  oauthToken: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const tokenData = encoder.encode(oauthToken);

  // Import token as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    tokenData,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive AES-GCM key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt private key with derived key
 */
async function encryptPrivateKey(
  privateKey: JWK,
  encryptionKey: CryptoKey,
  iv: Uint8Array
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(privateKey));

  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    encryptionKey,
    data
  );

  return arrayBufferToBase64Url(encryptedData);
}

/**
 * Decrypt private key with derived key
 */
async function decryptPrivateKey(
  encryptedPrivateKey: string,
  encryptionKey: CryptoKey,
  iv: Uint8Array
): Promise<JWK> {
  const encryptedData = base64UrlToArrayBuffer(encryptedPrivateKey);

  const decryptedData = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    encryptionKey,
    encryptedData
  );

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decryptedData));
}

// === Main DID Functions ===

/**
 * Generate a new DID keypair with P-256 ECDSA curve
 * Returns the DID, public key, and private key
 */
export async function generateDIDKeyPair(): Promise<DIDKeyPair> {
  // Generate keypair with proper cryptographic randomness
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true, // extractable - needed to export JWK
    ['sign', 'verify']
  );

  // Export keys as JWK
  const publicKeyJwk = (await crypto.subtle.exportKey('jwk', keyPair.publicKey)) as JWK;
  const privateKeyJwk = (await crypto.subtle.exportKey('jwk', keyPair.privateKey)) as JWK;

  // Generate DID from public key hash
  const publicKeyHash = await hashPublicKey(publicKeyJwk);
  const did = `${DID_PREFIX}${publicKeyHash}`;

  // Add key ID to JWKs
  publicKeyJwk.kid = did;
  privateKeyJwk.kid = did;

  return {
    did,
    publicKey: publicKeyJwk,
    privateKey: privateKeyJwk,
  };
}

/**
 * Generate DID and encrypt private key for storage
 * Uses OAuth token derivative for encryption
 */
export async function generateEncryptedDID(
  oauthToken: string
): Promise<EncryptedDIDKeyPair> {
  // Generate keypair
  const { did, publicKey, privateKey } = await generateDIDKeyPair();

  // Generate random salt and IV for encryption
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Derive encryption key from OAuth token
  const encryptionKey = await deriveKeyFromToken(oauthToken, salt);

  // Encrypt private key
  const encryptedPrivateKey = await encryptPrivateKey(privateKey, encryptionKey, iv);

  return {
    did,
    publicKey,
    encryptedPrivateKey,
    salt: arrayBufferToBase64Url(salt.buffer),
    iv: arrayBufferToBase64Url(iv.buffer),
  };
}

/**
 * Recover private key from encrypted backup using OAuth token
 */
export async function recoverPrivateKey(
  oauthToken: string,
  encryptedPrivateKey: string,
  salt: string,
  iv: string
): Promise<JWK> {
  // Convert base64url to Uint8Array
  const saltBuffer = new Uint8Array(base64UrlToArrayBuffer(salt));
  const ivBuffer = new Uint8Array(base64UrlToArrayBuffer(iv));

  // Derive the same encryption key from OAuth token
  const encryptionKey = await deriveKeyFromToken(oauthToken, saltBuffer);

  // Decrypt private key
  return decryptPrivateKey(encryptedPrivateKey, encryptionKey, ivBuffer);
}

/**
 * Verify a DID matches a public key
 */
export async function verifyDID(did: string, publicKey: JWK): Promise<boolean> {
  const expectedHash = await hashPublicKey(publicKey);
  const expectedDID = `${DID_PREFIX}${expectedHash}`;
  return did === expectedDID;
}

/**
 * Extract the hash portion from a DID
 */
export function extractDIDHash(did: string): string | null {
  if (!did.startsWith(DID_PREFIX)) {
    return null;
  }
  return did.slice(DID_PREFIX.length);
}

/**
 * Validate DID format
 */
export function isValidDID(did: string): boolean {
  if (!did.startsWith(DID_PREFIX)) {
    return false;
  }
  const hash = did.slice(DID_PREFIX.length);
  // Base64url hash should be 43 characters (256 bits)
  return /^[A-Za-z0-9_-]{43}$/.test(hash);
}

/**
 * Sign data with private key
 * Returns signature as base64url string
 */
export async function signWithDID(
  data: string,
  privateKeyJwk: JWK
): Promise<string> {
  // Import private key
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  // Sign data
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encoder.encode(data)
  );

  return arrayBufferToBase64Url(signature);
}

/**
 * Verify signature with public key
 */
export async function verifySignature(
  data: string,
  signature: string,
  publicKeyJwk: JWK
): Promise<boolean> {
  // Import public key
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    publicKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );

  // Verify signature
  const encoder = new TextEncoder();
  const signatureBuffer = base64UrlToArrayBuffer(signature);

  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    signatureBuffer,
    encoder.encode(data)
  );
}
