import * as fs from 'fs';
import * as path from 'path';

import { Command, Flags } from '@oclif/core';
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
      this.log(chalk.yellow(`⚠ Knowledge folder already exists: ${knowledgePath}`));
      this.log(chalk.gray('  Use --force to overwrite existing files.'));
      return;
    }

    this.log('');
    this.log(chalk.bold('🚀 Initializing Knowledge Documentation'));
    this.log('');

    // Create folder structure
    const folders = [
      '',
      'business-logic',
      'api',
      'patterns',
      'database',
      'modules',
    ];

    for (const folder of folders) {
      const folderPath = path.join(knowledgePath, folder);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
        this.log(chalk.green(`  ✓ Created ${folder || 'knowledge/'}`));
      }
    }

    // Create index file
    const indexPath = path.join(knowledgePath, '_index.md');
    if (!fs.existsSync(indexPath) || flags.force) {
      const projectName = path.basename(projectPath);
      const today = new Date().toISOString().split('T')[0];

      const indexContent = `---
id: knowledge-index
type: index
title: ${projectName} Knowledge Base
status: draft
created: ${today}
---

# ${projectName} Knowledge Base

Welcome to the project knowledge documentation.

## Structure

| Folder | Content |
|--------|---------|
| \`business-logic/\` | Workflows, rules, state machines |
| \`api/\` | REST/GraphQL endpoint documentation |
| \`patterns/\` | Design patterns, architectures |
| \`database/\` | Table schemas, relationships |
| \`modules/\` | Package/feature documentation |

## Getting Started

Use the SidStack Knowledge Builder to generate documentation:

\`\`\`bash
# Full project scan
/sidstack:knowledge build

# Focus on specific area
/sidstack:knowledge build api
/sidstack:knowledge build business-logic

# Validate documents
sidstack knowledge validate
\`\`\`

## Quick Links

- Business Logic
  - <!-- Add links to business logic docs -->
- API Endpoints
  - <!-- Add links to API docs -->
- Design Patterns
  - <!-- Add links to pattern docs -->
`;

      fs.writeFileSync(indexPath, indexContent);
      this.log(chalk.green('  ✓ Created _index.md'));
    }

    // Create example templates in each folder
    const templates: Record<string, string> = {
      'business-logic/.gitkeep': '',
      'api/.gitkeep': '',
      'patterns/.gitkeep': '',
      'database/.gitkeep': '',
      'modules/.gitkeep': '',
    };

    for (const [templatePath, content] of Object.entries(templates)) {
      const fullPath = path.join(knowledgePath, templatePath);
      if (!fs.existsSync(fullPath)) {
        fs.writeFileSync(fullPath, content);
      }
    }

    this.log('');
    this.log(chalk.bold('📋 Next Steps:'));
    this.log('');
    this.log(chalk.gray('  1. Run the Knowledge Builder to generate documentation:'));
    this.log(chalk.cyan('     /sidstack:knowledge build'));
    this.log('');
    this.log(chalk.gray('  2. List existing documents:'));
    this.log(chalk.cyan('     sidstack knowledge list'));
    this.log('');
    this.log(chalk.gray('  3. Validate documents:'));
    this.log(chalk.cyan('     sidstack knowledge validate'));
    this.log('');
    this.log(chalk.green('✓ Knowledge folder initialized successfully!'));
    this.log('');
  }
}
