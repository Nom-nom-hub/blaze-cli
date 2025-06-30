const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const ini = require('ini');

class RegistryService {
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
        this.failedRegistries.add(registry);
        
        // Try next registry
        this.currentIndex = (this.currentIndex + 1) % this.registries.length;
      }
    }
    
    throw new Error(`All registries failed. Last error: ${lastError.message}`);
  }

  async get(url, options = {}) {
    try {
      const response = await this.request(url, { method: 'GET', ...options });
      return response;
    } catch (error) {
      throw error;
    }
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

  // Helper method to get package metadata
  async getPackageMetadata(packageName) {
    try {
      const url = `${packageName}`;
      const response = await this.get(url);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Helper method to get specific package version
  async getPackageVersion(packageName, version) {
    try {
      const url = `${packageName}/${version}`;
      const response = await this.get(url);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Helper method for audit requests
  async audit(payload) {
    try {
      const url = `-/npm/v1/security/audits`;
      const response = await this.post(url, payload, {
        headers: { 'Content-Type': 'application/json' }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Download package tarball
  async downloadPackage(url) {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    return response.data;
  }
}

// Create singleton instance
const registryService = new RegistryService();

module.exports = registryService; 