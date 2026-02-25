import * as fs from 'fs';
import * as path from 'path';

import { Command, Flags } from '@oclif/core';
import { FOLDER_CONFIG } from '@sidstack/shared';
import chalk from 'chalk';

export default class KnowledgeInit extends Command {
  static description = 'Initialize knowledge documentation folder';

  static examples = [
    '<%= config.bin %> knowledge init',
    '<%= config.bin %> knowledge init --path ./custom-knowledge',
  ];

  static flags = {
    path: Flags.string({
      char: 'p',
      description: 'Custom path for knowledge folder',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Overwrite existing files',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(KnowledgeInit);
    const projectPath = process.cwd();
    const knowledgePath = flags.path || path.join(projectPath, '.sidstack', 'knowledge');

    // Check if already exists
    if (fs.existsSync(knowledgePath) && !flags.force) {
      this.log(chalk.yellow(`Warning: Knowledge folder already exists: ${knowledgePath}`));
      this.log(chalk.gray('  Use --force to overwrite existing files.'));
      return;
    }

    this.log('');
    this.log(chalk.bold('Initializing Knowledge Documentation'));
    this.log('');

    // Create 9-folder structure with _README.md in each (from shared FOLDER_CONFIG)
    for (const folder of FOLDER_CONFIG) {
      const folderPath = path.join(knowledgePath, folder.name);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      const readmePath = path.join(folderPath, '_README.md');
      if (!fs.existsSync(readmePath) || flags.force) {
        fs.writeFileSync(readmePath, folder.readmeContent);
      }

      this.log(chalk.green(`  Created ${folder.name}/`));
    }

    // Create root index file
    const indexPath = path.join(knowledgePath, '_index.md');
    if (!fs.existsSync(indexPath) || flags.force) {
      const projectName = path.basename(projectPath);
      const today = new Date().toISOString().split('T')[0];

      const indexContent = `---
id: knowledge-index
type: index
title: ${projectName} Knowledge Base
status: draft
createdAt: ${today}
---

# ${projectName} Knowledge Base

## Structure

| Folder | Content | Type |
|--------|---------|------|
| \`00-context/\` | System purpose, business model, constraints | Living |
| \`01-architecture/\` | System overview, module boundaries, data flow | Living |
| \`02-decisions/\` | Architecture Decision Records (ADR) | Event |
| \`03-standards/\` | Coding rules, conventions, checklists | Living |
| \`04-data/\` | Database schema, ownership, retention | Living |
| \`05-api/\` | API contracts, schemas, versioning | Living |
| \`06-operations/\` | Deployment, rollback, monitoring | Living |
| \`07-projects/\` | Project briefs, designs, post-mortems | Event |
| \`08-incidents/\` | Incident reports, root cause, prevention | Event |

## Getting Started

\`\`\`bash
# AI-powered knowledge generation
sidstack init --scan

# Search knowledge
sidstack knowledge list
sidstack knowledge validate
\`\`\`
`;

      fs.writeFileSync(indexPath, indexContent);
      this.log(chalk.green('  Created _index.md'));
    }

    this.log('');
    this.log(chalk.bold('Next Steps:'));
    this.log('');
    this.log(chalk.gray('  1. Run AI-powered scan to generate initial docs:'));
    this.log(chalk.cyan('     sidstack init --scan'));
    this.log('');
    this.log(chalk.gray('  2. List existing documents:'));
    this.log(chalk.cyan('     sidstack knowledge list'));
    this.log('');
    this.log(chalk.gray('  3. Validate documents:'));
    this.log(chalk.cyan('     sidstack knowledge validate'));
    this.log('');
    this.log(chalk.green('Knowledge folder initialized successfully!'));
    this.log('');
  }
}
