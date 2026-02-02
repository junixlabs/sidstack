/**
 * SidStack Knowledge System - Document Parser
 *
 * Single source of truth for parsing markdown documents with YAML frontmatter.
 */

import type { DocumentFrontmatter, DocumentType, DocumentStatus } from './types';

// =============================================================================
// Frontmatter Parsing
// =============================================================================

/**
 * Parse YAML frontmatter from markdown content
 */
export function parseFrontmatter(content: string): {
  frontmatter: DocumentFrontmatter;
  body: string;
} {
  const lines = content.split('\n');
  const frontmatter: Record<string, unknown> = {};
  let body = content;
  let frontmatterEnd = -1;

  // Check for frontmatter delimiter
  if (lines[0]?.trim() === '---') {
    let currentKey = '';
    let inArray = false;
    let arrayValues: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      // End of frontmatter
      if (line.trim() === '---') {
        // Save any pending array
        if (inArray && currentKey) {
          frontmatter[currentKey] = arrayValues;
        }
        frontmatterEnd = i;
        break;
      }

      // Handle multi-line array items (- item)
      if (inArray && line.match(/^\s+-\s/)) {
        const value = line.replace(/^\s+-\s*/, '').trim();
        if (value) {
          arrayValues.push(cleanValue(value));
        }
        continue;
      }

      // End of array when we hit a new key
      if (inArray && line.match(/^[a-zA-Z_][a-zA-Z0-9_]*:/)) {
        frontmatter[currentKey] = arrayValues;
        inArray = false;
        arrayValues = [];
      }

      // Parse key-value pair
      const keyMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/);
      if (keyMatch) {
        const [, key, rawValue] = keyMatch;
        currentKey = key;
        const value = rawValue.trim();

        // Empty value followed by array items
        if (value === '' || value === '[]') {
          inArray = true;
          arrayValues = [];
          continue;
        }

        // Inline array [item1, item2]
        const inlineArrayMatch = value.match(/^\[(.*)\]$/);
        if (inlineArrayMatch) {
          const items = inlineArrayMatch[1]
            .split(',')
            .map(item => cleanValue(item.trim()))
            .filter(Boolean);
          frontmatter[key] = items;
          continue;
        }

        // Regular value
        frontmatter[key] = parseValue(value);
      }
    }

    // Extract body (content after frontmatter)
    if (frontmatterEnd > 0) {
      body = lines.slice(frontmatterEnd + 1).join('\n').trim();
    }
  }

  return {
    frontmatter: normalizeFrontmatter(frontmatter),
    body,
  };
}

/**
 * Clean a string value (remove quotes)
 */
function cleanValue(value: string): string {
  // Remove surrounding quotes
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Parse a YAML value to appropriate type
 */
function parseValue(value: string): unknown {
  const cleaned = cleanValue(value);

  // Boolean
  if (cleaned === 'true') return true;
  if (cleaned === 'false') return false;

  // Null
  if (cleaned === 'null' || cleaned === '~') return null;

  // Number
  if (/^-?\d+$/.test(cleaned)) return parseInt(cleaned, 10);
  if (/^-?\d+\.\d+$/.test(cleaned)) return parseFloat(cleaned);

  // String
  return cleaned;
}

/**
 * Normalize frontmatter to DocumentFrontmatter interface
 */
function normalizeFrontmatter(raw: Record<string, unknown>): DocumentFrontmatter {
  // Map legacy types to their replacements
  let type: DocumentType | undefined;
  if (isValidDocumentType(raw.type)) {
    type = raw.type;
  } else if (typeof raw.type === 'string' && LEGACY_TYPE_MAP[raw.type]) {
    type = LEGACY_TYPE_MAP[raw.type];
  }

  return {
    id: typeof raw.id === 'string' ? raw.id : undefined,
    type,
    title: typeof raw.title === 'string' ? raw.title : undefined,
    status: isValidDocumentStatus(raw.status) ? raw.status : undefined,
    summary: typeof raw.summary === 'string' ? raw.summary : undefined,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    module: typeof raw.module === 'string' ? raw.module : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.filter(t => typeof t === 'string') : undefined,
    owner: typeof raw.owner === 'string' ? raw.owner : undefined,
    author: typeof raw.author === 'string' ? raw.author : undefined,
    reviewDate: typeof raw.reviewDate === 'string' ? raw.reviewDate : undefined,
    related: Array.isArray(raw.related) ? raw.related.filter(r => typeof r === 'string') : undefined,
    dependsOn: Array.isArray(raw.dependsOn) || Array.isArray(raw.depends_on)
      ? (raw.dependsOn || raw.depends_on) as string[]
      : undefined,
    createdAt: typeof raw.createdAt === 'string' || typeof raw.created_at === 'string'
      ? (raw.createdAt || raw.created_at) as string
      : undefined,
    updatedAt: typeof raw.updatedAt === 'string' || typeof raw.updated_at === 'string'
      ? (raw.updatedAt || raw.updated_at) as string
      : undefined,
  };
}

// =============================================================================
// Frontmatter Serialization
// =============================================================================

/**
 * Serialize a DocumentFrontmatter object and body back to markdown with YAML frontmatter
 */
export function serializeFrontmatter(frontmatter: DocumentFrontmatter, body: string): string {
  const lines: string[] = ['---'];

  const writeField = (key: string, value: unknown) => {
    if (value === undefined || value === null) return;

    if (Array.isArray(value)) {
      if (value.length === 0) return;
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
    } else {
      lines.push(`${key}: ${value}`);
    }
  };

  // Write fields in a consistent order
  writeField('id', frontmatter.id);
  writeField('type', frontmatter.type);
  writeField('title', frontmatter.title);
  writeField('status', frontmatter.status);
  writeField('summary', frontmatter.summary);
  writeField('description', frontmatter.description);
  writeField('module', frontmatter.module);
  writeField('tags', frontmatter.tags);
  writeField('owner', frontmatter.owner);
  writeField('author', frontmatter.author);
  writeField('reviewDate', frontmatter.reviewDate);
  writeField('related', frontmatter.related);
  writeField('dependsOn', frontmatter.dependsOn);
  writeField('createdAt', frontmatter.createdAt);
  writeField('updatedAt', frontmatter.updatedAt);

  lines.push('---');
  lines.push('');

  // Append body
  if (body) {
    lines.push(body);
  }

  return lines.join('\n');
}

/**
 * Generate frontmatter from a create document input
 */
export function generateDocumentFrontmatter(input: {
  title: string;
  type: DocumentType;
  status?: DocumentStatus;
  module?: string;
  tags?: string[];
  owner?: string;
  related?: string[];
  dependsOn?: string[];
}): DocumentFrontmatter {
  const now = new Date().toISOString();
  return {
    id: generateSlug(input.title),
    type: input.type,
    title: input.title,
    status: input.status || 'draft',
    module: input.module,
    tags: input.tags || [],
    owner: input.owner,
    related: input.related,
    dependsOn: input.dependsOn,
    createdAt: now,
    updatedAt: now,
  };
}

// =============================================================================
// Content Extraction
// =============================================================================

/**
 * Extract title from markdown content (first H1)
 */
export function extractTitle(content: string): string | undefined {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : undefined;
}

/**
 * Extract summary from markdown content
 * Takes the first paragraph after the title
 */
export function extractSummary(content: string, maxLength = 200): string | undefined {
  // Remove title
  const withoutTitle = content.replace(/^#\s+.+$/m, '').trim();

  // Find first non-empty paragraph
  const paragraphs = withoutTitle.split(/\n\n+/);
  for (const p of paragraphs) {
    const cleaned = p.trim();
    // Skip headings, code blocks, lists
    if (cleaned.startsWith('#') ||
        cleaned.startsWith('```') ||
        cleaned.startsWith('-') ||
        cleaned.startsWith('*') ||
        cleaned.startsWith('1.')) {
      continue;
    }
    if (cleaned.length > 0) {
      return cleaned.length > maxLength
        ? cleaned.slice(0, maxLength) + '...'
        : cleaned;
    }
  }
  return undefined;
}

/**
 * Calculate word count
 */
export function countWords(content: string): number {
  return content
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]+`/g, '')        // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace links with text
    .split(/\s+/)
    .filter(word => word.length > 0)
    .length;
}

/**
 * Estimate reading time in minutes
 */
export function estimateReadingTime(wordCount: number): number {
  const wordsPerMinute = 200;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}

// =============================================================================
// Type Guards
// =============================================================================

const VALID_DOCUMENT_TYPES: DocumentType[] = [
  'spec', 'decision', 'proposal',
  'guide', 'reference',
  'template', 'checklist', 'pattern',
  'skill', 'principle', 'rule',
  'module', 'index',
];

// Legacy types that map to 'guide'
const LEGACY_TYPE_MAP: Record<string, DocumentType> = {
  'tutorial': 'guide',
  'explanation': 'guide',
  'concept': 'guide',
};

const VALID_DOCUMENT_STATUSES: DocumentStatus[] = [
  'draft', 'active', 'review', 'archived',
];

export function isValidDocumentType(value: unknown): value is DocumentType {
  return typeof value === 'string' && VALID_DOCUMENT_TYPES.includes(value as DocumentType);
}

export function isValidDocumentStatus(value: unknown): value is DocumentStatus {
  return typeof value === 'string' && VALID_DOCUMENT_STATUSES.includes(value as DocumentStatus);
}

// =============================================================================
// Slug Generation
// =============================================================================

/**
 * Generate URL-friendly slug from string
 */
export function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

/**
 * Generate document ID from file path
 */
export function generateIdFromPath(filePath: string): string {
  // Extract filename without extension
  const filename = filePath.split('/').pop()?.replace(/\.md$/i, '') || 'unknown';
  return generateSlug(filename);
}
