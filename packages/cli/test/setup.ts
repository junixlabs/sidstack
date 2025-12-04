/**
 * Test Setup
 *
 * Provides utilities and fixtures for CLI tests.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const FIXTURES_PATH = path.join(__dirname, 'fixtures');
export const CLI_BIN = path.join(__dirname, '../bin/run.js');

/**
 * Copy directory recursively
 */
async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Create a temporary test workspace with .sidstack structure
 */
export async function createTestWorkspace(): Promise<string> {
  const os = await import('os');
  const tempDir = path.join(os.tmpdir(), `sidstack-cli-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  // Create .sidstack directory
  await fs.mkdir(path.join(tempDir, '.sidstack', 'modules'), { recursive: true });

  // Copy config
  await fs.copyFile(
    path.join(FIXTURES_PATH, '.sidstack', 'config.json'),
    path.join(tempDir, '.sidstack', 'config.json')
  );

  // Copy fixture modules
  const fixtureModulesDir = path.join(FIXTURES_PATH, 'modules');
  const targetModulesDir = path.join(tempDir, '.sidstack', 'modules');

  const files = await fs.readdir(fixtureModulesDir);
  for (const file of files) {
    if (file.endsWith('.yaml')) {
      await fs.copyFile(
        path.join(fixtureModulesDir, file),
        path.join(targetModulesDir, file)
      );
    }
  }

  // Copy governance files if they exist
  const governanceSrc = path.join(FIXTURES_PATH, '.sidstack', 'governance.md');
  try {
    await fs.access(governanceSrc);
    await fs.copyFile(governanceSrc, path.join(tempDir, '.sidstack', 'governance.md'));
  } catch {
    // No governance file, skip
  }

  // Copy principles directory if it exists
  const principlesSrc = path.join(FIXTURES_PATH, '.sidstack', 'principles');
  try {
    await fs.access(principlesSrc);
    await copyDir(principlesSrc, path.join(tempDir, '.sidstack', 'principles'));
  } catch {
    // No principles directory, skip
  }

  // Copy skills directory if it exists
  const skillsSrc = path.join(FIXTURES_PATH, '.sidstack', 'skills');
  try {
    await fs.access(skillsSrc);
    await copyDir(skillsSrc, path.join(tempDir, '.sidstack', 'skills'));
  } catch {
    // No skills directory, skip
  }

  return tempDir;
}

/**
 * Clean up test workspace
 */
export async function cleanupTestWorkspace(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

/**
 * Create an empty test workspace (no modules)
 */
export async function createEmptyWorkspace(): Promise<string> {
  const os = await import('os');
  const tempDir = path.join(os.tmpdir(), `sidstack-cli-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  await fs.mkdir(path.join(tempDir, '.sidstack', 'modules'), { recursive: true });

  await fs.copyFile(
    path.join(FIXTURES_PATH, '.sidstack', 'config.json'),
    path.join(tempDir, '.sidstack', 'config.json')
  );

  return tempDir;
}

/**
 * Add a custom module to a test workspace
 */
export async function addModule(
  workspacePath: string,
  moduleId: string,
  moduleContent: Record<string, unknown>
): Promise<void> {
  const yaml = await import('yaml');
  const modulePath = path.join(workspacePath, '.sidstack', 'modules', `${moduleId}.yaml`);
  await fs.writeFile(modulePath, yaml.stringify(moduleContent));
}
