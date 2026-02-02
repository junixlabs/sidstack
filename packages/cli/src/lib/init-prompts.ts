import { input, select, confirm, checkbox } from '@inquirer/prompts';

import { detectProject, type ProjectInfo } from './project-detector.js';
import { PresetLoader, type PresetInfo } from './preset-loader.js';

export interface InitWizardResult {
  projectName: string;
  preset: string | null;
  installGovernance: boolean;
  installOpenSpec: boolean;
  runScan: boolean;
  cancelled: boolean;
}

/**
 * Run the interactive init wizard.
 * Only called when TTY is available and no flags override behavior.
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

  // 2. Preset recommendation
  const presetLoader = new PresetLoader();
  let presetChoice: string | null = null;

  const language = projectInfo.techStack?.language;
  const matchingPresets = language
    ? presetLoader.findPresets({ language: normalizeLanguage(language) })
    : [];

  if (matchingPresets.length > 0) {
    const recommended = matchingPresets[0];
    const presetOptions: Array<{ name: string; value: string }> = [
      { name: `${recommended.displayName} (Recommended)`, value: recommended.name },
    ];

    // Add other matching presets
    for (const p of matchingPresets.slice(1)) {
      presetOptions.push({ name: p.displayName, value: p.name });
    }
    presetOptions.push({ name: 'Minimal', value: 'minimal' });
    presetOptions.push({ name: 'Skip preset', value: '_skip' });

    const selected = await select({
      message: 'Use recommended preset?',
      choices: presetOptions,
    });

    presetChoice = selected === '_skip' ? null : selected;
  } else {
    // No matching presets — offer minimal or skip
    const allPresets = presetLoader.listPresets();
    if (allPresets.length > 0) {
      const choices: Array<{ name: string; value: string }> = allPresets.map((p: PresetInfo) => ({
        name: p.displayName,
        value: p.name,
      }));
      choices.push({ name: 'Skip preset', value: '_skip' });

      const selected = await select({
        message: 'Select a preset:',
        choices,
      });

      presetChoice = selected === '_skip' ? null : selected;
    }
  }

  // 3. What to install
  const installChoices = await checkbox({
    message: 'What to install:',
    choices: [
      { name: 'Governance (principles, skills, workflows, hooks, CLAUDE.md)', value: 'governance', checked: true },
      { name: 'OpenSpec (change proposal framework)', value: 'openspec', checked: true },
    ],
  });

  const installGovernance = installChoices.includes('governance');
  const installOpenSpec = installChoices.includes('openspec');

  // 4. AI scan (only for existing projects with Claude CLI)
  let runScan = false;
  if (claudeAvailable && !projectInfo.isNew) {
    runScan = await confirm({
      message: 'Run AI knowledge scan after init?',
      default: false,
    });
  }

  // 5. Confirmation
  const proceed = await confirm({
    message: 'Proceed?',
    default: true,
  });

  if (!proceed) {
    return {
      projectName,
      preset: presetChoice,
      installGovernance,
      installOpenSpec,
      runScan,
      cancelled: true,
    };
  }

  return {
    projectName,
    preset: presetChoice,
    installGovernance,
    installOpenSpec,
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
  return lower;
}
