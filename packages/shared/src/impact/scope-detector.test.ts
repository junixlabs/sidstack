/**
 * Scope Detector Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ScopeDetector,
  scopeDetector,
  type ModuleKnowledgeProvider,
  type SpecProvider,
  type ImportGraphProvider,
  type DataFlowProvider,
} from './scope-detector';
import type { ChangeInput, ParsedChange } from './types';

describe('ScopeDetector', () => {
  let detector: ScopeDetector;

  // Mock providers
  const createMockModuleProvider = (): ModuleKnowledgeProvider => ({
    getModule: (id: string) => ({ id, name: id, paths: `src/${id}/**` }),
    getModuleByName: (name: string) => ({ id: name, name, paths: `src/${name}/**` }),
    listModules: () => [
      { id: 'users', name: 'users', paths: 'src/users/**' },
      { id: 'orders', name: 'orders', paths: 'src/orders/**' },
      { id: 'auth', name: 'auth', paths: 'src/auth/**' },
    ],
    detectModuleFromPath: (filePath: string) => {
      if (filePath.includes('users')) return { id: 'users', name: 'users', paths: 'src/users/**' };
      if (filePath.includes('orders')) return { id: 'orders', name: 'orders', paths: 'src/orders/**' };
      if (filePath.includes('auth')) return { id: 'auth', name: 'auth', paths: 'src/auth/**' };
      return null;
    },
    getModuleLinks: (moduleId: string) => {
      if (moduleId === 'users') {
        return {
          outgoing: [{ targetModuleId: 'auth', linkType: 'depends_on' }],
          incoming: [{ sourceModuleId: 'orders', linkType: 'uses' }],
        };
      }
      if (moduleId === 'orders') {
        return {
          outgoing: [{ targetModuleId: 'users', linkType: 'uses' }],
          incoming: [],
        };
      }
      return { outgoing: [], incoming: [] };
    },
  });

  const createMockSpecProvider = (): SpecProvider => ({
    getSpecDependencies: (specId: string) => {
      if (specId === 'spec-1') {
        return [
          { specId: 'spec-2', moduleId: 'orders', relationship: 'dependsOn' },
          { specId: 'spec-3', moduleId: 'auth', relationship: 'relatesTo' },
        ];
      }
      return [];
    },
    getSpec: (specId: string) => {
      if (specId === 'spec-1') return { id: 'spec-1', moduleId: 'users', title: 'User Spec' };
      if (specId === 'spec-2') return { id: 'spec-2', moduleId: 'orders', title: 'Order Spec' };
      return null;
    },
  });

  const createMockImportProvider = (): ImportGraphProvider => ({
    getImporters: (filePath: string) => {
      if (filePath === 'src/users/user.ts') {
        return ['src/orders/order.ts', 'src/auth/auth.ts'];
      }
      if (filePath === 'src/orders/order.ts') {
        return ['src/api/orders.ts'];
      }
      return [];
    },
    getImports: (filePath: string) => {
      if (filePath === 'src/orders/order.ts') {
        return ['src/users/user.ts'];
      }
      return [];
    },
  });

  const createMockDataFlowProvider = (): DataFlowProvider => ({
    getEntityFlows: (entityName: string) => {
      if (entityName === 'User') {
        return [
          {
            from: 'UserService',
            to: 'Database',
            entities: ['User', 'Profile'],
            strength: 'critical',
          },
        ];
      }
      return [];
    },
  });

  // Helper to create mock parsed change
  const createMockParsed = (overrides: Partial<ParsedChange> = {}): ParsedChange => ({
    entities: ['User'],
    operations: [{ type: 'add', target: 'feature', description: 'add feature' }],
    keywords: ['user', 'profile'],
    changeType: 'feature',
    confidence: 0.8,
    ...overrides,
  });

  // Helper to create mock input
  const createMockInput = (overrides: Partial<ChangeInput> = {}): ChangeInput => ({
    description: 'Add user profile feature',
    ...overrides,
  });

  beforeEach(() => {
    detector = new ScopeDetector();
  });

  describe('detect', () => {
    it('should detect scope with minimal input', () => {
      const input = createMockInput();
      const parsed = createMockParsed();

      const scope = detector.detect(input, parsed);

      expect(scope).toBeDefined();
      expect(scope.primaryModules).toEqual([]);
      expect(scope.primaryFiles).toEqual([]);
      expect(scope.dependentModules).toEqual([]);
      expect(scope.affectedFiles).toEqual([]);
      expect(scope.affectedEntities).toContain('User');
    });

    it('should detect primary modules from explicit input', () => {
      const input = createMockInput({ targetModules: ['users', 'orders'] });
      const parsed = createMockParsed();

      const scope = detector.detect(input, parsed);

      expect(scope.primaryModules).toContain('users');
      expect(scope.primaryModules).toContain('orders');
    });

    it('should detect primary files from explicit input', () => {
      const input = createMockInput({ targetFiles: ['src/users/user.ts'] });
      const parsed = createMockParsed();

      const scope = detector.detect(input, parsed);

      expect(scope.primaryFiles).toContain('src/users/user.ts');
    });

    it('should detect module from file path with provider', () => {
      detector.setProviders({ moduleProvider: createMockModuleProvider() });

      const input = createMockInput({ targetFiles: ['src/users/user.ts'] });
      const parsed = createMockParsed();

      const scope = detector.detect(input, parsed);

      expect(scope.primaryModules).toContain('users');
      expect(scope.primaryFiles).toContain('src/users/user.ts');
    });

    it('should infer modules from entities', () => {
      detector.setProviders({ moduleProvider: createMockModuleProvider() });

      const input = createMockInput();
      const parsed = createMockParsed({ entities: ['User'], keywords: ['users'] });

      const scope = detector.detect(input, parsed);

      // 'users' keyword should match module
      expect(scope.primaryModules).toContain('users');
    });

    it('should infer modules from keywords', () => {
      detector.setProviders({ moduleProvider: createMockModuleProvider() });

      const input = createMockInput();
      const parsed = createMockParsed({ entities: [], keywords: ['auth', 'login'] });

      const scope = detector.detect(input, parsed);

      expect(scope.primaryModules).toContain('auth');
    });
  });

  describe('detect with spec provider', () => {
    it('should detect module from spec', () => {
      detector.setProviders({
        moduleProvider: createMockModuleProvider(),
        specProvider: createMockSpecProvider(),
      });

      const input = createMockInput({ specId: 'spec-1' });
      const parsed = createMockParsed();

      const scope = detector.detect(input, parsed);

      expect(scope.primaryModules).toContain('users');
    });

    it('should expand dependencies from spec', () => {
      detector.setProviders({
        moduleProvider: createMockModuleProvider(),
        specProvider: createMockSpecProvider(),
      });

      const input = createMockInput({ specId: 'spec-1' });
      const parsed = createMockParsed();

      const scope = detector.detect(input, parsed);

      // Should include dependent modules from spec
      expect(scope.dependentModules.some(d => d.moduleId === 'orders')).toBe(true);
      expect(scope.dependentModules.some(d => d.moduleId === 'auth')).toBe(true);
    });
  });

  describe('expandModuleDependencies', () => {
    it('should expand module links', () => {
      detector.setProviders({ moduleProvider: createMockModuleProvider() });

      const input = createMockInput({ targetModules: ['users'] });
      const parsed = createMockParsed();

      const scope = detector.detect(input, parsed);

      // 'orders' depends on 'users' (incoming link)
      expect(scope.dependentModules.some(d => d.moduleId === 'orders')).toBe(true);
    });

    it('should expand cascade dependencies', () => {
      detector.setProviders({ moduleProvider: createMockModuleProvider() });

      const input = createMockInput({ targetModules: ['users'] });
      const parsed = createMockParsed();

      const scope = detector.detect(input, parsed);

      // 'auth' is depended on by 'users' (outgoing depends_on link)
      expect(scope.dependentModules.some(d => d.moduleId === 'auth')).toBe(true);
    });

    it('should classify impact levels correctly', () => {
      detector.setProviders({ moduleProvider: createMockModuleProvider() });

      const input = createMockInput({ targetModules: ['users'] });
      const parsed = createMockParsed();

      const scope = detector.detect(input, parsed);

      // Depth 1 should be direct
      const ordersModule = scope.dependentModules.find(d => d.moduleId === 'orders');
      expect(ordersModule?.impactLevel).toBe('direct');
    });
  });

  describe('expandFileDependencies', () => {
    it('should expand file imports', () => {
      detector.setProviders({
        moduleProvider: createMockModuleProvider(),
        importProvider: createMockImportProvider(),
      });

      const input = createMockInput({ targetFiles: ['src/users/user.ts'] });
      const parsed = createMockParsed();

      const scope = detector.detect(input, parsed);

      // Files that import src/users/user.ts
      expect(scope.affectedFiles.some(f => f.filePath === 'src/orders/order.ts')).toBe(true);
      expect(scope.affectedFiles.some(f => f.filePath === 'src/auth/auth.ts')).toBe(true);
    });

    it('should classify file impact levels', () => {
      detector.setProviders({
        moduleProvider: createMockModuleProvider(),
        importProvider: createMockImportProvider(),
      });

      const input = createMockInput({ targetFiles: ['src/users/user.ts'] });
      const parsed = createMockParsed();

      const scope = detector.detect(input, parsed);

      // Depth 1 should be direct
      const orderFile = scope.affectedFiles.find(f => f.filePath === 'src/orders/order.ts');
      expect(orderFile?.impactLevel).toBe('direct');
    });

    it('should expand imports recursively', () => {
      detector.setProviders({
        moduleProvider: createMockModuleProvider(),
        importProvider: createMockImportProvider(),
      });

      const input = createMockInput({ targetFiles: ['src/users/user.ts'] });
      const parsed = createMockParsed();

      const scope = detector.detect(input, parsed);

      // src/api/orders.ts imports src/orders/order.ts which imports src/users/user.ts
      expect(scope.affectedFiles.some(f => f.filePath === 'src/api/orders.ts')).toBe(true);
    });
  });

  describe('identifyAffectedEntities', () => {
    it('should include primary entities', () => {
      const input = createMockInput();
      const parsed = createMockParsed({ entities: ['User', 'Order'] });

      const scope = detector.detect(input, parsed);

      expect(scope.affectedEntities).toContain('User');
      expect(scope.affectedEntities).toContain('Order');
    });

    it('should expand entities through data flows', () => {
      detector.setProviders({ dataFlowProvider: createMockDataFlowProvider() });

      const input = createMockInput();
      const parsed = createMockParsed({ entities: ['User'] });

      const scope = detector.detect(input, parsed);

      // User flows to Profile
      expect(scope.affectedEntities).toContain('Profile');
    });
  });

  describe('configuration', () => {
    it('should respect maxDepth config', () => {
      detector = new ScopeDetector({ maxDepth: 1 });
      detector.setProviders({
        moduleProvider: createMockModuleProvider(),
        importProvider: createMockImportProvider(),
      });

      const input = createMockInput({ targetFiles: ['src/users/user.ts'] });
      const parsed = createMockParsed();

      const scope = detector.detect(input, parsed);

      // With maxDepth 1, should not include depth 2 files
      expect(scope.affectedFiles.some(f => f.filePath === 'src/api/orders.ts')).toBe(false);
    });

    it('should respect includeIndirect config', () => {
      detector = new ScopeDetector({ includeIndirect: false });
      detector.setProviders({ moduleProvider: createMockModuleProvider() });

      const input = createMockInput({ targetModules: ['users'] });
      const parsed = createMockParsed();

      const scope = detector.detect(input, parsed);

      // With includeIndirect false, should only have depth 1 modules
      const indirectModules = scope.dependentModules.filter(d => d.impactLevel === 'indirect');
      expect(indirectModules).toHaveLength(0);
    });

    it('should respect expandImports config', () => {
      detector = new ScopeDetector({ expandImports: false });
      detector.setProviders({
        moduleProvider: createMockModuleProvider(),
        importProvider: createMockImportProvider(),
      });

      const input = createMockInput({ targetFiles: ['src/users/user.ts'] });
      const parsed = createMockParsed();

      const scope = detector.detect(input, parsed);

      expect(scope.affectedFiles).toHaveLength(0);
    });

    it('should respect expandDataFlows config', () => {
      detector = new ScopeDetector({ expandDataFlows: false });
      detector.setProviders({ dataFlowProvider: createMockDataFlowProvider() });

      const input = createMockInput();
      const parsed = createMockParsed({ entities: ['User'] });

      const scope = detector.detect(input, parsed);

      // Should not expand to Profile
      expect(scope.affectedEntities).not.toContain('Profile');
    });

    it('should update config with setConfig', () => {
      detector.setConfig({ maxDepth: 1 });
      detector.setProviders({
        moduleProvider: createMockModuleProvider(),
        importProvider: createMockImportProvider(),
      });

      const input = createMockInput({ targetFiles: ['src/users/user.ts'] });
      const parsed = createMockParsed();

      const scope = detector.detect(input, parsed);

      expect(scope.expansionDepth).toBe(1);
    });
  });

  describe('entityToModuleName', () => {
    it('should convert PascalCase to kebab-case', () => {
      detector.setProviders({
        moduleProvider: {
          ...createMockModuleProvider(),
          getModuleByName: (name: string) => {
            if (name === 'order-item') {
              return { id: 'order-item', name: 'order-item', paths: 'src/order-item/**' };
            }
            return null;
          },
        },
      });

      const input = createMockInput();
      const parsed = createMockParsed({ entities: ['OrderItem'], keywords: [] });

      const scope = detector.detect(input, parsed);

      expect(scope.primaryModules).toContain('order-item');
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton detector', () => {
      expect(scopeDetector).toBeInstanceOf(ScopeDetector);
    });
  });
});
