/**
 * Impact Analysis MCP Tool Handlers
 *
 * Direct integration with shared impact modules and SQLite.
 * No api-server dependency required.
 *
 * Tools:
 * - impact_analyze: Run impact analysis on a change
 * - impact_check_gate: Check gate status
 * - impact_run_validation: Run a specific validation
 * - impact_get_context: Get Claude context for analysis
 * - impact_approve_gate: Approve blocked gate items
 * - impact_list: List impact analyses
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  getDB,
  changeParser,
  scopeDetector,
  riskAssessor,
  validationGenerator,
  impactDataFlowAnalyzer,
  gateController,
  type ChangeInput,
  type ImpactAnalysis,
  type IdentifiedRisk,
  type ValidationItem,
  type ValidationCategory,
  type ValidationStatus,
  type ImpactDataFlow,
  type ScopedModule,
  type ScopedFile,
  type GateBlocker,
  type GateWarning,
  type ParsedOperation,
} from '@sidstack/shared';

// =============================================================================
// Tool Definitions
// =============================================================================

export const impactTools: Tool[] = [
  {
    name: 'impact_analyze',
    description: 'Run impact analysis on a planned change. Analyzes scope, risks, data flows, and generates validation checklist.',
    inputSchema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Description of the change to analyze',
        },
        projectId: {
          type: 'string',
          description: 'Project ID (optional)',
        },
        taskId: {
          type: 'string',
          description: 'Task ID if analyzing a task (optional)',
        },
        specId: {
          type: 'string',
          description: 'Spec ID if analyzing a spec (optional)',
        },
        changeType: {
          type: 'string',
          enum: ['feature', 'refactor', 'bugfix', 'migration', 'deletion'],
          description: 'Type of change (optional - will be inferred if not provided)',
        },
        targetFiles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific files being changed (optional)',
        },
        targetModules: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific modules being affected (optional)',
        },
      },
      required: ['description'],
    },
  },
  {
    name: 'impact_check_gate',
    description: 'Check the implementation gate status for an analysis. Returns blocked/warning/clear status with blockers.',
    inputSchema: {
      type: 'object',
      properties: {
        analysisId: {
          type: 'string',
          description: 'Analysis ID to check gate for',
        },
        taskId: {
          type: 'string',
          description: 'Task ID to find analysis for (alternative to analysisId)',
        },
        specId: {
          type: 'string',
          description: 'Spec ID to find analysis for (alternative to analysisId)',
        },
      },
    },
  },
  {
    name: 'impact_run_validation',
    description: 'Run a specific validation check from an impact analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        analysisId: {
          type: 'string',
          description: 'Analysis ID',
        },
        validationId: {
          type: 'string',
          description: 'Validation ID to run',
        },
      },
      required: ['analysisId', 'validationId'],
    },
  },
  {
    name: 'impact_get_context',
    description: 'Get Claude-compatible context export for an impact analysis. Returns markdown with scope, risks, and validations.',
    inputSchema: {
      type: 'object',
      properties: {
        analysisId: {
          type: 'string',
          description: 'Analysis ID to export context for',
        },
        format: {
          type: 'string',
          enum: ['claude', 'report', 'summary'],
          description: 'Export format (default: claude)',
          default: 'claude',
        },
      },
      required: ['analysisId'],
    },
  },
  {
    name: 'impact_approve_gate',
    description: 'Approve blocked items in the implementation gate.',
    inputSchema: {
      type: 'object',
      properties: {
        analysisId: {
          type: 'string',
          description: 'Analysis ID',
        },
        approver: {
          type: 'string',
          description: 'Name of the approver',
        },
        reason: {
          type: 'string',
          description: 'Reason for approval',
        },
        blockerIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of blockers to approve (optional - approves all if not specified)',
        },
      },
      required: ['analysisId', 'approver', 'reason'],
    },
  },
  {
    name: 'impact_list',
    description: 'List impact analyses for a project or task.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Filter by project ID',
        },
        taskId: {
          type: 'string',
          description: 'Filter by task ID',
        },
        specId: {
          type: 'string',
          description: 'Filter by spec ID',
        },
        status: {
          type: 'string',
          enum: ['pending', 'analyzing', 'completed', 'failed'],
          description: 'Filter by status',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 10)',
          default: 10,
        },
      },
    },
  },
];

// =============================================================================
// Database Helpers
// =============================================================================

interface DbValidation {
  id: string;
  analysisId: string;
  title: string;
  description?: string;
  category: string;
  status: string;
  isBlocking: number;
  autoVerifiable: number;
  verifyCommand?: string;
  expectedPattern?: string;
  riskId?: string;
  dataFlowId?: string;
  moduleId?: string;
  resultJson?: string;
  createdAt: number;
  updatedAt: number;
}

function convertDbValidation(dbVal: DbValidation | null): ValidationItem | null {
  if (!dbVal) return null;
  return {
    id: dbVal.id,
    title: dbVal.title,
    description: dbVal.description || '',
    category: dbVal.category as ValidationCategory,
    status: dbVal.status as ValidationStatus,
    isBlocking: dbVal.isBlocking === 1,
    autoVerifiable: dbVal.autoVerifiable === 1,
    verifyCommand: dbVal.verifyCommand,
    expectedPattern: dbVal.expectedPattern,
    riskId: dbVal.riskId,
    dataFlowId: dbVal.dataFlowId,
    moduleId: dbVal.moduleId,
  };
}

function convertDbValidations(dbVals: (DbValidation | null)[]): ValidationItem[] {
  return dbVals
    .map(convertDbValidation)
    .filter((v): v is ValidationItem => v !== null);
}

function buildAnalysisFromRecord(
  record: {
    id: string;
    projectId: string;
    taskId?: string;
    specId?: string;
    changeType?: string;
    status: string;
    inputJson: string;
    parsedJson?: string;
    scopeJson?: string;
    dataFlowsJson?: string;
    risksJson?: string;
    validationsJson?: string;
    gateJson?: string;
    error?: string;
    createdAt: number;
    updatedAt: number;
  },
  validations: ValidationItem[]
): ImpactAnalysis {
  const input = JSON.parse(record.inputJson) as ChangeInput;
  const parsed = record.parsedJson ? JSON.parse(record.parsedJson) : null;
  const scope = record.scopeJson ? JSON.parse(record.scopeJson) : null;
  const dataFlows = record.dataFlowsJson ? JSON.parse(record.dataFlowsJson) : [];
  const risks = record.risksJson ? JSON.parse(record.risksJson) : [];
  const gate = record.gateJson ? JSON.parse(record.gateJson) : {
    status: 'clear',
    blockers: [],
    warnings: [],
    evaluatedAt: Date.now(),
  };

  return {
    id: record.id,
    projectId: record.projectId,
    input,
    status: record.status as ImpactAnalysis['status'],
    parsed: parsed || {
      entities: [],
      operations: [],
      keywords: [],
      changeType: input.changeType || 'feature',
      confidence: 0,
    },
    scope: scope || {
      primaryModules: [],
      primaryFiles: [],
      dependentModules: [],
      affectedFiles: [],
      affectedEntities: [],
      expansionDepth: 0,
    },
    dataFlows,
    risks,
    validations,
    gate,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    error: record.error,
  };
}

// =============================================================================
// Result Helpers
// =============================================================================

type ToolResult = { content: Array<{ type: string; text: string }> };

function textResult(text: string): ToolResult {
  return { content: [{ type: 'text', text }] };
}

function errorResult(error: string): ToolResult {
  return { content: [{ type: 'text', text: `Error: ${error}` }] };
}

// =============================================================================
// Tool Handlers - Direct SQLite + Shared Modules
// =============================================================================

/**
 * Handle impact_analyze tool
 * Runs the full analysis pipeline: parse → scope → flows → risks → validations → gate
 */
export async function handleImpactAnalyze(args: Record<string, unknown>): Promise<ToolResult> {
  const {
    description,
    projectId,
    taskId,
    specId,
    changeType,
    targetFiles,
    targetModules,
  } = args as {
    description: string;
    projectId?: string;
    taskId?: string;
    specId?: string;
    changeType?: string;
    targetFiles?: string[];
    targetModules?: string[];
  };

  if (!description) {
    return errorResult('description is required');
  }

  try {
    const db = await getDB();
    const input: ChangeInput = {
      description,
      projectId: projectId || 'default',
      taskId,
      specId,
      changeType: changeType as ChangeInput['changeType'],
      targetFiles,
      targetModules,
    };

    // Create initial analysis record
    const { id } = db.createImpactAnalysis({
      projectId: input.projectId || 'default',
      taskId: input.taskId,
      specId: input.specId,
      changeType: input.changeType || 'feature',
      inputJson: JSON.stringify(input),
    });

    let stage = 'init';
    try {
      // Step 1: Parse the change
      stage = 'parse';
      const parsed = changeParser.parse(input);

      // Step 2: Detect scope
      stage = 'scope';
      const scope = scopeDetector.detect(input, parsed);

      // Step 3: Analyze data flows
      stage = 'data-flows';
      const mockDataFlows: ImpactDataFlow[] = [];
      const impactFlows = impactDataFlowAnalyzer.analyzeForImpact(
        mockDataFlows.map(f => ({
          from: f.from,
          to: f.to,
          entities: f.entities,
          flowType: f.flowType,
          strength: f.strength,
          relationships: f.relationships,
        })),
        scope,
        parsed
      );

      // Step 4: Assess risks
      stage = 'risks';
      const risks = riskAssessor.assess(input, parsed, scope, impactFlows);

      // Step 5: Generate validations
      stage = 'validations';
      const validationItems = validationGenerator.generate(scope, impactFlows, risks);

      // Step 6: Evaluate gate
      stage = 'gate';
      const gate = gateController.evaluate(risks, validationItems);

      // Update analysis with results
      db.updateImpactAnalysis(id, {
        status: 'completed',
        parsedJson: JSON.stringify(parsed),
        scopeJson: JSON.stringify(scope),
        dataFlowsJson: JSON.stringify(impactFlows),
        risksJson: JSON.stringify(risks),
        gateJson: JSON.stringify(gate),
      });

      // Create validation records
      for (const validation of validationItems) {
        db.createImpactValidation({
          analysisId: id,
          title: validation.title,
          description: validation.description,
          category: validation.category,
          isBlocking: validation.isBlocking,
          autoVerifiable: validation.autoVerifiable,
          verifyCommand: validation.verifyCommand,
          expectedPattern: validation.expectedPattern,
          riskId: validation.riskId,
          dataFlowId: validation.dataFlowId,
          moduleId: validation.moduleId,
        });
      }

      // Build and return analysis summary
      const record = db.getImpactAnalysis(id);
      if (!record) {
        return errorResult('Failed to retrieve analysis after creation');
      }

      const validations = db.getImpactValidations(id);
      const analysis = buildAnalysisFromRecord(record, convertDbValidations(validations as DbValidation[]));

      return textResult(formatAnalysisSummary(analysis));
    } catch (analyzeError) {
      const errMsg = analyzeError instanceof Error ? analyzeError.message : String(analyzeError);
      db.updateImpactAnalysis(id, {
        status: 'failed',
        error: `[${stage}] ${errMsg}`,
      });
      return errorResult(`Analysis failed at stage '${stage}': ${errMsg} (ID: ${id})`);
    }
  } catch (error) {
    return errorResult(`Failed to run analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle impact_check_gate tool
 */
export async function handleImpactCheckGate(args: Record<string, unknown>): Promise<ToolResult> {
  const { analysisId, taskId, specId } = args as {
    analysisId?: string;
    taskId?: string;
    specId?: string;
  };

  try {
    const db = await getDB();
    let id = analysisId;

    // Find analysis by taskId or specId if not provided
    if (!id) {
      if (taskId) {
        const record = db.getImpactAnalysisByTask(taskId);
        id = record?.id;
      } else if (specId) {
        const record = db.getImpactAnalysisBySpec(specId);
        id = record?.id;
      } else {
        return errorResult('Must provide analysisId, taskId, or specId');
      }
    }

    if (!id) {
      return errorResult('No analysis found');
    }

    const analysis = db.getImpactAnalysis(id);
    if (!analysis) {
      return errorResult('Analysis not found');
    }

    const gate = analysis.gateJson ? JSON.parse(analysis.gateJson) : {
      status: 'clear',
      blockers: [],
      warnings: [],
      evaluatedAt: Date.now(),
    };

    // Get scope info for richer context
    const scope = analysis.scopeJson ? JSON.parse(analysis.scopeJson) : null;
    const risks: IdentifiedRisk[] = analysis.risksJson ? JSON.parse(analysis.risksJson) : [];

    const statusIcon = {
      blocked: '⛔',
      warning: '⚠️',
      clear: '✅',
    }[gate.status as string] || '❓';

    let text = `${statusIcon} Gate: ${gate.status.toUpperCase()}`;
    if (scope?.primaryModules?.length > 0) {
      text += ` (${scope.primaryModules.join(', ')})`;
    }
    text += '\n\n';

    if (gate.blockers && gate.blockers.length > 0) {
      text += `Blockers (${gate.blockers.length}):\n`;
      for (const blocker of gate.blockers) {
        // Find matching risk for extra context
        const matchingRisk = blocker.type === 'risk'
          ? risks.find((r: IdentifiedRisk) => blocker.description.includes(r.name))
          : null;
        text += `  - ${blocker.description}\n`;
        if (matchingRisk?.affectedAreas && matchingRisk.affectedAreas.length > 0) {
          text += `    Affects: ${matchingRisk.affectedAreas.join(', ')}\n`;
        }
        text += `    Resolution: ${blocker.resolution}\n`;
      }
      text += '\n';
    }

    if (gate.warnings && gate.warnings.length > 0) {
      text += `Warnings (${gate.warnings.length}):\n`;
      for (const warning of gate.warnings) {
        text += `  - ${warning.description}\n`;
      }
      text += '\n';
    }

    if (gate.approval) {
      text += `Approved by: ${gate.approval.approver}\n`;
      text += `Reason: ${gate.approval.reason}\n`;
    }

    if (gate.status === 'clear') {
      text += 'Safe to proceed with implementation.\n';
    }

    return textResult(text);
  } catch (error) {
    return errorResult(`Failed to check gate: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle impact_run_validation tool
 */
export async function handleImpactRunValidation(args: Record<string, unknown>): Promise<ToolResult> {
  const { analysisId, validationId } = args as {
    analysisId: string;
    validationId: string;
  };

  if (!analysisId || !validationId) {
    return errorResult('Both analysisId and validationId are required');
  }

  try {
    const db = await getDB();
    const validation = db.getImpactValidation(validationId);
    if (!validation) {
      return errorResult('Validation not found');
    }

    if (!validation.autoVerifiable || !validation.verifyCommand) {
      return errorResult('Validation is not auto-verifiable');
    }

    // Execute the command
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const startTime = Date.now();
    let output: string;
    let passed: boolean;

    try {
      const result = await execAsync(validation.verifyCommand, {
        cwd: process.cwd(),
        timeout: 60000,
      });
      output = result.stdout + (result.stderr || '');

      if (validation.expectedPattern) {
        const pattern = new RegExp(validation.expectedPattern, 'i');
        passed = pattern.test(output);
      } else {
        passed = true;
      }
    } catch (execError: unknown) {
      const error = execError as { stdout?: string; stderr?: string; message?: string };
      output = (error.stdout || '') + (error.stderr || error.message || '');
      passed = false;
    }

    const duration = Date.now() - startTime;
    const newStatus = passed ? 'passed' : 'failed';

    // Update validation
    db.updateImpactValidation(validationId, {
      status: newStatus,
      resultJson: JSON.stringify({ output, runAt: Date.now() }),
    });

    // Re-evaluate gate
    const analysis = db.getImpactAnalysis(analysisId);
    if (analysis) {
      const validations = convertDbValidations(db.getImpactValidations(analysisId) as DbValidation[]);
      const risks = analysis.risksJson ? JSON.parse(analysis.risksJson) : [];
      const existingGate = analysis.gateJson ? JSON.parse(analysis.gateJson) : undefined;
      const newGate = gateController.evaluate(risks, validations, existingGate?.approval);
      db.updateImpactAnalysis(analysisId, {
        gateJson: JSON.stringify(newGate),
      });
    }

    const statusIcon = passed ? '✅' : '❌';
    let text = `${statusIcon} Validation: ${validation.title}\n`;
    text += `Status: ${newStatus}\n`;
    text += `Duration: ${duration}ms\n\n`;
    if (output) {
      text += `Output:\n${output.substring(0, 5000)}\n`;
    }

    return textResult(text);
  } catch (error) {
    return errorResult(`Failed to run validation: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle impact_get_context tool
 */
export async function handleImpactGetContext(args: Record<string, unknown>): Promise<ToolResult> {
  const { analysisId, format = 'claude' } = args as {
    analysisId: string;
    format?: 'claude' | 'report' | 'summary';
  };

  if (!analysisId) {
    return errorResult('analysisId is required');
  }

  try {
    const db = await getDB();
    const record = db.getImpactAnalysis(analysisId);
    if (!record) {
      return errorResult('Analysis not found');
    }

    const validations = convertDbValidations(db.getImpactValidations(analysisId) as DbValidation[]);
    const analysis = buildAnalysisFromRecord(record, validations);

    if (format === 'summary') {
      return textResult(formatAnalysisSummary(analysis));
    }

    if (format === 'report') {
      return textResult(generateReport(analysis));
    }

    return textResult(generateClaudeContext(analysis));
  } catch (error) {
    return errorResult(`Failed to get context: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle impact_approve_gate tool
 */
export async function handleImpactApproveGate(args: Record<string, unknown>): Promise<ToolResult> {
  const { analysisId, approver, reason, blockerIds } = args as {
    analysisId: string;
    approver: string;
    reason: string;
    blockerIds?: string[];
  };

  if (!analysisId || !approver || !reason) {
    return errorResult('analysisId, approver, and reason are required');
  }

  try {
    const db = await getDB();
    const analysis = db.getImpactAnalysis(analysisId);
    if (!analysis) {
      return errorResult('Analysis not found');
    }

    const currentGate = analysis.gateJson ? JSON.parse(analysis.gateJson) : {
      status: 'blocked',
      blockers: [],
      warnings: [],
      evaluatedAt: Date.now(),
    };

    const { gate: newGate } = gateController.approve(
      { approver, reason, blockerIds: blockerIds || [] },
      currentGate
    );

    // Save approval record
    db.createGateApproval({
      analysisId,
      approver,
      reason,
      approvedBlockersJson: JSON.stringify(blockerIds || []),
    });

    // Update analysis
    db.updateImpactAnalysis(analysisId, {
      gateJson: JSON.stringify(newGate),
    });

    return textResult(`✅ Gate approved by ${approver}\n\nNew status: ${newGate.status}\nReason: ${reason}`);
  } catch (error) {
    return errorResult(`Failed to approve gate: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle impact_list tool
 */
export async function handleImpactList(args: Record<string, unknown>): Promise<ToolResult> {
  const { projectId, taskId, specId, status, limit = 10 } = args as {
    projectId?: string;
    taskId?: string;
    specId?: string;
    status?: string;
    limit?: number;
  };

  try {
    const db = await getDB();

    type AnalysisRecord = ReturnType<typeof db.getImpactAnalysis>;
    let records: (AnalysisRecord)[] = [];

    if (taskId) {
      const record = db.getImpactAnalysisByTask(taskId);
      if (record) records = [record];
    } else if (specId) {
      const record = db.getImpactAnalysisBySpec(specId);
      if (record) records = [record];
    } else {
      const pid = projectId || 'default';
      records = db.listImpactAnalyses(pid, { status, limit });
    }

    const analyses = records
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map(record => {
        const validations = db.getImpactValidations(record.id);
        return buildAnalysisFromRecord(record, convertDbValidations(validations as DbValidation[]));
      });

    if (analyses.length === 0) {
      return textResult('No analyses found');
    }

    let text = `Impact Analyses (${analyses.length}):\n\n`;

    for (const analysis of analyses) {
      const gateIcon = {
        blocked: '⛔',
        warning: '⚠️',
        clear: '✅',
      }[analysis.gate?.status as string] || '❓';

      text += `${gateIcon} ${analysis.id.slice(0, 8)}\n`;
      text += `   ${analysis.input?.description?.slice(0, 50) || 'No description'}...\n`;
      text += `   Status: ${analysis.status} | Risks: ${analysis.risks?.length || 0}\n\n`;
    }

    return textResult(text);
  } catch (error) {
    return errorResult(`Failed to list analyses: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatAnalysisSummary(analysis: ImpactAnalysis): string {
  const lines: string[] = [];

  const gateStatus = analysis.gate?.status || 'unknown';
  const gateIcon = {
    blocked: '⛔',
    warning: '⚠️',
    clear: '✅',
  }[gateStatus] || '❓';

  lines.push(`Impact Analysis: ${gateIcon} ${gateStatus.toUpperCase()}`);
  lines.push(`ID: ${analysis.id}`);
  lines.push('');

  // Scope - show actual names
  const modules = analysis.scope?.primaryModules || [];
  const files = analysis.scope?.primaryFiles || [];
  const deps = (analysis.scope?.dependentModules || []) as ScopedModule[];
  lines.push('Scope:');
  if (modules.length > 0) {
    lines.push(`  Modules: ${modules.join(', ')}`);
  }
  if (deps.length > 0) {
    lines.push(`  Dependencies: ${deps.map(d => d.moduleName || d.moduleId).join(', ')}`);
  }
  if (files.length > 0) {
    const fileList = files.length <= 5
      ? files.join(', ')
      : files.slice(0, 5).join(', ') + ` (+${files.length - 5} more)`;
    lines.push(`  Files: ${fileList}`);
  }
  if (modules.length === 0 && files.length === 0) {
    lines.push('  No specific modules or files identified');
  }
  lines.push('');

  // Risks - show details
  if (analysis.risks && analysis.risks.length > 0) {
    lines.push('Risks:');
    for (const r of analysis.risks) {
      const icon = r.severity === 'critical' ? '🔴' : r.severity === 'high' ? '🟠' : r.severity === 'medium' ? '🟡' : '⚪';
      const blocking = r.isBlocking ? ' [BLOCKING]' : '';
      lines.push(`  ${icon} ${r.severity.toUpperCase()}: ${r.name}${blocking}`);
      lines.push(`     ${r.description}`);
      if (r.affectedAreas && r.affectedAreas.length > 0) {
        lines.push(`     Affects: ${r.affectedAreas.join(', ')}`);
      }
      lines.push(`     Mitigation: ${r.mitigation}`);
    }
    lines.push('');
  }

  // Gate blockers
  if (analysis.gate?.blockers && (analysis.gate.blockers as GateBlocker[]).length > 0) {
    lines.push('Blockers:');
    for (const b of analysis.gate.blockers as GateBlocker[]) {
      lines.push(`  - ${b.description}`);
      lines.push(`    Resolution: ${b.resolution}`);
    }
    lines.push('');
  }

  // Validations
  if (analysis.validations && analysis.validations.length > 0) {
    const blocking = analysis.validations.filter(v => v.isBlocking && v.status === 'pending').length;
    const passed = analysis.validations.filter(v => v.status === 'passed').length;
    lines.push(`Validations: ${passed}/${analysis.validations.length} passed`);
    if (blocking > 0) {
      lines.push(`  ${blocking} blocking validation(s) pending`);
    }
    lines.push('');
  }

  lines.push(`Details: impact_get_context analysisId="${analysis.id}"`);

  return lines.join('\n');
}

function generateClaudeContext(analysis: ImpactAnalysis): string {
  const lines: string[] = [];

  lines.push('# Impact Analysis Context');
  lines.push('');
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push(`> Analysis ID: ${analysis.id}`);
  lines.push('');

  lines.push(`## Gate Status: ${analysis.gate.status.toUpperCase()}`);
  lines.push('');

  if (analysis.gate.status === 'blocked') {
    lines.push('**IMPLEMENTATION BLOCKED** - Resolve blockers before proceeding.');
    lines.push('');
  }

  lines.push('## Scope');
  lines.push('');
  lines.push('### Primary Modules');
  if (analysis.scope.primaryModules.length > 0) {
    analysis.scope.primaryModules.forEach((m: string) => lines.push(`- ${m}`));
  } else {
    lines.push('- None identified');
  }
  lines.push('');

  if (analysis.scope.dependentModules && analysis.scope.dependentModules.length > 0) {
    lines.push('### Dependent Modules');
    analysis.scope.dependentModules.forEach((m: ScopedModule) => {
      lines.push(`- ${m.moduleName || m.moduleId} (${m.impactLevel}): ${m.reason}`);
    });
    lines.push('');
  }

  if (analysis.scope.primaryFiles && analysis.scope.primaryFiles.length > 0) {
    lines.push('### Files in Scope');
    analysis.scope.primaryFiles.forEach((f: string) => lines.push(`- ${f}`));
    lines.push('');
  }

  lines.push('### Affected Entities');
  if (analysis.scope.affectedEntities.length > 0) {
    analysis.scope.affectedEntities.forEach((e: string) => lines.push(`- ${e}`));
  } else {
    lines.push('- None identified');
  }
  lines.push('');

  lines.push('## Risks to Watch');
  lines.push('');
  const criticalRisks = analysis.risks.filter((r: IdentifiedRisk) => r.severity === 'critical' || r.severity === 'high');
  if (criticalRisks.length > 0) {
    criticalRisks.forEach((r: IdentifiedRisk) => {
      lines.push(`### ${r.severity.toUpperCase()}: ${r.name}`);
      lines.push(r.description);
      lines.push(`**Mitigation:** ${r.mitigation}`);
      lines.push('');
    });
  } else {
    lines.push('No critical or high-severity risks identified.');
  }
  lines.push('');

  lines.push('## Required Validations');
  lines.push('');
  const blockingValidations = analysis.validations.filter((v: ValidationItem) => v.isBlocking);
  if (blockingValidations.length > 0) {
    blockingValidations.forEach((v: ValidationItem) => {
      const status = v.status === 'passed' ? '[x]' : '[ ]';
      lines.push(`- ${status} ${v.title}`);
      if (v.verifyCommand) {
        lines.push(`  - Command: \`${v.verifyCommand}\``);
      }
    });
  } else {
    lines.push('No blocking validations required.');
  }
  lines.push('');

  lines.push('## Implementation Rules');
  lines.push('');
  lines.push('1. **Check scope** - Only modify files within the identified scope');
  lines.push('2. **Test coverage** - Ensure all blocking validations can pass');
  lines.push('3. **Risk mitigation** - Follow mitigation strategies for identified risks');
  if (analysis.gate.status === 'blocked') {
    lines.push('4. **BLOCKED** - Do not proceed until gate is cleared');
  }
  lines.push('');

  return lines.join('\n');
}

function generateReport(analysis: ImpactAnalysis): string {
  const lines: string[] = [];

  lines.push('# Impact Analysis Report');
  lines.push('');
  lines.push(`**Analysis ID:** ${analysis.id}`);
  lines.push(`**Project:** ${analysis.projectId}`);
  lines.push(`**Status:** ${analysis.status}`);
  lines.push(`**Created:** ${new Date(analysis.createdAt).toISOString()}`);
  lines.push(`**Updated:** ${new Date(analysis.updatedAt).toISOString()}`);
  lines.push('');

  lines.push('## Change Description');
  lines.push('');
  lines.push(analysis.input.description);
  lines.push('');

  lines.push('## Scope Analysis');
  lines.push('');
  lines.push(`- Primary modules: ${analysis.scope.primaryModules.join(', ') || 'none'}`);
  if (analysis.scope.dependentModules?.length > 0) {
    lines.push(`- Dependent modules: ${(analysis.scope.dependentModules as ScopedModule[]).map(m => m.moduleName || m.moduleId).join(', ')}`);
  }
  if (analysis.scope.primaryFiles?.length > 0) {
    lines.push(`- Files: ${analysis.scope.primaryFiles.join(', ')}`);
  }
  lines.push(`- Affected entities: ${analysis.scope.affectedEntities.join(', ') || 'none'}`);
  lines.push('');

  lines.push('## Risk Assessment');
  lines.push('');
  if (analysis.risks.length > 0) {
    lines.push('| Severity | Name | Blocking | Affects |');
    lines.push('|----------|------|----------|---------|');
    analysis.risks.forEach((r: IdentifiedRisk) => {
      const affects = r.affectedAreas?.join(', ') || '-';
      lines.push(`| ${r.severity} | ${r.name} | ${r.isBlocking ? 'Yes' : 'No'} | ${affects} |`);
    });
  } else {
    lines.push('No risks identified.');
  }
  lines.push('');

  lines.push('## Validation Checklist');
  lines.push('');
  analysis.validations.forEach((v: ValidationItem) => {
    const statusIcon = v.status === 'passed' ? '✅' : v.status === 'failed' ? '❌' : '⏳';
    const blockingTag = v.isBlocking ? ' [BLOCKING]' : '';
    lines.push(`- ${statusIcon} ${v.title}${blockingTag}`);
  });
  lines.push('');

  lines.push('## Gate');
  lines.push('');
  lines.push(`Status: ${analysis.gate.status.toUpperCase()}`);
  if (analysis.gate.blockers.length > 0) {
    lines.push('');
    lines.push('Blockers:');
    analysis.gate.blockers.forEach((b: GateBlocker) => {
      lines.push(`- ${b.description} (Resolution: ${b.resolution})`);
    });
  }

  return lines.join('\n');
}

// =============================================================================
// Main Handler Router
// =============================================================================

export async function handleImpactTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  switch (name) {
    case 'impact_analyze':
      return handleImpactAnalyze(args);
    case 'impact_check_gate':
      return handleImpactCheckGate(args);
    case 'impact_run_validation':
      return handleImpactRunValidation(args);
    case 'impact_get_context':
      return handleImpactGetContext(args);
    case 'impact_approve_gate':
      return handleImpactApproveGate(args);
    case 'impact_list':
      return handleImpactList(args);
    default:
      return errorResult(`Unknown impact tool: ${name}`);
  }
}
