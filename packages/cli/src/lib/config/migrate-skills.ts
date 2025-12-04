/**
 * Migration script for setting up skill templates.
 *
 * This script copies skill templates from the CLI bundle to project or user directories.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export interface SkillConfig {
  name: string;
  description: string;
  category: 'core' | 'optional';
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface SkillMigrationResult {
  success: boolean;
  skill: string;
  destination: string;
  error?: string;
}

/**
 * Parse a skill file and extract config
 */
export function parseSkillFile(content: string): { config: SkillConfig; body: string } | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    return null;
  }

  try {
    const config = parseYaml(frontmatterMatch[1]) as SkillConfig;
    const body = frontmatterMatch[2].trim();

    return { config, body };
  } catch {
    return null;
  }
}

/**
 * List all available skills from the templates directory
 */
export async function listAvailableSkills(templatesDir: string): Promise<SkillConfig[]> {
  const skills: SkillConfig[] = [];

  // Check core skills
  const coreDir = path.join(templatesDir, 'core');
  if (fs.existsSync(coreDir)) {
    const coreFiles = await fs.promises.readdir(coreDir);
    for (const file of coreFiles) {
      if (file.endsWith('.md')) {
        const content = await fs.promises.readFile(path.join(coreDir, file), 'utf-8');
        const parsed = parseSkillFile(content);
        if (parsed) {
          skills.push(parsed.config);
        }
      }
    }
  }

  // Check optional skills
  const optionalDir = path.join(templatesDir, 'optional');
  if (fs.existsSync(optionalDir)) {
    const optionalFiles = await fs.promises.readdir(optionalDir);
    for (const file of optionalFiles) {
      if (file.endsWith('.md')) {
        const content = await fs.promises.readFile(path.join(optionalDir, file), 'utf-8');
        const parsed = parseSkillFile(content);
        if (parsed) {
          skills.push(parsed.config);
        }
      }
    }
  }

  return skills;
}

/**
 * Copy a skill to a destination directory
 */
export async function copySkill(
  sourceDir: string,
  skillName: string,
  destDir: string,
  category: 'core' | 'optional'
): Promise<SkillMigrationResult> {
  try {
    const sourcePath = path.join(sourceDir, category, `${skillName}.md`);
    const destPath = path.join(destDir, `${skillName}.md`);

    // Check if source exists
    if (!fs.existsSync(sourcePath)) {
      return {
        success: false,
        skill: skillName,
        destination: destPath,
        error: `Source skill not found: ${sourcePath}`,
      };
    }

    // Ensure destination directory exists
    await fs.promises.mkdir(destDir, { recursive: true });

    // Copy file
    await fs.promises.copyFile(sourcePath, destPath);

    return {
      success: true,
      skill: skillName,
      destination: destPath,
    };
  } catch (error) {
    return {
      success: false,
      skill: skillName,
      destination: path.join(destDir, `${skillName}.md`),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Copy all core skills to a destination directory
 */
export async function copyCoreSkills(
  sourceDir: string,
  destDir: string
): Promise<SkillMigrationResult[]> {
  const results: SkillMigrationResult[] = [];

  const coreSkillsDir = path.join(sourceDir, 'core');
  if (!fs.existsSync(coreSkillsDir)) {
    return results;
  }

  const files = await fs.promises.readdir(coreSkillsDir);
  const skillFiles = files.filter((f) => f.endsWith('.md'));

  for (const file of skillFiles) {
    const skillName = file.replace('.md', '');
    const result = await copySkill(sourceDir, skillName, destDir, 'core');
    results.push(result);
  }

  return results;
}

/**
 * Copy selected optional skills to a destination directory
 */
export async function copyOptionalSkills(
  sourceDir: string,
  destDir: string,
  skillNames: string[]
): Promise<SkillMigrationResult[]> {
  const results: SkillMigrationResult[] = [];

  for (const skillName of skillNames) {
    const result = await copySkill(sourceDir, skillName, destDir, 'optional');
    results.push(result);
  }

  return results;
}

/**
 * Initialize skills for a project based on preset
 */
export async function initializeProjectSkills(
  templatesDir: string,
  projectDir: string,
  preset: {
    core: string[];
    optional: string[];
  }
): Promise<SkillMigrationResult[]> {
  const results: SkillMigrationResult[] = [];
  const skillsDir = path.join(projectDir, '.claude', 'skills');

  // Copy core skills
  for (const skillName of preset.core) {
    const result = await copySkill(templatesDir, skillName, skillsDir, 'core');
    results.push(result);
  }

  // Copy optional skills
  for (const skillName of preset.optional) {
    const result = await copySkill(templatesDir, skillName, skillsDir, 'optional');
    results.push(result);
  }

  return results;
}

/**
 * Setup user-level skills directory
 */
export async function setupUserSkills(
  templatesDir: string,
  homeDir: string = process.env.HOME || ''
): Promise<SkillMigrationResult[]> {
  const results: SkillMigrationResult[] = [];
  const userSkillsDir = path.join(homeDir, '.sidstack', 'skills');

  // Ensure directory exists
  await fs.promises.mkdir(userSkillsDir, { recursive: true });

  // Copy all core skills to user directory
  const coreResults = await copyCoreSkills(templatesDir, userSkillsDir);
  results.push(...coreResults);

  return results;
}

/**
 * Validate a skill file
 */
export function validateSkillConfig(config: SkillConfig): string[] {
  const errors: string[] = [];

  if (!config.name) {
    errors.push('Missing required field: name');
  }

  if (!config.description) {
    errors.push('Missing required field: description');
  }

  if (!config.category || !['core', 'optional'].includes(config.category)) {
    errors.push('Invalid or missing category. Must be: core or optional');
  }

  if (!config.priority || !['critical', 'high', 'medium', 'low'].includes(config.priority)) {
    errors.push('Invalid or missing priority. Must be: critical, high, medium, or low');
  }

  return errors;
}

/**
 * Create a custom skill file
 */
export function createSkillFile(config: SkillConfig, body: string): string {
  const yamlFrontmatter = stringifyYaml(config);

  return `---
${yamlFrontmatter.trim()}
---

${body}`;
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const templatesDir = path.join(__dirname, '../../../templates/skills');

  switch (command) {
    case 'list':
      listAvailableSkills(templatesDir)
        .then((skills) => {
          console.log('Available Skills:\n');

          const coreSkills = skills.filter((s) => s.category === 'core');
          const optionalSkills = skills.filter((s) => s.category === 'optional');

          console.log('Core Skills:');
          for (const skill of coreSkills) {
            console.log(`  - ${skill.name}: ${skill.description}`);
          }

          console.log('\nOptional Skills:');
          for (const skill of optionalSkills) {
            console.log(`  - ${skill.name}: ${skill.description}`);
          }
        })
        .catch(console.error);
      break;

    case 'setup-user':
      setupUserSkills(templatesDir)
        .then((results) => {
          console.log('User skills setup results:\n');
          for (const result of results) {
            if (result.success) {
              console.log(`✓ ${result.skill} -> ${result.destination}`);
            } else {
              console.log(`✗ ${result.skill}: ${result.error}`);
            }
          }
        })
        .catch(console.error);
      break;

    case 'init-project': {
      const projectDir = args[1] || process.cwd();
      const preset = {
        core: [
          'research-first',
          'code-discovery',
          'architecture-understanding',
          'research-first',
          'code-discovery',
          'architecture-understanding',
        ],
        optional: ['test-driven-development', 'security-awareness'],
      };

      initializeProjectSkills(templatesDir, projectDir, preset)
        .then((results) => {
          console.log('Project skills initialization results:\n');
          for (const result of results) {
            if (result.success) {
              console.log(`✓ ${result.skill} -> ${result.destination}`);
            } else {
              console.log(`✗ ${result.skill}: ${result.error}`);
            }
          }
        })
        .catch(console.error);
      break;
    }

    default:
      console.log(`
Usage: migrate-skills <command> [options]

Commands:
  list              List all available skills
  setup-user        Setup skills in user directory (~/.sidstack/skills)
  init-project [dir] Initialize skills for a project directory
      `);
  }
}
