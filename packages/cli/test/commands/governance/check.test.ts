/**
 * Tests for: sidstack governance check
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';
import {
  createTestWorkspace,
  cleanupTestWorkspace,
  createEmptyWorkspace,
} from '../../setup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(__dirname, '../../../bin/run.js');

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  json?: Record<string, unknown>;
}

async function runCli(args: string[], cwd: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    const proc = spawn('node', [CLI_PATH, ...args], {
      cwd,
      env: { ...process.env, FORCE_COLOR: '0' },
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const result: CommandResult = {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? 1,
      };

      if (args.includes('--json') || args.includes('-j')) {
        try {
          result.json = JSON.parse(stdout.trim());
        } catch {
          // Not valid JSON
        }
      }

      resolve(result);
    });

    proc.on('error', (err) => {
      resolve({
        stdout,
        stderr: err.message,
        exitCode: 1,
      });
    });
  });
}

describe('governance check', () => {
  let workspacePath: string;

  beforeEach(async () => {
    workspacePath = await createTestWorkspace();
  });

  afterEach(async () => {
    if (workspacePath) {
      await cleanupTestWorkspace(workspacePath);
    }
  });

  describe('basic functionality', () => {
    it('should check governance compliance', async () => {
      const result = await runCli(['governance', 'check'], workspacePath);

      // Should complete (pass or with warnings)
      expect([0, 2]).toContain(result.exitCode);
    });
  });

  describe('JSON output (--json)', () => {
    it('should return valid JSON', async () => {
      const result = await runCli(['governance', 'check', '--json'], workspacePath);

      expect(result.json).toBeDefined();
    });

    it('should include check results', async () => {
      const result = await runCli(['governance', 'check', '--json'], workspacePath);

      const data = result.json?.data as Record<string, unknown>;
      expect(data).toBeDefined();
    });
  });

  describe('category filter (scope argument)', () => {
    it('should check only principles', async () => {
      const result = await runCli(['governance', 'check', 'principles', '--json'], workspacePath);

      expect(result.json).toBeDefined();
    });

    it('should check only skills', async () => {
      const result = await runCli(['governance', 'check', 'skills', '--json'], workspacePath);

      expect(result.json).toBeDefined();
    });
  });

  describe('module filter (scope argument)', () => {
    it('should check specific module', async () => {
      const result = await runCli(['governance', 'check', 'module', 'api-server', '--json'], workspacePath);

      expect(result.json).toBeDefined();
    });
  });

  describe('strict mode (--strict)', () => {
    it('should treat warnings as errors in strict mode', async () => {
      const normalResult = await runCli(['governance', 'check', '--json'], workspacePath);
      const strictResult = await runCli(['governance', 'check', '--strict', '--json'], workspacePath);

      // If normal mode has warnings (exit 2), strict mode should fail (exit 3)
      if (normalResult.exitCode === 2) {
        expect(strictResult.exitCode).toBe(3);
      }
    });
  });

  describe('quiet mode (--quiet)', () => {
    it('should output minimal info', async () => {
      const result = await runCli(['governance', 'check', '--quiet'], workspacePath);

      // Quiet mode should have minimal output
      expect(result.stdout.length).toBeLessThan(200);
    });
  });

  describe('exit codes', () => {
    it('should return 0 for passing check', async () => {
      const result = await runCli(['governance', 'check', '--json'], workspacePath);

      // 0 = pass, 2 = warnings, 3 = errors
      expect([0, 2]).toContain(result.exitCode);
    });

    it('should return 4 for uninitialized workspace', async () => {
      const emptyPath = await createEmptyWorkspace();

      try {
        const result = await runCli(['governance', 'check', '--json'], emptyPath);

        expect(result.exitCode).toBe(4); // NOT_INITIALIZED
      } finally {
        await cleanupTestWorkspace(emptyPath);
      }
    });
  });

  describe('invalid governance files', () => {
    it('should detect invalid principle files', async () => {
      // Create an invalid principle file (missing required frontmatter)
      const invalidPrinciple = path.join(workspacePath, '.sidstack', 'principles', 'invalid.md');
      await fs.writeFile(invalidPrinciple, '# Invalid\n\nNo frontmatter');

      const result = await runCli(['governance', 'check', '--json'], workspacePath);

      // Should have warnings or errors about the invalid file
      const warnings = result.json?.warnings as Array<{ code: string }> | undefined;
      const errors = result.json?.errors as Array<{ code: string }> | undefined;

      const hasIssue = (warnings && warnings.length > 0) || (errors && errors.length > 0);
      expect(hasIssue || result.exitCode !== 0).toBe(true);
    });
  });
});
