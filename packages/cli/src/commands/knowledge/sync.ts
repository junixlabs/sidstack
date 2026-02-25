/**
 * knowledge sync - Sync local knowledge files to remote API server
 *
 * Reads local .sidstack/knowledge/ markdown files, parses frontmatter,
 * compares with remote API, and creates/updates documents as needed.
 */

import * as fs from 'fs';
import * as path from 'path';

import { Command, Flags } from '@oclif/core';
import { createApiClient, type ApiClientError } from '@sidstack/shared';
import { parseFrontmatter, extractSummary, generateSlug } from '@sidstack/shared/knowledge';
import chalk from 'chalk';

import { successResponse, errorResponse, ExitCodes } from '../../lib/output.js';

interface SyncResult {
  created: number;
  updated: number;
  unchanged: number;
  errors: number;
  details: Array<{
    file: string;
    action: 'created' | 'updated' | 'unchanged' | 'error';
    docId?: string;
    error?: string;
  }>;
}

export default class KnowledgeSync extends Command {
  static description = 'Sync local knowledge files to remote API server';

  static examples = [
    '<%= config.bin %> knowledge sync',
    '<%= config.bin %> knowledge sync --dry-run',
    '<%= config.bin %> knowledge sync --api-url http://remote:19432',
    '<%= config.bin %> knowledge sync --json',
  ];

  static flags = {
    json: Flags.boolean({
      char: 'j',
      description: 'Output in JSON format (agent-friendly)',
      default: false,
    }),
    'dry-run': Flags.boolean({
      description: 'Preview sync without making changes',
      default: false,
    }),
    'api-url': Flags.string({
      description: 'API server URL (default: SIDSTACK_API_URL or http://localhost:19432)',
    }),
    'api-key': Flags.string({
      description: 'API key (default: SIDSTACK_API_KEY env var)',
    }),
    path: Flags.string({
      char: 'p',
      description: 'Path to knowledge folder',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(KnowledgeSync);
    const projectPath = process.cwd();
    const knowledgePath = flags.path || path.join(projectPath, '.sidstack', 'knowledge');

    // Check knowledge folder exists
    if (!fs.existsSync(knowledgePath)) {
      if (flags.json) {
        this.log(JSON.stringify(errorResponse('knowledge sync', [
          { code: 'NOT_FOUND', message: `Knowledge folder not found: ${knowledgePath}` },
        ])));
      } else {
        this.error(`Knowledge folder not found: ${knowledgePath}\nRun 'sidstack knowledge init' first.`);
      }
      return;
    }

    // Read projectId from local config
    const configPath = path.join(projectPath, '.sidstack', 'config.json');
    let projectId: string;
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      projectId = config.projectId;
      if (!projectId) throw new Error('Missing projectId');
    } catch {
      if (flags.json) {
        this.log(JSON.stringify(errorResponse('knowledge sync', [
          { code: 'NO_CONFIG', message: 'No .sidstack/config.json found. Run "sidstack init" first.' },
        ])));
      } else {
        this.error('No .sidstack/config.json found. Run "sidstack init" first.');
      }
      return;
    }

    // Create API client
    const apiClient = createApiClient({
      baseUrl: flags['api-url'],
      apiKey: flags['api-key'],
    });

    // Check API health
    try {
      await apiClient.health();
    } catch {
      if (flags.json) {
        this.log(JSON.stringify(errorResponse('knowledge sync', [
          { code: 'API_UNREACHABLE', message: 'Cannot reach API server. Is it running?' },
        ])));
      } else {
        this.error('Cannot reach API server. Is it running?');
      }
      return;
    }

    // Scan local files
    const localFiles = this.findMarkdownFiles(knowledgePath);
    if (!flags.json) {
      this.log(`Found ${localFiles.length} local knowledge files`);
    }

    // Fetch existing remote docs
    let remoteDocs: Map<string, { id: string; updatedAt?: string }>;
    try {
      const response = await apiClient.knowledge.list({
        projectPath,
        limit: '10000',
      });
      const docs = response.documents || [];
      remoteDocs = new Map(docs.map((d: any) => [d.id, { id: d.id, updatedAt: d.updatedAt }]));
    } catch {
      remoteDocs = new Map();
    }

    // Sync each file
    const result: SyncResult = { created: 0, updated: 0, unchanged: 0, errors: 0, details: [] };

    for (const filePath of localFiles) {
      const relativePath = path.relative(knowledgePath, filePath);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const { frontmatter, body } = parseFrontmatter(content);

        const docId = frontmatter.id || generateSlug(frontmatter.title || path.basename(filePath, '.md'));
        const title = frontmatter.title || path.basename(filePath, '.md');
        const type = frontmatter.type || 'guide';
        const summary = frontmatter.summary || extractSummary(body) || '';

        const docBody = {
          projectPath,
          projectId,
          title,
          type,
          content: body,
          summary,
          status: frontmatter.status || 'active',
          module: frontmatter.module,
          tags: frontmatter.tags,
          owner: frontmatter.owner || frontmatter.author,
          related: frontmatter.related,
          dependsOn: frontmatter.dependsOn,
          covers: frontmatter.covers,
        };

        const existing = remoteDocs.get(docId);

        if (flags['dry-run']) {
          const action = existing ? 'updated' : 'created';
          result[action === 'created' ? 'created' : 'updated']++;
          result.details.push({ file: relativePath, action, docId });
          continue;
        }

        if (existing) {
          // Update existing doc
          await apiClient.knowledge.update(existing.id, docBody);
          result.updated++;
          result.details.push({ file: relativePath, action: 'updated', docId });
        } else {
          // Create new doc
          await apiClient.knowledge.create(docBody);
          result.created++;
          result.details.push({ file: relativePath, action: 'created', docId });
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        // Treat 409 (duplicate slug) as unchanged
        if ((err as any)?.status === 409) {
          result.unchanged++;
          result.details.push({ file: relativePath, action: 'unchanged', error: 'Already exists' });
        } else {
          result.errors++;
          result.details.push({ file: relativePath, action: 'error', error: errorMsg });
        }
      }
    }

    // Output results
    if (flags.json) {
      this.log(JSON.stringify(successResponse('knowledge sync', {
        dryRun: flags['dry-run'],
        ...result,
      })));
    } else {
      this.log('');
      if (flags['dry-run']) {
        this.log(chalk.yellow('DRY RUN — no changes made'));
      }
      this.log(chalk.bold('Sync Results:'));
      this.log(`  Created:   ${chalk.green(String(result.created))}`);
      this.log(`  Updated:   ${chalk.blue(String(result.updated))}`);
      this.log(`  Unchanged: ${chalk.gray(String(result.unchanged))}`);
      if (result.errors > 0) {
        this.log(`  Errors:    ${chalk.red(String(result.errors))}`);
        for (const d of result.details.filter(d => d.action === 'error')) {
          this.log(`    ${chalk.red('!')} ${d.file}: ${d.error}`);
        }
      }
      this.log('');
    }
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
        } else if (entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('_')) {
          files.push(fullPath);
        }
      }
    };

    walk(dir);
    return files;
  }
}
