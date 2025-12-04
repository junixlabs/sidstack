/**
 * TemplateSelector - Handles variant selection based on user preferences
 *
 * This class is used by the init wizard to determine which template variants
 * to use based on user answers to configuration questions.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { SkillDiscovery } from './skill-discovery.js';
import { SubagentConfigManager, VariantSelection } from './subagent-config-manager.js';

export interface PresetConfig {
  name: string;
  displayName: string;
  description: string;
  language: string;
  projectType: string;
  agents: Record<
    string,
    {
      base: string;
      variant?: string;
      projectVariant?: string;
      specialty?: string;
      skills: string[];
    }
  >;
  skills: {
    core: string[];
    optional: string[];
  };
  defaults: {
    model: string;
    permissionMode: string;
    enableFileLocking: boolean;
    enableProgressReporting: boolean;
  };
  recommended: Record<string, string>;
}

export interface UserPreferences {
  projectName: string;
  language: 'typescript' | 'go' | 'python' | 'other';
  projectType: 'backend-api' | 'microservices' | 'data-pipeline' | 'fullstack' | 'other';
  preset?: string;
  features: {
    fileLocking: boolean;
    progressReporting: boolean;
    securityAwareness: boolean;
    tdd: boolean;
  };
  agents: string[];
  skills: string[];
}

export interface TemplateSelectionResult {
  preset: PresetConfig | null;
  variant: VariantSelection;
  agents: Array<{
    type: string;
    config: {
      base: string;
      variant?: string;
      skills: string[];
    };
  }>;
  skills: {
    core: string[];
    optional: string[];
  };
}

export class TemplateSelector {
  private presetsDir: string;
  private configManager: SubagentConfigManager;
  private skillDiscovery: SkillDiscovery;

  constructor(options: { presetsDir?: string; projectDir?: string } = {}) {
    this.presetsDir = options.presetsDir || path.join(__dirname, '../../../templates/presets');
    this.configManager = new SubagentConfigManager({ projectDir: options.projectDir });
    this.skillDiscovery = new SkillDiscovery({ projectDir: options.projectDir });
  }

  /**
   * Load all available presets
   */
  async loadPresets(): Promise<PresetConfig[]> {
    const presets: PresetConfig[] = [];

    if (!fs.existsSync(this.presetsDir)) {
      return presets;
    }

    const files = await fs.promises.readdir(this.presetsDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(this.presetsDir, file);
        try {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const preset = JSON.parse(content) as PresetConfig;
          presets.push(preset);
        } catch (error) {
          console.warn(`Failed to load preset ${file}:`, error);
        }
      }
    }

    return presets;
  }

  /**
   * Find preset by name
   */
  async findPreset(name: string): Promise<PresetConfig | null> {
    const presets = await this.loadPresets();
    return presets.find((p) => p.name === name) || null;
  }

  /**
   * Find best matching preset based on language and project type
   */
  async findBestPreset(language: string, projectType: string): Promise<PresetConfig | null> {
    const presets = await this.loadPresets();

    // Exact match
    const exact = presets.find((p) => p.language === language && p.projectType === projectType);
    if (exact) return exact;

    // Match by language only
    const byLanguage = presets.find((p) => p.language === language);
    if (byLanguage) return byLanguage;

    // Match by project type only
    const byType = presets.find((p) => p.projectType === projectType);
    if (byType) return byType;

    // Return minimal preset
    return presets.find((p) => p.name === 'minimal') || null;
  }

  /**
   * Select templates based on user preferences
   */
  async selectTemplates(preferences: UserPreferences): Promise<TemplateSelectionResult> {
    // Load or find preset
    let preset: PresetConfig | null = null;
    if (preferences.preset) {
      preset = await this.findPreset(preferences.preset);
    } else {
      preset = await this.findBestPreset(preferences.language, preferences.projectType);
    }

    // Determine variant selection
    const variant: VariantSelection = {
      language:
        preferences.language !== 'other'
          ? (preferences.language as 'typescript' | 'go' | 'python')
          : undefined,
      projectType:
        preferences.projectType !== 'other'
          ? (preferences.projectType as
              | 'backend-api'
              | 'microservices'
              | 'data-pipeline'
              | 'fullstack')
          : undefined,
    };

    // Determine agents to include
    const agents: Array<{
      type: string;
      config: { base: string; variant?: string; skills: string[] };
    }> = [];

    const agentTypes = preferences.agents.length > 0 ? preferences.agents : ['dev', 'qa', 'ba'];

    for (const agentType of agentTypes) {
      const presetAgent = preset?.agents[agentType];

      const config = {
        base: presetAgent?.base || `base/${agentType}-agent`,
        variant: this.getAgentVariant(agentType, variant, presetAgent),
        skills: this.getAgentSkills(agentType, preferences, presetAgent),
      };

      agents.push({ type: agentType, config });
    }

    // Determine skills
    const skills = this.getSkillSelection(preferences, preset);

    return {
      preset,
      variant,
      agents,
      skills,
    };
  }

  /**
   * Get variant path for an agent
   */
  private getAgentVariant(
    agentType: string,
    variant: VariantSelection,
    presetAgent?: { variant?: string; projectVariant?: string }
  ): string | undefined {
    // Use preset variant if available
    if (presetAgent?.projectVariant) {
      return presetAgent.projectVariant;
    }
    if (presetAgent?.variant) {
      return presetAgent.variant;
    }

    // Otherwise, construct based on variant selection
    if (variant.projectType) {
      const projectVariantPath = `variants/project-types/${variant.projectType}/${agentType}-agent`;
      return projectVariantPath;
    }

    if (variant.language) {
      const languageVariantPath = `variants/${variant.language}/${agentType}-agent`;
      return languageVariantPath;
    }

    return undefined;
  }

  /**
   * Get skills for an agent
   */
  private getAgentSkills(
    agentType: string,
    preferences: UserPreferences,
    presetAgent?: { skills: string[] }
  ): string[] {
    // Start with preset skills or defaults
    const skills = presetAgent?.skills || ['research-first', 'code-discovery'];

    // Add feature-based skills
    if (preferences.features.securityAwareness && !skills.includes('security-awareness')) {
      skills.push('security-awareness');
    }

    if (preferences.features.tdd && agentType === 'dev' && !skills.includes('test-driven-development')) {
      skills.push('test-driven-development');
    }

    // Add user-selected skills
    for (const skill of preferences.skills) {
      if (!skills.includes(skill)) {
        skills.push(skill);
      }
    }

    return skills;
  }

  /**
   * Get skill selection based on preferences
   */
  private getSkillSelection(
    preferences: UserPreferences,
    preset: PresetConfig | null
  ): { core: string[]; optional: string[] } {
    // Start with preset skills
    const core = preset?.skills.core || [
      'research-first',
      'code-discovery',
      'architecture-understanding',
    ];

    const optional = preset?.skills.optional || [];

    // Add feature-based skills
    if (preferences.features.securityAwareness && !optional.includes('security-awareness')) {
      optional.push('security-awareness');
    }

    if (preferences.features.tdd && !optional.includes('test-driven-development')) {
      optional.push('test-driven-development');
    }

    // Add user-selected skills
    for (const skill of preferences.skills) {
      if (!core.includes(skill) && !optional.includes(skill)) {
        optional.push(skill);
      }
    }

    return { core, optional };
  }

  /**
   * Generate init configuration based on selection
   */
  async generateInitConfig(result: TemplateSelectionResult): Promise<{
    agents: Record<string, unknown>;
    skills: string[];
    settings: Record<string, unknown>;
  }> {
    const agents: Record<string, unknown> = {};

    for (const agent of result.agents) {
      agents[agent.type] = {
        base: agent.config.base,
        variant: agent.config.variant,
        skills: agent.config.skills,
      };
    }

    return {
      agents,
      skills: [...result.skills.core, ...result.skills.optional],
      settings: {
        model: result.preset?.defaults.model || 'sonnet',
        permissionMode: result.preset?.defaults.permissionMode || 'bypassPermissions',
        enableFileLocking: result.preset?.defaults.enableFileLocking ?? true,
        enableProgressReporting: result.preset?.defaults.enableProgressReporting ?? true,
      },
    };
  }

  /**
   * Get recommended tools for a preset
   */
  getRecommendedTools(preset: PresetConfig | null): Record<string, string> {
    return preset?.recommended || {};
  }

  /**
   * Validate selection
   */
  async validateSelection(result: TemplateSelectionResult): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate agents
    for (const agent of result.agents) {
      const resolved = await this.configManager.resolveAgent(agent.type, result.variant);
      if (!resolved) {
        errors.push(`Agent template not found: ${agent.type}`);
      }
    }

    // Validate skills
    const allSkills = [...result.skills.core, ...result.skills.optional];
    for (const skillName of allSkills) {
      const skill = await this.skillDiscovery.resolveSkill(skillName);
      if (!skill) {
        warnings.push(`Skill not found: ${skillName}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

// Export singleton instance
let instance: TemplateSelector | null = null;

export function getTemplateSelector(options?: {
  presetsDir?: string;
  projectDir?: string;
}): TemplateSelector {
  if (!instance || options) {
    instance = new TemplateSelector(options);
  }
  return instance;
}
