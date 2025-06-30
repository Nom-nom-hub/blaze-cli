const PerformanceProfiler = require('../../lib/performanceProfiler');
const fs = require('fs/promises');

// Mock fs module
jest.mock('fs/promises');

describe('PerformanceProfiler', () => {
  let profiler;

  beforeEach(() => {
    jest.clearAllMocks();
    profiler = new PerformanceProfiler();
  });

  describe('constructor', () => {
    it('initializes with empty metrics', () => {
      expect(profiler.metrics).toEqual({
        startTime: null,
        endTime: null,
        phases: {},
        packages: {},
        network: {},
        cache: {},
        errors: []
      });
      expect(profiler.phaseStartTime).toBeNull();
      expect(profiler.currentPhase).toBeNull();
    });
  });

  describe('start', () => {
    it('sets start time and system info', () => {
      const originalMemoryUsage = process.memoryUsage;
      const originalCpus = require('os').cpus;
      
      process.memoryUsage = jest.fn().mockReturnValue({ heapUsed: 1000 });
      require('os').cpus = jest.fn().mockReturnValue([{}, {}]);

      profiler.start();

      expect(profiler.metrics.startTime).toBeGreaterThan(0);
      expect(profiler.metrics.system).toEqual({
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        memory: { heapUsed: 1000 },
        cpus: 2
      });

      process.memoryUsage = originalMemoryUsage;
      require('os').cpus = originalCpus;
    });
  });

  describe('end', () => {
    it('sets end time and calculates total time', () => {
      profiler.start();
      const startTime = profiler.metrics.startTime;
      
      profiler.end();

      expect(profiler.metrics.endTime).toBeGreaterThan(startTime);
      expect(profiler.metrics.totalTime).toBeGreaterThan(0);
    });
  });

  describe('startPhase', () => {
    it('starts a new phase', () => {
      profiler.startPhase('test-phase');

      expect(profiler.currentPhase).toBe('test-phase');
      expect(profiler.phaseStartTime).toBeGreaterThan(0);
      expect(profiler.metrics.phases['test-phase']).toEqual({
        startTime: profiler.phaseStartTime,
        endTime: null,
        duration: null
      });
    });

    it('ends previous phase when starting new one', () => {
      profiler.startPhase('phase1');
      const phase1Start = profiler.phaseStartTime;
      
      // Add a small delay to ensure different timestamps
      setTimeout(() => {}, 1);
      
      profiler.startPhase('phase2');

      expect(profiler.metrics.phases['phase1'].endTime).toBeGreaterThanOrEqual(phase1Start);
      expect(profiler.metrics.phases['phase1'].duration).toBeGreaterThanOrEqual(0);
      expect(profiler.currentPhase).toBe('phase2');
    });
  });

  describe('endPhase', () => {
    it('ends current phase', () => {
      profiler.startPhase('test-phase');
      const startTime = profiler.phaseStartTime;

      // Add a small delay to ensure different timestamps
      setTimeout(() => {}, 1);
      
      profiler.endPhase();

      expect(profiler.metrics.phases['test-phase'].endTime).toBeGreaterThanOrEqual(startTime);
      expect(profiler.metrics.phases['test-phase'].duration).toBeGreaterThanOrEqual(0);
      expect(profiler.currentPhase).toBeNull();
      expect(profiler.phaseStartTime).toBeNull();
    });

    it('does nothing when no phase is active', () => {
      profiler.endPhase();
      expect(profiler.currentPhase).toBeNull();
    });
  });

  describe('recordPackageInstall', () => {
    it('records package install metrics', () => {
      profiler.recordPackageInstall('lodash', '4.17.21', 1000, 50000, false);

      expect(profiler.metrics.packages['lodash']).toEqual({
        installs: [{
          version: '4.17.21',
          duration: 1000,
          size: 50000,
          fromCache: false,
          timestamp: expect.any(Number)
        }],
        totalTime: 1000,
        totalSize: 50000,
        cacheHits: 0,
        cacheMisses: 1
      });
    });

    it('accumulates metrics for same package', () => {
      profiler.recordPackageInstall('lodash', '4.17.21', 1000, 50000, false);
      profiler.recordPackageInstall('lodash', '4.17.22', 2000, 60000, true);

      const pkg = profiler.metrics.packages['lodash'];
      expect(pkg.installs).toHaveLength(2);
      expect(pkg.totalTime).toBe(3000);
      expect(pkg.totalSize).toBe(110000);
      expect(pkg.cacheHits).toBe(1);
      expect(pkg.cacheMisses).toBe(1);
    });
  });

  describe('recordNetworkRequest', () => {
    it('records network request metrics', () => {
      profiler.recordNetworkRequest('https://registry.npmjs.org/lodash', 500, 1000, true);

      expect(profiler.metrics.network['https://registry.npmjs.org/lodash']).toEqual({
        requests: [{
          duration: 500,
          size: 1000,
          success: true,
          timestamp: expect.any(Number)
        }],
        totalTime: 500,
        totalSize: 1000,
        successCount: 1,
        errorCount: 0
      });
    });

    it('accumulates metrics for same URL', () => {
      profiler.recordNetworkRequest('https://registry.npmjs.org/lodash', 500, 1000, true);
      profiler.recordNetworkRequest('https://registry.npmjs.org/lodash', 300, 800, false);

      const req = profiler.metrics.network['https://registry.npmjs.org/lodash'];
      expect(req.requests).toHaveLength(2);
      expect(req.totalTime).toBe(800);
      expect(req.totalSize).toBe(1800);
      expect(req.successCount).toBe(1);
      expect(req.errorCount).toBe(1);
    });
  });

  describe('recordCacheOperation', () => {
    it('records cache operation metrics', () => {
      profiler.recordCacheOperation('get', 'lodash-4.17.21', 50, true);

      expect(profiler.metrics.cache['get']).toEqual({
        operations: [{
          key: 'lodash-4.17.21',
          duration: 50,
          hit: true,
          timestamp: expect.any(Number)
        }],
        totalTime: 50,
        hits: 1,
        misses: 0
      });
    });

    it('accumulates metrics for same operation', () => {
      profiler.recordCacheOperation('get', 'lodash-4.17.21', 50, true);
      profiler.recordCacheOperation('get', 'jest-27.0.0', 30, false);

      const cache = profiler.metrics.cache['get'];
      expect(cache.operations).toHaveLength(2);
      expect(cache.totalTime).toBe(80);
      expect(cache.hits).toBe(1);
      expect(cache.misses).toBe(1);
    });
  });

  describe('recordError', () => {
    it('records error with context', () => {
      const error = new Error('Test error');
      const context = { package: 'lodash', phase: 'install' };

      profiler.recordError(error, context);

      expect(profiler.metrics.errors).toHaveLength(1);
      expect(profiler.metrics.errors[0]).toEqual({
        message: 'Test error',
        stack: error.stack,
        context,
        timestamp: expect.any(Number)
      });
    });
  });

  describe('getSummary', () => {
    beforeEach(() => {
      profiler.start();
      profiler.startPhase('resolve');
      profiler.endPhase();
      profiler.startPhase('install');
      profiler.endPhase();
      profiler.end();

      profiler.recordPackageInstall('lodash', '4.17.21', 1000, 50000, false);
      profiler.recordPackageInstall('jest', '27.0.0', 2000, 80000, true);
      profiler.recordNetworkRequest('https://registry.npmjs.org/lodash', 500, 1000, true);
      profiler.recordNetworkRequest('https://registry.npmjs.org/jest', 300, 800, false);
      profiler.recordCacheOperation('get', 'lodash-4.17.21', 50, true);
      profiler.recordCacheOperation('get', 'jest-27.0.0', 30, false);
      profiler.recordError(new Error('Test error'));
    });

    it('generates comprehensive summary', () => {
      const summary = profiler.getSummary();

      expect(summary.totalTime).toBeGreaterThan(0);
      expect(summary.phases).toHaveProperty('resolve');
      expect(summary.phases).toHaveProperty('install');
      expect(summary.packages.total).toBe(2);
      expect(summary.packages.totalTime).toBe(3000);
      expect(summary.packages.totalSize).toBe(130000);
      expect(summary.packages.cacheHits).toBe(1);
      expect(summary.packages.cacheMisses).toBe(1);
      expect(summary.network.totalRequests).toBe(2);
      expect(summary.network.totalTime).toBe(800);
      expect(summary.network.totalSize).toBe(1800);
      expect(summary.cache.totalOperations).toBe(2);
      expect(summary.cache.totalTime).toBe(80);
      expect(summary.errors).toBe(1);
    });

    it('calculates percentages correctly', () => {
      const summary = profiler.getSummary();

      expect(summary.network.successRate).toBe('50.0');
      expect(summary.cache.hitRate).toBe('50.0');
    });
  });

  describe('getDetailedReport', () => {
    it('generates detailed report', () => {
      profiler.start();
      profiler.end();
      profiler.recordPackageInstall('lodash', '4.17.21', 1000, 50000, false);

      const report = profiler.getDetailedReport();

      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('details');
      expect(report.details.packages).toHaveProperty('lodash');
    });
  });

  describe('saveReport', () => {
    it('saves report to file', async () => {
      profiler.start();
      profiler.end();
      profiler.recordPackageInstall('lodash', '4.17.21', 1000, 50000, false);

      await profiler.saveReport('test-report.json');

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-report.json'),
        expect.any(String),
        'utf-8'
      );
    });

    it('generates default filename', async () => {
      profiler.start();
      profiler.end();

      await profiler.saveReport();

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/blaze-profile-.*\.json/),
        expect.any(String),
        'utf-8'
      );
    });
  });

  describe('printSummary', () => {
    it('prints summary to console', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      profiler.start();
      profiler.end();
      profiler.recordPackageInstall('lodash', '4.17.21', 1000, 50000, false);

      profiler.printSummary();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Performance Summary'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Total Time'));

      consoleSpy.mockRestore();
    });
  });

  describe('getSlowestPackages', () => {
    it('returns slowest packages sorted by time', () => {
      profiler.recordPackageInstall('fast', '1.0.0', 100, 1000, false);
      profiler.recordPackageInstall('slow', '2.0.0', 1000, 5000, false);
      profiler.recordPackageInstall('medium', '3.0.0', 500, 3000, false);

      const slowest = profiler.getSlowestPackages(2);

      expect(slowest).toHaveLength(2);
      expect(slowest[0].name).toBe('slow');
      expect(slowest[1].name).toBe('medium');
    });

    it('respects limit parameter', () => {
      profiler.recordPackageInstall('pkg1', '1.0.0', 100, 1000, false);
      profiler.recordPackageInstall('pkg2', '2.0.0', 200, 2000, false);
      profiler.recordPackageInstall('pkg3', '3.0.0', 300, 3000, false);

      const slowest = profiler.getSlowestPackages(1);

      expect(slowest).toHaveLength(1);
      expect(slowest[0].name).toBe('pkg3');
    });
  });

  describe('getSlowestPhases', () => {
    it('returns phases sorted by duration', () => {
      // Start and end phases with different durations
      profiler.startPhase('fast');
      // Simulate some time passing
      profiler.metrics.phases.fast.startTime = Date.now() - 100;
      profiler.endPhase();
      
      profiler.startPhase('slow');
      // Simulate more time passing for slow phase
      profiler.metrics.phases.slow.startTime = Date.now() - 500;
      profiler.endPhase();

      // Manually set the durations to ensure proper sorting
      profiler.metrics.phases.fast.duration = 100;
      profiler.metrics.phases.slow.duration = 500;

      const slowest = profiler.getSlowestPhases();

      expect(slowest).toHaveLength(2);
      expect(slowest[0].name).toBe('slow');
      expect(slowest[1].name).toBe('fast');
    });
  });

  describe('getRecommendations', () => {
    it('provides recommendations based on metrics', () => {
      profiler.start();
      profiler.end();
      profiler.recordPackageInstall('lodash', '4.17.21', 1000, 50000, false);
      profiler.recordNetworkRequest('https://registry.npmjs.org/lodash', 500, 1000, false);

      const recommendations = profiler.getRecommendations();

      expect(recommendations).toBeInstanceOf(Array);
      expect(recommendations.length).toBeGreaterThan(0);
    });
  });
}); 