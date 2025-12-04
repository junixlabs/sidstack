/**
 * Resolve paths to bundled assets (templates, skills).
 *
 * Works in both environments:
 * - Development: __dirname is src/commands/ or src/lib/ → assets at ../../templates/
 * - Production (npx): __dirname is dist/commands/ or dist/lib/ → assets at ../templates/
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Resolve the CLI package root directory that contains templates/ and skills/.
 * @param fromDir - The __dirname of the calling module
 */
export function resolveCliPackageRoot(fromDir: string): string {
  // Production: dist/commands/ or dist/lib/ → one level up is dist/ (has templates/, skills/)
  const distRoot = path.resolve(fromDir, '..');
  if (fs.existsSync(path.join(distRoot, 'templates'))) {
    return distRoot;
  }

  // Development: src/commands/ or src/lib/ → two levels up is packages/cli/ (has templates/, skills/)
  const devRoot = path.resolve(fromDir, '../..');
  if (fs.existsSync(path.join(devRoot, 'templates'))) {
    return devRoot;
  }

  // Fallback to dist path
  return distRoot;
}

/** Resolve a path under templates/ */
export function resolveTemplatesDir(fromDir: string, ...segments: string[]): string {
  return path.join(resolveCliPackageRoot(fromDir), 'templates', ...segments);
}

/** Resolve a path under skills/ */
export function resolveSkillsDir(fromDir: string, ...segments: string[]): string {
  return path.join(resolveCliPackageRoot(fromDir), 'skills', ...segments);
}
