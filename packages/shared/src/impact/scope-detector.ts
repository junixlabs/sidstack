/**
 * Scope Detector
 *
 * Detects the scope of a change by:
 * - Identifying primary modules/files
 * - Expanding dependencies (spec relationships, imports, data flows)
 * - Classifying impact levels (direct, indirect, cascade)
 */

import type {
  ChangeInput,
  ParsedChange,
  ChangeScope,
  ScopedModule,
  ScopedFile,
  ImpactLevel,
} from './types';

// =============================================================================
// Configuration
// =============================================================================

export interface ScopeDetectorConfig {
  /** Maximum depth for dependency expansion */
  maxDepth: number;
  /** Whether to include indirect dependencies */
  includeIndirect: boolean;
  /** Whether to expand file imports */
  expandImports: boolean;
  /** Whether to expand data flows */
  expandDataFlows: boolean;
}

const DEFAULT_CONFIG: ScopeDetectorConfig = {
  maxDepth: 3,
  includeIndirect: true,
  expandImports: true,
  expandDataFlows: true,
};

// =============================================================================
// Module Knowledge Interface
// =============================================================================

/**
 * Interface for module knowledge provider
 * This abstracts the module detection logic for testing
 */
export interface ModuleKnowledgeProvider {
  /** Get module by ID */
  getModule(id: string): { id: string; name: string; paths: string } | null;
  /** Get module by name */
  getModuleByName(name: string): { id: string; name: string; paths: string } | null;
  /** List all modules */
  listModules(): Array<{ id: string; name: string; paths: string }>;
  /** Detect module from file path */
  detectModuleFromPath(filePath: string): { id: string; name: string; paths: string } | null;
  /** Get module dependencies */
  getModuleLinks(moduleId: string): {
    outgoing: Array<{ targetModuleId: string; linkType: string }>;
    incoming: Array<{ sourceModuleId: string; linkType: string }>;
  };
}

// =============================================================================
// Spec Provider Interface
// =============================================================================

/**
 * Interface for spec relationships
 */
export interface SpecProvider {
  /** Get spec dependencies */
  getSpecDependencies(specId: string): Array<{
    specId: string;
    moduleId?: string;
    relationship: 'dependsOn' | 'relatesTo';
  }>;
  /** Get spec by ID */
  getSpec(specId: string): {
    id: string;
    moduleId?: string;
    title: string;
  } | null;
}

// =============================================================================
// Import Graph Interface
// =============================================================================

/**
 * Interface for file import analysis
 */
export interface ImportGraphProvider {
  /** Get files that import from a given file */
  getImporters(filePath: string): string[];
  /** Get files that a given file imports from */
  getImports(filePath: string): string[];
}

// =============================================================================
// Data Flow Interface
// =============================================================================

/**
 * Interface for data flow relationships
 */
export interface DataFlowProvider {
  /** Get data flows involving an entity */
  getEntityFlows(entityName: string): Array<{
    from: string;
    to: string;
    entities: string[];
    strength: 'critical' | 'important' | 'optional';
  }>;
}

// =============================================================================
// Scope Detector Class
// =============================================================================

export class ScopeDetector {
  private config: ScopeDetectorConfig;
  private moduleProvider?: ModuleKnowledgeProvider;
  private specProvider?: SpecProvider;
  private importProvider?: ImportGraphProvider;
  private dataFlowProvider?: DataFlowProvider;

  constructor(
    config: Partial<ScopeDetectorConfig> = {},
    providers?: {
      moduleProvider?: ModuleKnowledgeProvider;
      specProvider?: SpecProvider;
      importProvider?: ImportGraphProvider;
      dataFlowProvider?: DataFlowProvider;
    }
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.moduleProvider = providers?.moduleProvider;
    this.specProvider = providers?.specProvider;
    this.importProvider = providers?.importProvider;
    this.dataFlowProvider = providers?.dataFlowProvider;
  }

  /**
   * Detect the scope of a change
   */
  detect(input: ChangeInput, parsed: ParsedChange): ChangeScope {
    // Step 1: Identify primary modules and files
    const { primaryModules, primaryFiles } = this.identifyPrimary(input, parsed);

    // Step 2: Expand dependencies
    const dependentModules = this.expandModuleDependencies(
      primaryModules,
      input.specId
    );

    // Step 3: Expand file dependencies
    const affectedFiles = this.expandFileDependencies(primaryFiles);

    // Step 4: Identify affected entities
    const affectedEntities = this.identifyAffectedEntities(
      parsed.entities,
      dependentModules
    );

    return {
      primaryModules,
      primaryFiles,
      dependentModules,
      affectedFiles,
      affectedEntities,
      expansionDepth: this.config.maxDepth,
    };
  }

  /**
   * Identify primary modules and files from input
   */
  private identifyPrimary(
    input: ChangeInput,
    parsed: ParsedChange
  ): { primaryModules: string[]; primaryFiles: string[] } {
    const primaryModules = new Set<string>();
    const primaryFiles = new Set<string>();

    // From explicit input
    if (input.targetModules) {
      for (const module of input.targetModules) {
        primaryModules.add(module);
      }
    }

    if (input.targetFiles) {
      for (const file of input.targetFiles) {
        primaryFiles.add(file);

        // Try to detect module from file path
        if (this.moduleProvider) {
          const module = this.moduleProvider.detectModuleFromPath(file);
          if (module) {
            primaryModules.add(module.id);
          }
        }
      }
    }

    // From spec
    if (input.specId && this.specProvider) {
      const spec = this.specProvider.getSpec(input.specId);
      if (spec?.moduleId) {
        primaryModules.add(spec.moduleId);
      }
    }

    // Infer from parsed entities and keywords
    if (this.moduleProvider && primaryModules.size === 0) {
      // Try to match entities to module names
      for (const entity of parsed.entities) {
        const moduleName = this.entityToModuleName(entity);
        const module = this.moduleProvider.getModuleByName(moduleName);
        if (module) {
          primaryModules.add(module.id);
        }
      }

      // Try to match keywords to module names
      for (const keyword of parsed.keywords) {
        const module = this.moduleProvider.getModuleByName(keyword);
        if (module) {
          primaryModules.add(module.id);
        }
      }
    }

    return {
      primaryModules: Array.from(primaryModules),
      primaryFiles: Array.from(primaryFiles),
    };
  }

  /**
   * Convert entity name to potential module name
   */
  private entityToModuleName(entity: string): string {
    // User -> users, OrderItem -> order-items
    return entity
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '')
      .replace(/-+/g, '-');
  }

  /**
   * Expand module dependencies
   */
  private expandModuleDependencies(
    primaryModules: string[],
    specId?: string
  ): ScopedModule[] {
    const dependentModules: ScopedModule[] = [];
    const visited = new Set<string>(primaryModules);
    const queue: Array<{
      moduleId: string;
      depth: number;
      path: string[];
      reason: string;
    }> = [];

    // Initialize queue with primary modules
    for (const moduleId of primaryModules) {
      queue.push({
        moduleId,
        depth: 0,
        path: [],
        reason: 'primary',
      });
    }

    // Expand from spec dependencies if available
    if (specId && this.specProvider) {
      const specDeps = this.specProvider.getSpecDependencies(specId);
      for (const dep of specDeps) {
        if (dep.moduleId && !visited.has(dep.moduleId)) {
          visited.add(dep.moduleId);
          queue.push({
            moduleId: dep.moduleId,
            depth: 1,
            path: ['spec:' + specId],
            reason: `Spec ${dep.relationship}: ${dep.specId}`,
          });
        }
      }
    }

    // BFS expansion
    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.depth > 0) {
        // Add to dependent modules (skip primary)
        const impactLevel = this.depthToImpactLevel(current.depth);

        let moduleName = current.moduleId;
        if (this.moduleProvider) {
          const module = this.moduleProvider.getModule(current.moduleId);
          if (module) {
            moduleName = module.name;
          }
        }

        dependentModules.push({
          moduleId: current.moduleId,
          moduleName,
          impactLevel,
          dependencyPath: current.path,
          reason: current.reason,
        });
      }

      // Stop if at max depth
      if (current.depth >= this.config.maxDepth) {
        continue;
      }

      // Skip indirect if not enabled
      if (!this.config.includeIndirect && current.depth > 0) {
        continue;
      }

      // Expand module links
      if (this.moduleProvider) {
        const links = this.moduleProvider.getModuleLinks(current.moduleId);

        // Process modules that depend on current module
        for (const link of links.incoming) {
          if (!visited.has(link.sourceModuleId)) {
            visited.add(link.sourceModuleId);
            queue.push({
              moduleId: link.sourceModuleId,
              depth: current.depth + 1,
              path: [...current.path, current.moduleId],
              reason: `${link.linkType} ${current.moduleId}`,
            });
          }
        }

        // Process modules that current module depends on (for cascade analysis)
        for (const link of links.outgoing) {
          if (!visited.has(link.targetModuleId) && link.linkType === 'depends_on') {
            visited.add(link.targetModuleId);
            queue.push({
              moduleId: link.targetModuleId,
              depth: current.depth + 1,
              path: [...current.path, current.moduleId],
              reason: `Cascade from ${current.moduleId}`,
            });
          }
        }
      }
    }

    return dependentModules;
  }

  /**
   * Convert depth to impact level
   */
  private depthToImpactLevel(depth: number): ImpactLevel {
    if (depth <= 1) return 'direct';
    if (depth === 2) return 'indirect';
    return 'cascade';
  }

  /**
   * Expand file dependencies through imports
   */
  private expandFileDependencies(primaryFiles: string[]): ScopedFile[] {
    const affectedFiles: ScopedFile[] = [];

    if (!this.config.expandImports || !this.importProvider) {
      return affectedFiles;
    }

    const visited = new Set<string>(primaryFiles);
    const queue: Array<{
      filePath: string;
      depth: number;
      reason: string;
    }> = [];

    // Initialize queue
    for (const file of primaryFiles) {
      queue.push({ filePath: file, depth: 0, reason: 'primary' });
    }

    // BFS expansion
    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.depth > 0) {
        let moduleId: string | undefined;
        if (this.moduleProvider) {
          const module = this.moduleProvider.detectModuleFromPath(current.filePath);
          moduleId = module?.id;
        }

        affectedFiles.push({
          filePath: current.filePath,
          impactLevel: this.depthToImpactLevel(current.depth),
          moduleId,
          reason: current.reason,
        });
      }

      // Stop at max depth
      if (current.depth >= this.config.maxDepth) {
        continue;
      }

      // Get files that import this file
      const importers = this.importProvider.getImporters(current.filePath);
      for (const importer of importers) {
        if (!visited.has(importer)) {
          visited.add(importer);
          queue.push({
            filePath: importer,
            depth: current.depth + 1,
            reason: `imports ${current.filePath.split('/').pop()}`,
          });
        }
      }
    }

    return affectedFiles;
  }

  /**
   * Identify affected entities through data flows
   */
  private identifyAffectedEntities(
    primaryEntities: string[],
    _dependentModules: ScopedModule[]
  ): string[] {
    const affectedEntities = new Set<string>(primaryEntities);

    if (!this.config.expandDataFlows || !this.dataFlowProvider) {
      return Array.from(affectedEntities);
    }

    // Expand entities through data flows
    for (const entity of primaryEntities) {
      const flows = this.dataFlowProvider.getEntityFlows(entity);
      for (const flow of flows) {
        for (const relatedEntity of flow.entities) {
          affectedEntities.add(relatedEntity);
        }
      }
    }

    return Array.from(affectedEntities);
  }

  /**
   * Set providers for testing or runtime configuration
   */
  setProviders(providers: {
    moduleProvider?: ModuleKnowledgeProvider;
    specProvider?: SpecProvider;
    importProvider?: ImportGraphProvider;
    dataFlowProvider?: DataFlowProvider;
  }): void {
    if (providers.moduleProvider) this.moduleProvider = providers.moduleProvider;
    if (providers.specProvider) this.specProvider = providers.specProvider;
    if (providers.importProvider) this.importProvider = providers.importProvider;
    if (providers.dataFlowProvider) this.dataFlowProvider = providers.dataFlowProvider;
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<ScopeDetectorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// =============================================================================
// Export singleton instance
// =============================================================================

export const scopeDetector = new ScopeDetector();
