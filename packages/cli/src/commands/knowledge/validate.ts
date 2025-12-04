import * as fs from 'fs';
import * as path from 'path';

import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';

interface KnowledgeFileIssue {
  filePath: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

interface ValidationResult {
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  issues: KnowledgeFileIssue[];
}

const VALID_TYPES = ['index', 'business-logic', 'api-endpoint', 'design-pattern', 'database-table', 'module'];
const VALID_STATUSES = ['draft', 'implemented', 'deprecated', 'planned'];

export default class KnowledgeValidate extends Command {
  static description = 'Validate knowledge documentation files';

  static examples = [
    '<%= config.bin %> knowledge validate',
    '<%= config.bin %> knowledge validate --fix',
    '<%= config.bin %> knowledge validate --path ./custom-knowledge',
  ];

  static flags = {
    path: Flags.string({
      char: 'p',
      description: 'Path to knowledge folder (default: .sidstack/knowledge)',
    }),
    fix: Flags.boolean({
      char: 'f',
      description: 'Automatically fix common issues',
      default: false,
    }),
    json: Flags.boolean({
      description: 'Output results as JSON',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(KnowledgeValidate);
    const projectPath = process.cwd();
    const knowledgePath = flags.path || path.join(projectPath, '.sidstack', 'knowledge');

    // Check if knowledge folder exists
    if (!fs.existsSync(knowledgePath)) {
      if (flags.json) {
        this.log(JSON.stringify({ error: 'Knowledge folder not found', path: knowledgePath }));
      } else {
        this.log(chalk.red(`✗ Knowledge folder not found: ${knowledgePath}`));
        this.log(chalk.gray('  Run `sidstack knowledge init` to create it.'));
      }
      return;
    }

    const result = await this.validateKnowledgeFiles(knowledgePath, flags.fix);

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2));
      return;
    }

    this.printResults(result, flags.fix);
  }

  private async validateKnowledgeFiles(knowledgePath: string, autoFix: boolean): Promise<ValidationResult> {
    const issues: KnowledgeFileIssue[] = [];
    const files = this.findMarkdownFiles(knowledgePath);
    let validFiles = 0;
    let invalidFiles = 0;

    for (const filePath of files) {
      const fileIssues = this.validateFile(filePath, autoFix);
      if (fileIssues.length === 0) {
        validFiles++;
      } else {
        invalidFiles++;
        issues.push(...fileIssues);
      }
    }

    return {
      totalFiles: files.length,
      validFiles,
      invalidFiles,
      issues,
    };
  }

  private findMarkdownFiles(dir: string): string[] {
    const files: string[] = [];

    const walk = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          // Skip hidden folders and archive
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

  private validateFile(filePath: string, autoFix: boolean): KnowledgeFileIssue[] {
    const issues: KnowledgeFileIssue[] = [];
    let content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    let modified = false;

    // Check for frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (!frontmatterMatch) {
      if (autoFix) {
        // Generate minimal frontmatter
        const id = fileName.replace('.md', '').replace(/\s+/g, '-').toLowerCase();
        const newContent = `---\nid: ${id}\ntype: index\nstatus: draft\ncreated: ${new Date().toISOString().split('T')[0]}\n---\n\n${content}`;
        fs.writeFileSync(filePath, newContent);
        issues.push({
          filePath,
          severity: 'info',
          message: 'Added missing frontmatter (auto-fixed)',
        });
      } else {
        issues.push({
          filePath,
          severity: 'error',
          message: 'Missing frontmatter',
          suggestion: 'Add YAML frontmatter with id and type fields',
        });
      }
      return issues;
    }

    const [, yaml, body] = frontmatterMatch;
    const frontmatter = this.parseYaml(yaml);

    // Check required fields
    if (!frontmatter.id) {
      if (autoFix) {
        const id = fileName.replace('.md', '').replace(/\s+/g, '-').toLowerCase();
        content = content.replace(/^---\n/, `---\nid: ${id}\n`);
        modified = true;
        issues.push({
          filePath,
          severity: 'info',
          message: 'Added missing id field (auto-fixed)',
        });
      } else {
        issues.push({
          filePath,
          severity: 'error',
          message: 'Missing required field: id',
          suggestion: `Add 'id: ${fileName.replace('.md', '').replace(/\s+/g, '-').toLowerCase()}' to frontmatter`,
        });
      }
    }

    if (!frontmatter.type) {
      if (autoFix) {
        const type = this.inferType(filePath);
        content = content.replace(/^---\n/, `---\ntype: ${type}\n`);
        modified = true;
        issues.push({
          filePath,
          severity: 'info',
          message: `Added missing type field: ${type} (auto-fixed)`,
        });
      } else {
        issues.push({
          filePath,
          severity: 'error',
          message: 'Missing required field: type',
          suggestion: `Add 'type: [${VALID_TYPES.join('|')}]' to frontmatter`,
        });
      }
    } else if (!VALID_TYPES.includes(frontmatter.type)) {
      issues.push({
        filePath,
        severity: 'error',
        message: `Invalid type: ${frontmatter.type}`,
        suggestion: `Valid types: ${VALID_TYPES.join(', ')}`,
      });
    }

    // Check status if present
    if (frontmatter.status && !VALID_STATUSES.includes(frontmatter.status)) {
      issues.push({
        filePath,
        severity: 'warning',
        message: `Invalid status: ${frontmatter.status}`,
        suggestion: `Valid statuses: ${VALID_STATUSES.join(', ')}`,
      });
    }

    // Check for at least one heading in body
    if (!body.match(/^#+\s+.+/m)) {
      issues.push({
        filePath,
        severity: 'warning',
        message: 'Content has no headings',
        suggestion: 'Add at least one # heading for better structure',
      });
    }

    // Check for empty content
    if (body.trim().length === 0) {
      issues.push({
        filePath,
        severity: 'warning',
        message: 'Content is empty',
        suggestion: 'Add documentation content',
      });
    }

    // Check for trailing newline
    if (!content.endsWith('\n')) {
      if (autoFix) {
        content += '\n';
        modified = true;
      } else {
        issues.push({
          filePath,
          severity: 'info',
          message: 'File does not end with newline',
        });
      }
    }

    // Write modified content
    if (modified) {
      fs.writeFileSync(filePath, content);
    }

    return issues;
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

  private inferType(filePath: string): string {
    const dir = path.dirname(filePath);
    const dirName = path.basename(dir);

    const typeMap: Record<string, string> = {
      'api': 'api-endpoint',
      'business-logic': 'business-logic',
      'patterns': 'design-pattern',
      'database': 'database-table',
      'modules': 'module',
    };

    return typeMap[dirName] || 'index';
  }

  private printResults(result: ValidationResult, wasFixed: boolean): void {
    this.log('');
    this.log(chalk.bold('📋 Knowledge Validation Results'));
    this.log('');

    // Summary
    this.log(chalk.gray('  Summary:'));
    this.log(`    Total files:   ${result.totalFiles}`);
    this.log(`    ${chalk.green('✓')} Valid:       ${chalk.green(result.validFiles.toString())}`);
    this.log(`    ${chalk.red('✗')} Invalid:     ${chalk.red(result.invalidFiles.toString())}`);
    this.log('');

    if (result.issues.length === 0) {
      this.log(chalk.green('  ✓ All knowledge files are valid!'));
      this.log('');
      return;
    }

    // Group issues by file
    const issuesByFile = new Map<string, KnowledgeFileIssue[]>();
    for (const issue of result.issues) {
      const existing = issuesByFile.get(issue.filePath) || [];
      existing.push(issue);
      issuesByFile.set(issue.filePath, existing);
    }

    // Print issues
    this.log(chalk.gray('  Issues:'));
    for (const [filePath, issues] of issuesByFile) {
      const relativePath = path.relative(process.cwd(), filePath);
      this.log(`    ${chalk.cyan(relativePath)}`);

      for (const issue of issues) {
        const icon = issue.severity === 'error'
          ? chalk.red('✗')
          : issue.severity === 'warning'
            ? chalk.yellow('⚠')
            : chalk.blue('ℹ');

        this.log(`      ${icon} ${issue.message}`);
        if (issue.suggestion && !wasFixed) {
          this.log(chalk.gray(`        → ${issue.suggestion}`));
        }
      }
    }
    this.log('');

    if (!wasFixed && result.invalidFiles > 0) {
      this.log(chalk.gray('  Tip: Run with --fix to automatically fix common issues'));
      this.log('');
    }
  }
}
