/**
 * Agent-Friendly Output Utilities
 *
 * Provides structured output formatting for both human users and Claude Code agents.
 *
 * Exit Codes:
 * - 0: Success
 * - 1: Fatal error
 * - 2: Warning (non-fatal)
 * - 3: Validation failed
 * - 4: Not initialized
 */

// Standard exit codes for agent consumption
export const ExitCodes = {
  SUCCESS: 0,
  ERROR: 1,
  WARNING: 2,
  VALIDATION_FAILED: 3,
  NOT_INITIALIZED: 4,
} as const;

export type ExitCode = (typeof ExitCodes)[keyof typeof ExitCodes];

// Standard response structure for JSON output
export interface CLIResponse<T = unknown> {
  success: boolean;
  exitCode: ExitCode;
  data?: T;
  errors: CLIError[];
  warnings: CLIWarning[];
  metadata: CLIMetadata;
}

export interface CLIError {
  code: string;
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

export interface CLIWarning {
  code: string;
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

export interface CLIMetadata {
  command: string;
  duration?: number;
  timestamp: string;
  version?: string;
}

// Validation-specific types
export interface ValidationResult {
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  items: ValidationItem[];
}

export interface ValidationItem {
  file: string;
  valid: boolean;
  errors: CLIError[];
  warnings: CLIWarning[];
}

/**
 * Output formatter class for consistent CLI output
 */
export class OutputFormatter {
  private startTime: number;
  private command: string;
  private jsonMode: boolean;
  private quietMode: boolean;
  private errors: CLIError[] = [];
  private warnings: CLIWarning[] = [];

  constructor(command: string, options: { json?: boolean; quiet?: boolean } = {}) {
    this.startTime = Date.now();
    this.command = command;
    this.jsonMode = options.json ?? false;
    this.quietMode = options.quiet ?? false;
  }

  /**
   * Add an error to the output
   */
  addError(error: CLIError): void {
    this.errors.push(error);
  }

  /**
   * Add a warning to the output
   */
  addWarning(warning: CLIWarning): void {
    this.warnings.push(warning);
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Check if there are any warnings
   */
  hasWarnings(): boolean {
    return this.warnings.length > 0;
  }

  /**
   * Get appropriate exit code based on errors/warnings
   */
  getExitCode(treatWarningsAsErrors: boolean = false): ExitCode {
    if (this.hasErrors()) {
      return ExitCodes.VALIDATION_FAILED;
    }
    if (treatWarningsAsErrors && this.hasWarnings()) {
      return ExitCodes.VALIDATION_FAILED;
    }
    if (this.hasWarnings()) {
      return ExitCodes.WARNING;
    }
    return ExitCodes.SUCCESS;
  }

  /**
   * Build the final response object
   */
  buildResponse<T>(data?: T, options: { strict?: boolean } = {}): CLIResponse<T> {
    const exitCode = this.getExitCode(options.strict);
    return {
      success: exitCode === ExitCodes.SUCCESS || exitCode === ExitCodes.WARNING,
      exitCode,
      data,
      errors: this.errors,
      warnings: this.warnings,
      metadata: {
        command: this.command,
        duration: Date.now() - this.startTime,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Format and return output string (JSON or human-readable)
   */
  format<T>(data?: T, options: { strict?: boolean } = {}): string {
    if (this.jsonMode) {
      return JSON.stringify(this.buildResponse(data, options), null, 2);
    }
    // Human-readable format - let the command handle this
    return '';
  }

  /**
   * Check if in JSON mode
   */
  isJsonMode(): boolean {
    return this.jsonMode;
  }

  /**
   * Check if in quiet mode
   */
  isQuietMode(): boolean {
    return this.quietMode;
  }
}

/**
 * Create a success response
 */
export function successResponse<T>(
  command: string,
  data: T,
  options: { warnings?: CLIWarning[] } = {}
): CLIResponse<T> {
  const hasWarnings = options.warnings && options.warnings.length > 0;
  return {
    success: true,
    exitCode: hasWarnings ? ExitCodes.WARNING : ExitCodes.SUCCESS,
    data,
    errors: [],
    warnings: options.warnings ?? [],
    metadata: {
      command,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create an error response
 */
export function errorResponse(
  command: string,
  errors: CLIError[],
  exitCode: ExitCode = ExitCodes.ERROR
): CLIResponse {
  return {
    success: false,
    exitCode,
    errors,
    warnings: [],
    metadata: {
      command,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create a validation response
 */
export function validationResponse(
  command: string,
  result: ValidationResult,
  options: { strict?: boolean } = {}
): CLIResponse<ValidationResult> {
  const hasErrors = result.invalidFiles > 0;
  const hasWarnings = result.items.some(item => item.warnings.length > 0);

  let exitCode: ExitCode = ExitCodes.SUCCESS;
  if (hasErrors) {
    exitCode = ExitCodes.VALIDATION_FAILED;
  } else if (options.strict && hasWarnings) {
    exitCode = ExitCodes.VALIDATION_FAILED;
  } else if (hasWarnings) {
    exitCode = ExitCodes.WARNING;
  }

  // Collect all errors and warnings
  const allErrors: CLIError[] = [];
  const allWarnings: CLIWarning[] = [];
  for (const item of result.items) {
    allErrors.push(...item.errors);
    allWarnings.push(...item.warnings);
  }

  return {
    success: exitCode === ExitCodes.SUCCESS || exitCode === ExitCodes.WARNING,
    exitCode,
    data: result,
    errors: allErrors,
    warnings: allWarnings,
    metadata: {
      command,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Simple format output helper for JSON responses
 */
export function formatOutput(response: CLIResponse | Record<string, unknown>, format: 'json' | 'text' = 'json'): string {
  if (format === 'json') {
    return JSON.stringify(response, null, 2);
  }
  // For text format, just return empty and let command handle it
  return '';
}

/**
 * Format table for human-readable output
 */
export function formatTable(
  headers: string[],
  rows: string[][],
  options: { padding?: number } = {}
): string {
  const padding = options.padding ?? 2;

  // Calculate column widths
  const widths = headers.map((header, i) => {
    const columnValues = [header, ...rows.map(row => row[i] ?? '')];
    return Math.max(...columnValues.map(v => v.length));
  });

  // Build header line
  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join(' '.repeat(padding));
  const separator = widths.map(w => '─'.repeat(w)).join('─'.repeat(padding));

  // Build rows
  const rowLines = rows.map(row =>
    row.map((cell, i) => (cell ?? '').padEnd(widths[i])).join(' '.repeat(padding))
  );

  return [headerLine, separator, ...rowLines].join('\n');
}

/**
 * Format a summary line for validation results
 */
export function formatValidationSummary(result: ValidationResult): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('─'.repeat(50));
  lines.push(`Total: ${result.totalFiles} file(s)`);
  lines.push(`Valid: ${result.validFiles}`);
  lines.push(`Invalid: ${result.invalidFiles}`);

  const totalWarnings = result.items.reduce((sum, item) => sum + item.warnings.length, 0);
  if (totalWarnings > 0) {
    lines.push(`Warnings: ${totalWarnings}`);
  }

  return lines.join('\n');
}
