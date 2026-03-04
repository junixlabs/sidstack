-- =======================================================================
-- SidStack PostgreSQL Schema
-- All CREATE TABLE IF NOT EXISTS (idempotent)
-- Converted from SQLite schema in database.ts
-- =======================================================================

-- =======================================================================
-- PROJECTS
-- =======================================================================
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'active',
  "createdAt" BIGINT NOT NULL,
  "updatedAt" BIGINT NOT NULL
);

-- =======================================================================
-- TASKS
-- =======================================================================
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "parentTaskId" TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  "assignedAgent" TEXT,
  "createdBy" TEXT DEFAULT 'user',
  "createdAt" BIGINT NOT NULL,
  "updatedAt" BIGINT NOT NULL,
  progress INTEGER DEFAULT 0,
  notes TEXT,
  -- Governance fields
  "taskType" TEXT DEFAULT 'feature',
  "moduleId" TEXT,
  governance JSONB DEFAULT '{}',
  "acceptanceCriteria" JSONB DEFAULT '[]',
  validation JSONB DEFAULT '{}',
  context JSONB DEFAULT '{}',
  branch TEXT,
  -- Solution plan & review fields
  "solutionPlan" TEXT,
  "planStatus" TEXT,
  "planReviewNotes" TEXT,
  "implementSummary" TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks("projectId");
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks("taskType");
CREATE INDEX IF NOT EXISTS idx_tasks_module ON tasks("moduleId");
CREATE INDEX IF NOT EXISTS idx_tasks_branch ON tasks(branch);

-- =======================================================================
-- GOVERNANCE VIOLATIONS
-- =======================================================================
CREATE TABLE IF NOT EXISTS governance_violations (
  id TEXT PRIMARY KEY,
  "taskId" TEXT NOT NULL REFERENCES tasks(id),
  "violationType" TEXT NOT NULL,
  blockers JSONB NOT NULL,
  reason TEXT,
  "agentId" TEXT,
  "timestamp" BIGINT NOT NULL,
  resolved BOOLEAN DEFAULT false,
  "resolvedBy" TEXT,
  "resolvedAt" BIGINT
);
CREATE INDEX IF NOT EXISTS idx_violations_task ON governance_violations("taskId");
CREATE INDEX IF NOT EXISTS idx_violations_type ON governance_violations("violationType");
CREATE INDEX IF NOT EXISTS idx_violations_resolved ON governance_violations(resolved);

-- =======================================================================
-- WORK HISTORY
-- =======================================================================

-- Work Sessions
CREATE TABLE IF NOT EXISTS work_sessions (
  id TEXT PRIMARY KEY,
  "workspacePath" TEXT NOT NULL,
  "claudeSessionId" TEXT,
  "startTime" BIGINT NOT NULL,
  "endTime" BIGINT,
  status TEXT DEFAULT 'active',
  summary TEXT,
  "createdAt" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_work_sessions_workspace ON work_sessions("workspacePath");
CREATE INDEX IF NOT EXISTS idx_work_sessions_time ON work_sessions("startTime");

-- Work Entries
CREATE TABLE IF NOT EXISTS work_entries (
  id TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL REFERENCES work_sessions(id),
  "taskId" TEXT,
  "workspacePath" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "actionName" TEXT NOT NULL,
  details JSONB,
  "resultSummary" TEXT,
  "durationMs" INTEGER,
  "timestamp" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_work_entries_session ON work_entries("sessionId");
CREATE INDEX IF NOT EXISTS idx_work_entries_workspace ON work_entries("workspacePath", "timestamp");
CREATE INDEX IF NOT EXISTS idx_work_entries_task ON work_entries("taskId");

-- Task Progress Log
CREATE TABLE IF NOT EXISTS task_progress_log (
  id TEXT PRIMARY KEY,
  "taskId" TEXT NOT NULL REFERENCES tasks(id),
  "sessionId" TEXT,
  progress INTEGER NOT NULL,
  status TEXT NOT NULL,
  "currentStep" TEXT,
  notes TEXT,
  artifacts JSONB DEFAULT '[]',
  "createdAt" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_task_progress_task ON task_progress_log("taskId", "createdAt");

-- =======================================================================
-- TEST ROOMS
-- =======================================================================

CREATE TABLE IF NOT EXISTS test_rooms (
  id TEXT PRIMARY KEY,
  "moduleId" TEXT NOT NULL UNIQUE,
  "specId" TEXT,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  "createdAt" BIGINT NOT NULL,
  "updatedAt" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_test_rooms_module ON test_rooms("moduleId");

CREATE TABLE IF NOT EXISTS test_items (
  id TEXT PRIMARY KEY,
  "roomId" TEXT NOT NULL REFERENCES test_rooms(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  "orderIndex" INTEGER DEFAULT 0,
  "resultNotes" TEXT,
  "testedAt" BIGINT,
  "createdAt" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_test_items_room ON test_items("roomId");

CREATE TABLE IF NOT EXISTS test_messages (
  id TEXT PRIMARY KEY,
  "roomId" TEXT NOT NULL REFERENCES test_rooms(id),
  sender TEXT NOT NULL,
  "messageType" TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  "createdAt" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_test_messages_room ON test_messages("roomId");

CREATE TABLE IF NOT EXISTS test_artifacts (
  id TEXT PRIMARY KEY,
  "roomId" TEXT NOT NULL REFERENCES test_rooms(id),
  "messageId" TEXT REFERENCES test_messages(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  path TEXT,
  content TEXT,
  "createdAt" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_test_artifacts_room ON test_artifacts("roomId");

-- =======================================================================
-- UNIFIED CONTEXT (Task-Spec-Knowledge Links)
-- =======================================================================

CREATE TABLE IF NOT EXISTS task_spec_links (
  id TEXT PRIMARY KEY,
  "taskId" TEXT NOT NULL,
  "specPath" TEXT NOT NULL,
  "specType" TEXT NOT NULL CHECK("specType" IN ('change', 'spec', 'module')),
  "linkType" TEXT NOT NULL DEFAULT 'manual' CHECK("linkType" IN ('manual', 'auto', 'suggested', 'referenced')),
  "linkReason" TEXT,
  "createdAt" BIGINT NOT NULL,
  UNIQUE("taskId", "specPath")
);
CREATE INDEX IF NOT EXISTS idx_task_spec_links_task ON task_spec_links("taskId");
CREATE INDEX IF NOT EXISTS idx_task_spec_links_spec ON task_spec_links("specPath");

CREATE TABLE IF NOT EXISTS task_knowledge_links (
  id TEXT PRIMARY KEY,
  "taskId" TEXT NOT NULL,
  "knowledgePath" TEXT NOT NULL,
  "linkType" TEXT NOT NULL DEFAULT 'manual' CHECK("linkType" IN ('manual', 'auto', 'suggested', 'referenced')),
  "linkReason" TEXT,
  "createdAt" BIGINT NOT NULL,
  UNIQUE("taskId", "knowledgePath")
);
CREATE INDEX IF NOT EXISTS idx_task_knowledge_links_task ON task_knowledge_links("taskId");
CREATE INDEX IF NOT EXISTS idx_task_knowledge_links_knowledge ON task_knowledge_links("knowledgePath");

CREATE TABLE IF NOT EXISTS dismissed_suggestions (
  id TEXT PRIMARY KEY,
  "taskId" TEXT NOT NULL,
  "suggestedPath" TEXT NOT NULL,
  "suggestionType" TEXT NOT NULL CHECK("suggestionType" IN ('spec', 'knowledge')),
  "dismissedAt" BIGINT NOT NULL,
  UNIQUE("taskId", "suggestedPath")
);
CREATE INDEX IF NOT EXISTS idx_dismissed_suggestions_task ON dismissed_suggestions("taskId");

-- =======================================================================
-- MODULE KNOWLEDGE SYSTEM
-- =======================================================================

CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  paths TEXT NOT NULL,
  "createdAt" BIGINT NOT NULL,
  "updatedAt" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_modules_name ON modules(name);

CREATE TABLE IF NOT EXISTS module_architectures (
  id TEXT PRIMARY KEY,
  "moduleId" TEXT NOT NULL UNIQUE REFERENCES modules(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  stack TEXT NOT NULL,
  "entryPoints" JSONB,
  diagrams JSONB,
  version INTEGER DEFAULT 1,
  "updatedAt" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_module_arch_module ON module_architectures("moduleId");

CREATE TABLE IF NOT EXISTS module_decisions (
  id TEXT PRIMARY KEY,
  "moduleId" TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  question TEXT,
  decision TEXT NOT NULL,
  reasoning TEXT,
  alternatives JSONB,
  date BIGINT NOT NULL,
  "sessionId" TEXT,
  "relatedFiles" JSONB,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'superseded', 'deprecated')),
  "supersededBy" TEXT,
  tags JSONB,
  "createdAt" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_module_decisions_module ON module_decisions("moduleId");
CREATE INDEX IF NOT EXISTS idx_module_decisions_status ON module_decisions(status);
CREATE INDEX IF NOT EXISTS idx_module_decisions_date ON module_decisions(date);

CREATE TABLE IF NOT EXISTS module_tech_debt (
  id TEXT PRIMARY KEY,
  "moduleId" TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  impact TEXT CHECK(impact IN ('low', 'medium', 'high')),
  effort TEXT CHECK(effort IN ('low', 'medium', 'high')),
  "createdAt" BIGINT NOT NULL,
  "createdBy" TEXT,
  "sessionId" TEXT,
  "relatedFiles" JSONB,
  "relatedDecisions" JSONB,
  status TEXT DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved')),
  "resolvedAt" BIGINT,
  resolution TEXT
);
CREATE INDEX IF NOT EXISTS idx_module_tech_debt_module ON module_tech_debt("moduleId");
CREATE INDEX IF NOT EXISTS idx_module_tech_debt_status ON module_tech_debt(status);
CREATE INDEX IF NOT EXISTS idx_module_tech_debt_impact ON module_tech_debt(impact);

CREATE TABLE IF NOT EXISTS module_links (
  id TEXT PRIMARY KEY,
  "sourceModuleId" TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  "targetModuleId" TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  "linkType" TEXT NOT NULL CHECK("linkType" IN ('depends_on', 'used_by', 'related')),
  description TEXT,
  "createdAt" BIGINT NOT NULL,
  UNIQUE("sourceModuleId", "targetModuleId", "linkType")
);
CREATE INDEX IF NOT EXISTS idx_module_links_source ON module_links("sourceModuleId");
CREATE INDEX IF NOT EXISTS idx_module_links_target ON module_links("targetModuleId");

CREATE TABLE IF NOT EXISTS module_spec_links (
  id TEXT PRIMARY KEY,
  "moduleId" TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  "specPath" TEXT NOT NULL,
  "linkType" TEXT NOT NULL DEFAULT 'references' CHECK("linkType" IN ('implements', 'references', 'related')),
  description TEXT,
  "createdAt" BIGINT NOT NULL,
  UNIQUE("moduleId", "specPath")
);
CREATE INDEX IF NOT EXISTS idx_module_spec_links_module ON module_spec_links("moduleId");
CREATE INDEX IF NOT EXISTS idx_module_spec_links_spec ON module_spec_links("specPath");

CREATE TABLE IF NOT EXISTS module_knowledge_links (
  id TEXT PRIMARY KEY,
  "moduleId" TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  "knowledgePath" TEXT NOT NULL,
  "linkType" TEXT NOT NULL DEFAULT 'references' CHECK("linkType" IN ('references', 'documents', 'related')),
  description TEXT,
  "createdAt" BIGINT NOT NULL,
  UNIQUE("moduleId", "knowledgePath")
);
CREATE INDEX IF NOT EXISTS idx_module_knowledge_links_module ON module_knowledge_links("moduleId");
CREATE INDEX IF NOT EXISTS idx_module_knowledge_links_knowledge ON module_knowledge_links("knowledgePath");

-- =======================================================================
-- IMPACT ANALYSIS SYSTEM
-- =======================================================================

CREATE TABLE IF NOT EXISTS impact_analyses (
  id TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT,
  "specId" TEXT,
  "changeType" TEXT NOT NULL CHECK("changeType" IN ('feature', 'refactor', 'bugfix', 'migration', 'deletion')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'analyzing', 'completed', 'failed')),
  "inputJson" JSONB NOT NULL,
  "parsedJson" JSONB,
  "scopeJson" JSONB,
  "dataFlowsJson" JSONB,
  "risksJson" JSONB,
  "gateJson" JSONB,
  error TEXT,
  "createdAt" BIGINT NOT NULL,
  "updatedAt" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_impact_analyses_project ON impact_analyses("projectId");
CREATE INDEX IF NOT EXISTS idx_impact_analyses_task ON impact_analyses("taskId");
CREATE INDEX IF NOT EXISTS idx_impact_analyses_spec ON impact_analyses("specId");
CREATE INDEX IF NOT EXISTS idx_impact_analyses_status ON impact_analyses(status);

CREATE TABLE IF NOT EXISTS impact_validations (
  id TEXT PRIMARY KEY,
  "analysisId" TEXT NOT NULL REFERENCES impact_analyses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK(category IN ('test', 'data-flow', 'api', 'migration', 'manual', 'review')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'passed', 'failed', 'skipped')),
  "isBlocking" BOOLEAN NOT NULL DEFAULT true,
  "autoVerifiable" BOOLEAN NOT NULL DEFAULT false,
  "verifyCommand" TEXT,
  "expectedPattern" TEXT,
  "resultJson" JSONB,
  "riskId" TEXT,
  "dataFlowId" TEXT,
  "moduleId" TEXT,
  "createdAt" BIGINT NOT NULL,
  "updatedAt" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_impact_validations_analysis ON impact_validations("analysisId");
CREATE INDEX IF NOT EXISTS idx_impact_validations_status ON impact_validations(status);

CREATE TABLE IF NOT EXISTS gate_approvals (
  id TEXT PRIMARY KEY,
  "analysisId" TEXT NOT NULL REFERENCES impact_analyses(id) ON DELETE CASCADE,
  approver TEXT NOT NULL,
  reason TEXT NOT NULL,
  "approvedBlockersJson" JSONB NOT NULL,
  "createdAt" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gate_approvals_analysis ON gate_approvals("analysisId");

CREATE TABLE IF NOT EXISTS analysis_history (
  id TEXT PRIMARY KEY,
  "analysisId" TEXT NOT NULL REFERENCES impact_analyses(id) ON DELETE CASCADE,
  "actualIssuesJson" JSONB NOT NULL,
  "accuracyScore" REAL NOT NULL DEFAULT 0,
  notes TEXT,
  "createdAt" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analysis_history_analysis ON analysis_history("analysisId");

-- =======================================================================
-- CLAUDE SESSION MANAGER
-- =======================================================================

CREATE TABLE IF NOT EXISTS claude_sessions (
  id TEXT PRIMARY KEY,
  "workspacePath" TEXT NOT NULL,
  -- Linking
  "taskId" TEXT,
  "moduleId" TEXT,
  "specId" TEXT,
  "ticketId" TEXT,
  "workSessionId" TEXT,
  -- Launch info
  terminal TEXT NOT NULL,
  "launchMode" TEXT DEFAULT 'normal',
  "initialPrompt" TEXT,
  -- Process info
  pid INTEGER,
  "terminalWindowId" TEXT,
  "claudeSessionId" TEXT,
  -- Status
  status TEXT DEFAULT 'launching',
  "startedAt" BIGINT NOT NULL,
  "endedAt" BIGINT,
  -- Metadata
  "claudeModel" TEXT,
  "exitCode" INTEGER,
  "errorMessage" TEXT,
  -- Resume
  "canResume" BOOLEAN DEFAULT true,
  "resumeCount" INTEGER DEFAULT 0,
  "lastResumeAt" BIGINT,
  "resumeContext" JSONB,
  "createdAt" BIGINT NOT NULL,
  "updatedAt" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_claude_sessions_workspace ON claude_sessions("workspacePath");
CREATE INDEX IF NOT EXISTS idx_claude_sessions_task ON claude_sessions("taskId");
CREATE INDEX IF NOT EXISTS idx_claude_sessions_module ON claude_sessions("moduleId");
CREATE INDEX IF NOT EXISTS idx_claude_sessions_spec ON claude_sessions("specId");
CREATE INDEX IF NOT EXISTS idx_claude_sessions_ticket ON claude_sessions("ticketId");
CREATE INDEX IF NOT EXISTS idx_claude_sessions_status ON claude_sessions(status);
CREATE INDEX IF NOT EXISTS idx_claude_sessions_started ON claude_sessions("startedAt");

-- Session Events
CREATE TABLE IF NOT EXISTS session_events (
  id TEXT PRIMARY KEY,
  "claudeSessionId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "timestamp" BIGINT NOT NULL,
  details JSONB,
  CONSTRAINT fk_session_events_session FOREIGN KEY ("claudeSessionId") REFERENCES claude_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_session_events_session ON session_events("claudeSessionId");
CREATE INDEX IF NOT EXISTS idx_session_events_type ON session_events("eventType");
CREATE INDEX IF NOT EXISTS idx_session_events_time ON session_events("timestamp");

-- =======================================================================
-- TICKETS
-- =======================================================================

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES projects(id),
  "externalId" TEXT,
  source TEXT NOT NULL DEFAULT 'api' CHECK(source IN ('api', 'jira', 'github', 'linear', 'manual')),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'task' CHECK(type IN ('bug', 'feature', 'improvement', 'task', 'epic')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'reviewing', 'approved', 'in_progress', 'completed', 'rejected')),
  labels JSONB DEFAULT '[]',
  attachments JSONB DEFAULT '[]',
  "linkedIssues" JSONB DEFAULT '[]',
  "externalUrls" JSONB DEFAULT '[]',
  "taskId" TEXT REFERENCES tasks(id),
  "sessionId" TEXT REFERENCES claude_sessions(id),
  reporter TEXT,
  assignee TEXT,
  "createdAt" BIGINT NOT NULL,
  "updatedAt" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tickets_project ON tickets("projectId");
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_type ON tickets(type);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_external ON tickets("externalId");
CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets("createdAt");

-- =======================================================================
-- TRAINING ROOM (Lessons-Learned System)
-- =======================================================================

CREATE TABLE IF NOT EXISTS training_sessions (
  id TEXT PRIMARY KEY,
  "projectPath" TEXT NOT NULL DEFAULT '',
  "moduleId" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
  "totalIncidents" INTEGER DEFAULT 0,
  "totalLessons" INTEGER DEFAULT 0,
  "totalSkills" INTEGER DEFAULT 0,
  "createdAt" BIGINT NOT NULL,
  "updatedAt" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_training_sessions_module ON training_sessions("moduleId");
CREATE INDEX IF NOT EXISTS idx_training_sessions_status ON training_sessions(status);
CREATE INDEX IF NOT EXISTS idx_training_sessions_project ON training_sessions("projectPath");
CREATE UNIQUE INDEX IF NOT EXISTS idx_training_sessions_project_module ON training_sessions("projectPath", "moduleId");

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('mistake', 'failure', 'confusion', 'slow', 'other')),
  severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT,
  context JSONB,
  resolution TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'analyzed', 'lesson_created', 'closed')),
  "createdAt" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_incidents_session ON incidents("sessionId");
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_type ON incidents(type);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  "incidentIds" JSONB,
  title TEXT NOT NULL,
  problem TEXT NOT NULL,
  "rootCause" TEXT NOT NULL,
  solution TEXT NOT NULL,
  applicability JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'reviewed', 'approved', 'archived')),
  "approvedBy" TEXT,
  "createdAt" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lessons_session ON lessons("sessionId");
CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons(status);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  "projectPath" TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  description TEXT,
  "lessonIds" JSONB,
  type TEXT NOT NULL CHECK(type IN ('procedure', 'checklist', 'template', 'rule')),
  content TEXT NOT NULL,
  "triggerConfig" JSONB,
  applicability JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'deprecated')),
  "usageCount" INTEGER DEFAULT 0,
  "successRate" REAL DEFAULT 0,
  "lastUsed" BIGINT,
  "createdAt" BIGINT NOT NULL,
  "updatedAt" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_skills_status ON skills(status);
CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
CREATE INDEX IF NOT EXISTS idx_skills_type ON skills(type);
CREATE INDEX IF NOT EXISTS idx_skills_project ON skills("projectPath");
CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_project_name ON skills("projectPath", name);

CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY,
  "projectPath" TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  description TEXT,
  "skillIds" JSONB,
  level TEXT NOT NULL CHECK(level IN ('must', 'should', 'may')),
  enforcement TEXT NOT NULL CHECK(enforcement IN ('manual', 'hook', 'gate')),
  content TEXT NOT NULL,
  applicability JSONB,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'deprecated')),
  "violationCount" INTEGER DEFAULT 0,
  "lastViolation" BIGINT,
  "createdAt" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rules_status ON rules(status);
CREATE INDEX IF NOT EXISTS idx_rules_level ON rules(level);
CREATE INDEX IF NOT EXISTS idx_rules_enforcement ON rules(enforcement);
CREATE INDEX IF NOT EXISTS idx_rules_project ON rules("projectPath");
CREATE UNIQUE INDEX IF NOT EXISTS idx_rules_project_name ON rules("projectPath", name);

CREATE TABLE IF NOT EXISTS training_feedback (
  id TEXT PRIMARY KEY,
  "entityType" TEXT NOT NULL CHECK("entityType" IN ('skill', 'rule')),
  "entityId" TEXT NOT NULL,
  "taskId" TEXT,
  outcome TEXT NOT NULL CHECK(outcome IN ('helped', 'ignored', 'hindered')),
  notes TEXT,
  "createdAt" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_training_feedback_entity ON training_feedback("entityType", "entityId");
CREATE INDEX IF NOT EXISTS idx_training_feedback_task ON training_feedback("taskId");

-- =======================================================================
-- ENTITY REFERENCES (Project Intelligence Hub)
-- =======================================================================

CREATE TABLE IF NOT EXISTS entity_references (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relationship TEXT NOT NULL,
  metadata JSONB,
  created_at BIGINT NOT NULL,
  created_by TEXT,
  UNIQUE(source_type, source_id, target_type, target_id, relationship)
);
CREATE INDEX IF NOT EXISTS idx_entity_ref_source ON entity_references(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_entity_ref_target ON entity_references(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_entity_ref_relationship ON entity_references(relationship);
CREATE INDEX IF NOT EXISTS idx_entity_ref_source_rel ON entity_references(source_type, source_id, relationship);
CREATE INDEX IF NOT EXISTS idx_entity_ref_target_rel ON entity_references(target_type, target_id, relationship);

-- =======================================================================
-- KNOWLEDGE DOCUMENTS
-- =======================================================================

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  content TEXT NOT NULL,
  summary TEXT,
  module TEXT,
  tags JSONB DEFAULT '[]',
  category TEXT,
  owner TEXT,
  "reviewDate" TEXT,
  related JSONB DEFAULT '[]',
  "dependsOn" JSONB DEFAULT '[]',
  covers JSONB DEFAULT '[]',
  source TEXT DEFAULT 'manual',
  "sourcePath" TEXT,
  "wordCount" INTEGER,
  "readingTime" INTEGER,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  UNIQUE("projectId", slug)
);
CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge_documents("projectId");
CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge_documents("projectId", type);
CREATE INDEX IF NOT EXISTS idx_knowledge_status ON knowledge_documents("projectId", status);
CREATE INDEX IF NOT EXISTS idx_knowledge_module ON knowledge_documents("projectId", module);
CREATE INDEX IF NOT EXISTS idx_knowledge_slug ON knowledge_documents("projectId", slug);
