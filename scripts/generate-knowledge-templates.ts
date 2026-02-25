#!/usr/bin/env tsx
/**
 * Generate Knowledge Template READMEs
 *
 * Reads FOLDER_CONFIG from the shared schema and writes _README.md files
 * to the CLI governance template directory.
 *
 * Usage: pnpm generate:knowledge-templates
 *
 * Run this after changing FOLDER_CONFIG in packages/shared/src/knowledge/types.ts.
 * The schema-consistency test will catch if this is forgotten.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Import from built shared package
import { FOLDER_CONFIG } from '@sidstack/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_DIR = path.resolve(
  __dirname,
  '../packages/cli/templates/governance/.sidstack/knowledge'
);

function main() {
  console.log('Generating knowledge template READMEs...\n');

  // Ensure base template directory exists
  if (!fs.existsSync(TEMPLATE_DIR)) {
    fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
  }

  for (const folder of FOLDER_CONFIG) {
    const folderPath = path.join(TEMPLATE_DIR, folder.name);

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const readmePath = path.join(folderPath, '_README.md');
    fs.writeFileSync(readmePath, folder.readmeContent);
    console.log(`  Written: ${folder.name}/_README.md`);
  }

  console.log(`\nDone. ${FOLDER_CONFIG.length} folders generated.`);
}

main();
