/**
 * Validation Utilities
 *
 * Provides structured validation helpers for modules, governance, and knowledge.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse as parseYaml } from 'yaml';

import { CLIError, CLIWarning, ValidationItem, ValidationResult } from './output.js';

// Re-export types for consumers
export type { CLIError, CLIWarning, ValidationItem, ValidationResult };

// Common error codes
export const ErrorCodes = {
  // Generic errors
  NOT_FOUND: 'NOT_FOUND',
  NOT_INITIALIZED: 'NOT_INITIALIZED',

  // File errors
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_READ_ERROR: 'FILE_READ_ERROR',
  INVALID_YAML: 'INVALID_YAML',
  INVALID_FRONTMATTER: 'INVALID_FRONTMATTER',

  // Schema errors
  MISSING_FIELD: 'MISSING_FIELD',
  INVALID_FIELD: 'INVALID_FIELD',
  INVALID_VALUE: 'INVALID_VALUE',

  // Reference errors
  MISSING_DEPENDENCY: 'MISSING_DEPENDENCY',
  CIRCULAR_DEPENDENCY: 'CIRCULAR_DEPENDENCY',

  // Governance errors
  MISSING_GOVERNANCE: 'MISSING_GOVERNANCE',
  INVALID_RULE: 'INVALID_RULE',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// Common warning codes
export const WarningCodes = {
  EMPTY_CONTENT: 'EMPTY_CONTENT',
  SHORT_CONTENT: 'SHORT_CONTENT',
  NO_GOVERNANCE: 'NO_GOVERNANCE',
  DEPRECATED_FIELD: 'DEPRECATED_FIELD',
  NAME_MISMATCH: 'NAME_MISMATCH',
} as const;

export type WarningCode = (typeof WarningCodes)[keyof typeof WarningCodes];

/**
 * Create a structured error
 */
export function createError(
  code: ErrorCode | string,
  message: string,
  options: { file?: string; line?: number; suggestion?: string } = {}
): CLIError {
  return {
    code,
    message,
    ...options,
  };
}

/**
 * Create a structured warning
 */
export function createWarning(
  code: WarningCode | string,
  message: string,
  options: { file?: string; line?: number; suggestion?: string } = {}
): CLIWarning {
  return {
    code,
    message,
    ...options,
  };
}

/**
 * Validate YAML file content
 */
export function validateYamlFile(
  filePath: string,
  content: string
): { valid: boolean; data?: Record<string, unknown>; error?: CLIError } {
  try {
    const data = parseYaml(content) as Record<string, unknown>;
    return { valid: true, data };
  } catch (e) {
    return {
      valid: false,
      error: createError(ErrorCodes.INVALID_YAML, e instanceof Error ? e.message : 'Invalid YAML syntax', {
        file: filePath,
        suggestion: 'Check YAML syntax - ensure proper indentation and quoting',
      }),
    };
  }
}

/**
 * Validate markdown frontmatter
 */
export function validateFrontmatter(
  filePath: string,
  content: string
): { valid: boolean; frontmatter?: Record<string, unknown>; body?: string; error?: CLIError } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!match) {
    return {
      valid: false,
      error: createError(
        ErrorCodes.INVALID_FRONTMATTER,
        'Missing or invalid YAML frontmatter. File must start with --- and have a closing ---',
        { file: filePath, suggestion: 'Add YAML frontmatter at the beginning of the file' }
      ),
    };
  }

  const yamlResult = validateYamlFile(filePath, match[1]);
  if (!yamlResult.valid) {
    return { valid: false, error: yamlResult.error };
  }

  return {
    valid: true,
    frontmatter: yamlResult.data,
    body: match[2].trim(),
  };
}

/**
 * Validate required fields in an object
 */
export function validateRequiredFields(
  data: Record<string, unknown>,
  requiredFields: string[],
  filePath: string
): CLIError[] {
  const errors: CLIError[] = [];

  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      errors.push(
        createError(ErrorCodes.MISSING_FIELD, `Missing required field: ${field}`, {
          file: filePath,
          suggestion: `Add '${field}' field to the file`,
        })
      );
    }
  }

  return errors;
}

/**
 * Validate field value against allowed values
 */
export function validateFieldValue(
  data: Record<string, unknown>,
  field: string,
  allowedValues: string[],
  filePath: string
): CLIError | null {
  const value = data[field];
  if (value !== undefined && !allowedValues.includes(value as string)) {
    return createError(
      ErrorCodes.INVALID_VALUE,
      `Invalid value '${value}' for field '${field}'. Must be one of: ${allowedValues.join(', ')}`,
      { file: filePath, suggestion: `Use one of: ${allowedValues.join(', ')}` }
    );
  }
  return null;
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read and parse a YAML file
 */
export async function readYamlFile<T = Record<string, unknown>>(
  filePath: string
): Promise<{ data?: T; error?: CLIError }> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const result = validateYamlFile(filePath, content);
    if (!result.valid) {
      return { error: result.error };
    }
    return { data: result.data as T };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        error: createError(ErrorCodes.FILE_NOT_FOUND, `File not found: ${filePath}`, { file: filePath }),
      };
    }
    return {
      error: createError(ErrorCodes.FILE_READ_ERROR, e instanceof Error ? e.message : 'Failed to read file', {
        file: filePath,
      }),
    };
  }
}

/**
 * Read and parse a markdown file with frontmatter
 */
export async function readMarkdownFile(
  filePath: string
): Promise<{ frontmatter?: Record<string, unknown>; body?: string; error?: CLIError }> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return validateFrontmatter(filePath, content);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        error: createError(ErrorCodes.FILE_NOT_FOUND, `File not found: ${filePath}`, { file: filePath }),
      };
    }
    return {
      error: createError(ErrorCodes.FILE_READ_ERROR, e instanceof Error ? e.message : 'Failed to read file', {
        file: filePath,
      }),
    };
  }
}

/**
 * List files in a directory matching a pattern
 */
export async function listFiles(dirPath: string, extension: string): Promise<string[]> {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter(entry => entry.isFile() && entry.name.endsWith(extension))
      .map(entry => path.join(dirPath, entry.name));
  } catch {
    return [];
  }
}

/**
 * Build a validation result from multiple items
 */
export function buildValidationResult(items: ValidationItem[]): ValidationResult {
  const validFiles = items.filter(item => item.valid).length;
  return {
    totalFiles: items.length,
    validFiles,
    invalidFiles: items.length - validFiles,
    items,
  };
}

/**
 * Simple auto-fix for common YAML issues
 */
export interface AutoFixResult {
  fixed: boolean;
  content: string;
  fixes: string[];
}

export function autoFixYaml(content: string): AutoFixResult {
  const fixes: string[] = [];
  let fixedContent = content;

  // Fix unquoted strings that need quotes (e.g., values with colons)
  const lines = fixedContent.split('\n');
  const fixedLines = lines.map((line, index) => {
    // Match key: value pairs where value contains a colon and isn't quoted
    const match = line.match(/^(\s*)([^:]+):\s*(.+)$/);
    if (match) {
      const [, indent, key, value] = match;
      // If value contains a colon and isn't already quoted
      if (value.includes(':') && !value.startsWith('"') && !value.startsWith("'")) {
        fixes.push(`Line ${index + 1}: Quoted value containing colon`);
        return `${indent}${key}: "${value}"`;
      }
    }
    return line;
  });

  fixedContent = fixedLines.join('\n');

  return {
    fixed: fixes.length > 0,
    content: fixedContent,
    fixes,
  };
}
