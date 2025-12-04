/**
 * Migration script for converting old prompt format to new agent template format.
 *
 * Old format: packages/cli/prompts/{agent-name}.md (plain markdown)
 * New format: packages/cli/templates/agents/base/{agent-name}.md (YAML frontmatter + markdown)
 *
 * This script helps migrate existing agent prompts to the new format.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export interface AgentConfig {
  name: string;
  description: string;
  model: 'sonnet' | 'opus' | 'haiku';
  extends?: string;
  tools: string[];
  permissionMode: 'bypassPermissions' | 'default';
  skills: string[];
  metadata: {
    role: string;
    agentId: string;
    taskId: string;
    spawnedBy: string;
    spawnedAt: string;
    [key: string]: string;
  };
}

export interface MigrationResult {
  success: boolean;
  source: string;
  destination: string;
  error?: string;
}

const DEFAULT_TOOLS: Record<string, string[]> = {
  dev: [
    'Read',
    'Write',
    'Edit',
    'Glob',
    'Grep',
    'Bash',
    'mcp__sidstack__agent_read_task',
    'mcp__sidstack__agent_update_status',
    'mcp__sidstack__agent_report_progress',
    'mcp__sidstack__agent_send_message',
    'mcp__sidstack__agent_get_messages',
    'mcp__sidstack__agent_create_artifact',
    'mcp__sidstack__agent_query_agents',
    'mcp__sidstack__agent_ask_orchestrator',
    'mcp__sidstack__agent_report_blocker',
    'mcp__sidstack__file_lock_acquire',
    'mcp__sidstack__file_lock_release',
    'mcp__sidstack__file_lock_check',
    'mcp__sidstack__file_lock_list',
  ],
  ba: [
    'Read',
    'Write',
    'Edit',
    'Glob',
    'Grep',
    'mcp__sidstack__agent_read_task',
    'mcp__sidstack__agent_update_status',
    'mcp__sidstack__agent_report_progress',
    'mcp__sidstack__agent_send_message',
    'mcp__sidstack__agent_get_messages',
    'mcp__sidstack__agent_create_artifact',
    'mcp__sidstack__agent_query_agents',
    'mcp__sidstack__agent_ask_orchestrator',
    'mcp__sidstack__agent_report_blocker',
    'mcp__sidstack__sticky_note_create',
  ],
  qa: [
    'Read',
    'Write',
    'Edit',
    'Glob',
    'Grep',
    'Bash',
    'mcp__sidstack__agent_read_task',
    'mcp__sidstack__agent_update_status',
    'mcp__sidstack__agent_report_progress',
    'mcp__sidstack__agent_send_message',
    'mcp__sidstack__agent_get_messages',
    'mcp__sidstack__agent_create_artifact',
    'mcp__sidstack__agent_report_blocker',
    'mcp__sidstack__sticky_note_create',
  ],
  da: [
    'Read',
    'Write',
    'Edit',
    'Glob',
    'Grep',
    'Bash',
    'mcp__sidstack__agent_read_task',
    'mcp__sidstack__agent_update_status',
    'mcp__sidstack__agent_report_progress',
    'mcp__sidstack__agent_send_message',
    'mcp__sidstack__agent_get_messages',
    'mcp__sidstack__agent_create_artifact',
    'mcp__sidstack__agent_query_agents',
    'mcp__sidstack__agent_ask_orchestrator',
    'mcp__sidstack__agent_report_blocker',
    'mcp__sidstack__sticky_note_create',
  ],
  bm: [
    'Read',
    'Write',
    'Edit',
    'Glob',
    'Grep',
    'mcp__sidstack__agent_read_task',
    'mcp__sidstack__agent_update_status',
    'mcp__sidstack__agent_report_progress',
    'mcp__sidstack__agent_send_message',
    'mcp__sidstack__agent_get_messages',
    'mcp__sidstack__agent_create_artifact',
    'mcp__sidstack__agent_query_agents',
    'mcp__sidstack__agent_ask_orchestrator',
    'mcp__sidstack__agent_report_blocker',
  ],
  devops: [
    'Read',
    'Write',
    'Edit',
    'Glob',
    'Grep',
    'Bash',
    'mcp__sidstack__agent_read_task',
    'mcp__sidstack__agent_update_status',
    'mcp__sidstack__agent_report_progress',
    'mcp__sidstack__agent_send_message',
    'mcp__sidstack__agent_get_messages',
    'mcp__sidstack__agent_create_artifact',
    'mcp__sidstack__agent_query_agents',
    'mcp__sidstack__agent_ask_orchestrator',
    'mcp__sidstack__agent_report_blocker',
    'mcp__sidstack__file_lock_acquire',
    'mcp__sidstack__file_lock_release',
    'mcp__sidstack__file_lock_check',
    'mcp__sidstack__file_lock_list',
  ],
};

const AGENT_DESCRIPTIONS: Record<string, string> = {
  dev: 'Developer agent for implementing features, fixing bugs, and writing tests. The primary coding agent in the system.',
  ba: 'Business Analyst agent for analyzing requirements and creating detailed specifications. Use when task requires requirements analysis, PRD creation, or user story writing.',
  qa: 'QA/Testing agent for ensuring quality through comprehensive testing. Use when task requires test planning, test execution, or bug reporting.',
  da: 'Data Architect agent for designing database schemas, data models, and managing data migrations. Use when task requires database design, schema creation, or migration planning.',
  bm: 'Business Manager agent for project planning, budgets, timelines, and resource allocation. Use when task requires project planning, sprint planning, or resource management.',
  devops:
    'DevOps agent for deployment, CI/CD, infrastructure, and operational concerns. Use when task requires infrastructure setup, deployment, or monitoring configuration.',
};

const AGENT_ROLES: Record<string, { role: string; specialty?: string }> = {
  dev:    { role: 'worker', specialty: 'frontend' },
  ba:     { role: 'worker', specialty: 'backend' },
  qa:     { role: 'worker', specialty: 'qa' },
  da:     { role: 'worker', specialty: 'database' },
  bm:     { role: 'orchestrator' },
  devops: { role: 'worker', specialty: 'devops' },
};

const DEFAULT_SKILLS: Record<string, string[]> = {
  dev: ['research-first', 'code-discovery', 'architecture-understanding'],
  ba: ['research-first', 'code-discovery'],
  qa: ['research-first', 'code-discovery'],
  da: ['research-first', 'code-discovery'],
  bm: ['research-first'],
  devops: ['research-first', 'code-discovery'],
};

/**
 * Parse an existing markdown file and extract content
 */
function parseOldFormat(content: string): string {
  // Old format is just plain markdown
  // Return as-is for the body content
  return content.trim();
}

/**
 * Create the new agent config frontmatter
 */
function createAgentConfig(agentType: string): AgentConfig {
  const name = `${agentType}-agent`;
  return {
    name,
    description: AGENT_DESCRIPTIONS[agentType] || `${agentType} agent`,
    model: 'sonnet',
    tools: DEFAULT_TOOLS[agentType] || DEFAULT_TOOLS['dev'],
    permissionMode: 'bypassPermissions',
    skills: DEFAULT_SKILLS[agentType] || ['research-first'],
    metadata: {
      role: AGENT_ROLES[agentType]?.role || 'worker',
      agentId: '{{AGENT_ID}}',
      taskId: '{{TASK_ID}}',
      spawnedBy: '{{SPAWNED_BY}}',
      spawnedAt: '{{SPAWNED_AT}}',
    },
  };
}

/**
 * Convert old variable format to new format
 * ${VARIABLE} -> {{VARIABLE}}
 */
function convertVariableFormat(content: string): string {
  return content.replace(/\$\{([A-Z_]+)\}/g, '{{$1}}');
}

/**
 * Generate the new format file content
 */
function generateNewFormat(config: AgentConfig, markdownContent: string): string {
  const yamlFrontmatter = stringifyYaml(config);
  const convertedContent = convertVariableFormat(markdownContent);

  return `---
${yamlFrontmatter.trim()}
---

${convertedContent}`;
}

/**
 * Migrate a single agent file
 */
export async function migrateAgent(
  sourcePath: string,
  destPath: string,
  agentType: string
): Promise<MigrationResult> {
  try {
    // Read source file
    const content = await fs.promises.readFile(sourcePath, 'utf-8');

    // Parse old format
    const markdownContent = parseOldFormat(content);

    // Create config
    const config = createAgentConfig(agentType);

    // Generate new format
    const newContent = generateNewFormat(config, markdownContent);

    // Ensure destination directory exists
    const destDir = path.dirname(destPath);
    await fs.promises.mkdir(destDir, { recursive: true });

    // Write new file
    await fs.promises.writeFile(destPath, newContent, 'utf-8');

    return {
      success: true,
      source: sourcePath,
      destination: destPath,
    };
  } catch (error) {
    return {
      success: false,
      source: sourcePath,
      destination: destPath,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Migrate all agents from old prompts directory to new templates directory
 */
export async function migrateAllAgents(
  sourceDir: string,
  destDir: string
): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  // Get all .md files in source directory
  const files = await fs.promises.readdir(sourceDir);
  const mdFiles = files.filter((f) => f.endsWith('.md'));

  for (const file of mdFiles) {
    // Extract agent type from filename (e.g., "dev-agent.md" -> "dev")
    const agentType = file.replace('-agent.md', '');

    const sourcePath = path.join(sourceDir, file);
    const destPath = path.join(destDir, file);

    const result = await migrateAgent(sourcePath, destPath, agentType);
    results.push(result);
  }

  return results;
}

/**
 * Parse a new format agent file
 */
export function parseAgentFile(content: string): { config: AgentConfig; body: string } | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    return null;
  }

  try {
    const config = parseYaml(frontmatterMatch[1]) as AgentConfig;
    const body = frontmatterMatch[2].trim();

    return { config, body };
  } catch {
    return null;
  }
}

/**
 * Validate an agent config
 */
export function validateAgentConfig(config: AgentConfig): string[] {
  const errors: string[] = [];

  if (!config.name) {
    errors.push('Missing required field: name');
  }

  if (!config.description) {
    errors.push('Missing required field: description');
  }

  if (!config.model || !['sonnet', 'opus', 'haiku'].includes(config.model)) {
    errors.push('Invalid or missing model. Must be: sonnet, opus, or haiku');
  }

  if (!Array.isArray(config.tools) || config.tools.length === 0) {
    errors.push('Missing or empty tools array');
  }

  if (!config.permissionMode || !['bypassPermissions', 'default'].includes(config.permissionMode)) {
    errors.push('Invalid or missing permissionMode');
  }

  if (!config.metadata?.agentId || !config.metadata?.taskId) {
    errors.push('Missing required metadata fields: agentId, taskId');
  }

  return errors;
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const sourceDir = args[0] || path.join(__dirname, '../../../prompts');
  const destDir = args[1] || path.join(__dirname, '../../../templates/agents/base');

  console.log('Migrating agents...');
  console.log(`Source: ${sourceDir}`);
  console.log(`Destination: ${destDir}`);

  migrateAllAgents(sourceDir, destDir)
    .then((results) => {
      console.log('\nMigration Results:');
      for (const result of results) {
        if (result.success) {
          console.log(`✓ ${result.source} -> ${result.destination}`);
        } else {
          console.log(`✗ ${result.source}: ${result.error}`);
        }
      }

      const successCount = results.filter((r) => r.success).length;
      console.log(`\nMigrated ${successCount}/${results.length} agents`);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
