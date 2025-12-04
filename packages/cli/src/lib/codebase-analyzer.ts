/**
 * CodebaseAnalyzer - Main orchestrator for codebase analysis
 *
 * Coordinates detection of:
 * - Technology stack
 * - Business modules
 * - Features
 * - Dependencies
 * - Architecture patterns
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import { detectEnhancedTechStack, type EnhancedTechStack } from './tech-stack-detector.js';

// ============================================================================
// Types
// ============================================================================

export interface ModuleInfo {
  id: string;
  name: string;
  description: string;
  path: string;
  language: string;
  type: 'package' | 'service' | 'app' | 'library' | 'module';
  dependencies: string[];
  exports: string[];
  isIndependent: boolean;
}

export interface FeatureInfo {
  id: string;
  name: string;
  description: string;
  moduleId?: string;
  source: 'route' | 'documentation' | 'component';
  status: 'released' | 'in_progress' | 'planned';
  paths: string[];
  tags: string[];
}

export interface DependencyInfo {
  from: string;
  to: string;
  type: 'import' | 'package' | 'service';
}

export interface ArchitectureInfo {
  pattern: 'layered' | 'feature-based' | 'mvc' | 'microservices' | 'monorepo' | 'ddd' | 'unknown';
  confidence: number;
  indicators: string[];
}

export interface AnalysisResult {
  techStack: EnhancedTechStack;
  modules: ModuleInfo[];
  features: FeatureInfo[];
  dependencies: DependencyInfo[];
  architecture: ArchitectureInfo;
  summary: AnalysisSummary;
}

export interface AnalysisSummary {
  moduleCount: number;
  featureCount: number;
  technologyCount: number;
  dependencyCount: number;
  architecturePattern: string;
  primaryLanguage: string;
  projectType: string;
}

// ============================================================================
// CodebaseAnalyzer Class
// ============================================================================

export class CodebaseAnalyzer {
  private projectPath: string;
  private techStack: EnhancedTechStack | null = null;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Run full codebase analysis
   */
  async analyze(): Promise<AnalysisResult> {
    // Step 1: Detect technology stack
    this.techStack = await detectEnhancedTechStack(this.projectPath);

    // Step 2: Detect modules (parallel with architecture)
    const [modules, architecture] = await Promise.all([
      this.detectModules(),
      this.detectArchitecture(),
    ]);

    // Step 3: Detect features (after modules for context)
    const features = await this.detectFeatures(modules);

    // Step 4: Analyze dependencies
    const dependencies = await this.analyzeDependencies(modules);

    // Step 5: Build summary
    const summary = this.buildSummary(modules, features, dependencies, architecture);

    return {
      techStack: this.techStack,
      modules,
      features,
      dependencies,
      architecture,
      summary,
    };
  }

  // ==========================================================================
  // Module Detection (Hybrid: Directory + Import Analysis)
  // ==========================================================================

  private async detectModules(): Promise<ModuleInfo[]> {
    const modules: ModuleInfo[] = [];

    // Scan standard module directories
    const moduleDirs = [
      { pattern: 'packages/*', type: 'package' as const },
      { pattern: 'services/*', type: 'service' as const },
      { pattern: 'apps/*', type: 'app' as const },
      { pattern: 'libs/*', type: 'library' as const },
      { pattern: 'src/modules/*', type: 'module' as const },
      { pattern: 'src/features/*', type: 'module' as const },
    ];

    for (const { pattern, type } of moduleDirs) {
      const dirPath = path.join(this.projectPath, pattern.replace('/*', ''));
      const discovered = await this.scanModuleDirectory(dirPath, type);
      modules.push(...discovered);
    }

    // Validate and enrich modules with import analysis
    for (const module of modules) {
      await this.enrichModuleInfo(module);
    }

    // Filter out invalid modules
    return modules.filter((m) => m.isIndependent || m.exports.length > 0);
  }

  private async scanModuleDirectory(
    dirPath: string,
    type: ModuleInfo['type']
  ): Promise<ModuleInfo[]> {
    const modules: ModuleInfo[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

        const modulePath = path.join(dirPath, entry.name);
        const moduleInfo = await this.analyzeModuleDirectory(modulePath, entry.name, type);

        if (moduleInfo) {
          modules.push(moduleInfo);
        }
      }
    } catch {
      // Directory doesn't exist, skip
    }

    return modules;
  }

  private async analyzeModuleDirectory(
    modulePath: string,
    name: string,
    type: ModuleInfo['type']
  ): Promise<ModuleInfo | null> {
    // Check for package indicators
    const hasPackageJson = await this.fileExists(path.join(modulePath, 'package.json'));
    const hasGoMod = await this.fileExists(path.join(modulePath, 'go.mod'));
    const hasPyProject = await this.fileExists(path.join(modulePath, 'pyproject.toml'));
    const hasSetupPy = await this.fileExists(path.join(modulePath, 'setup.py'));
    const hasSrcDir = await this.fileExists(path.join(modulePath, 'src'));
    const hasIndexFile =
      (await this.fileExists(path.join(modulePath, 'index.ts'))) ||
      (await this.fileExists(path.join(modulePath, 'index.js'))) ||
      (await this.fileExists(path.join(modulePath, 'main.go')));

    // Must have some indicator of being a valid module
    if (!hasPackageJson && !hasGoMod && !hasPyProject && !hasSetupPy && !hasSrcDir && !hasIndexFile) {
      return null;
    }

    // Detect language
    let language = 'unknown';
    if (hasGoMod) {
      language = 'go';
    } else if (hasPyProject || hasSetupPy) {
      language = 'python';
    } else if (hasPackageJson) {
      language = await this.detectPackageLanguage(path.join(modulePath, 'package.json'));
    }

    // Extract description from package.json or README
    const description = await this.extractModuleDescription(modulePath, name);

    return {
      id: `module-${this.slugify(name)}`,
      name: this.formatModuleName(name),
      description,
      path: path.relative(this.projectPath, modulePath),
      language,
      type,
      dependencies: [],
      exports: [],
      isIndependent: hasPackageJson || hasGoMod || hasPyProject || hasSetupPy,
    };
  }

  private async enrichModuleInfo(module: ModuleInfo): Promise<void> {
    const fullPath = path.join(this.projectPath, module.path);

    // Extract dependencies from package.json or go.mod
    if (module.language === 'typescript' || module.language === 'javascript') {
      const packageJsonPath = path.join(fullPath, 'package.json');
      try {
        const content = await fs.readFile(packageJsonPath, 'utf-8');
        const pkg = JSON.parse(content);

        // Get workspace dependencies (internal)
        const allDeps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
        };

        module.dependencies = Object.keys(allDeps).filter(
          (dep) => dep.startsWith('@') && !dep.startsWith('@types/')
        );
      } catch {
        // No package.json
      }
    } else if (module.language === 'go') {
      // Parse go.mod for internal imports
      const goModPath = path.join(fullPath, 'go.mod');
      try {
        const content = await fs.readFile(goModPath, 'utf-8');
        const requireMatch = content.match(/require\s*\([^)]+\)/g);
        if (requireMatch) {
          module.dependencies = requireMatch
            .join('\n')
            .match(/\t([^\s]+)/g)
            ?.map((m) => m.trim()) || [];
        }
      } catch {
        // No go.mod
      }
    }

    // Scan for exports (entry points)
    module.exports = await this.findModuleExports(fullPath, module.language);
  }

  private async findModuleExports(modulePath: string, language: string): Promise<string[]> {
    const exports: string[] = [];

    try {
      if (language === 'typescript' || language === 'javascript') {
        // Check index.ts/index.js
        const indexPath = path.join(modulePath, 'src', 'index.ts');
        if (await this.fileExists(indexPath)) {
          const content = await fs.readFile(indexPath, 'utf-8');
          const exportMatches = content.match(/export\s+(?:const|function|class|type|interface)\s+(\w+)/g);
          if (exportMatches) {
            exports.push(...exportMatches.map((m) => m.split(/\s+/).pop() || ''));
          }
        }
      } else if (language === 'go') {
        // Go exports are capitalized functions
        const mainPath = path.join(modulePath, 'main.go');
        if (await this.fileExists(mainPath)) {
          const content = await fs.readFile(mainPath, 'utf-8');
          const funcMatches = content.match(/func\s+([A-Z]\w+)/g);
          if (funcMatches) {
            exports.push(...funcMatches.map((m) => m.replace('func ', '')));
          }
        }
      }
    } catch {
      // Error reading files
    }

    return exports;
  }

  // ==========================================================================
  // Feature Detection (Routes + Documentation)
  // ==========================================================================

  private async detectFeatures(modules: ModuleInfo[]): Promise<FeatureInfo[]> {
    const features: FeatureInfo[] = [];

    // Source 1: Route definitions
    const routeFeatures = await this.detectRouteFeatures();
    features.push(...routeFeatures);

    // Source 2: Documentation
    const docFeatures = await this.detectDocFeatures();
    features.push(...docFeatures);

    // Deduplicate and merge
    return this.mergeFeatures(features, modules);
  }

  private async detectRouteFeatures(): Promise<FeatureInfo[]> {
    const features: FeatureInfo[] = [];

    // Common route file patterns
    const routePatterns = [
      'src/routes/**/*.ts',
      'src/api/**/*.ts',
      'src/controllers/**/*.ts',
      'pages/api/**/*.ts',
      'app/**/route.ts',
      'routes/**/*.ts',
      'api/**/*.ts',
    ];

    for (const pattern of routePatterns) {
      const basePath = path.join(this.projectPath, pattern.split('**')[0]);
      const routeFiles = await this.findFiles(basePath, /\.(ts|js)$/);

      for (const file of routeFiles) {
        const featureName = this.extractFeatureNameFromPath(file);
        if (featureName && !features.some((f) => f.name === featureName)) {
          features.push({
            id: `feature-${this.slugify(featureName)}`,
            name: featureName,
            description: `API endpoint for ${featureName}`,
            source: 'route',
            status: 'released',
            paths: [path.relative(this.projectPath, file)],
            tags: ['api'],
          });
        }
      }
    }

    return features;
  }

  private async detectDocFeatures(): Promise<FeatureInfo[]> {
    const features: FeatureInfo[] = [];

    // Parse README.md for features section
    const readmePath = path.join(this.projectPath, 'README.md');
    try {
      const content = await fs.readFile(readmePath, 'utf-8');
      const featuresSection = content.match(/##\s*Features?\s*\n([\s\S]*?)(?=\n##|$)/i);

      if (featuresSection) {
        const featureLines = featuresSection[1].match(/[-*]\s*\*?\*?([^*\n]+)\*?\*?/g);
        if (featureLines) {
          for (const line of featureLines) {
            const name = line.replace(/[-*]/g, '').trim();
            if (name.length > 3 && name.length < 100) {
              features.push({
                id: `feature-${this.slugify(name)}`,
                name,
                description: `Documented feature: ${name}`,
                source: 'documentation',
                status: 'released',
                paths: ['README.md'],
                tags: ['documented'],
              });
            }
          }
        }
      }
    } catch {
      // No README or parse error
    }

    // Parse docs/features/*.md
    const docsPath = path.join(this.projectPath, 'docs', 'features');
    try {
      const files = await fs.readdir(docsPath);
      for (const file of files) {
        if (file.endsWith('.md')) {
          const name = this.formatModuleName(file.replace('.md', ''));
          features.push({
            id: `feature-${this.slugify(name)}`,
            name,
            description: `Feature documented in docs/features/${file}`,
            source: 'documentation',
            status: 'released',
            paths: [`docs/features/${file}`],
            tags: ['documented'],
          });
        }
      }
    } catch {
      // No docs/features directory
    }

    return features;
  }

  private mergeFeatures(features: FeatureInfo[], modules: ModuleInfo[]): FeatureInfo[] {
    const merged = new Map<string, FeatureInfo>();

    for (const feature of features) {
      const existing = merged.get(feature.name.toLowerCase());
      if (existing) {
        // Merge paths
        existing.paths.push(...feature.paths);
        // Prefer route source over doc
        if (feature.source === 'route') {
          existing.source = 'route';
        }
      } else {
        // Try to associate with a module
        const relatedModule = modules.find((m) =>
          feature.paths.some((p) => p.includes(m.path))
        );
        if (relatedModule) {
          feature.moduleId = relatedModule.id;
        }
        merged.set(feature.name.toLowerCase(), feature);
      }
    }

    return Array.from(merged.values());
  }

  // ==========================================================================
  // Dependency Analysis
  // ==========================================================================

  private async analyzeDependencies(modules: ModuleInfo[]): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];

    // Create module ID lookup
    const moduleByPath = new Map<string, string>();
    for (const module of modules) {
      moduleByPath.set(module.path, module.id);
    }

    // Analyze each module's dependencies
    for (const module of modules) {
      for (const dep of module.dependencies) {
        // Check if dependency is an internal module
        const depModule = modules.find(
          (m) => m.name === dep || dep.includes(m.name.toLowerCase())
        );

        if (depModule) {
          dependencies.push({
            from: module.id,
            to: depModule.id,
            type: 'package',
          });
        }
      }
    }

    return dependencies;
  }

  // ==========================================================================
  // Architecture Detection
  // ==========================================================================

  private async detectArchitecture(): Promise<ArchitectureInfo> {
    const indicators: string[] = [];
    let pattern: ArchitectureInfo['pattern'] = 'unknown';
    let confidence = 0;

    // Check for monorepo
    const hasPackages = await this.fileExists(path.join(this.projectPath, 'packages'));
    const hasTurbo = await this.fileExists(path.join(this.projectPath, 'turbo.json'));
    const hasNx = await this.fileExists(path.join(this.projectPath, 'nx.json'));
    const hasLerna = await this.fileExists(path.join(this.projectPath, 'lerna.json'));

    if (hasPackages && (hasTurbo || hasNx || hasLerna)) {
      pattern = 'monorepo';
      confidence = 0.9;
      indicators.push('packages/ directory', hasTurbo ? 'turbo.json' : hasNx ? 'nx.json' : 'lerna.json');
    }

    // Check for microservices
    const hasServices = await this.fileExists(path.join(this.projectPath, 'services'));
    const hasDockerCompose = await this.fileExists(path.join(this.projectPath, 'docker-compose.yml'));

    if (hasServices && hasDockerCompose) {
      if (pattern === 'monorepo') {
        indicators.push('services/ directory', 'docker-compose.yml');
      } else {
        pattern = 'microservices';
        confidence = 0.85;
        indicators.push('services/ directory', 'docker-compose.yml');
      }
    }

    // Check for layered architecture
    const hasControllers = await this.fileExists(path.join(this.projectPath, 'src', 'controllers'));
    const hasServicesDir = await this.fileExists(path.join(this.projectPath, 'src', 'services'));
    const hasRepositories = await this.fileExists(path.join(this.projectPath, 'src', 'repositories'));

    if (hasControllers && hasServicesDir) {
      if (pattern === 'unknown') {
        pattern = 'layered';
        confidence = 0.8;
      }
      indicators.push('controllers/', 'services/', hasRepositories ? 'repositories/' : '');
    }

    // Check for MVC
    const hasModels = await this.fileExists(path.join(this.projectPath, 'src', 'models'));
    const hasViews = await this.fileExists(path.join(this.projectPath, 'src', 'views'));

    if (hasModels && hasViews && hasControllers) {
      if (pattern === 'unknown' || pattern === 'layered') {
        pattern = 'mvc';
        confidence = 0.85;
      }
      indicators.push('models/', 'views/', 'controllers/');
    }

    // Check for feature-based / DDD
    const hasFeatures = await this.fileExists(path.join(this.projectPath, 'src', 'features'));
    const hasDomains = await this.fileExists(path.join(this.projectPath, 'src', 'domains'));
    const hasModules = await this.fileExists(path.join(this.projectPath, 'src', 'modules'));

    if (hasDomains) {
      pattern = 'ddd';
      confidence = 0.85;
      indicators.push('domains/');
    } else if (hasFeatures || hasModules) {
      if (pattern === 'unknown') {
        pattern = 'feature-based';
        confidence = 0.8;
      }
      indicators.push(hasFeatures ? 'features/' : 'modules/');
    }

    return {
      pattern,
      confidence,
      indicators: indicators.filter((i) => i !== ''),
    };
  }

  // ==========================================================================
  // Summary Builder
  // ==========================================================================

  private buildSummary(
    modules: ModuleInfo[],
    features: FeatureInfo[],
    dependencies: DependencyInfo[],
    architecture: ArchitectureInfo
  ): AnalysisSummary {
    return {
      moduleCount: modules.length,
      featureCount: features.length,
      technologyCount: this.techStack?.all.length || 0,
      dependencyCount: dependencies.length,
      architecturePattern: architecture.pattern,
      primaryLanguage: this.techStack?.languages.primary || 'unknown',
      projectType: this.techStack?.projectStructure.type || 'standard',
    };
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async findFiles(dirPath: string, pattern: RegExp): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const subFiles = await this.findFiles(fullPath, pattern);
          files.push(...subFiles);
        } else if (entry.isFile() && pattern.test(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist
    }

    return files;
  }

  private async detectPackageLanguage(packageJsonPath: string): Promise<string> {
    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);

      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      if (allDeps.typescript || allDeps['ts-node']) {
        return 'typescript';
      }
      return 'javascript';
    } catch {
      return 'javascript';
    }
  }

  private async extractModuleDescription(modulePath: string, name: string): Promise<string> {
    // Try package.json description
    try {
      const pkgPath = path.join(modulePath, 'package.json');
      const content = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);
      if (pkg.description) {
        return pkg.description;
      }
    } catch {
      // No package.json
    }

    // Try README.md first line
    try {
      const readmePath = path.join(modulePath, 'README.md');
      const content = await fs.readFile(readmePath, 'utf-8');
      const firstParagraph = content.match(/^#[^\n]+\n+([^\n#]+)/);
      if (firstParagraph) {
        return firstParagraph[1].trim().slice(0, 200);
      }
    } catch {
      // No README
    }

    return `${this.formatModuleName(name)} module`;
  }

  private extractFeatureNameFromPath(filePath: string): string {
    const relativePath = path.relative(this.projectPath, filePath);
    const parts = relativePath.split(path.sep);

    // Get meaningful name from path
    const fileName = path.basename(filePath, path.extname(filePath));

    if (fileName === 'index' || fileName === 'route') {
      // Use parent directory name
      const parentDir = parts[parts.length - 2];
      return this.formatModuleName(parentDir);
    }

    return this.formatModuleName(fileName);
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private formatModuleName(name: string): string {
    return name
      .replace(/[-_]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

// ============================================================================
// Convenience Function
// ============================================================================

export async function analyzeCodebase(projectPath: string): Promise<AnalysisResult> {
  const analyzer = new CodebaseAnalyzer(projectPath);
  return analyzer.analyze();
}
