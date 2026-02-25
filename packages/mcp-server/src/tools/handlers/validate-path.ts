/**
 * Shared validation for projectPath parameters.
 *
 * Ensures the resolved path points to a real SidStack project
 * (i.e. contains `.sidstack/config.json`).
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Validate that `projectPath` is a legitimate SidStack project directory.
 *
 * 1. Resolves to an absolute path
 * 2. Checks that `.sidstack/config.json` exists
 * 3. Returns the validated absolute path
 *
 * Throws if validation fails.
 */
export function validateProjectPath(projectPath: string): string {
  if (!projectPath || typeof projectPath !== 'string') {
    throw new Error('projectPath is required');
  }

  const resolved = path.resolve(projectPath);

  const configPath = path.join(resolved, '.sidstack', 'config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Invalid project path: ${resolved} does not contain .sidstack/config.json`
    );
  }

  return resolved;
}
