/**
 * SpecDrivenAnalyzer - Generate project specs as Markdown files
 *
 * Inspired by OpenSpec, this analyzer creates a file-based representation
 * of the project structure using Markdown + Mermaid diagrams.
 *
 * Output structure:
 * .sidstack/
 * ├── project.md       # Project overview with dependency diagram
 * ├── modules/
 * │   ├── cli.md       # Module spec for CLI package
 * │   └── ...
 * └── index.md         # Navigation index
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

export interface ModuleSpec {
  id: string;
  name: string;
  displayName: string;
  description: string;
  path: string;
  type: 'package' | 'service' | 'app' | 'library';
  language: 'typescript' | 'javascript' | 'go' | 'python' | 'rust' | 'unknown';
  dependencies: {
    internal: string[];
    external: string[];
  };
  entryPoints: string[];
  features: string[];
}

export interface ProjectSpec {
  name: string;
  description: string;
  rootPath: string;
  modules: ModuleSpec[];
  techStack: string[];
}

export interface AnalyzerOptions {
  force?: boolean;
  outputDir?: string;
  validate?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  file: string;
  line?: number;
  message: string;
  type: 'mermaid' | 'markdown' | 'structure' | 'link';
}

export interface ValidationWarning {
  file: string;
  message: string;
  suggestion?: string;
}

// ============================================================================
// SpecDrivenAnalyzer Class
// ============================================================================

export class SpecDrivenAnalyzer {
  private projectPath: string;
  private options: AnalyzerOptions;

  constructor(projectPath: string, options: AnalyzerOptions = {}) {
    this.projectPath = projectPath;
    this.options = {
      force: false,
      outputDir: '.sidstack',
      validate: true,
      ...options,
    };
  }

  /**
   * Run full analysis and generate spec files
   */
  async analyze(): Promise<ProjectSpec> {
    const outputDir = path.join(this.projectPath, this.options.outputDir!);

    // Check if output exists and not forcing
    if (!this.options.force) {
      try {
        await fs.access(outputDir);
        const projectMd = path.join(outputDir, 'project.md');
        await fs.access(projectMd);
        console.log(`Specs already exist at ${outputDir}. Use --force to regenerate.`);
      } catch {
        // Directory doesn't exist, continue
      }
    }

    // Step 1: Detect modules
    console.log('Detecting modules...');
    const modules = await this.detectModules();
    console.log(`Found ${modules.length} modules`);

    // Step 2: Analyze dependencies
    console.log('Analyzing dependencies...');
    for (const module of modules) {
      await this.analyzeDependencies(module);
    }

    // Step 3: Build project spec
    const projectSpec = await this.buildProjectSpec(modules);

    // Step 4: Generate output files
    console.log('Generating spec files...');
    await this.generateOutput(projectSpec);

    return projectSpec;
  }

  /**
   * Detect all modules in the project
   */
  private async detectModules(): Promise<ModuleSpec[]> {
    const modules: ModuleSpec[] = [];

    // Scan standard directories
    const scanConfigs = [
      { dir: 'packages', type: 'package' as const },
      { dir: 'services', type: 'service' as const },
      { dir: 'apps', type: 'app' as const },
      { dir: 'libs', type: 'library' as const },
    ];

    for (const { dir, type } of scanConfigs) {
      const dirPath = path.join(this.projectPath, dir);
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            const modulePath = path.join(dirPath, entry.name);
            const module = await this.analyzeModule(modulePath, type);
            if (module) {
              modules.push(module);
            }
          }
        }
      } catch {
        // Directory doesn't exist, skip
      }
    }

    return modules;
  }

  /**
   * Analyze a single module
   */
  private async analyzeModule(
    modulePath: string,
    type: ModuleSpec['type']
  ): Promise<ModuleSpec | null> {
    const name = path.basename(modulePath);
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');

    // Detect language
    const language = await this.detectLanguage(modulePath);
    if (language === 'unknown') {
      return null; // Skip non-code directories
    }

    // Get description from package.json or go.mod
    const description = await this.getModuleDescription(modulePath, language);

    // Get entry points
    const entryPoints = await this.detectEntryPoints(modulePath, language);

    return {
      id,
      name,
      displayName: this.formatDisplayName(name),
      description,
      path: path.relative(this.projectPath, modulePath),
      type,
      language,
      dependencies: {
        internal: [],
        external: [],
      },
      entryPoints,
      features: [],
    };
  }

  /**
   * Detect programming language of a module
   */
  private async detectLanguage(modulePath: string): Promise<ModuleSpec['language']> {
    const checks = [
      { file: 'package.json', lang: 'typescript' as const },
      { file: 'tsconfig.json', lang: 'typescript' as const },
      { file: 'go.mod', lang: 'go' as const },
      { file: 'Cargo.toml', lang: 'rust' as const },
      { file: 'pyproject.toml', lang: 'python' as const },
      { file: 'setup.py', lang: 'python' as const },
    ];

    for (const { file, lang } of checks) {
      try {
        await fs.access(path.join(modulePath, file));
        return lang;
      } catch {
        // File doesn't exist
      }
    }

    // Check for .js files (JavaScript without TypeScript)
    try {
      const files = await fs.readdir(modulePath);
      if (files.some(f => f.endsWith('.js') || f.endsWith('.jsx'))) {
        return 'javascript';
      }
    } catch {
      // Skip
    }

    return 'unknown';
  }

  /**
   * Get module description from manifest file
   */
  private async getModuleDescription(
    modulePath: string,
    language: ModuleSpec['language']
  ): Promise<string> {
    if (language === 'typescript' || language === 'javascript') {
      try {
        const pkgPath = path.join(modulePath, 'package.json');
        const content = await fs.readFile(pkgPath, 'utf-8');
        const pkg = JSON.parse(content);
        return pkg.description || '';
      } catch {
        // No package.json
      }
    }

    if (language === 'go') {
      try {
        const modPath = path.join(modulePath, 'go.mod');
        const content = await fs.readFile(modPath, 'utf-8');
        const lines = content.split('\n');
        // First line after module declaration might be a comment
        for (const line of lines) {
          if (line.startsWith('//')) {
            return line.replace(/^\/\/\s*/, '');
          }
        }
      } catch {
        // No go.mod
      }
    }

    return '';
  }

  /**
   * Detect entry points of a module
   */
  private async detectEntryPoints(
    modulePath: string,
    language: ModuleSpec['language']
  ): Promise<string[]> {
    const entryPoints: string[] = [];

    if (language === 'typescript' || language === 'javascript') {
      const commonEntries = ['src/index.ts', 'src/index.js', 'index.ts', 'index.js'];
      for (const entry of commonEntries) {
        try {
          await fs.access(path.join(modulePath, entry));
          entryPoints.push(entry);
          break;
        } catch {
          // File doesn't exist
        }
      }
    }

    if (language === 'go') {
      try {
        const cmdPath = path.join(modulePath, 'cmd');
        const entries = await fs.readdir(cmdPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            entryPoints.push(`cmd/${entry.name}/main.go`);
          }
        }
      } catch {
        // No cmd directory, check for main.go
        try {
          await fs.access(path.join(modulePath, 'main.go'));
          entryPoints.push('main.go');
        } catch {
          // No main.go
        }
      }
    }

    return entryPoints;
  }

  /**
   * Analyze dependencies of a module
   */
  private async analyzeDependencies(module: ModuleSpec): Promise<void> {
    const modulePath = path.join(this.projectPath, module.path);

    if (module.language === 'typescript' || module.language === 'javascript') {
      try {
        const pkgPath = path.join(modulePath, 'package.json');
        const content = await fs.readFile(pkgPath, 'utf-8');
        const pkg = JSON.parse(content);

        const deps = Object.keys(pkg.dependencies || {});
        for (const dep of deps) {
          if (dep.startsWith('@sidstack/')) {
            module.dependencies.internal.push(dep.replace('@sidstack/', ''));
          } else {
            module.dependencies.external.push(dep);
          }
        }
      } catch {
        // No package.json
      }
    }

    if (module.language === 'go') {
      try {
        const modPath = path.join(modulePath, 'go.mod');
        const content = await fs.readFile(modPath, 'utf-8');
        const lines = content.split('\n');

        let inRequire = false;
        for (const line of lines) {
          if (line.includes('require (')) {
            inRequire = true;
            continue;
          }
          if (line.includes(')')) {
            inRequire = false;
            continue;
          }
          if (inRequire) {
            const match = line.trim().match(/^([^\s]+)/);
            if (match) {
              module.dependencies.external.push(match[1]);
            }
          }
        }
      } catch {
        // No go.mod
      }
    }
  }

  /**
   * Build complete project spec
   */
  private async buildProjectSpec(modules: ModuleSpec[]): Promise<ProjectSpec> {
    // Try to get project name from root package.json
    let name = path.basename(this.projectPath);
    let description = '';

    try {
      const pkgPath = path.join(this.projectPath, 'package.json');
      const content = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);
      name = pkg.name || name;
      description = pkg.description || '';
    } catch {
      // No root package.json
    }

    // Collect tech stack
    const techStack = new Set<string>();
    for (const module of modules) {
      if (module.language !== 'unknown') {
        techStack.add(module.language);
      }
    }

    return {
      name,
      description,
      rootPath: this.projectPath,
      modules,
      techStack: Array.from(techStack),
    };
  }

  /**
   * Generate output files
   */
  private async generateOutput(spec: ProjectSpec): Promise<void> {
    const outputDir = path.join(this.projectPath, this.options.outputDir!);

    // Create directories
    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(path.join(outputDir, 'modules'), { recursive: true });

    // Generate project.md
    await this.generateProjectMd(spec, outputDir);

    // Generate module specs
    for (const module of spec.modules) {
      await this.generateModuleMd(module, outputDir);
    }

    // Generate index.md
    await this.generateIndexMd(spec, outputDir);

    console.log(`Specs generated at ${outputDir}`);
  }

  /**
   * Generate project.md with Mermaid diagram
   */
  private async generateProjectMd(spec: ProjectSpec, outputDir: string): Promise<void> {
    const mermaidDiagram = this.generateDependencyDiagram(spec.modules);

    const content = `# ${spec.name}

${spec.description}

## Overview

- **Modules**: ${spec.modules.length}
- **Tech Stack**: ${spec.techStack.join(', ')}

## Architecture

\`\`\`mermaid
${mermaidDiagram}
\`\`\`

## Modules

| Module | Type | Language | Description |
|--------|------|----------|-------------|
${spec.modules.map(m => `| [${m.displayName}](modules/${m.id}.md) | ${m.type} | ${m.language} | ${m.description} |`).join('\n')}

## Quick Navigation

${spec.modules.map(m => `- [${m.displayName}](modules/${m.id}.md)`).join('\n')}
`;

    await fs.writeFile(path.join(outputDir, 'project.md'), content);
  }

  /**
   * Generate Mermaid dependency diagram
   */
  private generateDependencyDiagram(modules: ModuleSpec[]): string {
    const lines: string[] = ['graph TD'];

    // Add nodes
    for (const module of modules) {
      const nodeId = module.id.replace(/-/g, '_');
      const label = module.displayName;
      const shape = module.type === 'service' ? `((${label}))` : `[${label}]`;
      lines.push(`    ${nodeId}${shape}`);
    }

    // Add edges
    for (const module of modules) {
      const fromId = module.id.replace(/-/g, '_');
      for (const dep of module.dependencies.internal) {
        const depModule = modules.find(m => m.name === dep || m.id === dep);
        if (depModule) {
          const toId = depModule.id.replace(/-/g, '_');
          lines.push(`    ${fromId} --> ${toId}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate module spec file
   */
  private async generateModuleMd(module: ModuleSpec, outputDir: string): Promise<void> {
    const content = `# ${module.displayName}

${module.description}

## Overview

| Property | Value |
|----------|-------|
| **Path** | \`${module.path}\` |
| **Type** | ${module.type} |
| **Language** | ${module.language} |

## Entry Points

${module.entryPoints.length > 0 ? module.entryPoints.map(e => `- \`${e}\``).join('\n') : '_None detected_'}

## Dependencies

### Internal

${module.dependencies.internal.length > 0 ? module.dependencies.internal.map(d => `- [${d}](${d}.md)`).join('\n') : '_None_'}

### External

${module.dependencies.external.length > 0 ? module.dependencies.external.slice(0, 20).map(d => `- \`${d}\``).join('\n') : '_None_'}
${module.dependencies.external.length > 20 ? `\n_...and ${module.dependencies.external.length - 20} more_` : ''}

---

[← Back to Project](../project.md)
`;

    await fs.writeFile(path.join(outputDir, 'modules', `${module.id}.md`), content);
  }

  /**
   * Generate index.md with navigation
   */
  private async generateIndexMd(spec: ProjectSpec, outputDir: string): Promise<void> {
    const content = `# ${spec.name} - Spec Index

This directory contains auto-generated specs for the project.

## Contents

- [Project Overview](project.md) - Architecture and module diagram

### Modules

${spec.modules.map(m => `- [${m.displayName}](modules/${m.id}.md) - ${m.description || m.type}`).join('\n')}

---

_Generated by SidStack Analyzer_
`;

    await fs.writeFile(path.join(outputDir, 'index.md'), content);
  }

  /**
   * Format module name for display
   */
  private formatDisplayName(name: string): string {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // ==========================================================================
  // Validation Methods
  // ==========================================================================

  /**
   * Validate generated spec files
   */
  async validate(): Promise<ValidationResult> {
    const outputDir = path.join(this.projectPath, this.options.outputDir!);
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Check directory structure
      await this.validateStructure(outputDir, errors, warnings);

      // Validate project.md
      await this.validateProjectMd(outputDir, errors, warnings);

      // Validate module files
      await this.validateModules(outputDir, errors, warnings);

      // Validate links
      await this.validateLinks(outputDir, errors, warnings);

    } catch (error) {
      errors.push({
        file: outputDir,
        message: `Validation failed: ${error instanceof Error ? error.message : error}`,
        type: 'structure',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate directory structure
   */
  private async validateStructure(
    outputDir: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const requiredFiles = ['project.md', 'index.md'];
    const requiredDirs = ['modules'];

    for (const file of requiredFiles) {
      const filePath = path.join(outputDir, file);
      try {
        await fs.access(filePath);
      } catch {
        errors.push({
          file: filePath,
          message: `Required file missing: ${file}`,
          type: 'structure',
        });
      }
    }

    for (const dir of requiredDirs) {
      const dirPath = path.join(outputDir, dir);
      try {
        const stat = await fs.stat(dirPath);
        if (!stat.isDirectory()) {
          errors.push({
            file: dirPath,
            message: `Expected directory but found file: ${dir}`,
            type: 'structure',
          });
        }
      } catch {
        errors.push({
          file: dirPath,
          message: `Required directory missing: ${dir}`,
          type: 'structure',
        });
      }
    }
  }

  /**
   * Validate project.md content
   */
  private async validateProjectMd(
    outputDir: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const projectMdPath = path.join(outputDir, 'project.md');

    try {
      const content = await fs.readFile(projectMdPath, 'utf-8');
      const lines = content.split('\n');

      // Check for required sections
      const requiredSections = ['# ', '## Overview', '## Architecture', '## Modules'];
      for (const section of requiredSections) {
        if (!lines.some(line => line.startsWith(section))) {
          warnings.push({
            file: projectMdPath,
            message: `Missing section: ${section}`,
            suggestion: `Add ${section} section to project.md`,
          });
        }
      }

      // Validate Mermaid block
      const mermaidMatch = content.match(/```mermaid\n([\s\S]*?)```/);
      if (mermaidMatch) {
        const mermaidContent = mermaidMatch[1];
        this.validateMermaidSyntax(mermaidContent, projectMdPath, errors, warnings);
      } else {
        warnings.push({
          file: projectMdPath,
          message: 'No Mermaid diagram found',
          suggestion: 'Add a Mermaid diagram to visualize architecture',
        });
      }

      // Check for empty table rows
      const tableLines = lines.filter(line => line.startsWith('|'));
      for (let i = 0; i < tableLines.length; i++) {
        const cells = tableLines[i].split('|').filter(c => c.trim());
        if (cells.some(c => c.trim() === '')) {
          warnings.push({
            file: projectMdPath,
            message: `Table row ${i + 1} has empty cells`,
          });
        }
      }

    } catch (error) {
      errors.push({
        file: projectMdPath,
        message: `Failed to read project.md: ${error instanceof Error ? error.message : error}`,
        type: 'markdown',
      });
    }
  }

  /**
   * Validate Mermaid syntax
   */
  private validateMermaidSyntax(
    content: string,
    file: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const lines = content.trim().split('\n');

    // Check for valid diagram type
    const validTypes = ['graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'erDiagram', 'gantt', 'pie', 'gitGraph'];
    const firstLine = lines[0]?.trim() || '';
    const diagramType = firstLine.split(/\s+/)[0];

    if (!validTypes.some(t => diagramType.toLowerCase().startsWith(t.toLowerCase()))) {
      errors.push({
        file,
        line: 1,
        message: `Invalid Mermaid diagram type: ${diagramType}`,
        type: 'mermaid',
      });
      return;
    }

    // Validate graph/flowchart syntax
    if (diagramType === 'graph' || diagramType === 'flowchart') {
      // Check direction
      const direction = firstLine.split(/\s+/)[1];
      const validDirections = ['TB', 'TD', 'BT', 'RL', 'LR'];
      if (direction && !validDirections.includes(direction)) {
        errors.push({
          file,
          line: 1,
          message: `Invalid graph direction: ${direction}. Use one of: ${validDirections.join(', ')}`,
          type: 'mermaid',
        });
      }

      // Check node definitions
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Check for invalid characters in node IDs
        const nodeMatch = line.match(/^\s*([a-zA-Z0-9_]+)/);
        if (nodeMatch) {
          const nodeId = nodeMatch[1];
          if (/^\d/.test(nodeId)) {
            errors.push({
              file,
              line: i + 1,
              message: `Node ID cannot start with a number: ${nodeId}`,
              type: 'mermaid',
            });
          }
        }

        // Check for balanced brackets (exclude arrows like --> from counting)
        const lineWithoutArrows = line.replace(/--+>|<--+|==+>|<==+|-\.->|<-\.-/g, '');
        const openBrackets = (lineWithoutArrows.match(/[\[\(\{]/g) || []).length;
        const closeBrackets = (lineWithoutArrows.match(/[\]\)\}]/g) || []).length;
        if (openBrackets !== closeBrackets) {
          errors.push({
            file,
            line: i + 1,
            message: `Unbalanced brackets in line: ${line}`,
            type: 'mermaid',
          });
        }

        // Check arrow syntax
        if (line.includes('->') || line.includes('-->') || line.includes('==>')) {
          const arrowMatch = line.match(/--+>|==+>|-.->|-\.->/);
          if (!arrowMatch && line.includes('-') && line.includes('>')) {
            warnings.push({
              file,
              message: `Line ${i + 1}: Potentially invalid arrow syntax`,
              suggestion: 'Use --> for arrows, ---> for dotted, ==> for thick',
            });
          }
        }
      }
    }

    // Check for duplicate node definitions
    const nodeIds = new Set<string>();
    for (const line of lines) {
      const match = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[\[\(\{]/);
      if (match) {
        const nodeId = match[1];
        if (nodeIds.has(nodeId)) {
          warnings.push({
            file,
            message: `Duplicate node definition: ${nodeId}`,
            suggestion: 'Each node should only be defined once',
          });
        }
        nodeIds.add(nodeId);
      }
    }
  }

  /**
   * Validate module spec files
   */
  private async validateModules(
    outputDir: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const modulesDir = path.join(outputDir, 'modules');

    try {
      const files = await fs.readdir(modulesDir);
      const mdFiles = files.filter(f => f.endsWith('.md'));

      if (mdFiles.length === 0) {
        warnings.push({
          file: modulesDir,
          message: 'No module spec files found',
          suggestion: 'Run analyzer to generate module specs',
        });
        return;
      }

      for (const file of mdFiles) {
        const filePath = path.join(modulesDir, file);
        await this.validateModuleMd(filePath, errors, warnings);
      }
    } catch {
      errors.push({
        file: modulesDir,
        message: 'Cannot read modules directory',
        type: 'structure',
      });
    }
  }

  /**
   * Validate individual module spec file
   */
  private async validateModuleMd(
    filePath: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      // Check for title
      if (!lines[0]?.startsWith('# ')) {
        errors.push({
          file: filePath,
          line: 1,
          message: 'Module spec must start with a title (# ModuleName)',
          type: 'markdown',
        });
      }

      // Check for required sections
      const requiredSections = ['## Overview', '## Dependencies'];
      for (const section of requiredSections) {
        if (!lines.some(line => line.startsWith(section))) {
          warnings.push({
            file: filePath,
            message: `Missing section: ${section}`,
          });
        }
      }

      // Check for back link
      if (!content.includes('[← Back to Project]')) {
        warnings.push({
          file: filePath,
          message: 'Missing back link to project.md',
          suggestion: 'Add [← Back to Project](../project.md) at the end',
        });
      }

    } catch (error) {
      errors.push({
        file: filePath,
        message: `Failed to read file: ${error instanceof Error ? error.message : error}`,
        type: 'markdown',
      });
    }
  }

  /**
   * Validate internal links
   */
  private async validateLinks(
    outputDir: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const allFiles = new Set<string>();

    // Collect all .md files
    const collectFiles = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await collectFiles(fullPath);
          } else if (entry.name.endsWith('.md')) {
            allFiles.add(path.relative(outputDir, fullPath));
          }
        }
      } catch {
        // Skip
      }
    };

    await collectFiles(outputDir);

    // Check links in each file
    for (const file of allFiles) {
      const filePath = path.join(outputDir, file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let match;

        while ((match = linkRegex.exec(content)) !== null) {
          const linkTarget = match[2];

          // Skip external links and anchors
          if (linkTarget.startsWith('http') || linkTarget.startsWith('#')) {
            continue;
          }

          // Resolve relative path
          const fileDir = path.dirname(file);
          const resolvedPath = path.normalize(path.join(fileDir, linkTarget));

          if (!allFiles.has(resolvedPath)) {
            errors.push({
              file: filePath,
              message: `Broken link: ${linkTarget} (resolved: ${resolvedPath})`,
              type: 'link',
            });
          }
        }
      } catch {
        // Skip
      }
    }
  }

  /**
   * Print validation results
   */
  static printValidationResult(result: ValidationResult): void {
    if (result.valid && result.warnings.length === 0) {
      console.log('✅ All validations passed!');
      return;
    }

    if (result.errors.length > 0) {
      console.log(`\n❌ ${result.errors.length} error(s) found:\n`);
      for (const error of result.errors) {
        const location = error.line ? `:${error.line}` : '';
        console.log(`  [${error.type.toUpperCase()}] ${error.file}${location}`);
        console.log(`    ${error.message}\n`);
      }
    }

    if (result.warnings.length > 0) {
      console.log(`\n⚠️  ${result.warnings.length} warning(s):\n`);
      for (const warning of result.warnings) {
        console.log(`  ${warning.file}`);
        console.log(`    ${warning.message}`);
        if (warning.suggestion) {
          console.log(`    💡 ${warning.suggestion}`);
        }
        console.log('');
      }
    }

    if (result.valid) {
      console.log('✅ No errors, but there are warnings to address.');
    } else {
      console.log('❌ Validation failed. Please fix errors above.');
    }
  }
}

export default SpecDrivenAnalyzer;
