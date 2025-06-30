const { WorkspaceResolver } = require('../../lib/workspaceResolver');
const path = require('path');
const fs = require('fs').promises;

describe('WorkspaceResolver', () => {
  let workspaceResolver;
  let testDir;

  beforeEach(async () => {
    testDir = path.join(__dirname, '../fixtures/workspace-resolver-test');
    await fs.mkdir(testDir, { recursive: true });
    workspaceResolver = new WorkspaceResolver(testDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('workspace discovery', () => {
    it('discovers workspaces from patterns', async () => {
      // Create workspace packages
      await fs.mkdir(path.join(testDir, 'packages'), { recursive: true });
      
      // Package A
      await fs.mkdir(path.join(testDir, 'packages/package-a'), { recursive: true });
      const packageAJson = {
        name: '@test/package-a',
        version: '1.0.0'
      };
      await fs.writeFile(path.join(testDir, 'packages/package-a/package.json'), JSON.stringify(packageAJson, null, 2));
      
      // Package B
      await fs.mkdir(path.join(testDir, 'packages/package-b'), { recursive: true });
      const packageBJson = {
        name: '@test/package-b',
        version: '1.0.0'
      };
      await fs.writeFile(path.join(testDir, 'packages/package-b/package.json'), JSON.stringify(packageBJson, null, 2));
      
      const workspaces = await workspaceResolver.discoverWorkspaces(['packages/*']);
      expect(workspaces).toHaveLength(2);
      expect(workspaces.find(w => w.name === '@test/package-a')).toBeDefined();
      expect(workspaces.find(w => w.name === '@test/package-b')).toBeDefined();
    });

    it('handles empty workspace patterns', async () => {
      const workspaces = await workspaceResolver.discoverWorkspaces([]);
      expect(workspaces).toHaveLength(0);
    });

    it('handles non-existent workspace paths', async () => {
      const workspaces = await workspaceResolver.discoverWorkspaces(['nonexistent/*']);
      expect(workspaces).toHaveLength(0);
    });
  });

  describe('dependency resolution', () => {
    it('resolves dependencies with conflict resolution', async () => {
      // Create workspace packages with dependencies
      await fs.mkdir(path.join(testDir, 'packages'), { recursive: true });
      
      // Package A with lodash dependency
      await fs.mkdir(path.join(testDir, 'packages/package-a'), { recursive: true });
      const packageAJson = {
        name: '@test/package-a',
        version: '1.0.0',
        dependencies: {
          lodash: '4.17.21'
        }
      };
      await fs.writeFile(path.join(testDir, 'packages/package-a/package.json'), JSON.stringify(packageAJson, null, 2));
      
      // Package B with different lodash version
      await fs.mkdir(path.join(testDir, 'packages/package-b'), { recursive: true });
      const packageBJson = {
        name: '@test/package-b',
        version: '1.0.0',
        dependencies: {
          lodash: '4.17.20'
        }
      };
      await fs.writeFile(path.join(testDir, 'packages/package-b/package.json'), JSON.stringify(packageBJson, null, 2));
      
      await workspaceResolver.discoverWorkspaces(['packages/*']);
      workspaceResolver.buildDependencyGraph();
      
      const resolved = workspaceResolver.resolveDependencies(
        { chalk: '4.1.2' }, // root dependencies
        { eslint: '8.0.0' }  // root dev dependencies
      );
      
      expect(resolved.hoisted).toBeDefined();
      expect(resolved.workspaceSpecific).toBeDefined();
      expect(resolved.conflicts).toBeDefined();
    });
  });

  describe('workspace paths', () => {
    it('returns workspace paths', async () => {
      await fs.mkdir(path.join(testDir, 'packages'), { recursive: true });
      await fs.mkdir(path.join(testDir, 'packages/package-a'), { recursive: true });
      
      const packageAJson = {
        name: '@test/package-a',
        version: '1.0.0'
      };
      await fs.writeFile(path.join(testDir, 'packages/package-a/package.json'), JSON.stringify(packageAJson, null, 2));
      
      await workspaceResolver.discoverWorkspaces(['packages/*']);
      const paths = workspaceResolver.getWorkspacePaths();
      
      expect(paths).toHaveLength(1);
      expect(paths[0]).toContain('package-a');
    });
  });

  describe('dependency collection', () => {
    it('collects all dependencies from workspaces', async () => {
      await fs.mkdir(path.join(testDir, 'packages'), { recursive: true });
      await fs.mkdir(path.join(testDir, 'packages/package-a'), { recursive: true });
      
      const packageAJson = {
        name: '@test/package-a',
        version: '1.0.0',
        dependencies: {
          lodash: '4.17.21'
        },
        devDependencies: {
          eslint: '8.0.0'
        }
      };
      await fs.writeFile(path.join(testDir, 'packages/package-a/package.json'), JSON.stringify(packageAJson, null, 2));
      
      await workspaceResolver.discoverWorkspaces(['packages/*']);
      const allDeps = workspaceResolver.getAllDependencies(
        { chalk: '4.1.2' },
        { jest: '29.0.0' }
      );
      
      expect(allDeps).toBeDefined();
      expect(Object.keys(allDeps).length).toBeGreaterThan(0);
    });
  });
}); 