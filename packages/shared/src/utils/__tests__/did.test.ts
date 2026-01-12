/**
 * DID (Decentralized Identity) Tests
 *
 * Note: These tests require a Web Crypto API implementation.
 * In Node.js, use --experimental-global-webcrypto flag or a polyfill.
 */

import {
  generateDIDKeyPair,
  generateEncryptedDID,
  recoverPrivateKey,
  verifyDID,
  extractDIDHash,
  isValidDID,
  signWithDID,
  verifySignature,
} from '../did';
import type { DIDKeyPair, JWK } from '../did';

// Skip tests if crypto is not available (CI/build environment)
const cryptoAvailable = typeof crypto !== 'undefined' && crypto.subtle;

const describeWithCrypto = cryptoAvailable ? describe : describe.skip;

describeWithCrypto('DID Generation', () => {
  let keyPair: DIDKeyPair;

  beforeAll(async () => {
    keyPair = await generateDIDKeyPair();
  });

  describe('generateDIDKeyPair', () => {
    it('should generate a valid DID', () => {
      expect(keyPair.did).toBeDefined();
      expect(keyPair.did.startsWith('did:sync:')).toBe(true);
    });

    it('should generate a public key in JWK format', () => {
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.publicKey.kty).toBe('EC');
      expect(keyPair.publicKey.crv).toBe('P-256');
      expect(keyPair.publicKey.x).toBeDefined();
      expect(keyPair.publicKey.y).toBeDefined();
      expect(keyPair.publicKey.d).toBeUndefined(); // Public key shouldn't have 'd'
    });

    it('should generate a private key in JWK format', () => {
      expect(keyPair.privateKey).toBeDefined();
      expect(keyPair.privateKey.kty).toBe('EC');
      expect(keyPair.privateKey.crv).toBe('P-256');
      expect(keyPair.privateKey.x).toBeDefined();
      expect(keyPair.privateKey.y).toBeDefined();
      expect(keyPair.privateKey.d).toBeDefined(); // Private key should have 'd'
    });

    it('should include key ID (kid) in both keys', () => {
      expect(keyPair.publicKey.kid).toBe(keyPair.did);
      expect(keyPair.privateKey.kid).toBe(keyPair.did);
    });

    it('should generate unique DIDs', async () => {
      const keyPair2 = await generateDIDKeyPair();
      expect(keyPair2.did).not.toBe(keyPair.did);
    });
  });

  describe('verifyDID', () => {
    it('should verify matching DID and public key', async () => {
      const isValid = await verifyDID(keyPair.did, keyPair.publicKey);
      expect(isValid).toBe(true);
    });

    it('should reject mismatched DID and public key', async () => {
      const otherKeyPair = await generateDIDKeyPair();
      const isValid = await verifyDID(keyPair.did, otherKeyPair.publicKey);
      expect(isValid).toBe(false);
    });
  });
});

describe('DID Format Validation', () => {
  describe('isValidDID', () => {
    it('should validate correctly formatted DID', () => {
      // Base64url characters, 43 chars (256 bits)
      const validDID = 'did:sync:' + 'a'.repeat(43);
      expect(isValidDID(validDID)).toBe(true);
    });

    it('should reject DID with wrong prefix', () => {
      expect(isValidDID('did:other:' + 'a'.repeat(43))).toBe(false);
      expect(isValidDID('invalid:' + 'a'.repeat(43))).toBe(false);
    });

    it('should reject DID with wrong hash length', () => {
      expect(isValidDID('did:sync:' + 'a'.repeat(42))).toBe(false);
      expect(isValidDID('did:sync:' + 'a'.repeat(44))).toBe(false);
    });

    it('should reject DID with invalid characters', () => {
      expect(isValidDID('did:sync:' + 'a'.repeat(42) + '!')).toBe(false);
      expect(isValidDID('did:sync:' + 'a'.repeat(42) + ' ')).toBe(false);
    });
  });

  describe('extractDIDHash', () => {
    it('should extract hash from valid DID', () => {
      const hash = 'abc123XYZ_-'.repeat(4).slice(0, 43);
      const did = `did:sync:${hash}`;
      expect(extractDIDHash(did)).toBe(hash);
    });

    it('should return null for invalid DID', () => {
      expect(extractDIDHash('invalid')).toBeNull();
      expect(extractDIDHash('did:other:hash')).toBeNull();
    });
  });
});

describeWithCrypto('DID Encryption and Recovery', () => {
  const mockOAuthToken = 'mock-oauth-access-token-for-testing-12345';

  it('should encrypt and recover private key', async () => {
    // Generate encrypted DID
    const encrypted = await generateEncryptedDID(mockOAuthToken);

    expect(encrypted.did).toBeDefined();
    expect(encrypted.publicKey).toBeDefined();
    expect(encrypted.encryptedPrivateKey).toBeDefined();
    expect(encrypted.salt).toBeDefined();
    expect(encrypted.iv).toBeDefined();

    // Recover private key
    const recoveredPrivateKey = await recoverPrivateKey(
      mockOAuthToken,
      encrypted.encryptedPrivateKey,
      encrypted.salt,
      encrypted.iv
    );

    // Verify the recovered key is valid by checking it can sign
    const testData = 'test message';
    const signature = await signWithDID(testData, recoveredPrivateKey);
    const isValid = await verifySignature(testData, signature, encrypted.publicKey);
    expect(isValid).toBe(true);
  });

  it('should fail recovery with wrong token', async () => {
    const encrypted = await generateEncryptedDID(mockOAuthToken);
    const wrongToken = 'different-oauth-token';

    await expect(
      recoverPrivateKey(
        wrongToken,
        encrypted.encryptedPrivateKey,
        encrypted.salt,
        encrypted.iv
      )
    ).rejects.toThrow();
  });
});

describeWithCrypto('DID Signing and Verification', () => {
  let keyPair: DIDKeyPair;

  beforeAll(async () => {
    keyPair = await generateDIDKeyPair();
  });

  describe('signWithDID', () => {
    it('should sign data and return base64url signature', async () => {
      const data = 'Hello, World!';
      const signature = await signWithDID(data, keyPair.privateKey);

      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      // Base64url pattern
      expect(signature).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should produce different signatures for different data', async () => {
      const sig1 = await signWithDID('data1', keyPair.privateKey);
      const sig2 = await signWithDID('data2', keyPair.privateKey);

      expect(sig1).not.toBe(sig2);
    });
  });

  describe('verifySignature', () => {
    it('should verify valid signature', async () => {
      const data = 'test message';
      const signature = await signWithDID(data, keyPair.privateKey);
      const isValid = await verifySignature(data, signature, keyPair.publicKey);

      expect(isValid).toBe(true);
    });

    it('should reject signature with wrong data', async () => {
      const signature = await signWithDID('original data', keyPair.privateKey);
      const isValid = await verifySignature('tampered data', signature, keyPair.publicKey);

      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong public key', async () => {
      const data = 'test message';
      const signature = await signWithDID(data, keyPair.privateKey);
      const otherKeyPair = await generateDIDKeyPair();
      const isValid = await verifySignature(data, signature, otherKeyPair.publicKey);

      expect(isValid).toBe(false);
    });
  });
});
