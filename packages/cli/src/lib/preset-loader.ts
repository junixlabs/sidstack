/**
 * Preset Loader - Load and apply initialization presets
 *
 * Presets define default configurations for different project types:
 * - minimal: Basic setup with essential skills only
 * - fullstack-typescript: Full-stack TypeScript monorepo
 * - typescript-backend: Node.js/TypeScript backend API
 * - python-data: Python data science/ML project
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Types
// =============================================================================

export interface AgentConfig {
  base: string;
  variant?: string;
  projectVariant?: string;
  specialty?: string;
  skills: string[];
}

export interface PresetConfig {
  name: string;
  displayName: string;
  description: string;
  language: string;
  projectType: string;
  agents: Record<string, AgentConfig>;
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

export interface PresetInfo {
  name: string;
  displayName: string;
  description: string;
  language: string;
  projectType: string;
  agentCount: number;
  skillCount: number;
}

// =============================================================================
// Preset Loader
// =============================================================================

export class PresetLoader {
  private presetsDir: string;

  constructor() {
    // Resolve presets directory relative to this file
    const sidstackRoot = path.resolve(__dirname, '../../../../');
    this.presetsDir = path.join(sidstackRoot, 'packages/cli/templates/presets');
  }

  /**
   * List all available presets
   */
  listPresets(): PresetInfo[] {
    if (!fs.existsSync(this.presetsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.presetsDir).filter(f => f.endsWith('.json'));
    const presets: PresetInfo[] = [];

    for (const file of files) {
      try {
        const preset = this.loadPreset(file.replace('.json', ''));
        if (preset) {
          presets.push({
            name: preset.name,
            displayName: preset.displayName,
            description: preset.description,
            language: preset.language,
            projectType: preset.projectType,
            agentCount: Object.keys(preset.agents).length,
            skillCount: preset.skills.core.length + preset.skills.optional.length,
          });
        }
      } catch {
        // Skip invalid preset files
      }
    }

    return presets;
  }

  /**
   * Load a preset by name
   */
  loadPreset(name: string): PresetConfig | null {
    const presetPath = path.join(this.presetsDir, `${name}.json`);

    if (!fs.existsSync(presetPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(presetPath, 'utf-8');
      return JSON.parse(content) as PresetConfig;
    } catch {
      return null;
    }
  }

  /**
   * Get preset names that match a language or project type
   */
  findPresets(criteria: { language?: string; projectType?: string }): PresetInfo[] {
    const all = this.listPresets();

    return all.filter(preset => {
      if (criteria.language && preset.language !== criteria.language && preset.language !== 'any') {
        return false;
      }
      if (criteria.projectType && preset.projectType !== criteria.projectType && preset.projectType !== 'general') {
        return false;
      }
      return true;
    });
  }

  /**
   * Get all available preset names
   */
  getPresetNames(): string[] {
    if (!fs.existsSync(this.presetsDir)) {
      return [];
    }

    return fs.readdirSync(this.presetsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  }

  /**
   * Check if a preset exists
   */
  presetExists(name: string): boolean {
    return fs.existsSync(path.join(this.presetsDir, `${name}.json`));
  }
}

// =============================================================================
// Convenience functions
// =============================================================================

const loader = new PresetLoader();

export function listPresets(): PresetInfo[] {
  return loader.listPresets();
}

export function loadPreset(name: string): PresetConfig | null {
  return loader.loadPreset(name);
}

export function getPresetNames(): string[] {
  return loader.getPresetNames();
}

export function presetExists(name: string): boolean {
  return loader.presetExists(name);
}

export function findPresets(criteria: { language?: string; projectType?: string }): PresetInfo[] {
  return loader.findPresets(criteria);
}
