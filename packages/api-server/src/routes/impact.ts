import { Router } from 'express';
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
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const impactRouter: Router = Router();

// =============================================================================
// Database Validation to ValidationItem Converter
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

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build full ImpactAnalysis object from database record
 */
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
// Impact Routes (4.1)
// =============================================================================

/**
 * POST /api/impact/analyze
 * Run impact analysis on a change
 */
impactRouter.post('/analyze', async (req, res) => {
  try {
    const db = await getDB();
    const input: ChangeInput = req.body;

    if (!input.description) {
      return res.status(400).json({ error: 'description is required' });
    }

    if (!input.projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    // Create initial analysis record
    const { id } = db.createImpactAnalysis({
      projectId: input.projectId,
      taskId: input.taskId,
      specId: input.specId,
      changeType: input.changeType,
      inputJson: JSON.stringify(input),
    });

    try {
      // Step 1: Parse the change
      const parsed = changeParser.parse(input);

      // Step 2: Detect scope
      const scope = scopeDetector.detect(input, parsed);

      // Step 3: Analyze data flows (mock data flows for now - would integrate with ERD)
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
      const risks = riskAssessor.assess(input, parsed, scope, impactFlows);

      // Step 5: Generate validations
      const validationItems = validationGenerator.generate(scope, impactFlows, risks);

      // Step 6: Evaluate gate
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

      // Fetch the complete analysis
      const record = db.getImpactAnalysis(id);
      const validations = db.getImpactValidations(id);

      if (!record) {
        return res.status(500).json({ error: 'Failed to retrieve analysis' });
      }

      const analysis = buildAnalysisFromRecord(record, convertDbValidations(validations as DbValidation[]));

      res.status(201).json({ success: true, analysis });
    } catch (analyzeError) {
      // Update with error
      db.updateImpactAnalysis(id, {
        status: 'failed',
        error: String(analyzeError),
      });

      throw analyzeError;
    }
  } catch (error) {
    console.error('Failed to analyze impact:', error);
    res.status(500).json({ error: 'Failed to analyze impact', details: String(error) });
  }
});

/**
 * GET /api/impact/:id
 * Get impact analysis by ID
 */
impactRouter.get('/:id', async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;

    const record = db.getImpactAnalysis(id);
    if (!record) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const validations = db.getImpactValidations(id);
    const analysis = buildAnalysisFromRecord(record, convertDbValidations(validations as DbValidation[]));

    res.json({ success: true, analysis });
  } catch (error) {
    console.error('Failed to get analysis:', error);
    res.status(500).json({ error: 'Failed to get analysis' });
  }
});

/**
 * GET /api/impact/by-task/:taskId
 * Get impact analysis by task ID
 */
impactRouter.get('/by-task/:taskId', async (req, res) => {
  try {
    const db = await getDB();
    const { taskId } = req.params;

    const record = db.getImpactAnalysisByTask(taskId);
    if (!record) {
      return res.status(404).json({ error: 'Analysis not found for task' });
    }

    const validations = db.getImpactValidations(record.id);
    const analysis = buildAnalysisFromRecord(record, convertDbValidations(validations as DbValidation[]));

    res.json({ success: true, analysis });
  } catch (error) {
    console.error('Failed to get analysis by task:', error);
    res.status(500).json({ error: 'Failed to get analysis by task' });
  }
});

/**
 * GET /api/impact/by-spec/:specId
 * Get impact analysis by spec ID
 */
impactRouter.get('/by-spec/:specId', async (req, res) => {
  try {
    const db = await getDB();
    const { specId } = req.params;

    const record = db.getImpactAnalysisBySpec(specId);
    if (!record) {
      return res.status(404).json({ error: 'Analysis not found for spec' });
    }

    const validations = db.getImpactValidations(record.id);
    const analysis = buildAnalysisFromRecord(record, convertDbValidations(validations as DbValidation[]));

    res.json({ success: true, analysis });
  } catch (error) {
    console.error('Failed to get analysis by spec:', error);
    res.status(500).json({ error: 'Failed to get analysis by spec' });
  }
});

/**
 * GET /api/impact/list
 * List impact analyses for a project
 */
impactRouter.get('/list/:projectId', async (req, res) => {
  try {
    const db = await getDB();
    const { projectId } = req.params;
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;

    const records = db.listImpactAnalyses(projectId, { status, limit });

    const analyses = records.map(record => {
      if (!record) return null;
      const validations = db.getImpactValidations(record.id);
      return buildAnalysisFromRecord(record, convertDbValidations(validations as DbValidation[]));
    }).filter(Boolean);

    res.json({ success: true, analyses, total: analyses.length });
  } catch (error) {
    console.error('Failed to list analyses:', error);
    res.status(500).json({ error: 'Failed to list analyses' });
  }
});

// =============================================================================
// Validation Routes (4.2)
// =============================================================================

/**
 * GET /api/impact/:id/validations
 * Get validations for an analysis
 */
impactRouter.get('/:id/validations', async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;

    const validations = db.getImpactValidations(id);
    const stats = validationGenerator.getStatistics(convertDbValidations(validations as DbValidation[]));

    res.json({ success: true, validations, stats });
  } catch (error) {
    console.error('Failed to get validations:', error);
    res.status(500).json({ error: 'Failed to get validations' });
  }
});

/**
 * POST /api/impact/:id/validations/:vid/run
 * Run a validation (execute verify command)
 */
impactRouter.post('/:id/validations/:vid/run', async (req, res) => {
  try {
    const db = await getDB();
    const { id, vid } = req.params;
    const { cwd } = req.body;

    const validation = db.getImpactValidation(vid);
    if (!validation) {
      return res.status(404).json({ error: 'Validation not found' });
    }

    if (!validation.autoVerifiable || !validation.verifyCommand) {
      return res.status(400).json({
        error: 'Validation is not auto-verifiable',
        validation,
      });
    }

    // Execute the command
    const startTime = Date.now();
    let output: string;
    let passed: boolean;

    try {
      const result = await execAsync(validation.verifyCommand, {
        cwd: cwd || process.cwd(),
        timeout: 60000, // 1 minute timeout
      });
      output = result.stdout + (result.stderr || '');

      // Check expected pattern if defined
      if (validation.expectedPattern) {
        const pattern = new RegExp(validation.expectedPattern, 'i');
        passed = pattern.test(output);
      } else {
        passed = true; // Command succeeded
      }
    } catch (execError: unknown) {
      const error = execError as { stdout?: string; stderr?: string; message?: string };
      output = (error.stdout || '') + (error.stderr || error.message || '');
      passed = false;
    }

    const duration = Date.now() - startTime;
    const newStatus = passed ? 'passed' : 'failed';

    // Update validation
    db.updateImpactValidation(vid, {
      status: newStatus,
      resultJson: JSON.stringify({ output, runAt: Date.now() }),
    });

    // Re-evaluate gate
    const analysis = db.getImpactAnalysis(id);
    if (analysis) {
      const validations = convertDbValidations(db.getImpactValidations(id) as DbValidation[]);
      const risks = analysis.risksJson ? JSON.parse(analysis.risksJson) : [];
      const existingGate = analysis.gateJson ? JSON.parse(analysis.gateJson) : undefined;

      const newGate = gateController.evaluate(risks, validations, existingGate?.approval);

      db.updateImpactAnalysis(id, {
        gateJson: JSON.stringify(newGate),
      });
    }

    res.json({
      success: true,
      validationId: vid,
      status: newStatus,
      passed,
      output: output.substring(0, 5000), // Limit output size
      duration,
    });
  } catch (error) {
    console.error('Failed to run validation:', error);
    res.status(500).json({ error: 'Failed to run validation' });
  }
});

/**
 * PUT /api/impact/:id/validations/:vid
 * Update a validation status manually
 */
impactRouter.put('/:id/validations/:vid', async (req, res) => {
  try {
    const db = await getDB();
    const { id, vid } = req.params;
    const { status, notes } = req.body;

    if (!status || !['pending', 'passed', 'failed', 'skipped'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be one of: pending, passed, failed, skipped',
      });
    }

    const success = db.updateImpactValidation(vid, {
      status,
      resultJson: notes ? JSON.stringify({ notes, runAt: Date.now() }) : undefined,
    });

    if (!success) {
      return res.status(404).json({ error: 'Validation not found' });
    }

    // Re-evaluate gate
    const analysis = db.getImpactAnalysis(id);
    if (analysis) {
      const validations = convertDbValidations(db.getImpactValidations(id) as DbValidation[]);
      const risks = analysis.risksJson ? JSON.parse(analysis.risksJson) : [];
      const existingGate = analysis.gateJson ? JSON.parse(analysis.gateJson) : undefined;

      const newGate = gateController.evaluate(risks, validations, existingGate?.approval);

      db.updateImpactAnalysis(id, {
        gateJson: JSON.stringify(newGate),
      });
    }

    res.json({ success: true, validationId: vid, status });
  } catch (error) {
    console.error('Failed to update validation:', error);
    res.status(500).json({ error: 'Failed to update validation' });
  }
});

// =============================================================================
// Gate Routes (4.3)
// =============================================================================

/**
 * GET /api/impact/:id/gate
 * Get gate status for an analysis
 */
impactRouter.get('/:id/gate', async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;

    const analysis = db.getImpactAnalysis(id);
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const gate = analysis.gateJson ? JSON.parse(analysis.gateJson) : {
      status: 'clear',
      blockers: [],
      warnings: [],
      evaluatedAt: Date.now(),
    };

    const summary = gateController.getSummary(gate);
    const blockersByType = gateController.getBlockersByType(gate);

    res.json({
      success: true,
      gate,
      summary,
      blockersByType,
    });
  } catch (error) {
    console.error('Failed to get gate:', error);
    res.status(500).json({ error: 'Failed to get gate' });
  }
});

/**
 * POST /api/impact/:id/gate/approve
 * Approve blockers to proceed with implementation
 */
impactRouter.post('/:id/gate/approve', async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;
    const { approver, reason, blockerIds } = req.body;

    if (!approver || !reason || !blockerIds || !Array.isArray(blockerIds)) {
      return res.status(400).json({
        error: 'approver, reason, and blockerIds[] are required',
      });
    }

    const analysis = db.getImpactAnalysis(id);
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const currentGate = analysis.gateJson ? JSON.parse(analysis.gateJson) : {
      status: 'blocked',
      blockers: [],
      warnings: [],
      evaluatedAt: Date.now(),
    };

    // Approve the gate
    const { gate: newGate, approval } = gateController.approve(
      { approver, reason, blockerIds },
      currentGate
    );

    // Save approval record
    db.createGateApproval({
      analysisId: id,
      approver,
      reason,
      approvedBlockersJson: JSON.stringify(blockerIds),
    });

    // Update analysis
    db.updateImpactAnalysis(id, {
      gateJson: JSON.stringify(newGate),
    });

    res.json({
      success: true,
      gate: newGate,
      approval,
      summary: gateController.getSummary(newGate),
    });
  } catch (error) {
    console.error('Failed to approve gate:', error);
    res.status(500).json({ error: 'Failed to approve gate', details: String(error) });
  }
});

/**
 * POST /api/impact/:id/gate/resolve
 * Resolve a risk (mark as mitigated)
 */
impactRouter.post('/:id/gate/resolve', async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;
    const { riskId, mitigationNotes } = req.body;

    if (!riskId || !mitigationNotes) {
      return res.status(400).json({
        error: 'riskId and mitigationNotes are required',
      });
    }

    const analysis = db.getImpactAnalysis(id);
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    // Update risks
    const risks: IdentifiedRisk[] = analysis.risksJson
      ? JSON.parse(analysis.risksJson)
      : [];

    const updatedRisks = risks.map(r =>
      r.id === riskId
        ? { ...r, mitigationApplied: true }
        : r
    );

    // Re-evaluate gate
    const validations = convertDbValidations(db.getImpactValidations(id) as DbValidation[]);
    const existingGate = analysis.gateJson ? JSON.parse(analysis.gateJson) : undefined;

    const newGate = gateController.evaluate(updatedRisks, validations, existingGate?.approval);

    // Update analysis
    db.updateImpactAnalysis(id, {
      risksJson: JSON.stringify(updatedRisks),
      gateJson: JSON.stringify(newGate),
    });

    res.json({
      success: true,
      riskId,
      gate: newGate,
      summary: gateController.getSummary(newGate),
    });
  } catch (error) {
    console.error('Failed to resolve risk:', error);
    res.status(500).json({ error: 'Failed to resolve risk' });
  }
});

// =============================================================================
// Export Routes (4.4)
// =============================================================================

/**
 * GET /api/impact/:id/export/claude
 * Export analysis as Claude context (markdown)
 */
impactRouter.get('/:id/export/claude', async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;

    const record = db.getImpactAnalysis(id);
    if (!record) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const validations = convertDbValidations(db.getImpactValidations(id) as DbValidation[]);
    const analysis = buildAnalysisFromRecord(record, validations);

    // Generate Claude context markdown
    const markdown = generateClaudeContext(analysis);

    res.type('text/markdown').send(markdown);
  } catch (error) {
    console.error('Failed to export Claude context:', error);
    res.status(500).json({ error: 'Failed to export Claude context' });
  }
});

/**
 * GET /api/impact/:id/export/report
 * Export analysis as detailed report
 */
impactRouter.get('/:id/export/report', async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;

    const record = db.getImpactAnalysis(id);
    if (!record) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const validations = convertDbValidations(db.getImpactValidations(id) as DbValidation[]);
    const analysis = buildAnalysisFromRecord(record, validations);

    // Generate report markdown
    const report = generateReport(analysis);

    res.type('text/markdown').send(report);
  } catch (error) {
    console.error('Failed to export report:', error);
    res.status(500).json({ error: 'Failed to export report' });
  }
});

// =============================================================================
// Export Helpers
// =============================================================================

/**
 * Generate Claude context markdown for implementing with guardrails
 */
function generateClaudeContext(analysis: ImpactAnalysis): string {
  const lines: string[] = [];

  lines.push(`# Impact Analysis Context`);
  lines.push('');
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push(`> Analysis ID: ${analysis.id}`);
  lines.push('');

  // Gate Status
  lines.push(`## Gate Status: ${analysis.gate.status.toUpperCase()}`);
  lines.push('');

  if (analysis.gate.status === 'blocked') {
    lines.push('**IMPLEMENTATION BLOCKED** - Resolve blockers before proceeding.');
    lines.push('');
  }

  // Scope
  lines.push('## Scope');
  lines.push('');
  lines.push('### Primary Modules');
  if (analysis.scope.primaryModules.length > 0) {
    analysis.scope.primaryModules.forEach((m: string) => lines.push(`- ${m}`));
  } else {
    lines.push('- None identified');
  }
  lines.push('');

  lines.push('### Affected Entities');
  if (analysis.scope.affectedEntities.length > 0) {
    analysis.scope.affectedEntities.forEach((e: string) => lines.push(`- ${e}`));
  } else {
    lines.push('- None identified');
  }
  lines.push('');

  // Risks
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

  // Validation Checklist
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

  // Rules for Claude
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

/**
 * Generate detailed report markdown
 */
function generateReport(analysis: ImpactAnalysis): string {
  const lines: string[] = [];

  lines.push(`# Impact Analysis Report`);
  lines.push('');
  lines.push(`**Analysis ID:** ${analysis.id}`);
  lines.push(`**Project:** ${analysis.projectId}`);
  lines.push(`**Status:** ${analysis.status}`);
  lines.push(`**Created:** ${new Date(analysis.createdAt).toISOString()}`);
  lines.push(`**Updated:** ${new Date(analysis.updatedAt).toISOString()}`);
  lines.push('');

  // Input
  lines.push('## Change Description');
  lines.push('');
  lines.push('```');
  lines.push(analysis.input.description);
  lines.push('```');
  lines.push('');
  if (analysis.input.changeType) {
    lines.push(`**Change Type:** ${analysis.input.changeType}`);
  }
  if (analysis.input.taskId) {
    lines.push(`**Task ID:** ${analysis.input.taskId}`);
  }
  if (analysis.input.specId) {
    lines.push(`**Spec ID:** ${analysis.input.specId}`);
  }
  lines.push('');

  // Parsed
  lines.push('## Parsed Information');
  lines.push('');
  lines.push(`**Inferred Type:** ${analysis.parsed.changeType}`);
  lines.push(`**Confidence:** ${(analysis.parsed.confidence * 100).toFixed(1)}%`);
  lines.push('');
  lines.push('**Entities:**');
  analysis.parsed.entities.forEach((e: string) => lines.push(`- ${e}`));
  lines.push('');
  lines.push('**Operations:**');
  analysis.parsed.operations.forEach((o: ParsedOperation) => lines.push(`- ${o.type}: ${o.target}`));
  lines.push('');

  // Scope
  lines.push('## Scope Analysis');
  lines.push('');
  lines.push('### Primary Modules');
  analysis.scope.primaryModules.forEach((m: string) => lines.push(`- ${m}`));
  lines.push('');
  lines.push('### Dependent Modules');
  analysis.scope.dependentModules.forEach((m: ScopedModule) => {
    lines.push(`- **${m.moduleName}** (${m.impactLevel})`);
    lines.push(`  - Reason: ${m.reason}`);
  });
  lines.push('');
  lines.push('### Affected Files');
  analysis.scope.affectedFiles.forEach((f: ScopedFile) => {
    lines.push(`- ${f.filePath} (${f.impactLevel})`);
  });
  lines.push('');
  lines.push('### Affected Entities');
  analysis.scope.affectedEntities.forEach((e: string) => lines.push(`- ${e}`));
  lines.push('');

  // Risks
  lines.push('## Risk Assessment');
  lines.push('');
  lines.push(`| Severity | Name | Category | Blocking |`);
  lines.push(`|----------|------|----------|----------|`);
  analysis.risks.forEach((r: IdentifiedRisk) => {
    lines.push(`| ${r.severity} | ${r.name} | ${r.category} | ${r.isBlocking ? 'Yes' : 'No'} |`);
  });
  lines.push('');

  // Validations
  lines.push('## Validation Checklist');
  lines.push('');
  const stats = validationGenerator.getStatistics(analysis.validations);
  lines.push(`**Total:** ${stats.total} | **Passed:** ${stats.passed} | **Failed:** ${stats.failed} | **Pending:** ${stats.pending}`);
  lines.push('');
  analysis.validations.forEach((v: ValidationItem) => {
    const statusIcon = v.status === 'passed' ? '✅' : v.status === 'failed' ? '❌' : '⏳';
    const blockingTag = v.isBlocking ? ' [BLOCKING]' : '';
    lines.push(`- ${statusIcon} **${v.title}**${blockingTag}`);
    lines.push(`  - Category: ${v.category}`);
    lines.push(`  - Status: ${v.status}`);
    if (v.verifyCommand) {
      lines.push(`  - Command: \`${v.verifyCommand}\``);
    }
  });
  lines.push('');

  // Gate
  lines.push('## Implementation Gate');
  lines.push('');
  lines.push(`**Status:** ${analysis.gate.status.toUpperCase()}`);
  lines.push('');
  if (analysis.gate.blockers.length > 0) {
    lines.push('### Blockers');
    analysis.gate.blockers.forEach((b: GateBlocker) => {
      lines.push(`- **${b.description}**`);
      lines.push(`  - Resolution: ${b.resolution}`);
    });
    lines.push('');
  }
  if (analysis.gate.warnings.length > 0) {
    lines.push('### Warnings');
    analysis.gate.warnings.forEach((w: GateWarning) => {
      lines.push(`- ${w.description}`);
    });
    lines.push('');
  }
  if (analysis.gate.approval) {
    lines.push('### Approval');
    lines.push(`- **Approver:** ${analysis.gate.approval.approver}`);
    lines.push(`- **Reason:** ${analysis.gate.approval.reason}`);
    lines.push(`- **Approved At:** ${new Date(analysis.gate.approval.approvedAt).toISOString()}`);
    lines.push('');
  }

  return lines.join('\n');
}
