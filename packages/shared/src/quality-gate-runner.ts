/**
 * Quality Gate Runner
 *
 * Executes quality gate commands and returns structured results.
 * Used by task_complete to auto-run gates before completion.
 */

import { execSync } from 'child_process';
import type { QualityGate } from './governance';

export interface QualityGateResult {
  id: string;
  command: string;
  passed: boolean;
  exitCode: number;
  output: string;    // truncated to 2000 chars
  duration: number;  // ms
  executedAt: number;
}

/**
 * Run quality gates for a project. Returns results for all gates.
 * Gates are run sequentially. All gates run even if some fail.
 */
export function runQualityGates(
  projectPath: string,
  gates: QualityGate[]
): QualityGateResult[] {
  const results: QualityGateResult[] = [];

  for (const gate of gates) {
    const start = Date.now();
    let exitCode = 0;
    let output = '';

    try {
      const result = execSync(gate.command, {
        cwd: projectPath,
        timeout: 60000,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 1024 * 1024, // 1MB
      });
      output = result || '';
    } catch (error: any) {
      exitCode = error.status || 1;
      output = (error.stdout || '') + (error.stderr || '');
    }

    const duration = Date.now() - start;

    // Truncate output to 2000 chars
    if (output.length > 2000) {
      output = output.slice(0, 1997) + '...';
    }

    results.push({
      id: gate.id,
      command: gate.command,
      passed: exitCode === 0,
      exitCode,
      output,
      duration,
      executedAt: Date.now(),
    });
  }

  return results;
}
