import { input, select, confirm } from '@inquirer/prompts';

import type { ProjectInfo } from './project-detector.js';
import { PresetLoader } from './preset-loader.js';

export type SetupMode = 'guided' | 'custom';

export interface InitWizardResult {
  projectName: string;
  setupMode: SetupMode;
  preset: string | null;
  runScan: boolean;
  cancelled: boolean;
}

/**
 * Run the simplified interactive init wizard.
 * Two modes: Guided (interview) or Custom (quick setup).
 */
export async function runInitWizard(
  projectPath: string,
  defaultName: string,
  projectInfo: ProjectInfo,
  claudeAvailable: boolean
): Promise<InitWizardResult> {
  // 1. Project name
  const projectName = await input({
    message: 'Project name:',
    default: defaultName,
  });

  // 2. Setup mode selection
  const setupMode = await select<SetupMode>({
    message: 'How would you like to set up SidStack?',
    choices: [
      {
        name: 'Guided Setup (Recommended)',
        value: 'guided' as SetupMode,
        description: 'Claude interviews you about your project and generates docs (~10 min)',
      },
      {
        name: 'Custom Setup',
        value: 'custom' as SetupMode,
        description: 'Quick install with optional preset and AI scan (~3 min)',
      },
    ],
  });

  let presetChoice: string | null = null;
  let runScan = false;

  if (setupMode === 'custom') {
    // Custom mode: ask about preset and scan
    const presetLoader = new PresetLoader();
    const language = projectInfo.techStack?.language;
    const matchingPresets = language
      ? presetLoader.findPresets({ language: normalizeLanguage(language) })
      : [];

    if (matchingPresets.length > 0) {
      const recommended = matchingPresets[0];
      const presetOptions: Array<{ name: string; value: string }> = [
        { name: `${recommended.displayName} (Recommended)`, value: recommended.name },
      ];

      for (const p of matchingPresets.slice(1)) {
        presetOptions.push({ name: p.displayName, value: p.name });
      }
      presetOptions.push({ name: 'Minimal', value: 'minimal' });
      presetOptions.push({ name: 'Skip preset', value: '_skip' });

      const selected = await select({
        message: 'Select a preset:',
        choices: presetOptions,
      });

      presetChoice = selected === '_skip' ? null : selected;
    } else {
      // No matching presets — show all with descriptions
      const allPresets = presetLoader.listPresets();
      if (allPresets.length > 0) {
        const choices: Array<{ name: string; value: string; description?: string }> = [
          {
            name: 'Minimal Setup',
            value: 'minimal',
            description: 'For any stack (PHP, Go, Ruby, Java, etc.)',
          },
        ];

        for (const p of allPresets) {
          if (p.name === 'minimal') continue;
          choices.push({
            name: p.displayName,
            value: p.name,
            description: getPresetDescription(p.name),
          });
        }

        choices.push({
          name: 'Skip preset',
          value: '_skip',
          description: 'Bare minimum, configure manually later',
        });

        const selected = await select({
          message: 'Select a preset:',
          choices,
        });

        presetChoice = selected === '_skip' ? null : selected;
      }
    }

    // AI scan (only for existing projects with Claude CLI)
    if (claudeAvailable && !projectInfo.isNew) {
      runScan = await confirm({
        message: 'Run AI knowledge scan after init?',
        default: false,
      });
    }
  }

  // No "Proceed?" confirmation - just proceed

  return {
    projectName,
    setupMode,
    preset: presetChoice,
    runScan,
    cancelled: false,
  };
}

/**
 * Map detected language strings to preset-compatible values.
 */
function normalizeLanguage(lang: string): string {
  const lower = lang.toLowerCase();
  if (lower.includes('typescript') || lower.includes('javascript')) return 'typescript';
  if (lower.includes('python')) return 'python';
  if (lower.includes('go')) return 'go';
  if (lower.includes('rust')) return 'rust';
  if (lower.includes('php')) return 'php';
  if (lower.includes('ruby')) return 'ruby';
  if (lower.includes('java') || lower.includes('kotlin')) return 'java';
  return lower;
}

/**
 * Get human-readable description for each preset.
 */
function getPresetDescription(presetName: string): string {
  const descriptions: Record<string, string> = {
    'fullstack-typescript': 'Next.js, React, Node.js - full-stack TypeScript',
    'typescript-backend': 'Express, NestJS, Fastify - API/backend only',
    'python-data': 'FastAPI, Django, data pipelines - Python projects',
    'minimal': 'Any stack (PHP, Go, Ruby, Java, etc.)',
  };
  return descriptions[presetName] || '';
}
