/**
 * Impact Analysis Types
 *
 * TypeScript interfaces for the Change Impact Analyzer system.
 * Supports analyzing scope, dependencies, risks, and validations
 * before implementing changes.
 */

// =============================================================================
// Core Types
// =============================================================================

export type ChangeType = 'feature' | 'refactor' | 'bugfix' | 'migration' | 'deletion';
export type ImpactLevel = 'direct' | 'indirect' | 'cascade';
export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ValidationStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
export type GateStatus = 'blocked' | 'warning' | 'clear';
export type AnalysisStatus = 'pending' | 'analyzing' | 'completed' | 'failed';

// =============================================================================
// Change Input
// =============================================================================

/**
 * Input for triggering an impact analysis
 */
export interface ChangeInput {
  /** Project ID */
  projectId?: string;
  /** Task ID if analyzing a task */
  taskId?: string;
  /** Spec ID if analyzing a spec */
  specId?: string;
  /** Manual description of the change */
  description: string;
  /** Specific files being changed */
  targetFiles?: string[];
  /** Specific modules being affected */
  targetModules?: string[];
  /** Type of change */
  changeType?: ChangeType;
}

// =============================================================================
// Parsed Change
// =============================================================================

/**
 * Result of parsing a change input
 */
export interface ParsedChange {
  /** Identified entities (User, Order, etc.) */
  entities: string[];
  /** Operations detected */
  operations: ParsedOperation[];
  /** Keywords extracted */
  keywords: string[];
  /** Inferred change type */
  changeType: ChangeType;
  /** Confidence score (0-1) */
  confidence: number;
}

export interface ParsedOperation {
  /** Operation type */
  type: 'add' | 'modify' | 'delete' | 'refactor' | 'migrate';
  /** Target of the operation */
  target: string;
  /** Description of what's being done */
  description?: string;
}

// =============================================================================
// Scope Detection
// =============================================================================

/**
 * Detected scope of a change
 */
export interface ChangeScope {
  /** Primary modules being changed */
  primaryModules: string[];
  /** Primary files being changed */
  primaryFiles: string[];
  /** Dependent modules (direct dependencies) */
  dependentModules: ScopedModule[];
  /** Affected files from dependency expansion */
  affectedFiles: ScopedFile[];
  /** Data entities affected */
  affectedEntities: string[];
  /** Depth of dependency expansion used */
  expansionDepth: number;
}

export interface ScopedModule {
  moduleId: string;
  moduleName: string;
  /** How this module is affected */
  impactLevel: ImpactLevel;
  /** Path from primary to this module */
  dependencyPath: string[];
  /** Reason for inclusion */
  reason: string;
}

export interface ScopedFile {
  filePath: string;
  /** How this file is affected */
  impactLevel: ImpactLevel;
  /** Module this file belongs to */
  moduleId?: string;
  /** Reason for inclusion */
  reason: string;
}

// =============================================================================
// Data Flow Impact
// =============================================================================

/**
 * Extended data flow with impact information
 */
export interface ImpactDataFlow {
  /** Flow ID */
  id: string;
  /** Source entity/module */
  from: string;
  /** Target entity/module */
  to: string;
  /** Entities involved */
  entities: string[];
  /** Flow type */
  flowType: 'read' | 'write' | 'bidirectional';
  /** Flow strength */
  strength: 'critical' | 'important' | 'optional';
  /** Relationship labels */
  relationships: string[];
  /** Impact level for this change */
  impactLevel: ImpactLevel;
  /** Operations affected by this change */
  affectedOperations: string[];
  /** Whether validation is required */
  validationRequired: boolean;
  /** Suggested tests for this flow */
  suggestedTests: string[];
}

// =============================================================================
// Risk Assessment
// =============================================================================

/**
 * Identified risk from analysis
 */
export interface IdentifiedRisk {
  /** Risk ID */
  id: string;
  /** Rule that triggered this risk */
  ruleId: string;
  /** Risk name */
  name: string;
  /** Risk category */
  category: RiskCategory;
  /** Severity level */
  severity: RiskSeverity;
  /** Description of the risk */
  description: string;
  /** Affected areas */
  affectedAreas: string[];
  /** Suggested mitigation */
  mitigation: string;
  /** Whether this blocks implementation */
  isBlocking: boolean;
  /** Whether mitigation has been applied */
  mitigationApplied: boolean;
  /** Notes on mitigation */
  mitigationNotes?: string;
}

export type RiskCategory =
  | 'data-corruption'
  | 'breaking-change'
  | 'performance'
  | 'security'
  | 'compatibility'
  | 'testing'
  | 'deployment';

/**
 * Risk rule definition
 */
export interface RiskRule {
  /** Unique rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Risk category */
  category: RiskCategory;
  /** Default severity */
  severity: RiskSeverity;
  /** Condition function that returns true if risk applies */
  condition: (context: RiskEvaluationContext) => boolean;
  /** Message template for description */
  descriptionTemplate?: string;
  /** Default mitigation suggestion */
  mitigation: string;
  /** Whether this risk blocks implementation by default */
  isBlocking: boolean;
}

export interface RiskEvaluationContext {
  parsed: ParsedChange;
  scope: ChangeScope;
  dataFlows: ImpactDataFlow[];
  changeInput: ChangeInput;
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validation item to check before implementation
 */
export interface ValidationItem {
  /** Validation ID */
  id: string;
  /** Validation title */
  title: string;
  /** Detailed description */
  description: string;
  /** Category of validation */
  category: ValidationCategory;
  /** Current status */
  status: ValidationStatus;
  /** Whether this blocks implementation */
  isBlocking: boolean;
  /** Whether this can be auto-verified */
  autoVerifiable: boolean;
  /** Command to run for auto-verification */
  verifyCommand?: string;
  /** Expected result pattern (regex) */
  expectedPattern?: string;
  /** Actual result from verification */
  result?: ValidationResult;
  /** Related risk ID if generated from risk */
  riskId?: string;
  /** Related data flow ID if generated from flow */
  dataFlowId?: string;
  /** Module ID if module-specific */
  moduleId?: string;
}

export type ValidationCategory =
  | 'test'
  | 'data-flow'
  | 'api'
  | 'migration'
  | 'manual'
  | 'review';

export interface ValidationResult {
  /** Whether validation passed */
  passed: boolean;
  /** Output from verification */
  output?: string;
  /** Error message if failed */
  error?: string;
  /** Timestamp of verification */
  verifiedAt: number;
  /** Who/what performed verification */
  verifiedBy: 'auto' | 'manual';
}

// =============================================================================
// Implementation Gate
// =============================================================================

/**
 * Gate status for controlling implementation
 */
export interface ImplementationGate {
  /** Current gate status */
  status: GateStatus;
  /** Items blocking implementation */
  blockers: GateBlocker[];
  /** Warning items (non-blocking) */
  warnings: GateWarning[];
  /** Approval information if override approved */
  approval?: GateApproval;
  /** Last evaluation timestamp */
  evaluatedAt: number;
}

export interface GateBlocker {
  /** Type of blocker */
  type: 'risk' | 'validation';
  /** ID of the blocking item */
  itemId: string;
  /** Description of what's blocking */
  description: string;
  /** How to resolve */
  resolution: string;
}

export interface GateWarning {
  /** Type of warning */
  type: 'risk' | 'validation';
  /** ID of the warning item */
  itemId: string;
  /** Warning description */
  description: string;
}

export interface GateApproval {
  /** Who approved */
  approver: string;
  /** When approved */
  approvedAt: number;
  /** Reason for approval */
  reason: string;
  /** Specific blockers that were approved */
  approvedBlockers: string[];
}

// =============================================================================
// Impact Analysis (Full Result)
// =============================================================================

/**
 * Complete impact analysis result
 */
export interface ImpactAnalysis {
  /** Analysis ID */
  id: string;
  /** Project ID */
  projectId: string;
  /** Original change input */
  input: ChangeInput;
  /** Analysis status */
  status: AnalysisStatus;
  /** Parsed change information */
  parsed: ParsedChange;
  /** Detected scope */
  scope: ChangeScope;
  /** Data flow impacts */
  dataFlows: ImpactDataFlow[];
  /** Identified risks */
  risks: IdentifiedRisk[];
  /** Validation checklist */
  validations: ValidationItem[];
  /** Implementation gate */
  gate: ImplementationGate;
  /** When analysis was created */
  createdAt: number;
  /** When analysis was last updated */
  updatedAt: number;
  /** Error message if analysis failed */
  error?: string;
}

// =============================================================================
// Database Types (for SQLite persistence)
// =============================================================================

/**
 * Impact analysis record for database
 */
export interface ImpactAnalysisRecord {
  id: string;
  projectId: string;
  taskId?: string;
  specId?: string;
  changeType: ChangeType;
  status: AnalysisStatus;
  /** JSON string of ChangeInput */
  inputJson: string;
  /** JSON string of ParsedChange */
  parsedJson: string;
  /** JSON string of ChangeScope */
  scopeJson: string;
  /** JSON string of ImpactDataFlow[] */
  dataFlowsJson: string;
  /** JSON string of IdentifiedRisk[] */
  risksJson: string;
  /** JSON string of ImplementationGate */
  gateJson: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Validation record for database
 */
export interface ImpactValidationRecord {
  id: string;
  analysisId: string;
  title: string;
  description: string;
  category: ValidationCategory;
  status: ValidationStatus;
  isBlocking: boolean;
  autoVerifiable: boolean;
  verifyCommand?: string;
  expectedPattern?: string;
  /** JSON string of ValidationResult */
  resultJson?: string;
  riskId?: string;
  dataFlowId?: string;
  moduleId?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Gate approval record for audit trail
 */
export interface GateApprovalRecord {
  id: string;
  analysisId: string;
  approver: string;
  reason: string;
  /** JSON string of approved blocker IDs */
  approvedBlockersJson: string;
  createdAt: number;
}

/**
 * Analysis history for learning
 */
export interface AnalysisHistoryRecord {
  id: string;
  analysisId: string;
  /** JSON string of actual issues found */
  actualIssuesJson: string;
  /** Prediction accuracy score */
  accuracyScore: number;
  /** Notes on prediction vs reality */
  notes?: string;
  createdAt: number;
}

// =============================================================================
// Claude Export Types
// =============================================================================

/**
 * Format for exporting to Claude rules
 */
export interface ClaudeImpactExport {
  /** File paths to apply rules to */
  paths: string[];
  /** Glob patterns */
  globs: string[];
  /** Markdown content */
  content: string;
}

// =============================================================================
// API Types
// =============================================================================

export interface AnalyzeRequest {
  input: ChangeInput;
  options?: AnalyzeOptions;
}

export interface AnalyzeOptions {
  /** Maximum depth for dependency expansion */
  maxDepth?: number;
  /** Whether to include indirect dependencies */
  includeIndirect?: boolean;
  /** Whether to auto-run verifiable validations */
  autoVerify?: boolean;
}

export interface RunValidationRequest {
  validationId: string;
}

export interface ApproveGateRequest {
  approver: string;
  reason: string;
  blockerIds: string[];
}

export interface ResolveRiskRequest {
  riskId: string;
  mitigationNotes: string;
}
