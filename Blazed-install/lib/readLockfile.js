const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

async function readLockfile(raw = false) {const lockfilePath = path.join(process.cwd(), 'blaze-lock.json');
  try {
    const data = await fs.readFile(lockfilePath, 'utf8');
    
    if (raw) {return data;
    }
    
    const lockfile = JSON.parse(data);
    
    // Handle new format (v2.0.0+)
    if (lockfile.version && lockfile.packages) {// Verify integrity if present
      if (lockfile.integrity) {const lockfileContent = JSON.stringify(lockfile.packages, null, 2);
        const calculatedIntegrity = crypto.createHash('sha256').update(lockfileContent).digest('hex');
        
        if (lockfile.integrity !== calculatedIntegrity) {console.warn('[WARNING] Lockfile integrity check failed. The lockfile may be corrupted.');
        }
      }
      
      // Return packages in the expected format for backward compatibility
      return lockfile.packages;
    }
    
    // Handle old format (backward compatibility)
    return lockfile;
    
  } catch (err) {
    if (err.code === 'ENOENT') {return null;
    }
    throw err;
  }
}

module.exports = { readLockfile }; 