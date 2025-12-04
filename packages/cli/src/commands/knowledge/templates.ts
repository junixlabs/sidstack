/**
 * knowledge templates - List available knowledge document templates
 *
 * Agent-friendly output with JSON support.
 */

import { Command, Flags } from '@oclif/core';
import { listKnowledgeTemplates, loadKnowledgeTemplate, getKnowledgeTemplateNames } from '../../lib/knowledge-template.js';
import { successResponse, ExitCodes } from '../../lib/output.js';

export default class KnowledgeTemplates extends Command {
  static description = 'List available knowledge document templates';

  static examples = [
    '<%= config.bin %> knowledge templates',
    '<%= config.bin %> knowledge templates --json',
    '<%= config.bin %> knowledge templates --show api-endpoint',
  ];

  static flags = {
    json: Flags.boolean({
      char: 'j',
      description: 'Output in JSON format (agent-friendly)',
      default: false,
    }),
    quiet: Flags.boolean({
      char: 'q',
      description: 'Minimal output (names only)',
      default: false,
    }),
    show: Flags.string({
      char: 's',
      description: 'Show details for a specific template',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(KnowledgeTemplates);

    // Show specific template
    if (flags.show) {
      const template = loadKnowledgeTemplate(flags.show);
      if (!template) {
        const available = getKnowledgeTemplateNames().join(', ');
        this.error(`Template not found: ${flags.show}\nAvailable: ${available}`);
      }

      if (flags.json) {
        const response = successResponse('knowledge templates', template);
        this.log(JSON.stringify(response, null, 2));
        return;
      }

      this.log(`Template: ${template.name}`);
      this.log(`  Type: ${template.type}`);
      this.log(`  Description: ${template.description}`);
      this.log(`  Variables:`);
      for (const v of template.variables) {
        this.log(`    - {{${v}}}`);
      }
      this.log('');
      this.log(`Usage: sidstack knowledge init --type ${template.name} --title "My Doc"`);
      return;
    }

    // List all templates
    const templates = listKnowledgeTemplates();

    if (flags.json) {
      const response = successResponse('knowledge templates', {
        templates,
        total: templates.length,
      });
      this.log(JSON.stringify(response, null, 2));
      return;
    }

    if (flags.quiet) {
      for (const t of templates) {
        this.log(t.name);
      }
      return;
    }

    if (templates.length === 0) {
      this.log('No templates found.');
      return;
    }

    this.log(`Found ${templates.length} knowledge template(s):\n`);

    for (const t of templates) {
      this.log(`${t.name}`);
      this.log(`  ${t.description}`);
      this.log(`  Variables: ${t.variables.join(', ')}`);
      this.log('');
    }

    this.log('Usage: sidstack knowledge init --type <template> --title "Document Title"');

    process.exit(ExitCodes.SUCCESS);
  }
}
