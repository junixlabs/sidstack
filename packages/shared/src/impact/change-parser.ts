/**
 * Change Parser
 *
 * Parses change inputs (tasks, specs, descriptions) to extract:
 * - Entities (User, Order, etc.)
 * - Operations (add, modify, delete, refactor)
 * - Keywords for module mapping
 * - Change type inference
 */

import type {
  ChangeInput,
  ParsedChange,
  ParsedOperation,
  ChangeType,
} from './types';

// =============================================================================
// Entity Detection Patterns
// =============================================================================

/**
 * Common entity patterns in software systems
 */
const ENTITY_PATTERNS = [
  // PascalCase words (User, Order, Product)
  /\b([A-Z][a-z]+(?:[A-Z][a-z]+)*)\b/g,
  // Explicit entity references
  /(?:entity|model|table|schema|record)\s+['"]?(\w+)['"]?/gi,
  // Database/collection references
  /(?:collection|database|db)\.(\w+)/gi,
];

/**
 * Words to exclude from entity detection
 */
const ENTITY_EXCLUDES = new Set([
  // Common programming terms
  'String', 'Number', 'Boolean', 'Array', 'Object', 'Function', 'Promise',
  'Date', 'Error', 'Map', 'Set', 'Buffer', 'Stream',
  // Common action words
  'Add', 'Create', 'Update', 'Delete', 'Remove', 'Get', 'Set', 'List',
  'Find', 'Search', 'Filter', 'Sort', 'Validate', 'Check', 'Process',
  // Common prefixes/suffixes
  'Api', 'App', 'Web', 'Test', 'Mock', 'Stub', 'Fake',
  // Reserved words
  'This', 'That', 'The', 'And', 'For', 'With', 'From', 'Into',
  // Framework terms
  'React', 'Vue', 'Angular', 'Express', 'Node', 'Next', 'Nuxt',
  'Component', 'Service', 'Controller', 'Repository', 'Module',
]);

// =============================================================================
// Operation Detection Patterns
// =============================================================================

interface OperationPattern {
  type: ParsedOperation['type'];
  patterns: RegExp[];
  keywords: string[];
}

const OPERATION_PATTERNS: OperationPattern[] = [
  {
    type: 'add',
    patterns: [
      /\b(?:add|create|implement|introduce|build|develop|new)\s+(.+?)(?:\.|,|$)/gi,
      /\bnew\s+(\w+)/gi,
    ],
    keywords: ['add', 'create', 'implement', 'introduce', 'build', 'develop', 'new', 'feature'],
  },
  {
    type: 'modify',
    patterns: [
      /\b(?:update|modify|change|edit|alter|adjust|enhance|improve)\s+(.+?)(?:\.|,|$)/gi,
      /\b(?:fix|patch|correct)\s+(.+?)(?:\.|,|$)/gi,
    ],
    keywords: ['update', 'modify', 'change', 'edit', 'alter', 'adjust', 'enhance', 'improve', 'fix', 'patch'],
  },
  {
    type: 'delete',
    patterns: [
      /\b(?:delete|remove|drop|eliminate|deprecate)\s+(.+?)(?:\.|,|$)/gi,
    ],
    keywords: ['delete', 'remove', 'drop', 'eliminate', 'deprecate', 'clean'],
  },
  {
    type: 'refactor',
    patterns: [
      /\b(?:refactor|restructure|reorganize|optimize|simplify)\s+(.+?)(?:\.|,|$)/gi,
      /\b(?:move|extract|split|merge|consolidate)\s+(.+?)(?:\.|,|$)/gi,
    ],
    keywords: ['refactor', 'restructure', 'reorganize', 'optimize', 'simplify', 'move', 'extract', 'split', 'merge'],
  },
  {
    type: 'migrate',
    patterns: [
      /\b(?:migrate|migration|upgrade|convert|transform)\s+(.+?)(?:\.|,|$)/gi,
    ],
    keywords: ['migrate', 'migration', 'upgrade', 'convert', 'transform', 'schema'],
  },
];

// =============================================================================
// Change Type Inference
// =============================================================================

interface ChangeTypePattern {
  type: ChangeType;
  keywords: string[];
  weight: number;
}

const CHANGE_TYPE_PATTERNS: ChangeTypePattern[] = [
  {
    type: 'feature',
    keywords: ['feature', 'add', 'new', 'implement', 'create', 'build', 'develop', 'introduce'],
    weight: 1,
  },
  {
    type: 'bugfix',
    keywords: ['fix', 'bug', 'issue', 'error', 'crash', 'broken', 'wrong', 'incorrect', 'patch'],
    weight: 1.2, // Slightly higher weight for explicit bug fixes
  },
  {
    type: 'refactor',
    keywords: ['refactor', 'restructure', 'reorganize', 'optimize', 'clean', 'simplify', 'improve', 'enhance'],
    weight: 1,
  },
  {
    type: 'migration',
    keywords: ['migrate', 'migration', 'upgrade', 'database', 'schema', 'convert', 'transform'],
    weight: 1.3, // Higher weight for migrations
  },
  {
    type: 'deletion',
    keywords: ['delete', 'remove', 'drop', 'deprecate', 'eliminate', 'clean up', 'remove unused'],
    weight: 1.1,
  },
];

// =============================================================================
// Change Parser Class
// =============================================================================

export class ChangeParser {
  /**
   * Parse a change input into structured data
   */
  parse(input: ChangeInput): ParsedChange {
    // Gather all text to analyze
    const textToAnalyze = this.gatherText(input);

    // Extract entities
    const entities = this.extractEntities(textToAnalyze);

    // Detect operations
    const operations = this.detectOperations(textToAnalyze);

    // Extract keywords
    const keywords = this.extractKeywords(textToAnalyze);

    // Infer change type if not provided
    const changeType = input.changeType || this.inferChangeType(textToAnalyze, operations);

    // Calculate confidence score
    const confidence = this.calculateConfidence(entities, operations, keywords);

    return {
      entities,
      operations,
      keywords,
      changeType,
      confidence,
    };
  }

  /**
   * Gather all text from input sources
   */
  private gatherText(input: ChangeInput): string {
    const parts: string[] = [];

    if (input.description) {
      parts.push(input.description);
    }

    if (input.targetFiles) {
      // Extract meaningful names from file paths
      for (const file of input.targetFiles) {
        const fileName = file.split('/').pop()?.replace(/\.(ts|tsx|js|jsx|json|md)$/, '') || '';
        parts.push(fileName);
      }
    }

    if (input.targetModules) {
      parts.push(...input.targetModules);
    }

    return parts.join(' ');
  }

  /**
   * Extract entities from text
   */
  private extractEntities(text: string): string[] {
    const entities = new Set<string>();

    for (const pattern of ENTITY_PATTERNS) {
      // Reset regex state
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(text)) !== null) {
        const entity = match[1];

        // Filter out excluded words and short words
        if (
          entity &&
          entity.length > 2 &&
          !ENTITY_EXCLUDES.has(entity) &&
          /^[A-Z]/.test(entity) // Must start with uppercase
        ) {
          entities.add(entity);
        }
      }
    }

    return Array.from(entities);
  }

  /**
   * Detect operations from text
   */
  private detectOperations(text: string): ParsedOperation[] {
    const operations: ParsedOperation[] = [];
    const seenTargets = new Set<string>();

    for (const opPattern of OPERATION_PATTERNS) {
      for (const pattern of opPattern.patterns) {
        // Reset regex state
        pattern.lastIndex = 0;

        let match;
        while ((match = pattern.exec(text)) !== null) {
          const target = match[1]?.trim();

          if (target && target.length > 2 && !seenTargets.has(target.toLowerCase())) {
            seenTargets.add(target.toLowerCase());

            operations.push({
              type: opPattern.type,
              target,
              description: match[0].trim(),
            });
          }
        }
      }
    }

    // If no operations found, try to infer from keywords
    if (operations.length === 0) {
      const inferredOp = this.inferOperationFromKeywords(text);
      if (inferredOp) {
        operations.push(inferredOp);
      }
    }

    return operations;
  }

  /**
   * Infer operation from keywords when pattern matching fails
   */
  private inferOperationFromKeywords(text: string): ParsedOperation | null {
    const lowerText = text.toLowerCase();

    for (const opPattern of OPERATION_PATTERNS) {
      for (const keyword of opPattern.keywords) {
        if (lowerText.includes(keyword)) {
          return {
            type: opPattern.type,
            target: 'inferred',
            description: `Inferred ${opPattern.type} operation from keyword "${keyword}"`,
          };
        }
      }
    }

    return null;
  }

  /**
   * Extract keywords for module mapping
   */
  private extractKeywords(text: string): string[] {
    const keywords = new Set<string>();

    // Split into words and filter
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-_]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);

    for (const word of words) {
      // Skip common stop words
      if (!this.isStopWord(word)) {
        keywords.add(word);
      }
    }

    // Add module-related keywords from camelCase/PascalCase
    const camelCaseWords = text.match(/[a-z]+(?=[A-Z])|[A-Z][a-z]+/g) || [];
    for (const word of camelCaseWords) {
      const lower = word.toLowerCase();
      if (lower.length > 2 && !this.isStopWord(lower)) {
        keywords.add(lower);
      }
    }

    return Array.from(keywords);
  }

  /**
   * Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'it', 'its',
      'this', 'that', 'these', 'those', 'then', 'than', 'so', 'if', 'when',
      'where', 'how', 'what', 'which', 'who', 'whom', 'whose',
    ]);

    return stopWords.has(word);
  }

  /**
   * Infer change type from text and operations
   */
  private inferChangeType(text: string, operations: ParsedOperation[]): ChangeType {
    const lowerText = text.toLowerCase();
    const scores: Record<ChangeType, number> = {
      feature: 0,
      bugfix: 0,
      refactor: 0,
      migration: 0,
      deletion: 0,
    };

    // Score based on text keywords
    for (const pattern of CHANGE_TYPE_PATTERNS) {
      for (const keyword of pattern.keywords) {
        if (lowerText.includes(keyword)) {
          scores[pattern.type] += pattern.weight;
        }
      }
    }

    // Score based on detected operations
    for (const op of operations) {
      switch (op.type) {
        case 'add':
          scores.feature += 1;
          break;
        case 'modify':
          scores.feature += 0.5;
          scores.bugfix += 0.5;
          break;
        case 'delete':
          scores.deletion += 1;
          break;
        case 'refactor':
          scores.refactor += 1;
          break;
        case 'migrate':
          scores.migration += 1.5;
          break;
      }
    }

    // Find highest scoring type
    let maxScore = 0;
    let inferredType: ChangeType = 'feature';

    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        inferredType = type as ChangeType;
      }
    }

    return inferredType;
  }

  /**
   * Calculate confidence score (0-1) for the parsing result
   */
  private calculateConfidence(
    entities: string[],
    operations: ParsedOperation[],
    keywords: string[]
  ): number {
    let confidence = 0.5; // Base confidence

    // Boost for entities found
    if (entities.length > 0) {
      confidence += Math.min(entities.length * 0.1, 0.2);
    }

    // Boost for operations found
    if (operations.length > 0) {
      confidence += Math.min(operations.length * 0.1, 0.2);

      // Extra boost for non-inferred operations
      const nonInferred = operations.filter(op => op.target !== 'inferred');
      if (nonInferred.length > 0) {
        confidence += 0.05;
      }
    }

    // Boost for keywords found
    if (keywords.length > 5) {
      confidence += 0.05;
    }

    // Cap at 1.0
    return Math.min(confidence, 1.0);
  }

  /**
   * Parse from task title and description
   */
  parseFromTask(title: string, description?: string): ParsedChange {
    return this.parse({
      description: `${title}. ${description || ''}`,
      changeType: 'feature', // Will be inferred if not matching
    });
  }

  /**
   * Parse from spec content
   */
  parseFromSpec(specTitle: string, specContent: string, specModule?: string): ParsedChange {
    const modules = specModule ? [specModule] : [];

    return this.parse({
      description: `${specTitle}. ${specContent}`,
      targetModules: modules,
      changeType: 'feature',
    });
  }
}

// =============================================================================
// Export singleton instance
// =============================================================================

export const changeParser = new ChangeParser();
