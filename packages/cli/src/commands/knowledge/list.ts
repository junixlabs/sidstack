import * as fs from 'fs';
import * as path from 'path';

import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';

interface KnowledgeDocument {
  path: string;
  id: string;
  type: string;
  title?: string;
  module?: string;
  status?: string;
}

export default class KnowledgeList extends Command {
  static description = 'List knowledge documentation files';

  static examples = [
    '<%= config.bin %> knowledge list',
    '<%= config.bin %> knowledge list --type api-endpoint',
    '<%= config.bin %> knowledge list --module orders',
  ];

  static flags = {
    type: Flags.string({
      char: 't',
      description: 'Filter by type (business-logic, api-endpoint, etc.)',
    }),
    module: Flags.string({
      char: 'm',
      description: 'Filter by module',
    }),
    status: Flags.string({
      char: 's',
      description: 'Filter by status (draft, implemented, deprecated, planned)',
    }),
    json: Flags.boolean({
      description: 'Output as JSON',
      default: false,
    }),
    path: Flags.string({
      char: 'p',
      description: 'Path to knowledge folder',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(KnowledgeList);
    const projectPath = process.cwd();
    const knowledgePath = flags.path || path.join(projectPath, '.sidstack', 'knowledge');

    // Check if knowledge folder exists
    if (!fs.existsSync(knowledgePath)) {
      if (flags.json) {
        this.log(JSON.stringify({ error: 'Knowledge folder not found', documents: [] }));
      } else {
        this.log(chalk.red(`✗ Knowledge folder not found: ${knowledgePath}`));
        this.log(chalk.gray('  Run `sidstack knowledge init` to create it.'));
      }
      return;
    }

    let documents = this.loadDocuments(knowledgePath);

    // Apply filters
    if (flags.type) {
      documents = documents.filter(d => d.type === flags.type);
    }
    if (flags.module) {
      documents = documents.filter(d => d.module === flags.module);
    }
    if (flags.status) {
      documents = documents.filter(d => d.status === flags.status);
    }

    if (flags.json) {
      this.log(JSON.stringify(documents, null, 2));
      return;
    }

    this.printDocuments(documents, knowledgePath);
  }

  private loadDocuments(knowledgePath: string): KnowledgeDocument[] {
    const documents: KnowledgeDocument[] = [];
    const files = this.findMarkdownFiles(knowledgePath);

    for (const filePath of files) {
      const doc = this.parseDocument(filePath, knowledgePath);
      if (doc) {
        documents.push(doc);
      }
    }

    // Sort by type, then by title
    documents.sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return (a.title || a.id).localeCompare(b.title || b.id);
    });

    return documents;
  }

  private findMarkdownFiles(dir: string): string[] {
    const files: string[] = [];

    const walk = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'archive') {
            walk(fullPath);
          }
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    };

    walk(dir);
    return files;
  }

  private parseDocument(filePath: string, basePath: string): KnowledgeDocument | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const match = content.match(/^---\n([\s\S]*?)\n---/);

      if (!match) return null;

      const yaml = match[1];
      const frontmatter = this.parseYaml(yaml);

      return {
        path: path.relative(basePath, filePath),
        id: frontmatter.id || path.basename(filePath, '.md'),
        type: frontmatter.type || 'index',
        title: frontmatter.title,
        module: frontmatter.module,
        status: frontmatter.status,
      };
    } catch {
      return null;
    }
  }

  private parseYaml(yaml: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = yaml.split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      result[key] = value;
    }

    return result;
  }

  private printDocuments(documents: KnowledgeDocument[], basePath: string): void {
    this.log('');
    this.log(chalk.bold('📚 Knowledge Documents'));
    this.log(chalk.gray(`   Path: ${basePath}`));
    this.log('');

    if (documents.length === 0) {
      this.log(chalk.gray('  No documents found.'));
      this.log('');
      return;
    }

    // Group by type
    const byType = new Map<string, KnowledgeDocument[]>();
    for (const doc of documents) {
      const existing = byType.get(doc.type) || [];
      existing.push(doc);
      byType.set(doc.type, existing);
    }

    const typeIcons: Record<string, string> = {
      'index': '📋',
      'business-logic': '💼',
      'api-endpoint': '🌐',
      'design-pattern': '🧩',
      'database-table': '🗄️',
      'module': '📦',
    };

    const typeColors: Record<string, (str: string) => string> = {
      'index': chalk.cyan,
      'business-logic': chalk.magenta,
      'api-endpoint': chalk.green,
      'design-pattern': chalk.blue,
      'database-table': chalk.yellow,
      'module': (s) => chalk.hex('#ff8c00')(s),
    };

    for (const [type, docs] of byType) {
      const icon = typeIcons[type] || '📄';
      const color = typeColors[type] || chalk.white;
      this.log(`  ${icon} ${color(type)} (${docs.length})`);

      for (const doc of docs) {
        const title = doc.title || doc.id;
        const status = doc.status ? this.formatStatus(doc.status) : '';
        const module = doc.module ? chalk.gray(` [${doc.module}]`) : '';

        this.log(`     ${chalk.white('•')} ${title}${module}${status}`);
        this.log(chalk.gray(`       ${doc.path}`));
      }
      this.log('');
    }

    this.log(chalk.gray(`  Total: ${documents.length} documents`));
    this.log('');
  }

  private formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'draft': chalk.yellow(' [draft]'),
      'implemented': chalk.green(' [implemented]'),
      'deprecated': chalk.red(' [deprecated]'),
      'planned': chalk.blue(' [planned]'),
    };
    return statusMap[status] || '';
  }
}
