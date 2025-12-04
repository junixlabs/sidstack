/**
 * Claude-Powered Codebase Analyzer
 *
 * Two modes:
 * 1. Context Collection - Prepares code samples for Claude Code CLI analysis
 * 2. Interactive - Works within Claude Code session directly
 *
 * Leverages Claude's deep understanding for semantic analysis of:
 * - Module boundaries and responsibilities
 * - Feature detection from code patterns
 * - Architecture pattern recognition
 * - Business domain extraction
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import type { AnalysisResult, ModuleInfo, FeatureInfo, ArchitectureInfo } from './codebase-analyzer.js';

// ============================================================================
// Types
// ============================================================================

export interface ClaudeAnalysisConfig {
  maxFilesPerModule: number;
  maxCodeLinesPerFile: number;
  includeTests: boolean;
  analysisDepth: 'quick' | 'standard' | 'deep';
}

export interface ModuleAnalysis {
  name: string;
  purpose: string;
  responsibilities: string[];
  publicApi: string[];
  internalDependencies: string[];
  externalDependencies: string[];
  suggestedImprovements?: string[];
}

export interface FeatureAnalysis {
  name: string;
  description: string;
  type: 'api' | 'ui' | 'background' | 'integration' | 'utility';
  endpoints?: string[];
  relatedModules: string[];
  status: 'complete' | 'partial' | 'planned';
}

export interface ArchitectureAnalysis {
  pattern: string;
  confidence: number;
  reasoning: string;
  layers: string[];
  strengths: string[];
  concerns: string[];
}

export interface CodeSample {
  path: string;
  content: string;
  language: string;
}

export interface ClaudeAnalysisResult {
  modules: ModuleAnalysis[];
  features: FeatureAnalysis[];
  architecture: ArchitectureAnalysis;
  businessDomain: {
    domain: string;
    subdomains: string[];
    keyEntities: string[];
  };
  techInsights: {
    primaryStack: string;
    patterns: string[];
    qualityIndicators: string[];
  };
}

export interface CollectedContext {
  projectPath: string;
  structure: string;
  samples: CodeSample[];
  prompt: string;
}

// ============================================================================
// Context Collector Class (for Claude Code CLI usage)
// ============================================================================

export class CodeContextCollector {
  private projectPath: string;
  private config: ClaudeAnalysisConfig;

  constructor(
    projectPath: string,
    config: Partial<ClaudeAnalysisConfig> = {}
  ) {
    this.projectPath = projectPath;
    this.config = {
      maxFilesPerModule: config.maxFilesPerModule ?? 10,
      maxCodeLinesPerFile: config.maxCodeLinesPerFile ?? 200,
      includeTests: config.includeTests ?? false,
      analysisDepth: config.analysisDepth ?? 'standard',
    };
  }

  /**
   * Collect context for Claude Code CLI analysis
   */
  async collectContext(): Promise<CollectedContext> {
    const samples = await this.collectCodeSamples();
    const structure = await this.analyzeProjectStructure();
    const prompt = this.buildAnalysisPrompt(samples, structure);

    return {
      projectPath: this.projectPath,
      structure,
      samples,
      prompt,
    };
  }

  /**
   * Get list of key files to read for analysis
   */
  async getKeyFiles(): Promise<string[]> {
    const files: string[] = [];

    // Config files
    const configFiles = [
      'package.json',
      'tsconfig.json',
      'README.md',
      '.sidstack/config.json',
      'go.mod',
      'docker-compose.yml',
      'turbo.json',
      'nx.json',
    ];

    for (const file of configFiles) {
      const fullPath = path.join(this.projectPath, file);
      if (await this.fileExists(fullPath)) {
        files.push(file);
      }
    }

    // Entry points
    const entryPatterns = [
      'src/index.ts',
      'src/main.ts',
      'src/app.ts',
      'src/server.ts',
      'main.go',
      'cmd/main.go',
    ];

    for (const pattern of entryPatterns) {
      const fullPath = path.join(this.projectPath, pattern);
      if (await this.fileExists(fullPath)) {
        files.push(pattern);
      }
    }

    // Scan packages/services directories
    const modulesDirs = ['packages', 'services', 'apps', 'src/modules', 'src/features'];
    for (const dir of modulesDirs) {
      const dirPath = path.join(this.projectPath, dir);
      if (await this.fileExists(dirPath)) {
        const entries = await this.listDirectory(dirPath);
        for (const entry of entries.slice(0, 10)) {
          // Add package.json or index file from each module
          const pkgJson = path.join(dir, entry, 'package.json');
          const indexTs = path.join(dir, entry, 'src/index.ts');
          const mainGo = path.join(dir, entry, 'main.go');

          if (await this.fileExists(path.join(this.projectPath, pkgJson))) {
            files.push(pkgJson);
          }
          if (await this.fileExists(path.join(this.projectPath, indexTs))) {
            files.push(indexTs);
          }
          if (await this.fileExists(path.join(this.projectPath, mainGo))) {
            files.push(mainGo);
          }
        }
      }
    }

    // Routes/API files
    const apiDirs = ['src/routes', 'src/api', 'src/controllers', 'pages/api', 'app/api'];
    for (const dir of apiDirs) {
      const dirPath = path.join(this.projectPath, dir);
      if (await this.fileExists(dirPath)) {
        const apiFiles = await this.findSourceFiles(dirPath);
        files.push(...apiFiles.slice(0, 10).map(f => path.relative(this.projectPath, f)));
      }
    }

    return [...new Set(files)]; // Deduplicate
  }

  // ==========================================================================
  // Code Sample Collection
  // ==========================================================================

  private async collectCodeSamples(): Promise<CodeSample[]> {
    const samples: CodeSample[] = [];

    // Key files to always include
    const keyFiles = [
      'package.json',
      'tsconfig.json',
      'README.md',
      'src/index.ts',
      'src/main.ts',
      'src/app.ts',
      'go.mod',
      'main.go',
    ];

    for (const file of keyFiles) {
      const sample = await this.readFileSample(path.join(this.projectPath, file));
      if (sample) samples.push(sample);
    }

    // Scan entry points
    const entryPoints = await this.findEntryPoints();
    for (const entry of entryPoints.slice(0, 20)) {
      const sample = await this.readFileSample(entry);
      if (sample) samples.push(sample);
    }

    // Scan routes/API files
    const apiFiles = await this.findApiFiles();
    for (const file of apiFiles.slice(0, 15)) {
      const sample = await this.readFileSample(file);
      if (sample) samples.push(sample);
    }

    return samples;
  }

  private async readFileSample(filePath: string): Promise<CodeSample | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const truncated = lines.slice(0, this.config.maxCodeLinesPerFile).join('\n');

      return {
        path: path.relative(this.projectPath, filePath),
        content: truncated,
        language: this.detectLanguage(filePath),
      };
    } catch {
      return null;
    }
  }

  private async findEntryPoints(): Promise<string[]> {
    const patterns = [
      'src/index.ts',
      'src/main.ts',
      'src/app.ts',
      'packages/*/src/index.ts',
      'apps/*/src/index.ts',
      'services/*/main.go',
      'services/*/cmd/main.go',
    ];

    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = await this.globFiles(pattern);
      files.push(...matches);
    }
    return files;
  }

  private async findApiFiles(): Promise<string[]> {
    const patterns = [
      'src/routes/**/*.ts',
      'src/api/**/*.ts',
      'src/controllers/**/*.ts',
      'pages/api/**/*.ts',
      'app/**/route.ts',
    ];

    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = await this.globFiles(pattern);
      files.push(...matches);
    }
    return files;
  }

  private async findSourceFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.go', '.py'];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          if (!this.config.includeTests && entry.name === '__tests__') continue;
          const subFiles = await this.findSourceFiles(fullPath);
          files.push(...subFiles);
        } else if (extensions.some(ext => entry.name.endsWith(ext))) {
          if (!this.config.includeTests && entry.name.includes('.test.')) continue;
          files.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist
    }

    return files;
  }

  private async globFiles(pattern: string): Promise<string[]> {
    const parts = pattern.split('**');
    if (parts.length === 1) {
      const fullPath = path.join(this.projectPath, pattern);
      try {
        await fs.access(fullPath);
        return [fullPath];
      } catch {
        return [];
      }
    }

    const basePath = path.join(this.projectPath, parts[0]);
    const suffix = parts[1] || '';
    const files: string[] = [];

    try {
      const scan = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await scan(fullPath);
          } else if (suffix && fullPath.endsWith(suffix.replace('/', ''))) {
            files.push(fullPath);
          }
        }
      };
      await scan(basePath);
    } catch {
      // Base path doesn't exist
    }

    return files;
  }

  // ==========================================================================
  // Project Structure Analysis
  // ==========================================================================

  private async analyzeProjectStructure(): Promise<string> {
    const structure: string[] = [];

    try {
      const entries = await fs.readdir(this.projectPath, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.'));
      const files = entries.filter(e => e.isFile());

      structure.push('## Project Structure\n');
      structure.push('### Top-level directories:');
      for (const dir of dirs) {
        if (dir.name === 'node_modules') continue;
        const subEntries = await this.countDirectoryItems(path.join(this.projectPath, dir.name));
        structure.push(`- ${dir.name}/ (${subEntries} items)`);
      }

      structure.push('\n### Top-level files:');
      for (const file of files.slice(0, 15)) {
        structure.push(`- ${file.name}`);
      }
    } catch {
      structure.push('Could not read project structure');
    }

    return structure.join('\n');
  }

  private async countDirectoryItems(dirPath: string): Promise<number> {
    try {
      const entries = await fs.readdir(dirPath);
      return entries.filter(e => !e.startsWith('.') && e !== 'node_modules').length;
    } catch {
      return 0;
    }
  }

  private async listDirectory(dirPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
        .map(e => e.name);
    } catch {
      return [];
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // Prompt Builder
  // ==========================================================================

  private buildAnalysisPrompt(samples: CodeSample[], structureInfo: string): string {
    const sampleText = samples
      .map(s => `### File: ${s.path}\n\`\`\`${s.language}\n${s.content}\n\`\`\``)
      .join('\n\n');

    return `Analyze this codebase and populate the SidStack knowledge graph.

${structureInfo}

## Code Samples

${sampleText}

## Tasks

1. Identify all modules/packages and their purposes
2. Identify key features and their status
3. Detect the architecture pattern
4. Extract the business domain

After analysis, use the SidStack MCP tools to:
- Create Module nodes with mcp__sidstack__graph_query
- Create Feature nodes
- Link them to the project
- Store insights with mcp__sidstack__knowledge_store`;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const langMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.go': 'go',
      '.py': 'python',
      '.json': 'json',
      '.md': 'markdown',
      '.yaml': 'yaml',
      '.yml': 'yaml',
    };
    return langMap[ext] || 'text';
  }
}

// ============================================================================
// Integration Functions
// ============================================================================

/**
 * Convert Claude analysis to standard AnalysisResult format
 */
export function convertToAnalysisResult(
  claudeResult: ClaudeAnalysisResult,
  projectPath: string
): Partial<AnalysisResult> {
  const modules: ModuleInfo[] = claudeResult.modules.map((m, i) => ({
    id: `module-${i}`,
    name: m.name,
    description: m.purpose,
    path: '',
    language: claudeResult.techInsights.primaryStack.split('/')[0] || 'unknown',
    type: 'module' as const,
    dependencies: m.internalDependencies,
    exports: m.publicApi,
    isIndependent: true,
  }));

  const features: FeatureInfo[] = claudeResult.features.map((f, i) => ({
    id: `feature-${i}`,
    name: f.name,
    description: f.description,
    source: f.type === 'api' ? 'route' as const : 'documentation' as const,
    status: f.status === 'complete' ? 'released' as const : 'in_progress' as const,
    paths: f.endpoints || [],
    tags: [f.type, ...f.relatedModules],
  }));

  const architecture: ArchitectureInfo = {
    pattern: mapArchitecturePattern(claudeResult.architecture.pattern),
    confidence: claudeResult.architecture.confidence,
    indicators: [
      claudeResult.architecture.reasoning,
      ...claudeResult.architecture.layers,
    ],
  };

  return {
    modules,
    features,
    architecture,
  };
}

function mapArchitecturePattern(pattern: string): ArchitectureInfo['pattern'] {
  const normalized = pattern.toLowerCase();
  if (normalized.includes('monorepo')) return 'monorepo';
  if (normalized.includes('microservice')) return 'microservices';
  if (normalized.includes('layer')) return 'layered';
  if (normalized.includes('mvc')) return 'mvc';
  if (normalized.includes('ddd') || normalized.includes('domain')) return 'ddd';
  if (normalized.includes('feature')) return 'feature-based';
  return 'unknown';
}

/**
 * Collect context for Claude Code CLI analysis
 */
export async function collectContextForClaude(
  projectPath: string,
  config?: Partial<ClaudeAnalysisConfig>
): Promise<CollectedContext> {
  const collector = new CodeContextCollector(projectPath, config);
  return collector.collectContext();
}

/**
 * Get list of key files for Claude Code to read
 */
export async function getKeyFilesForAnalysis(
  projectPath: string,
  config?: Partial<ClaudeAnalysisConfig>
): Promise<string[]> {
  const collector = new CodeContextCollector(projectPath, config);
  return collector.getKeyFiles();
}
