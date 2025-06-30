const fs = require('fs/promises');
const path = require('path');
const os = require('os');

class PerformanceProfiler {
  constructor() {this.metrics = {
      startTime: null,
      endTime: null,
      phases: {},
      packages: {},
      network: {},
      cache: {},
      errors: []
    };
    this.phaseStartTime = null;
    this.currentPhase = null;
  }

  start() {this.metrics.startTime = Date.now();
    this.metrics.system = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      memory: process.memoryUsage(),
      cpus: os.cpus().length
    };
  }

  end() {this.metrics.endTime = Date.now();
    this.metrics.totalTime = this.metrics.endTime - this.metrics.startTime;
  }

  startPhase(phaseName) {if (this.currentPhase) {this.endPhase();
    }
    
    this.currentPhase = phaseName;
    this.phaseStartTime = Date.now();
    this.metrics.phases[phaseName] = {
      startTime: this.phaseStartTime,
      endTime: null,
      duration: null
    };
  }

  endPhase() {if (this.currentPhase && this.phaseStartTime) {const endTime = Date.now();
      const duration = endTime - this.phaseStartTime;
      
      this.metrics.phases[this.currentPhase].endTime = endTime;
      this.metrics.phases[this.currentPhase].duration = duration;
      
      this.currentPhase = null;
      this.phaseStartTime = null;
    }
  }

  recordPackageInstall(packageName, version, duration, size, fromCache = false) {if (!this.metrics.packages[packageName]) {this.metrics.packages[packageName] = {
        installs: [],
        totalTime: 0,
        totalSize: 0,
        cacheHits: 0,
        cacheMisses: 0
      };
    }
    
    const pkg = this.metrics.packages[packageName];
    pkg.installs.push({
      version,
      duration,
      size,
      fromCache,
      timestamp: Date.now()
    });
    
    pkg.totalTime += duration;
    pkg.totalSize += size;
    
    if (fromCache) {pkg.cacheHits++;
    } else {
      pkg.cacheMisses++;
    }
  }

  recordNetworkRequest(url, duration, size, success = true) {if (!this.metrics.network[url]) {this.metrics.network[url] = {
        requests: [],
        totalTime: 0,
        totalSize: 0,
        successCount: 0,
        errorCount: 0
      };
    }
    
    const req = this.metrics.network[url];
    req.requests.push({
      duration,
      size,
      success,
      timestamp: Date.now()
    });
    
    req.totalTime += duration;
    req.totalSize += size;
    
    if (success) {req.successCount++;
    } else {
      req.errorCount++;
    }
  }

  recordCacheOperation(operation, key, duration, hit = false) {if (!this.metrics.cache[operation]) {this.metrics.cache[operation] = {
        operations: [],
        totalTime: 0,
        hits: 0,
        misses: 0
      };
    }
    
    const cache = this.metrics.cache[operation];
    cache.operations.push({
      key,
      duration,
      hit,
      timestamp: Date.now()
    });
    
    cache.totalTime += duration;
    
    if (hit) {cache.hits++;
    } else {
      cache.misses++;
    }
  }

  recordError(error, context = {}) {this.metrics.errors.push({
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now()
    });
  }

  getSummary() {const summary = {
      totalTime: this.metrics.totalTime,
      phases: {},
      packages: {
        total: Object.keys(this.metrics.packages).length,
        totalTime: 0,
        totalSize: 0,
        cacheHits: 0,
        cacheMisses: 0
      },
      network: {
        totalRequests: 0,
        totalTime: 0,
        totalSize: 0,
        successRate: 0
      },
      cache: {
        totalOperations: 0,
        totalTime: 0,
        hitRate: 0
      },
      errors: this.metrics.errors.length
    };

    // Phase summary
    for (const [phase, data] of Object.entries(this.metrics.phases)) {
      summary.phases[phase] = {
        duration: data.duration,
        percentage: ((data.duration / this.metrics.totalTime) * 100).toFixed(1)
      };
    }

    // Package summary
    for (const [name, data] of Object.entries(this.metrics.packages)) {
      summary.packages.totalTime += data.totalTime;
      summary.packages.totalSize += data.totalSize;
      summary.packages.cacheHits += data.cacheHits;
      summary.packages.cacheMisses += data.cacheMisses;
    }

    // Network summary
    for (const [url, data] of Object.entries(this.metrics.network)) {
      summary.network.totalRequests += data.requests.length;
      summary.network.totalTime += data.totalTime;
      summary.network.totalSize += data.totalSize;
    }
    
    if (summary.network.totalRequests > 0) {summary.network.successRate = ((summary.network.totalRequests - this.metrics.errors.length) / summary.network.totalRequests * 100).toFixed(1);
    }

    // Cache summary
    for (const [operation, data] of Object.entries(this.metrics.cache)) {
      summary.cache.totalOperations += data.operations.length;
      summary.cache.totalTime += data.totalTime;
    }
    
    if (summary.cache.totalOperations > 0) {summary.cache.hitRate = ((summary.packages.cacheHits / (summary.packages.cacheHits + summary.packages.cacheMisses)) * 100).toFixed(1);
    }

    return summary;
  }

  getDetailedReport() {const summary = this.getSummary();
    
    return {
      summary,
      details: {
        system: this.metrics.system,
        phases: this.metrics.phases,
        packages: this.metrics.packages,
        network: this.metrics.network,
        cache: this.metrics.cache,
        errors: this.metrics.errors
      }
    };
  }

  async saveReport(filename = null) {
    if (!filename) {const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      filename = `blaze-profile-${timestamp}.json`;
    }
    
    const report = this.getDetailedReport();
    const reportPath = path.join(process.cwd(), filename);
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`📊 Performance report saved to: ${reportPath}`);
    
    return reportPath;
  }

  printSummary() {const summary = this.getSummary();
    
    console.log('\n📊 Performance Summary');
    console.log('='.repeat(50));
    console.log(`Total Time: ${summary.totalTime}ms`);
    console.log(`Packages: ${summary.packages.total}`);
    console.log(`Cache Hit Rate: ${summary.cache.hitRate}%`);
    console.log(`Network Success Rate: ${summary.network.successRate}%`);
    console.log(`Errors: ${summary.errors}`);
    
    console.log('\n📈 Phase Breakdown:');
    for (const [phase, data] of Object.entries(summary.phases)) {
      console.log(`  ${phase}: ${data.duration}ms (${data.percentage}%)`);
    }
    
    if (summary.errors > 0) {console.log('\n❌ Errors:');
      for (const error of this.metrics.errors) {console.log(`  ${error.message}`);
      }
    }
  }

  getSlowestPackages(limit = 10) {const packages = Object.entries(this.metrics.packages)
      .map(([name, data]) => ({
        name,
        totalTime: data.totalTime,
        avgTime: data.totalTime / data.installs.length,
        installs: data.installs.length
      }))
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, limit);
    
    return packages;
  }

  getSlowestPhases() {return Object.entries(this.metrics.phases)
      .map(([name, data]) => ({
        name,
        duration: data.duration,
        percentage: ((data.duration / this.metrics.totalTime) * 100).toFixed(1)
      }))
      .sort((a, b) => b.duration - a.duration);
  }

  getRecommendations() {const summary = this.getSummary();
    const recommendations = [];
    
    // Cache recommendations
    if (summary.cache.hitRate < 50) {recommendations.push('Consider running `blaze prefetch` to warm up the cache');
    }
    
    // Network recommendations
    if (summary.network.successRate < 90) {recommendations.push('Network issues detected - check your connection or registry configuration');
    }
    
    // Performance recommendations
    const slowestPhase = this.getSlowestPhases()[0];
    if (slowestPhase && slowestPhase.percentage > 50) {recommendations.push(`Phase "${slowestPhase.name}" is taking ${slowestPhase.percentage}% of total time - consider optimization`);
    }
    
    // Error recommendations
    if (summary.errors > 0) {recommendations.push('Errors detected - review error logs for potential issues');
    }
    
    return recommendations;
  }
}

module.exports = PerformanceProfiler; 