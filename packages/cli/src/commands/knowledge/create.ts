/**
 * knowledge create - Create a new knowledge document from template
 *
 * Agent-friendly output with JSON support.
 */

import * as fs from 'fs';
import * as path from 'path';

import { Args, Command, Flags } from '@oclif/core';
import { input, select } from '@inquirer/prompts';

import {
  listKnowledgeTemplates,
  loadKnowledgeTemplate,
  applyKnowledgeTemplate,
  getKnowledgeTemplateNames,
  getTemplateMissingVariables,
} from '../../lib/knowledge-template.js';
import { successResponse, errorResponse, ExitCodes } from '../../lib/output.js';

export default class KnowledgeCreate extends Command {
  static description = 'Create a new knowledge document from template';

  static examples = [
    '<%= config.bin %> knowledge create --type business-logic --title "User Authentication"',
    '<%= config.bin %> knowledge create --type api-endpoint --title "GET /users" --module api-server',
    '<%= config.bin %> knowledge create --type database-table --title "Users Table" --var table_name=users',
    '<%= config.bin %> knowledge create  # Interactive mode',
    '<%= config.bin %> knowledge create --type module --title "Auth Module" --json',
  ];

  static args = {
    output: Args.string({
      description: 'Output file path (optional, derived from title if not provided)',
      required: false,
    }),
  };

  static flags = {
    json: Flags.boolean({
      char: 'j',
      description: 'Output in JSON format (agent-friendly)',
      default: false,
    }),
    type: Flags.string({
      char: 't',
      description: 'Template type (business-logic, api-endpoint, design-pattern, database-table, module)',
    }),
    title: Flags.string({
      description: 'Document title',
    }),
    module: Flags.string({
      char: 'm',
      description: 'Module ID',
    }),
    var: Flags.string({
      description: 'Template variable in key=value format',
      multiple: true,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Overwrite existing file',
      default: false,
    }),
    'dry-run': Flags.boolean({
      description: 'Preview the generated content without writing',
      default: false,
    }),
    'output-dir': Flags.string({
      char: 'o',
      description: 'Output directory (default: .sidstack/knowledge/<type>/)',
    }),
    yes: Flags.boolean({
      char: 'y',
      description: 'Skip confirmation prompts (non-interactive)',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(KnowledgeCreate);
    const projectPath = process.cwd();

    // Parse --var flags into variables object
    const variables: Record<string, string> = {};
    if (flags.var) {
      for (const v of flags.var) {
        const [key, ...valueParts] = v.split('=');
        if (key && valueParts.length > 0) {
          variables[key] = valueParts.join('=');
        }
      }
    }

    // Set date variable
    variables.date = new Date().toISOString().split('T')[0];

    // Interactive mode if type not provided
    let templateType = flags.type;
    if (!templateType && !flags.json) {
      const templates = listKnowledgeTemplates();
      templateType = await select({
        message: 'Select template type:',
        choices: templates.map(t => ({
          name: `${t.name} - ${t.description}`,
          value: t.name,
        })),
      });
    }

    if (!templateType) {
      const available = getKnowledgeTemplateNames().join(', ');
      if (flags.json) {
        const response = errorResponse('knowledge create', [
          { code: 'MISSING_TYPE', message: 'Template type is required', suggestion: `Use --type with one of: ${available}` },
        ]);
        this.log(JSON.stringify(response, null, 2));
      } else {
        this.error(`Template type is required.\nAvailable: ${available}`);
      }
      process.exit(ExitCodes.ERROR);
    }

    // Load template
    const template = loadKnowledgeTemplate(templateType);
    if (!template) {
      const available = getKnowledgeTemplateNames().join(', ');
      if (flags.json) {
        const response = errorResponse('knowledge create', [
          { code: 'TEMPLATE_NOT_FOUND', message: `Template not found: ${templateType}`, suggestion: `Available templates: ${available}` },
        ]);
        this.log(JSON.stringify(response, null, 2));
      } else {
        this.error(`Template not found: ${templateType}\nAvailable: ${available}`);
      }
      process.exit(ExitCodes.ERROR);
    }

    // Set title from flag
    if (flags.title) {
      variables.title = flags.title;
    }

    // Set module from flag
    if (flags.module) {
      variables.module = flags.module;
      variables.module_id = flags.module;
    }

    // Interactive prompts for missing required variables
    if (!flags.json && !flags.yes) {
      const missing = getTemplateMissingVariables(templateType, variables);
      for (const varName of missing) {
        if (varName === 'date') continue; // Already set
        const value = await input({
          message: `Enter ${varName}:`,
          default: this.getDefaultValue(varName, variables),
        });
        variables[varName] = value;
      }
    }

    // Check for required variables in non-interactive mode (only truly required ones)
    const stillMissing = getTemplateMissingVariables(templateType, variables, true).filter(v => v !== 'date');
    if (stillMissing.length > 0 && (flags.json || flags.yes)) {
      if (flags.json) {
        const response = errorResponse('knowledge create', [
          {
            code: 'MISSING_VARIABLES',
            message: `Missing required variables: ${stillMissing.join(', ')}`,
            suggestion: 'Provide variables using --var key=value or --title/--module flags',
          },
        ]);
        this.log(JSON.stringify(response, null, 2));
      } else {
        this.error(`Missing required variables: ${stillMissing.join(', ')}\nUse --var key=value to provide them.`);
      }
      process.exit(ExitCodes.ERROR);
    }

    // Apply template
    const content = applyKnowledgeTemplate(templateType, variables);
    if (!content) {
      this.error('Failed to apply template');
      process.exit(ExitCodes.ERROR);
    }

    // Determine output path
    const outputDir = flags['output-dir'] || path.join(projectPath, '.sidstack', 'knowledge', templateType);
    const fileName = this.slugify(variables.title || 'untitled') + '.md';
    const outputPath = args.output || path.join(outputDir, fileName);

    // Dry run - just output content
    if (flags['dry-run']) {
      if (flags.json) {
        const response = successResponse('knowledge create', {
          dryRun: true,
          outputPath,
          variables,
          content,
        });
        this.log(JSON.stringify(response, null, 2));
      } else {
        this.log('--- DRY RUN ---');
        this.log(`Output path: ${outputPath}`);
        this.log('');
        this.log(content);
      }
      return;
    }

    // Check if file exists
    if (fs.existsSync(outputPath) && !flags.force) {
      if (flags.json) {
        const response = errorResponse('knowledge create', [
          { code: 'FILE_EXISTS', message: `File already exists: ${outputPath}`, suggestion: 'Use --force to overwrite' },
        ]);
        this.log(JSON.stringify(response, null, 2));
      } else {
        this.error(`File already exists: ${outputPath}\nUse --force to overwrite.`);
      }
      process.exit(ExitCodes.ERROR);
    }

    // Ensure output directory exists
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    // Write file
    fs.writeFileSync(outputPath, content);

    // Output result
    if (flags.json) {
      const response = successResponse('knowledge create', {
        created: true,
        outputPath,
        template: templateType,
        variables,
      });
      this.log(JSON.stringify(response, null, 2));
    } else {
      this.log(`Created: ${outputPath}`);
      this.log(`Template: ${templateType}`);
      this.log('');
      this.log('Next steps:');
      this.log('  1. Open the file and fill in the details');
      this.log('  2. Replace placeholder content with actual documentation');
      this.log('  3. Remove unused sections');
    }

    process.exit(ExitCodes.SUCCESS);
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private getDefaultValue(varName: string, existing: Record<string, string>): string {
    switch (varName) {
      case 'module':
      case 'module_id':
        return existing.module || existing.module_id || 'my-module';
      case 'owner':
        return process.env.USER || 'team';
      case 'method':
        return 'GET';
      case 'path':
        return '/api/v1/resource';
      case 'base_url':
        return 'http://localhost:3000';
      case 'database_type':
        return 'PostgreSQL';
      case 'source_path':
        return 'src/modules/' + (existing.module_id || 'module');
      default:
        return '';
    }
  }
}
