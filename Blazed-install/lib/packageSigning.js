const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

class PackageSigning {
  constructor(execAsync) {
    this.trustedKeys = new Set();
    this.verificationEnabled = process.env.BLAZE_VERIFY_SIGNATURES === 'true';
    this.loadTrustedKeys();
    this.execAsync = execAsync || promisify(exec);
  }

  async loadTrustedKeys() {
    // Load from environment
    const envKeys = process.env.BLAZE_TRUSTED_KEYS;
    if (envKeys) {envKeys.split(',').forEach(key => this.trustedKeys.add(key.trim()));
    }

    // Load from .blaze-keys file
    try {
      const keysPath = path.join(process.cwd(), '.blaze-keys');
      const keysContent = await fs.readFile(keysPath, 'utf-8');
      keysContent.split('\n').forEach(line => {
        const key = line.trim();
        if (key && !key.startsWith('#')) {
          this.trustedKeys.add(key);
        }
      });
    } catch (err) {
      // .blaze-keys doesn't exist
    }
  }

  async verifySignature(packageName, version, signature, tarballPath) {
    if (!this.verificationEnabled) {console.log(`[SIGNATURE] Verification disabled for ${packageName}@${version}`);
      return { verified: true, reason: 'verification_disabled' };
    }

    if (!signature) {console.warn(`[SIGNATURE] No signature provided for ${packageName}@${version}`);
      return { verified: false, reason: 'no_signature' };
    }

    try {
      // Verify GPG signature if available
      if (await this.hasGPG()) {
        return await this.verifyGPGSignature(signature, tarballPath);
      }

      // Fallback to hash verification
      return await this.verifyHashSignature(signature, tarballPath);
    } catch (error) {
      console.error(`[SIGNATURE] Verification failed for ${packageName}@${version}: ${error.message}`);
      return { verified: false, reason: 'verification_failed', error: error.message };
    }
  }

  async hasGPG() {
    try {
      await this.execAsync('gpg --version');
      return true;
    } catch {
      return false;
    }
  }

  async verifyGPGSignature(signature, tarballPath) {
    try {
      // Write signature to temporary file
      const sigPath = tarballPath + '.sig';
      await fs.writeFile(sigPath, signature, 'base64');

      // Verify signature
      const { stdout, stderr } = await this.execAsync(`gpg --verify "${sigPath}" "${tarballPath}"`);
      
      // Clean up
      await fs.unlink(sigPath);

      if (stderr.includes('Good signature')) {
        console.log(`[SIGNATURE] GPG verification successful`);
        return { verified: true, reason: 'gpg_verified' };
      } else {
        return { verified: false, reason: 'gpg_failed', details: stderr };
      }
    } catch (error) {
      return { verified: false, reason: 'gpg_error', error: error.message };
    }
  }

  async verifyHashSignature(signature, tarballPath) {
    try {
      const tarballData = await fs.readFile(tarballPath);
      const computedHash = crypto.createHash('sha256').update(tarballData).digest('hex');
      
      if (computedHash === signature) {console.log(`[SIGNATURE] Hash verification successful`);
        return { verified: true, reason: 'hash_verified' };
      } else {
        return { verified: false, reason: 'hash_mismatch' };
      }
    } catch (error) {
      return { verified: false, reason: 'hash_error', error: error.message };
    }
  }

  async verifyPackageIntegrity(packageName, version, integrity, tarballPath) {
    if (!integrity) {return { verified: true, reason: 'no_integrity_check' };
    }

    try {
      const tarballData = await fs.readFile(tarballPath);
      const [algorithm, expectedHash] = integrity.split('-');
      
      let computedHash;
      if (algorithm === 'sha512') {computedHash = crypto.createHash('sha512').update(tarballData).digest('base64');
      } else if (algorithm === 'sha256') {
        computedHash = crypto.createHash('sha256').update(tarballData).digest('base64');
      } else {
        return { verified: false, reason: 'unsupported_algorithm', algorithm };
      }

      if (computedHash === expectedHash) {console.log(`[INTEGRITY] ${algorithm.toUpperCase()} verification successful for ${packageName}@${version}`);
        return { verified: true, reason: 'integrity_verified' };
      } else {
        return { verified: false, reason: 'integrity_mismatch' };
      }
    } catch (error) {
      return { verified: false, reason: 'integrity_error', error: error.message };
    }
  }

  isTrustedKey(keyId) {return this.trustedKeys.has(keyId);
  }

  addTrustedKey(keyId) {this.trustedKeys.add(keyId);
  }

  getTrustedKeys() {return Array.from(this.trustedKeys);
  }
}

module.exports = PackageSigning; 