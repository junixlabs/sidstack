/**
 * Interactive Init Wizard - Prompts user for configuration during init
 *
 * Uses @inquirer/prompts for interactive terminal prompts.
 * Collects user preferences and returns template selection result.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { select, input, confirm, checkbox } from '@inquirer/prompts';

import { SkillDiscovery } from './config/skill-discovery.js';
import { TemplateSelector, UserPreferences, TemplateSelectionResult } from './config/template-selector.js';

export interface WizardResult {
  preferences: UserPreferences;
  selection: TemplateSelectionResult;
  cancelled: boolean;
}

export class InitWizard {
  private templateSelector: TemplateSelector;
  private skillDiscovery: SkillDiscovery;

  constructor(projectDir?: string) {
    this.templateSelector = new TemplateSelector({ projectDir });
    this.skillDiscovery = new SkillDiscovery({ projectDir });
  }

  /**
   * Run the interactive wizard
   */
  async run(): Promise<WizardResult> {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧙 SidStack Configuration Wizard');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
      // Step 1: Project Name
      const projectName = await input({
        message: 'Project name:',
        default: path.basename(process.cwd()),
      });

      // Step 2: Language
      const language = await select<'typescript' | 'go' | 'python' | 'other'>({
        message: 'Primary programming language:',
        choices: [
          { value: 'typescript', name: 'TypeScript/JavaScript' },
          { value: 'go', name: 'Go' },
          { value: 'python', name: 'Python' },
          { value: 'other', name: 'Other' },
        ],
      });

      // Step 3: Project Type
      const projectType = await select<'backend-api' | 'microservices' | 'data-pipeline' | 'fullstack' | 'other'>({
        message: 'Project type:',
        choices: [
          { value: 'backend-api', name: 'Backend API (REST/GraphQL)' },
          { value: 'fullstack', name: 'Full-Stack Application' },
          { value: 'microservices', name: 'Microservices' },
          { value: 'data-pipeline', name: 'Data Pipeline / ETL' },
          { value: 'other', name: 'Other' },
        ],
      });

      // Step 4: Use Preset or Custom
      const matchingPreset = await this.templateSelector.findBestPreset(language, projectType);

      let usePreset = false;
      let presetName: string | undefined;

      if (matchingPreset) {
        usePreset = await confirm({
          message: `Use "${matchingPreset.displayName}" preset? (${matchingPreset.description})`,
          default: true,
        });

        if (usePreset) {
          presetName = matchingPreset.name;
        }
      }

      // Step 5: Select Agents
      const agentChoices = [
        { value: 'dev', name: 'DEV - Developer (code implementation)', checked: true },
        { value: 'ba', name: 'BA - Business Analyst (requirements)', checked: true },
        { value: 'qa', name: 'QA - Quality Assurance (testing)', checked: true },
        { value: 'da', name: 'DA - Data Architect (database design)', checked: language !== 'other' },
        { value: 'devops', name: 'DevOps - Infrastructure (deployment)', checked: projectType === 'microservices' },
        { value: 'bm', name: 'BM - Business Manager (planning)', checked: false },
      ];

      const selectedAgents = await checkbox({
        message: 'Select agents to enable:',
        choices: agentChoices,
      });

      // Step 6: Feature Selection
      const enableFileLocking = await confirm({
        message: 'Enable file locking (prevents conflicts in multi-agent operations)?',
        default: true,
      });

      const enableProgressReporting = await confirm({
        message: 'Enable progress reporting (agents report status updates)?',
        default: true,
      });

      const enableTDD = await confirm({
        message: 'Enable Test-Driven Development skill for DEV agent?',
        default: false,
      });

      const enableSecurity = await confirm({
        message: 'Enable Security Awareness skill (OWASP top 10 checks)?',
        default: language === 'typescript' || projectType === 'backend-api',
      });

      // Step 7: Optional Skills Selection
      const availableSkills = await this.skillDiscovery.listSkillsByCategory();
      const optionalSkillChoices = availableSkills.optional.map((s) => ({
        value: s.name,
        name: `${s.name} - ${s.config.description}`,
        checked: false,
      }));

      let additionalSkills: string[] = [];
      if (optionalSkillChoices.length > 0) {
        const wantMoreSkills = await confirm({
          message: 'Want to select additional optional skills?',
          default: false,
        });

        if (wantMoreSkills) {
          additionalSkills = await checkbox({
            message: 'Select additional skills:',
            choices: optionalSkillChoices.filter(
              (s) => s.value !== 'test-driven-development' && s.value !== 'security-awareness'
            ),
          });
        }
      }

      // Build preferences
      const preferences: UserPreferences = {
        projectName,
        language,
        projectType,
        preset: presetName,
        features: {
          fileLocking: enableFileLocking,
          progressReporting: enableProgressReporting,
          securityAwareness: enableSecurity,
          tdd: enableTDD,
        },
        agents: selectedAgents,
        skills: additionalSkills,
      };

      // Get template selection
      const selection = await this.templateSelector.selectTemplates(preferences);

      // Validate selection
      const validation = await this.templateSelector.validateSelection(selection);
      if (!validation.valid) {
        console.log('\n⚠️  Validation errors:');
        validation.errors.forEach((e) => console.log(`   - ${e}`));
      }
      if (validation.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        validation.warnings.forEach((w) => console.log(`   - ${w}`));
      }

      // Show summary
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 Configuration Summary');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log(`  Project: ${projectName}`);
      console.log(`  Language: ${language}`);
      console.log(`  Type: ${projectType}`);
      if (presetName) {
        console.log(`  Preset: ${presetName}`);
      }
      console.log(`  Agents: ${selectedAgents.join(', ')}`);
      console.log(`  Skills: ${[...selection.skills.core, ...selection.skills.optional].join(', ')}`);
      console.log('');

      const confirmConfig = await confirm({
        message: 'Proceed with this configuration?',
        default: true,
      });

      if (!confirmConfig) {
        return { preferences, selection, cancelled: true };
      }

      return { preferences, selection, cancelled: false };
    } catch (error) {
      // User cancelled (Ctrl+C)
      return {
        preferences: {} as UserPreferences,
        selection: {} as TemplateSelectionResult,
        cancelled: true,
      };
    }
  }

  /**
   * Run with minimal prompts (quick mode)
   */
  async runQuick(defaults: Partial<UserPreferences> = {}): Promise<WizardResult> {
    const preferences: UserPreferences = {
      projectName: defaults.projectName || path.basename(process.cwd()),
      language: defaults.language || 'typescript',
      projectType: defaults.projectType || 'backend-api',
      preset: defaults.preset,
      features: {
        fileLocking: defaults.features?.fileLocking ?? true,
        progressReporting: defaults.features?.progressReporting ?? true,
        securityAwareness: defaults.features?.securityAwareness ?? true,
        tdd: defaults.features?.tdd ?? false,
      },
      agents: defaults.agents || ['dev', 'ba', 'qa'],
      skills: defaults.skills || [],
    };

    const selection = await this.templateSelector.selectTemplates(preferences);

    return { preferences, selection, cancelled: false };
  }

  /**
   * Apply configuration to project directory
   */
  async applyConfiguration(
    projectDir: string,
    result: WizardResult
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const claudeDir = path.join(projectDir, '.claude');
      const agentsDir = path.join(claudeDir, 'agents');
      const skillsDir = path.join(claudeDir, 'skills');

      // Ensure directories exist
      await fs.promises.mkdir(agentsDir, { recursive: true });
      await fs.promises.mkdir(skillsDir, { recursive: true });

      // Copy agent templates
      const { SubagentConfigManager } = await import('./config/subagent-config-manager.js');
      const configManager = new SubagentConfigManager({ projectDir });

      for (const agent of result.selection.agents) {
        const copyResult = await configManager.copyToProject(agent.type, result.selection.variant);
        if (!copyResult.success) {
          console.warn(`Warning: Could not copy agent template ${agent.type}: ${copyResult.error}`);
        }
      }

      // Copy skill templates
      for (const skillName of [...result.selection.skills.core, ...result.selection.skills.optional]) {
        const copyResult = await this.skillDiscovery.copyToProject(skillName);
        if (!copyResult.success) {
          console.warn(`Warning: Could not copy skill ${skillName}: ${copyResult.error}`);
        }
      }

      // Write sidstack config
      const config = await this.templateSelector.generateInitConfig(result.selection);
      const sidstackDir = path.join(projectDir, '.sidstack');
      await fs.promises.mkdir(sidstackDir, { recursive: true });

      const agentConfigPath = path.join(sidstackDir, 'agents.json');
      await fs.promises.writeFile(
        agentConfigPath,
        JSON.stringify(config.agents, null, 2),
        'utf-8'
      );

      const skillsConfigPath = path.join(sidstackDir, 'skills.json');
      await fs.promises.writeFile(
        skillsConfigPath,
        JSON.stringify(config.skills, null, 2),
        'utf-8'
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Run the wizard as a standalone function
 */
export async function runInitWizard(projectDir?: string): Promise<WizardResult> {
  const wizard = new InitWizard(projectDir);
  return wizard.run();
}

/**
 * Run quick mode with defaults
 */
export async function runQuickInit(
  projectDir?: string,
  defaults?: Partial<UserPreferences>
): Promise<WizardResult> {
  const wizard = new InitWizard(projectDir);
  return wizard.runQuick(defaults);
}
