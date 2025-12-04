/**
 * Impact Analysis Module
 *
 * Provides tools for analyzing the impact of planned changes before implementation.
 *
 * Core Components:
 * - ChangeParser: Extracts entities, operations, and keywords from change descriptions
 * - ScopeDetector: Identifies affected modules, files, and entities
 * - RiskAssessor: Evaluates risks using configurable rule engine
 * - ValidationGenerator: Creates validation checklist for implementation gates
 *
 * Usage:
 * ```typescript
 * import {
 *   changeParser,
 *   scopeDetector,
 *   riskAssessor,
 *   validationGenerator,
 * } from '@sidstack/shared/impact';
 *
 * // Parse the change
 * const parsed = changeParser.parse({ description: 'Refactor auth module', changeType: 'refactor' });
 *
 * // Detect scope
 * const scope = scopeDetector.detect(input, parsed);
 *
 * // Assess risks
 * const risks = riskAssessor.assess(input, parsed, scope, dataFlows);
 *
 * // Generate validations
 * const validations = validationGenerator.generate(scope, dataFlows, risks);
 * ```
 */

// Types
export * from './types';

// Change Parser
export { ChangeParser, changeParser } from './change-parser';

// Scope Detector
export {
  ScopeDetector,
  scopeDetector,
  type ScopeDetectorConfig,
  type ModuleKnowledgeProvider,
  type SpecProvider,
  type ImportGraphProvider,
  type DataFlowProvider,
} from './scope-detector';

// Risk Assessor
export {
  RiskAssessor,
  riskAssessor,
  DEFAULT_RISK_RULES,
} from './risk-assessor';

// Validation Generator
export {
  ValidationGenerator,
  validationGenerator,
  type ValidationGeneratorConfig,
  VALIDATION_TEMPLATES,
} from './validation-generator';

// Impact Data Flow Analyzer
export {
  ImpactDataFlowAnalyzer,
  impactDataFlowAnalyzer,
  type DataFlow,
  type EntityRelationship,
  type FlowNode,
  type FlowEdge,
  type FlowGraph,
  type MermaidDiagram,
} from './impact-data-flow';

// Gate Controller
export {
  GateController,
  gateController,
  type GateControllerConfig,
  type GateStatusHook,
  type GateAuditLog,
  type GateSummary,
} from './gate-controller';

// Lifecycle Hooks
export {
  LifecycleHooks,
  lifecycleHooks,
  type TaskImpactMetadata,
  type SpecImpactMetadata,
  type AnalysisCriteria,
  type AnalysisTrigger,
  type PreImplementationCheck,
  type AnalysisProvider,
} from './lifecycle-hooks';

// Claude Exporter
export {
  ClaudeExporter,
  claudeExporter,
  type ClaudeExporterConfig,
  type ClaudeRulesFile,
  type ClaudeContextSummary,
} from './claude-exporter';
