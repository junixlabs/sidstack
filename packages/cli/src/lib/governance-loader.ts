/**
 * Governance Loader
 *
 * Utilities for loading and managing SidStack governance system.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { CLIError, createError, ErrorCodes, listFiles, readMarkdownFile } from './validator.js';

// Governance types
export interface GovernanceSummary {
  principles: PrincipleSummary[];
  skills: SkillSummary[];
  agents: AgentSummary[];
}

export interface PrincipleSummary {
  name: string;
  path: string;
  description?: string;
  valid: boolean;
}

export interface SkillSummary {
  name: string;
  path: string;
  category: string;
  description?: string;
  valid: boolean;
}

export interface AgentSummary {
  name: string;
  path: string;
  description?: string;
  valid: boolean;
}

export interface GovernanceLoadResult {
  summary: GovernanceSummary;
  errors: CLIError[];
}

/**
 * Get governance paths for a project
 */
export function getGovernancePaths(projectPath: string) {
  const base = path.join(projectPath, '.sidstack');
  return {
    root: base,
    governance: path.join(base, 'governance.md'),
    principles: path.join(base, 'principles'),
    skills: path.join(base, 'skills'),
    agents: path.join(base, 'agents'),
  };
}

/**
 * Check if governance is initialized
 */
export async function governanceExists(projectPath: string): Promise<boolean> {
  const paths = getGovernancePaths(projectPath);
  try {
    await fs.promises.access(paths.governance);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load governance summary
 */
export async function loadGovernanceSummary(projectPath: string): Promise<GovernanceLoadResult> {
  const paths = getGovernancePaths(projectPath);
  const errors: CLIError[] = [];

  // Load principles
  const principles: PrincipleSummary[] = [];
  const principleFiles = await listFiles(paths.principles, '.md');
  for (const file of principleFiles) {
    const name = path.basename(file, '.md');
    const result = await readMarkdownFile(file);
    principles.push({
      name,
      path: file,
      description: result.frontmatter?.description as string | undefined,
      valid: !result.error,
    });
    if (result.error) {
      errors.push(result.error);
    }
  }

  // Load skills (from multiple subdirectories)
  const skills: SkillSummary[] = [];
  const skillCategories = ['dev', 'qa', 'shared'];
  for (const category of skillCategories) {
    const categoryPath = path.join(paths.skills, category);
    const skillFiles = await listFiles(categoryPath, '.md');
    for (const file of skillFiles) {
      const name = path.basename(file, '.md');
      const result = await readMarkdownFile(file);
      skills.push({
        name,
        path: file,
        category,
        description: result.frontmatter?.description as string | undefined,
        valid: !result.error,
      });
      if (result.error) {
        errors.push(result.error);
      }
    }
  }

  // Load agents
  const agents: AgentSummary[] = [];
  const agentFiles = await listFiles(paths.agents, '.md');
  for (const file of agentFiles) {
    const name = path.basename(file, '.md');
    const result = await readMarkdownFile(file);
    agents.push({
      name,
      path: file,
      description: result.frontmatter?.description as string | undefined,
      valid: !result.error,
    });
    if (result.error) {
      errors.push(result.error);
    }
  }

  return {
    summary: { principles, skills, agents },
    errors,
  };
}

/**
 * Validate a principle file
 */
export interface PrincipleValidation {
  valid: boolean;
  errors: CLIError[];
  warnings: string[];
}

export async function validatePrincipleFile(filePath: string): Promise<PrincipleValidation> {
  const errors: CLIError[] = [];
  const warnings: string[] = [];

  const result = await readMarkdownFile(filePath);
  if (result.error) {
    return { valid: false, errors: [result.error], warnings };
  }

  // Check for required sections in body
  const body = result.body ?? '';
  if (!body.includes('#')) {
    warnings.push('No headings found in principle body');
  }

  // Check for common sections
  const requiredSections = ['Purpose', 'Rules', 'Examples'];
  for (const section of requiredSections) {
    if (!body.toLowerCase().includes(section.toLowerCase())) {
      warnings.push(`Missing recommended section: ${section}`);
    }
  }

  return { valid: true, errors, warnings };
}

/**
 * Validate a skill file
 */
export interface SkillValidation {
  valid: boolean;
  errors: CLIError[];
  warnings: string[];
}

export async function validateSkillFile(filePath: string): Promise<SkillValidation> {
  const errors: CLIError[] = [];
  const warnings: string[] = [];

  const result = await readMarkdownFile(filePath);
  if (result.error) {
    return { valid: false, errors: [result.error], warnings };
  }

  const frontmatter = result.frontmatter ?? {};

  // Check required frontmatter fields
  const requiredFields = ['name', 'description'];
  for (const field of requiredFields) {
    if (!frontmatter[field]) {
      errors.push(
        createError(ErrorCodes.MISSING_FIELD, `Missing required frontmatter field: ${field}`, {
          file: filePath,
          suggestion: `Add '${field}' to the frontmatter`,
        })
      );
    }
  }

  // Check body has steps
  const body = result.body ?? '';
  if (!body.includes('##') && !body.includes('Step')) {
    warnings.push('Skill body should have steps or sections');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate an agent file
 */
export async function validateAgentFile(filePath: string): Promise<SkillValidation> {
  const errors: CLIError[] = [];
  const warnings: string[] = [];

  const result = await readMarkdownFile(filePath);
  if (result.error) {
    return { valid: false, errors: [result.error], warnings };
  }

  const frontmatter = result.frontmatter ?? {};

  // Check required frontmatter fields
  if (!frontmatter['name']) {
    errors.push(
      createError(ErrorCodes.MISSING_FIELD, 'Missing required frontmatter field: name', {
        file: filePath,
        suggestion: "Add 'name' to the frontmatter",
      })
    );
  }

  // Check body has required sections
  const body = result.body ?? '';
  const requiredSections = ['When to Use', 'Capabilities', 'Process'];
  for (const section of requiredSections) {
    if (!body.toLowerCase().includes(section.toLowerCase())) {
      warnings.push(`Missing recommended section: ${section}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
