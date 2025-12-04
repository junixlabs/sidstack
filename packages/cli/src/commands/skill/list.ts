import { Command, Flags } from '@oclif/core';

import { getSkillDiscovery } from '../../lib/config/skill-discovery.js';

export default class SkillList extends Command {
  static description = 'List all available skills';

  static examples = [
    '<%= config.bin %> skill list',
    '<%= config.bin %> skill list --json',
    '<%= config.bin %> skill list --source bundle',
    '<%= config.bin %> skill list --category core',
  ];

  static flags = {
    json: Flags.boolean({
      description: 'Output in JSON format',
      default: false,
    }),
    source: Flags.string({
      char: 's',
      description: 'Filter by source (project, user, bundle)',
      options: ['project', 'user', 'bundle'],
    }),
    category: Flags.string({
      char: 'c',
      description: 'Filter by category (core, optional)',
      options: ['core', 'optional'],
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(SkillList);
    const discovery = getSkillDiscovery();

    const grouped = await discovery.getAllSkillsGrouped();

    // Apply source filter
    let sources: Array<'project' | 'user' | 'bundle'> = ['project', 'user', 'bundle'];
    if (flags.source) {
      sources = [flags.source as 'project' | 'user' | 'bundle'];
    }

    // Build output data
    interface SkillEntry {
      name: string;
      description: string;
      category: string;
      priority: string;
      source: string;
      path: string;
    }

    const skills: SkillEntry[] = [];

    for (const source of sources) {
      for (const skill of grouped[source]) {
        // Apply category filter
        if (flags.category && skill.config.category !== flags.category) {
          continue;
        }

        skills.push({
          name: skill.name,
          description: skill.config.description,
          category: skill.config.category,
          priority: skill.config.priority,
          source,
          path: skill.path,
        });
      }
    }

    // JSON output
    if (flags.json) {
      this.log(JSON.stringify(skills, null, 2));
      return;
    }

    // Human-readable output
    if (skills.length === 0) {
      this.log('No skills found.');
      return;
    }

    // Group by source for display
    const bySource: Record<string, SkillEntry[]> = {};
    for (const skill of skills) {
      if (!bySource[skill.source]) {
        bySource[skill.source] = [];
      }
      bySource[skill.source].push(skill);
    }

    const sourceLabels: Record<string, string> = {
      project: 'Project (.claude/skills/)',
      user: 'User (~/.sidstack/skills/)',
      bundle: 'Bundle (built-in)',
    };

    for (const source of ['project', 'user', 'bundle']) {
      const sourceSkills = bySource[source];
      if (!sourceSkills || sourceSkills.length === 0) continue;

      this.log('');
      this.log(`${sourceLabels[source]}`);
      this.log('─'.repeat(40));

      for (const skill of sourceSkills) {
        const categoryBadge = skill.category === 'core' ? '[core]' : '[opt]';
        const priorityBadge = this.getPriorityBadge(skill.priority);
        this.log(`  ${skill.name} ${categoryBadge} ${priorityBadge}`);
        this.log(`    ${skill.description}`);
      }
    }

    this.log('');
    this.log(`Total: ${skills.length} skill(s)`);
  }

  private getPriorityBadge(priority: string): string {
    switch (priority) {
      case 'critical':
        return '(critical)';
      case 'high':
        return '(high)';
      case 'medium':
        return '(medium)';
      case 'low':
        return '(low)';
      default:
        return '';
    }
  }
}
