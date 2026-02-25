/**
 * Impact Analysis MCP Tool Handlers
 *
 * Thin wrappers that delegate to the SidStack API server via HTTP.
 * All analysis logic (parse, scope, risks, validations, gate) runs server-side.
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
import { createApiClient, ApiClientError } from '@sidstack/shared';

const apiClient = createApiClient();

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
// Result Helpers
// =============================================================================

type ToolResult = { content: Array<{ type: string; text: string }> };

function textResult(text: string): ToolResult {
  return { content: [{ type: 'text', text }] };
}

function errorResult(error: string): ToolResult {
  return { content: [{ type: 'text', text: `Error: ${error}` }] };
}

function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }
  return error instanceof Error ? error.message : 'Unknown error';
}

// =============================================================================
// Tool Handlers - API Client Wrappers
// =============================================================================

/**
 * Handle impact_analyze tool
 * Delegates full analysis pipeline to the API server.
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
    const result = await apiClient.impact.analyze({
      description,
      projectId: projectId || 'default',
      taskId,
      specId,
      changeType,
      targetFiles,
      targetModules,
    });

    const analysis = result.analysis;
    if (!analysis) {
      return errorResult('API returned no analysis');
    }

    return textResult(formatAnalysisSummary(analysis));
  } catch (error) {
    return errorResult(`Failed to run analysis: ${apiErrorMessage(error)}`);
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
    let id = analysisId;

    // Resolve analysisId from taskId or specId
    if (!id) {
      if (taskId) {
        const result = await apiClient.impact.getByTask(taskId);
        id = result.analysis?.id;
      } else if (specId) {
        const result = await apiClient.impact.getBySpec(specId);
        id = result.analysis?.id;
      } else {
        return errorResult('Must provide analysisId, taskId, or specId');
      }
    }

    if (!id) {
      return errorResult('No analysis found');
    }

    const result = await apiClient.impact.getGate(id);
    const gate = result.gate || {
      status: 'clear',
      blockers: [],
      warnings: [],
      evaluatedAt: Date.now(),
    };

    // Fetch full analysis for scope/risk context
    let scope: any = null;
    let risks: any[] = [];
    try {
      const analysisResult = await apiClient.impact.get(id);
      if (analysisResult.analysis) {
        scope = analysisResult.analysis.scope;
        risks = analysisResult.analysis.risks || [];
      }
    } catch {
      // Non-critical: gate info is sufficient
    }

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
        const matchingRisk = blocker.type === 'risk'
          ? risks.find((r: any) => blocker.description.includes(r.name))
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
    return errorResult(`Failed to check gate: ${apiErrorMessage(error)}`);
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
    const result = await apiClient.impact.runValidation(analysisId, validationId, {
      cwd: process.cwd(),
    });

    const passed = result.passed;
    const output = result.output || '';
    const duration = result.duration || 0;
    const newStatus = result.status || (passed ? 'passed' : 'failed');

    // Store validation failures in mem0 for future learning (fire-and-forget)
    if (!passed) {
      try {
        const { getMem0ClientIfAvailable } = await import('./memory.js');
        const mem0 = await getMem0ClientIfAvailable();
        if (mem0) {
          // Fetch analysis for context
          let taskTitle = '';
          let projectId = 'default';
          try {
            const analysisResult = await apiClient.impact.get(analysisId);
            if (analysisResult.analysis) {
              taskTitle = analysisResult.analysis.input?.description || '';
              projectId = analysisResult.analysis.projectId || 'default';
            }
          } catch {
            // Non-critical
          }

          const memContent = [
            `Validation failed: ${result.validationId || validationId}`,
            `Status: ${newStatus}`,
            `Error: ${output.substring(0, 500)}`,
            taskTitle ? `Task: ${taskTitle}` : '',
          ].filter(Boolean).join('\n');

          mem0.addSmart(memContent, projectId, {
            sourceType: 'validation_failure',
            validationId,
            analysisId,
          }).catch(() => {});
        }
      } catch {
        // Non-blocking
      }
    }

    const statusIcon = passed ? '✅' : '❌';
    let text = `${statusIcon} Validation: ${validationId}\n`;
    text += `Status: ${newStatus}\n`;
    text += `Duration: ${duration}ms\n\n`;
    if (output) {
      text += `Output:\n${output.substring(0, 5000)}\n`;
    }

    return textResult(text);
  } catch (error) {
    return errorResult(`Failed to run validation: ${apiErrorMessage(error)}`);
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
    // Fetch the analysis and its validations
    const [analysisResult, validationsResult] = await Promise.all([
      apiClient.impact.get(analysisId),
      apiClient.impact.getValidations(analysisId),
    ]);

    const analysis = analysisResult.analysis;
    if (!analysis) {
      return errorResult('Analysis not found');
    }

    // Merge validations from the validations endpoint if available
    if (validationsResult.validations) {
      analysis.validations = validationsResult.validations;
    }

    if (format === 'summary') {
      return textResult(formatAnalysisSummary(analysis));
    }

    if (format === 'report') {
      return textResult(generateReport(analysis));
    }

    return textResult(generateClaudeContext(analysis));
  } catch (error) {
    return errorResult(`Failed to get context: ${apiErrorMessage(error)}`);
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
    const result = await apiClient.impact.approveGate(analysisId, {
      approver,
      reason,
      blockerIds: blockerIds || [],
    });

    const newGate = result.gate || {};
    return textResult(`✅ Gate approved by ${approver}\n\nNew status: ${newGate.status || 'unknown'}\nReason: ${reason}`);
  } catch (error) {
    return errorResult(`Failed to approve gate: ${apiErrorMessage(error)}`);
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
    let analyses: any[] = [];

    if (taskId) {
      try {
        const result = await apiClient.impact.getByTask(taskId);
        if (result.analysis) analyses = [result.analysis];
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 404) {
          // No analysis found for task -- return empty
        } else {
          throw error;
        }
      }
    } else if (specId) {
      try {
        const result = await apiClient.impact.getBySpec(specId);
        if (result.analysis) analyses = [result.analysis];
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 404) {
          // No analysis found for spec -- return empty
        } else {
          throw error;
        }
      }
    } else {
      const pid = projectId || 'default';
      const result = await apiClient.impact.list(pid);
      analyses = result.analyses || [];
    }

    // Client-side filtering for status and limit
    if (status) {
      analyses = analyses.filter((a: any) => a.status === status);
    }
    analyses = analyses.slice(0, limit);

    if (analyses.length === 0) {
      return textResult('No analyses found');
    }

    let text = `Impact Analyses (${analyses.length}):\n\n`;

    for (const analysis of analyses) {
      const gateStatus = analysis.gate?.status as string;
      const gateIcon = {
        blocked: '⛔',
        warning: '⚠️',
        clear: '✅',
      }[gateStatus] || '❓';

      text += `${gateIcon} ${(analysis.id || '').slice(0, 8)}\n`;
      text += `   ${(analysis.input?.description || 'No description').slice(0, 50)}...\n`;
      text += `   Status: ${analysis.status} | Risks: ${analysis.risks?.length || 0}\n\n`;
    }

    return textResult(text);
  } catch (error) {
    return errorResult(`Failed to list analyses: ${apiErrorMessage(error)}`);
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatAnalysisSummary(analysis: any): string {
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

  // Scope
  const modules = analysis.scope?.primaryModules || [];
  const files = analysis.scope?.primaryFiles || [];
  const deps = analysis.scope?.dependentModules || [];
  lines.push('Scope:');
  if (modules.length > 0) {
    lines.push(`  Modules: ${modules.join(', ')}`);
  }
  if (deps.length > 0) {
    lines.push(`  Dependencies: ${deps.map((d: any) => d.moduleName || d.moduleId).join(', ')}`);
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

  // Risks
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
  if (analysis.gate?.blockers && analysis.gate.blockers.length > 0) {
    lines.push('Blockers:');
    for (const b of analysis.gate.blockers) {
      lines.push(`  - ${b.description}`);
      lines.push(`    Resolution: ${b.resolution}`);
    }
    lines.push('');
  }

  // Validations
  if (analysis.validations && analysis.validations.length > 0) {
    const blocking = analysis.validations.filter((v: any) => v.isBlocking && v.status === 'pending').length;
    const passed = analysis.validations.filter((v: any) => v.status === 'passed').length;
    lines.push(`Validations: ${passed}/${analysis.validations.length} passed`);
    if (blocking > 0) {
      lines.push(`  ${blocking} blocking validation(s) pending`);
    }
    lines.push('');
  }

  lines.push(`Details: impact_get_context analysisId="${analysis.id}"`);

  return lines.join('\n');
}

function generateClaudeContext(analysis: any): string {
  const lines: string[] = [];

  lines.push('# Impact Analysis Context');
  lines.push('');
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push(`> Analysis ID: ${analysis.id}`);
  lines.push('');

  lines.push(`## Gate Status: ${(analysis.gate?.status || 'unknown').toUpperCase()}`);
  lines.push('');

  if (analysis.gate?.status === 'blocked') {
    lines.push('**IMPLEMENTATION BLOCKED** - Resolve blockers before proceeding.');
    lines.push('');
  }

  lines.push('## Scope');
  lines.push('');
  lines.push('### Primary Modules');
  const primaryModules = analysis.scope?.primaryModules || [];
  if (primaryModules.length > 0) {
    primaryModules.forEach((m: string) => lines.push(`- ${m}`));
  } else {
    lines.push('- None identified');
  }
  lines.push('');

  const dependentModules = analysis.scope?.dependentModules || [];
  if (dependentModules.length > 0) {
    lines.push('### Dependent Modules');
    dependentModules.forEach((m: any) => {
      lines.push(`- ${m.moduleName || m.moduleId} (${m.impactLevel}): ${m.reason}`);
    });
    lines.push('');
  }

  const primaryFiles = analysis.scope?.primaryFiles || [];
  if (primaryFiles.length > 0) {
    lines.push('### Files in Scope');
    primaryFiles.forEach((f: string) => lines.push(`- ${f}`));
    lines.push('');
  }

  lines.push('### Affected Entities');
  const affectedEntities = analysis.scope?.affectedEntities || [];
  if (affectedEntities.length > 0) {
    affectedEntities.forEach((e: string) => lines.push(`- ${e}`));
  } else {
    lines.push('- None identified');
  }
  lines.push('');

  lines.push('## Risks to Watch');
  lines.push('');
  const risks = analysis.risks || [];
  const criticalRisks = risks.filter((r: any) => r.severity === 'critical' || r.severity === 'high');
  if (criticalRisks.length > 0) {
    criticalRisks.forEach((r: any) => {
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
  const validations = analysis.validations || [];
  const blockingValidations = validations.filter((v: any) => v.isBlocking);
  if (blockingValidations.length > 0) {
    blockingValidations.forEach((v: any) => {
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
  if (analysis.gate?.status === 'blocked') {
    lines.push('4. **BLOCKED** - Do not proceed until gate is cleared');
  }
  lines.push('');

  return lines.join('\n');
}

function generateReport(analysis: any): string {
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
  lines.push(analysis.input?.description || 'No description');
  lines.push('');

  lines.push('## Scope Analysis');
  lines.push('');
  lines.push(`- Primary modules: ${(analysis.scope?.primaryModules || []).join(', ') || 'none'}`);
  const deps = analysis.scope?.dependentModules || [];
  if (deps.length > 0) {
    lines.push(`- Dependent modules: ${deps.map((m: any) => m.moduleName || m.moduleId).join(', ')}`);
  }
  const scopeFiles = analysis.scope?.primaryFiles || [];
  if (scopeFiles.length > 0) {
    lines.push(`- Files: ${scopeFiles.join(', ')}`);
  }
  lines.push(`- Affected entities: ${(analysis.scope?.affectedEntities || []).join(', ') || 'none'}`);
  lines.push('');

  lines.push('## Risk Assessment');
  lines.push('');
  const risks = analysis.risks || [];
  if (risks.length > 0) {
    lines.push('| Severity | Name | Blocking | Affects |');
    lines.push('|----------|------|----------|---------|');
    risks.forEach((r: any) => {
      const affects = r.affectedAreas?.join(', ') || '-';
      lines.push(`| ${r.severity} | ${r.name} | ${r.isBlocking ? 'Yes' : 'No'} | ${affects} |`);
    });
  } else {
    lines.push('No risks identified.');
  }
  lines.push('');

  lines.push('## Validation Checklist');
  lines.push('');
  const validations = analysis.validations || [];
  validations.forEach((v: any) => {
    const statusIcon = v.status === 'passed' ? '✅' : v.status === 'failed' ? '❌' : '⏳';
    const blockingTag = v.isBlocking ? ' [BLOCKING]' : '';
    lines.push(`- ${statusIcon} ${v.title}${blockingTag}`);
  });
  lines.push('');

  lines.push('## Gate');
  lines.push('');
  lines.push(`Status: ${(analysis.gate?.status || 'unknown').toUpperCase()}`);
  const blockers = analysis.gate?.blockers || [];
  if (blockers.length > 0) {
    lines.push('');
    lines.push('Blockers:');
    blockers.forEach((b: any) => {
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
