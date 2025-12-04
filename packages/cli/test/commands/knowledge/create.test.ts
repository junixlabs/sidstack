/**
 * Tests for: sidstack knowledge create
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';
import {
  createTestWorkspace,
  cleanupTestWorkspace,
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

describe('knowledge create', () => {
  let workspacePath: string;

  beforeEach(async () => {
    workspacePath = await createTestWorkspace();
  });

  afterEach(async () => {
    if (workspacePath) {
      await cleanupTestWorkspace(workspacePath);
    }
  });

  describe('create from template', () => {
    it('should create business-logic document', async () => {
      const result = await runCli([
        'knowledge', 'create',
        '--type', 'business-logic',
        '--title', 'User Registration',
        '--yes',
        '--json'
      ], workspacePath);

      expect(result.exitCode).toBe(0);
      expect(result.json?.success).toBe(true);

      const data = result.json?.data as Record<string, unknown>;
      expect(data?.created).toBe(true);
      expect(data?.outputPath).toContain('user-registration.md');
    });

    it('should create api-endpoint document', async () => {
      const result = await runCli([
        'knowledge', 'create',
        '--type', 'api-endpoint',
        '--title', 'GET Users',
        '--var', 'method=GET',
        '--var', 'path=/api/users',
        '--yes',
        '--json'
      ], workspacePath);

      expect(result.exitCode).toBe(0);
      expect(result.json?.success).toBe(true);
    });

    it('should create module document', async () => {
      const result = await runCli([
        'knowledge', 'create',
        '--type', 'module',
        '--title', 'Auth Module',
        '--module', 'auth',
        '--yes',
        '--json'
      ], workspacePath);

      expect(result.exitCode).toBe(0);
      expect(result.json?.success).toBe(true);
    });

    it('should create database-table document', async () => {
      const result = await runCli([
        'knowledge', 'create',
        '--type', 'database-table',
        '--title', 'Users Table',
        '--var', 'table_name=users',
        '--yes',
        '--json'
      ], workspacePath);

      expect(result.exitCode).toBe(0);
      expect(result.json?.success).toBe(true);
    });
  });

  describe('file creation', () => {
    it('should create file at correct path', async () => {
      const result = await runCli([
        'knowledge', 'create',
        '--type', 'business-logic',
        '--title', 'Test Document',
        '--yes',
        '--json'
      ], workspacePath);

      expect(result.exitCode).toBe(0);

      const data = result.json?.data as Record<string, unknown>;
      const outputPath = data?.outputPath as string;

      // Check file exists
      const fileExists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should create file with correct content', async () => {
      const result = await runCli([
        'knowledge', 'create',
        '--type', 'business-logic',
        '--title', 'Test Content',
        '--yes',
        '--json'
      ], workspacePath);

      expect(result.exitCode).toBe(0);

      const data = result.json?.data as Record<string, unknown>;
      const outputPath = data?.outputPath as string;

      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('Test Content');
    });
  });

  describe('dry run (--dry-run)', () => {
    it('should not create file in dry run mode', async () => {
      const result = await runCli([
        'knowledge', 'create',
        '--type', 'business-logic',
        '--title', 'Dry Run Test',
        '--dry-run',
        '--yes',
        '--json'
      ], workspacePath);

      expect(result.exitCode).toBe(0);

      const data = result.json?.data as Record<string, unknown>;
      expect(data?.dryRun).toBe(true);

      const outputPath = data?.outputPath as string;
      const fileExists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(false);
    });

    it('should show content in dry run mode', async () => {
      const result = await runCli([
        'knowledge', 'create',
        '--type', 'business-logic',
        '--title', 'Dry Run Preview',
        '--dry-run',
        '--yes',
        '--json'
      ], workspacePath);

      expect(result.exitCode).toBe(0);

      const data = result.json?.data as Record<string, unknown>;
      expect(data?.content).toBeDefined();
      expect((data?.content as string).length).toBeGreaterThan(0);
    });
  });

  describe('force overwrite (--force)', () => {
    it('should error when file exists without --force', async () => {
      // First create
      await runCli([
        'knowledge', 'create',
        '--type', 'business-logic',
        '--title', 'Existing Doc',
        '--yes',
        '--json'
      ], workspacePath);

      // Second create should fail
      const result = await runCli([
        'knowledge', 'create',
        '--type', 'business-logic',
        '--title', 'Existing Doc',
        '--yes',
        '--json'
      ], workspacePath);

      expect(result.exitCode).not.toBe(0);
      expect(result.json?.success).toBe(false);
    });

    it('should overwrite with --force', async () => {
      // First create
      await runCli([
        'knowledge', 'create',
        '--type', 'business-logic',
        '--title', 'Overwrite Test',
        '--yes',
        '--json'
      ], workspacePath);

      // Second create with --force should succeed
      const result = await runCli([
        'knowledge', 'create',
        '--type', 'business-logic',
        '--title', 'Overwrite Test',
        '--force',
        '--yes',
        '--json'
      ], workspacePath);

      expect(result.exitCode).toBe(0);
      expect(result.json?.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should error for invalid template type', async () => {
      const result = await runCli([
        'knowledge', 'create',
        '--type', 'invalid-template',
        '--title', 'Test',
        '--yes',
        '--json'
      ], workspacePath);

      expect(result.exitCode).not.toBe(0);
      expect(result.json?.success).toBe(false);
    });

    it('should error when missing required variables', async () => {
      const result = await runCli([
        'knowledge', 'create',
        '--type', 'business-logic',
        // Missing --title
        '--yes',
        '--json'
      ], workspacePath);

      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('output directory (--output-dir)', () => {
    it('should create file in custom directory', async () => {
      const customDir = path.join(workspacePath, 'custom', 'knowledge');

      const result = await runCli([
        'knowledge', 'create',
        '--type', 'business-logic',
        '--title', 'Custom Path',
        '--output-dir', customDir,
        '--yes',
        '--json'
      ], workspacePath);

      expect(result.exitCode).toBe(0);

      const data = result.json?.data as Record<string, unknown>;
      const outputPath = data?.outputPath as string;

      expect(outputPath).toContain('custom/knowledge');
    });
  });
});
