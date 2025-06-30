const fs = require('fs/promises');
const crypto = require('crypto');
const PackageSigning = require('../../lib/packageSigning');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

// Mock dependencies
jest.mock('fs/promises');
jest.mock('crypto');
jest.mock('child_process', () => ({ exec: jest.fn() }));
jest.mock('util', () => ({
  promisify: jest.fn()
}));

describe('PackageSigning', () => {
  let signing;
  let mockCryptoHash;
  let mockExecAsync;

  beforeEach(() => {
    // Create mock crypto hash
    mockCryptoHash = {
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('mock-hash')
    };
    // Create mock execAsync
    mockExecAsync = jest.fn();
    // Mock crypto.createHash before requiring the module
    crypto.createHash.mockReturnValue(mockCryptoHash);
    // Reset modules and require the package signing module
    jest.clearAllMocks();
    // Create instance with mockExecAsync
    signing = new PackageSigning(mockExecAsync);
    // Re-setup crypto mock after module reset
    crypto.createHash.mockReturnValue(mockCryptoHash);
  });

  describe('constructor', () => {
    it('initializes with trustedKeys and verificationEnabled', () => {
      expect(signing.trustedKeys).toBeInstanceOf(Set);
      expect(typeof signing.verificationEnabled).toBe('boolean');
    });

    it('enables verification when environment variable is set', () => {
      const originalEnv = process.env.BLAZE_VERIFY_SIGNATURES;
      process.env.BLAZE_VERIFY_SIGNATURES = 'true';
      
      const signingModule = require('../../lib/packageSigning');
      const signing = new signingModule();
      expect(signing.verificationEnabled).toBe(true);
      
      process.env.BLAZE_VERIFY_SIGNATURES = originalEnv;
    });
  });

  describe('loadTrustedKeys', () => {
    it('loads keys from env', async () => {
      const originalEnv = process.env.BLAZE_TRUSTED_KEYS;
      process.env.BLAZE_TRUSTED_KEYS = 'key1,key2';
      const s = new PackageSigning();
      await s.loadTrustedKeys();
      expect(s.trustedKeys.has('key1')).toBe(true);
      expect(s.trustedKeys.has('key2')).toBe(true);
      process.env.BLAZE_TRUSTED_KEYS = originalEnv;
    });

    it('loads keys from file', async () => {
      fs.readFile.mockResolvedValue('key1\nkey2\n# comment\nkey3');
      await signing.loadTrustedKeys();
      expect(fs.readFile).toHaveBeenCalledWith(expect.stringContaining('.blaze-keys'), 'utf-8');
      expect(signing.trustedKeys.has('key1')).toBe(true);
      expect(signing.trustedKeys.has('key2')).toBe(true);
      expect(signing.trustedKeys.has('key3')).toBe(true);
      expect(signing.trustedKeys.has('# comment')).toBe(false);
    });

    it('handles missing file gracefully', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));
      await expect(signing.loadTrustedKeys()).resolves.not.toThrow();
    });
  });

  describe('verifySignature', () => {
    it('returns verified if verification disabled', async () => {
      signing.verificationEnabled = false;
      const result = await signing.verifySignature('pkg', '1.0.0', 'sig', '/path');
      expect(result.verified).toBe(true);
      expect(result.reason).toBe('verification_disabled');
    });

    it('returns error if no signature', async () => {
      signing.verificationEnabled = true;
      const result = await signing.verifySignature('pkg', '1.0.0', null, '/path');
      expect(result.verified).toBe(false);
      expect(result.reason).toBe('no_signature');
    });

    it('uses GPG if available', async () => {
      signing.verificationEnabled = true;
      signing.hasGPG = jest.fn().mockResolvedValue(true);
      signing.verifyGPGSignature = jest.fn().mockResolvedValue({ verified: true, reason: 'gpg_verified' });
      const result = await signing.verifySignature('pkg', '1.0.0', 'sig', '/path');
      expect(result.verified).toBe(true);
      expect(result.reason).toBe('gpg_verified');
      expect(signing.verifyGPGSignature).toHaveBeenCalledWith('sig', '/path');
    });

    it('falls back to hash if GPG not available', async () => {
      signing.verificationEnabled = true;
      signing.hasGPG = jest.fn().mockResolvedValue(false);
      signing.verifyHashSignature = jest.fn().mockResolvedValue({ verified: true, reason: 'hash_verified' });
      const result = await signing.verifySignature('pkg', '1.0.0', 'sig', '/path');
      expect(result.verified).toBe(true);
      expect(result.reason).toBe('hash_verified');
      expect(signing.verifyHashSignature).toHaveBeenCalledWith('sig', '/path');
    });

    it('handles verification errors', async () => {
      signing.verificationEnabled = true;
      signing.hasGPG = jest.fn().mockRejectedValue(new Error('fail'));
      const result = await signing.verifySignature('pkg', '1.0.0', 'sig', '/path');
      expect(result.verified).toBe(false);
      expect(result.reason).toBe('verification_failed');
      expect(result.error).toBe('fail');
    });
  });

  describe('verifyHashSignature', () => {
    it('verifies hash signature successfully', async () => {
      const mockHash = 'abc123';
      const mockTarballData = Buffer.from('tarball data');
      
      fs.readFile.mockResolvedValue(mockTarballData);
      mockCryptoHash.digest.mockReturnValue(mockHash);

      const result = await signing.verifyHashSignature(
        'abc123',
        '/path/to/tarball'
      );

      expect(result).toEqual({
        verified: true,
        reason: 'hash_verified'
      });
      expect(fs.readFile).toHaveBeenCalledWith('/path/to/tarball');
    });

    it('handles hash mismatch', async () => {
      const mockHash = 'abc123';
      const mockTarballData = Buffer.from('tarball data');
      
      fs.readFile.mockResolvedValue(mockTarballData);
      mockCryptoHash.digest.mockReturnValue(mockHash);

      const result = await signing.verifyHashSignature(
        'different-hash',
        '/path/to/tarball'
      );

      expect(result).toEqual({
        verified: false,
        reason: 'hash_mismatch'
      });
    });

    it('handles hash verification errors', async () => {
      fs.readFile.mockRejectedValue(new Error('File read error'));

      const result = await signing.verifyHashSignature(
        'hash',
        '/path/to/tarball'
      );

      expect(result).toEqual({
        verified: false,
        reason: 'hash_error',
        error: 'File read error'
      });
    });
  });

  describe('verifyPackageIntegrity', () => {
    it('returns verified when no integrity check', async () => {
      const result = await signing.verifyPackageIntegrity(
        'lodash',
        '4.17.21',
        null,
        '/path/to/tarball'
      );

      expect(result).toEqual({
        verified: true,
        reason: 'no_integrity_check'
      });
    });

    it('verifies SHA512 integrity successfully', async () => {
      const mockHash = 'base64hash';
      const mockTarballData = Buffer.from('tarball data');
      
      fs.readFile.mockResolvedValue(mockTarballData);
      mockCryptoHash.digest.mockReturnValue(mockHash);

      const result = await signing.verifyPackageIntegrity(
        'lodash',
        '4.17.21',
        'sha512-base64hash',
        '/path/to/tarball'
      );

      expect(result).toEqual({
        verified: true,
        reason: 'integrity_verified'
      });
    });

    it('verifies SHA256 integrity successfully', async () => {
      const mockHash = 'base64hash';
      const mockTarballData = Buffer.from('tarball data');
      
      fs.readFile.mockResolvedValue(mockTarballData);
      mockCryptoHash.digest.mockReturnValue(mockHash);

      const result = await signing.verifyPackageIntegrity(
        'lodash',
        '4.17.21',
        'sha256-base64hash',
        '/path/to/tarball'
      );

      expect(result).toEqual({
        verified: true,
        reason: 'integrity_verified'
      });
    });

    it('handles unsupported algorithm', async () => {
      const result = await signing.verifyPackageIntegrity(
        'lodash',
        '4.17.21',
        'md5-hash',
        '/path/to/tarball'
      );

      expect(result).toEqual({
        verified: false,
        reason: 'unsupported_algorithm',
        algorithm: 'md5'
      });
    });

    it('handles integrity mismatch', async () => {
      const mockHash = 'different-hash';
      const mockTarballData = Buffer.from('tarball data');
      
      fs.readFile.mockResolvedValue(mockTarballData);
      mockCryptoHash.digest.mockReturnValue(mockHash);

      const result = await signing.verifyPackageIntegrity(
        'lodash',
        '4.17.21',
        'sha512-base64hash',
        '/path/to/tarball'
      );

      expect(result).toEqual({
        verified: false,
        reason: 'integrity_mismatch'
      });
    });

    it('handles integrity verification errors', async () => {
      fs.readFile.mockRejectedValue(new Error('File read error'));

      const result = await signing.verifyPackageIntegrity(
        'lodash',
        '4.17.21',
        'sha512-hash',
        '/path/to/tarball'
      );

      expect(result).toEqual({
        verified: false,
        reason: 'integrity_error',
        error: 'File read error'
      });
    });
  });

  describe('trusted key management', () => {
    it('checks if key is trusted', () => {
      signing.addTrustedKey('test-key');
      expect(signing.isTrustedKey('test-key')).toBe(true);
      expect(signing.isTrustedKey('other-key')).toBe(false);
    });

    it('adds trusted key', () => {
      signing.addTrustedKey('new-key');
      expect(signing.trustedKeys.has('new-key')).toBe(true);
    });

    it('gets all trusted keys', () => {
      signing.addTrustedKey('key1');
      signing.addTrustedKey('key2');
      const keys = signing.getTrustedKeys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });
  });
}); 