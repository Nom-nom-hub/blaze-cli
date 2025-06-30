const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

class RegistryMirror {
  constructor() {this.registries = [];
    this.currentIndex = 0;
    this.failedRegistries = new Set();
    this.loadRegistryConfig();
  }

  async loadRegistryConfig() {
    // Load from environment variables
    const npmRegistry = process.env.npm_config_registry || 'https://registry.npmjs.org/';
    const blazeRegistries = process.env.BLAZE_REGISTRIES;
    
    // Default registries
    this.registries = [npmRegistry];
    
    // Add custom registries from environment
    if (blazeRegistries) {const customRegistries = blazeRegistries.split(',').map(r => r.trim());
      this.registries.push(...customRegistries);
    }
    
    // Load from .npmrc file
    try {
      const npmrcPath = path.join(process.cwd(), '.npmrc');
      const npmrcContent = await fs.readFile(npmrcPath, 'utf-8');
      const registryMatch = npmrcContent.match(/^registry\s*=\s*(.+)$/m);
      if (registryMatch && !this.registries.includes(registryMatch[1])) {
        this.registries.unshift(registryMatch[1]);
      }
    } catch (err) {
      // .npmrc doesn't exist or can't be read
    }
    
    // Remove duplicates while preserving order
    this.registries = [...new Set(this.registries)];
  }

  async request(url, options = {}) {
    const maxRetries = this.registries.length;
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {const registry = this.registries[this.currentIndex];
      const fullUrl = url.startsWith('http') ? url : `${registry}${url}`;
      
      try {
        console.log(`[REGISTRY] Attempting request to: ${registry}`);
        const response = await axios.request({
          url: fullUrl,
          timeout: 10000,
          ...options
        });
        
        // Reset failed status on success
        this.failedRegistries.delete(registry);
        return response;
        
      } catch (error) {
        lastError = error;
        console.warn(`[REGISTRY] Failed to fetch from ${registry}: ${error.message}`);
        this.failedRegistries.add(registry);
        
        // Try next registry
        this.currentIndex = (this.currentIndex + 1) % this.registries.length;
      }
    }
    
    throw new Error(`All registries failed. Last error: ${lastError.message}`);
  }

  async get(url, options = {}) {
    return this.request(url, { method: 'GET', ...options });
  }

  async post(url, data, options = {}) {
    return this.request(url, { method: 'POST', data, ...options });
  }

  getCurrentRegistry() {return this.registries[this.currentIndex];
  }

  getRegistryStatus() {return {
      current: this.registries[this.currentIndex],
      all: this.registries,
      failed: Array.from(this.failedRegistries),
      healthy: this.registries.filter(r => !this.failedRegistries.has(r))
    };
  }
}

module.exports = RegistryMirror; 