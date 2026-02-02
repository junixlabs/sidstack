# SidStack Roadmap - Q1 2026

**Created**: 2026-01-02
**Updated**: 2026-02-01
**Status**: Active
**Owner**: Development Team

---

## Vision Statement (Updated)

**SidStack** = Project Knowledge Browser & Agent Workspace

**Focus**: Knowledge management and visualization first, then orchestration.

Core principles:
- **Knowledge-first** - Understand the project before automating
- **Visual & Friendly** - Both agents and humans can read and update
- **Incremental** - Small incremental steps, not big-bang releases
- **Local-first** - No complex server dependencies

---

## Completed: SidStack v1 - CLI & View-Only App

**Status**: ✅ Completed (2026-01-21)
**Status**: Shipped in v0.3.0

### CLI Commands (Agent-Friendly)

All CLI commands support JSON output (`--json`), exit codes, and strict mode (`--strict`).

| Command | Description | Status |
|---------|-------------|--------|
| `sidstack governance show` | Show governance overview | ✅ Done |
| `sidstack governance check` | Check governance compliance | ✅ Done |
| `sidstack preset list` | List available presets | ✅ Done |
| `sidstack preset show <name>` | Show preset details | ✅ Done |
| `sidstack init --preset <name>` | Initialize with preset | ✅ Done |
| `sidstack knowledge templates` | List knowledge templates | ✅ Done |
| `sidstack knowledge create` | Create from template | ✅ Done |

### Knowledge Templates

| Template | Description |
|----------|-------------|
| `business-logic` | Business rules and workflows |
| `api-endpoint` | API endpoint documentation |
| `design-pattern` | Design pattern documentation |
| `database-table` | Database table documentation |
| `module` | Module documentation |

### Desktop App (View-Only)

| Feature | Status |
|---------|--------|
| Knowledge Browser | ✅ Done |
| Project Hub | ✅ Done |
| Task Manager | ✅ Done |
| View-Only Badge | ✅ Done |
| Open in Editor | ✅ Done |

### CLI Testing

| Category | Tests |
|----------|-------|
| Governance Commands | 2 test files |
| Preset Commands | 2 test files |
| Knowledge Commands | 2 test files |

See `docs/USER_GUIDE_VIEW_ONLY_APP.md` for user guide.

---

## Completed: SidStack v1.1 - Full Feature Desktop App

**Status**: ✅ Completed (2026-01-27)

### Desktop App Features

| Feature | Status |
|---------|--------|
| Task Manager (Kanban + Tree + List views) | ✅ Done |
| Session Manager (launch/track Claude sessions) | ✅ Done |
| Ticket Queue (intake, review, convert to task) | ✅ Done |
| Knowledge Browser (unified knowledge API) | ✅ Done |
| Project Hub (central dashboard) | ✅ Done |
| Project Hub (capability tree, entity connections) | ✅ Done |
| Training Room (incidents, lessons, skills, rules) | ✅ Done |
| Impact Analysis (scope, risks, validations, gates) | ✅ Done |
| Progress Tracking (work history, sessions) | ❌ Deleted (merged into Sessions view) |
| Settings (per-project configuration) | ✅ Done |
| Onboarding Flow | ✅ Done |
| Tunnel/Remote Access | ✅ Done |

### Agent Orchestration

| Feature | Status |
|---------|--------|
| MCP Server (task, impact, knowledge, training tools) | ✅ Done |
| External Session Launch (iTerm, Terminal, Warp, etc.) | ✅ Done |
| Agent Governance (principles, skills, workflows) | ✅ Done |
| Simplified Agent Roles (Orchestrator, Worker, Reviewer) | ✅ Done |
| Capability Skills (implement, design, test, review, deploy) | ✅ Done |
| Lesson Detection & Suggestion | ✅ Done |

### Quality & Testing

| Metric | Value |
|--------|-------|
| CLI Tests | Passing |
| API Server Smoke Tests | 27 passing |
| TypeScript Build | Clean (0 errors) |
| Technical Debt | All 7 items resolved |
| OpenSpec Changes | 69 archived, 0 active |

---

## Phase 1: Knowledge Browser Enhancement (Merged)

**Status**: ✅ Completed (2026-01-28)
**Approach**: Enhanced existing unified Knowledge Browser with type-aware rendering instead of building 4 separate viewers.

### What was done
- Existing Knowledge Browser already had: tree view, search, 16 type filters, markdown viewer, module navigation
- Added: Category quick-filter tabs (Specs, Docs, Resources, Agent, Meta)
- Added: Type-aware context bar (API method badges, rule enforcement levels, skill types, checklist progress, pattern categories)
- Added: Copy content/path buttons
- Added: HTTP method detection for API reference docs
- MarkdownPreview already supports Mermaid diagrams (ERD) and code syntax highlighting

### Original plan (4 separate viewers) → Merged into 1 unified viewer
- Business Logic Viewer → Unified viewer with markdown rendering ✅
- API Structure Browser → Type context bar with method badges (GET/POST/etc) ✅
- Design Patterns Registry → Category detection in context bar ✅
- Database Schema Browser → Mermaid ERD rendering (already supported) ✅

### Document formats still supported
- Database schemas
- Module relationships

### 1.1 Backend Business Logic Viewer

**What**: Display business rules, workflows, and backend logic

**Structure**:
```
.sidstack/knowledge/
├── business-logic/
│   ├── _index.md              # Overview & navigation
│   ├── user-management.md     # User registration, auth, roles
│   ├── order-processing.md    # Order workflow, states
│   └── payment-flow.md        # Payment integration logic
```

**Format** (human & agent friendly):
```markdown
---
id: user-registration
type: business-logic
module: user-management
status: implemented
last_updated: 2026-01-15
related: [email-verification, role-assignment]
---

# User Registration Flow

## Overview
Brief description of the business logic.

## Rules
1. Email must be unique
2. Password minimum 8 characters
3. Auto-assign "user" role on creation

## States
- pending → verified → active
- pending → expired (after 24h)

## Code References
- `src/services/auth.ts:45` - Registration handler
- `src/models/user.ts:12` - User model
```

**Tasks**:
| Task | Priority | Status |
|------|----------|--------|
| Define business-logic document schema | P0 | ✅ Done (frontmatter) |
| Create UI component: BusinessLogicViewer | P0 | ✅ Merged into unified viewer |
| Markdown editor with live preview | P0 | Deferred to Phase 2 |
| Search & filter by module/status | P1 | ✅ Done |
| Link to source code (click to open) | P1 | ✅ Done (MarkdownPreview) |

---

### 1.2 API Structure Browser

**What**: Display API endpoints, request/response schemas, and standards

**Structure**:
```
.sidstack/knowledge/
├── api/
│   ├── _index.md              # API overview & standards
│   ├── _standards.md          # Naming conventions, error handling
│   ├── auth/
│   │   ├── login.md
│   │   ├── register.md
│   │   └── refresh-token.md
│   ├── users/
│   │   ├── list.md
│   │   ├── get.md
│   │   └── update.md
│   └── orders/
│       └── ...
```

**Format**:
```markdown
---
id: post-auth-login
type: api-endpoint
method: POST
path: /api/auth/login
module: auth
status: implemented
version: v1
---

# POST /api/auth/login

## Description
Authenticate user and return JWT tokens.

## Request
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

## Response (200)
```json
{
  "accessToken": "string",
  "refreshToken": "string",
  "expiresIn": 3600
}
```

## Errors
| Code | Description |
|------|-------------|
| 401 | Invalid credentials |
| 422 | Validation error |
| 429 | Too many attempts |

## Code Reference
- `src/routes/auth.ts:23`
```

**Tasks**:
| Task | Priority | Status |
|------|----------|--------|
| Define API document schema | P0 | ✅ Done (frontmatter) |
| Create UI component: APIBrowser | P0 | ✅ Merged into unified viewer |
| Group by module with tree view | P0 | ✅ Done (existing tree) |
| Method badges (GET/POST/etc.) | P1 | ✅ Done (TypeContextBar) |
| Copy curl command | P1 | ✅ Done (CopyButton) |
| Test endpoint (call API) | P2 | Deferred |

---

### 1.3 Design Patterns Registry

**What**: Document design patterns used in the project

**Structure**:
```
.sidstack/knowledge/
├── patterns/
│   ├── _index.md              # Pattern catalog
│   ├── repository-pattern.md
│   ├── service-layer.md
│   ├── dto-validation.md
│   └── error-handling.md
```

**Format**:
```markdown
---
id: repository-pattern
type: design-pattern
category: data-access
status: adopted
---

# Repository Pattern

## Intent
Abstract data access logic from business logic.

## Structure
```
src/
├── repositories/
│   ├── base.repository.ts     # Base class
│   ├── user.repository.ts
│   └── order.repository.ts
├── services/
│   └── user.service.ts        # Uses repository
```

## Example
```typescript
// user.repository.ts
class UserRepository extends BaseRepository<User> {
  async findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email } });
  }
}
```

## When to Use
- Complex data access logic
- Need to swap database implementations
- Unit testing with mocks

## Code References
- `src/repositories/base.repository.ts:1`
```

**Tasks**:
| Task | Priority | Status |
|------|----------|--------|
| Define pattern document schema | P0 | ✅ Done (frontmatter) |
| Create UI component: PatternViewer | P0 | ✅ Merged into unified viewer |
| Category filtering | P1 | ✅ Done (TypeContextBar + category tabs) |
| Code snippet syntax highlighting | P0 | ✅ Done (MarkdownPreview) |

---

### 1.4 Database Schema Browser

**What**: Visualize database schema and relationships

**Structure**:
```
.sidstack/knowledge/
├── database/
│   ├── _index.md              # Schema overview
│   ├── schema.prisma          # (auto-linked from project)
│   ├── users.md               # User table documentation
│   ├── orders.md
│   └── migrations/
│       └── _index.md          # Migration history
```

**Tasks**:
| Task | Priority | Status |
|------|----------|--------|
| Parse Prisma/SQL schema | P0 | Deferred (manual docs first) |
| ERD visualization (Mermaid) | P0 | ✅ Done (MarkdownPreview + MermaidDiagram) |
| Table detail view | P1 | ✅ Merged into unified viewer |
| Relationship explorer | P1 | ✅ Done (Mermaid erDiagram blocks) |

---

## Phase: VS Code Extension (MCP App)

**Status**: Planned
**Added**: 2026-02-01
**Decision**: Option C - MCP App with Interactive UI

### Objective

Extend SidStack to VS Code as primary development environment integration.

### Key Results

| KR | Metric | Target |
|----|--------|--------|
| KR-1 | MCP server works in VS Code agent mode | 32/32 tools accessible |
| KR-2 | MCP Apps UI renders project dashboard in chat | < 500ms load |
| KR-3 | VS Code Marketplace listing published | Published |
| KR-4 | Task management end-to-end in VS Code | Create -> Complete flow |

### Approach

Option C - MCP App with Interactive UI:
- Extend existing `@sidstack/mcp-server` with MCP Apps UI templates
- Reuse `@sidstack/shared` (database, types) - 100% compatible
- Cross-platform: works in VS Code, Claude, ChatGPT
- No Tauri UI rebuild - focus on MCP protocol layer

### Scope

- Week 1: Register MCP server in VS Code, publish minimal extension scaffold
- Week 2: Add MCP Apps UI (dashboard, task forms, knowledge view)
- Week 3: Status bar + command palette + polish + Marketplace publish

### New Package

`packages/vscode-extension/` - VS Code extension with MCP App integration

### Research

Full research document: (internal)

---

## Phase 2: Knowledge Editor & Sync

### 2.1 Visual Editor

- Rich markdown editor with templates
- Drag & drop to reorganize
- Auto-save

### 2.2 Agent-Friendly Format

- Structured frontmatter for AI parsing
- Code reference links
- Relationship metadata

### 2.3 Sync with Codebase

- Watch for code changes
- Suggest document updates
- Detect outdated references

---

## Phase 3: Agent Integration

### 3.1 Context Builder
- Build knowledge context from selected documents
- Smart relevance filtering
- Token-aware compression

### 3.2 Task Awareness
- Agent reads relevant docs before coding
- Follows documented patterns
- Updates docs after changes

---

## Phase 4: Antigravity Integration (Future)

**Status:** Planned  
**Priority:** P2 (After Phase 1-3)  
**Timeline:** TBD

### Vision

Integrate Antigravity AI assistant as an alternative to Claude Code, providing users with choice of AI engine while maintaining consistent governance and workflow.

### 4.1 Level 1: Minimal Integration

**Goal:** Enable Antigravity to understand and work with SidStack projects

**Features:**
- Context export system (`.antigravity/CONTEXT.md`)
- CLI commands: `sidstack antigravity init`, `export-context`
- Knowledge template adapters
- Basic project understanding

**Deliverables:**
| Item | Description |
|------|-------------|
| Context Generator | Auto-generate project context for Antigravity |
| Template Adapters | Convert knowledge templates to Antigravity format |
| CLI Commands | Init and context export commands |

### 4.2 Level 2: Governance Integration

**Goal:** Antigravity follows SidStack governance like Claude Code agents

**Features:**
- Antigravity-specific skills (`.sidstack/skills/antigravity/`)
- Governance adapter layer
- Progress tracking hooks
- Quality gate enforcement

**Deliverables:**
| Item | Description |
|------|-------------|
| Skill Templates | SKILL.md framework for Antigravity |
| Governance Adapter | Translate governance rules for Antigravity |
| Progress Hooks | Log Antigravity work to SQLite |
| Quality Gates | Automated typecheck/lint/test validation |

### 4.3 Level 3: Full Integration (Optional)

**Goal:** Seamless multi-engine orchestration

**Features:**
- Antigravity MCP adapter
- Desktop app terminal integration
- Multi-engine orchestrator (Claude + Antigravity)
- Engine selection based on task type

**Deliverables:**
| Item | Description |
|------|-------------|
| MCP Adapter | Bridge Antigravity to SidStack tools |
| Desktop UI | Antigravity terminals in Agent Manager |
| Orchestrator | Route tasks to optimal AI engine |
| Comparison Tools | Performance metrics across engines |

### Integration Approach

**Directory Structure:**
```
sidstack/
├── .antigravity/                    # Antigravity integration
│   ├── CONTEXT.md                   # Auto-generated context
│   ├── governance-adapter.ts        # Governance bridge
│   ├── hooks/
│   │   └── progress-tracker.ts      # Progress tracking
│   └── templates/
│       ├── request.md               # Request templates
│       └── knowledge-request.md     # Knowledge templates
│
├── .sidstack/skills/
│   ├── antigravity/                 # Antigravity skills
│   │   ├── SKILL.md                 # Framework
│   │   ├── implement-feature.md
│   │   ├── create-knowledge-doc.md
│   │   └── analyze-codebase.md
│   └── ...
│
└── packages/
    └── antigravity-adapter/         # Integration package
        └── src/
            ├── mcp-adapter.ts
            ├── context-builder.ts
            └── index.ts
```

### Success Criteria

| Metric | Target |
|--------|--------|
| Context generation time | < 2s |
| Governance compliance | > 95% |
| CLI usability | < 5 steps to export context |
| Desktop integration | Seamless terminal rendering |

### Dependencies

- Phase 1 complete (Knowledge Browser)
- Phase 2 complete (Knowledge Editor)
- Phase 3 complete (Agent Integration)
- Stable governance system
- CLI infrastructure

### Risks

| Risk | Mitigation |
|------|------------|
| Different AI workflow | Create adapter skills in `.sidstack/skills/antigravity/` |
| Desktop complexity | Start CLI-only, defer desktop integration |
| Governance enforcement | Automated quality gates |
| Context staleness | Auto-regenerate on project changes |

### Documentation

- Integration strategy: See artifacts/antigravity_integration_strategy.md
- Best practices: See artifacts/antigravity_best_practices.md
- Template formats: Defined in integration strategy

---

## UI Components (Phase 1 - Complete)

| Component | Description | Status |
|-----------|-------------|--------|
| `KnowledgeBrowserBlockView` | Unified browser with sidebar + content | ✅ Done |
| `MarkdownPreview` | Render markdown + Mermaid + code highlight | ✅ Done |
| `TypeContextBar` | Type-aware metadata (methods, levels, progress) | ✅ Done |
| `CopyButton` | Copy content/path to clipboard | ✅ Done |
| `TreeView` / `TreeNode` | Folder/file tree navigation | ✅ Done |
| `DocumentEditor` | Edit with live preview | Deferred to Phase 2 |

---

## Document Schema (Shared)

All documents use this frontmatter structure:

```yaml
---
id: unique-identifier
type: business-logic | api-endpoint | design-pattern | database-table
module: module-name
status: draft | implemented | deprecated
created: 2026-01-15
updated: 2026-01-15
author: name
related: [other-doc-ids]
tags: [tag1, tag2]
---
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Document load time | < 500ms |
| Search results | < 200ms |
| Editor save | < 100ms |
| Full knowledge scan | < 2s for 100 docs |

---

## Immediate Next Actions

1. [x] Create `.sidstack/knowledge/` structure (via Knowledge API)
2. [x] Define document schemas (TypeScript types in KnowledgeBrowserBlockView)
3. [x] Build `KnowledgeBrowser` component (KnowledgeBrowserBlockView - 1000+ lines)
4. [x] Build `DocumentViewer` (MarkdownPreview + TypeContextBar)
5. [ ] Build `DocumentEditor` (Phase 2 - visual editor)
6. [x] Test with sample docs (Knowledge API serves from .sidstack/knowledge/ + docs/)

---

## Not In Scope (Phase 1)

- Complex orchestration
- Multi-agent coordination
- Cloud sync
- Real-time collaboration
- Auto-generation from code (manual first)

---

## Related Files

- `src/components/knowledge/` - UI components (to create)
- `packages/shared/src/knowledge-types.ts` - Document types (to create)
- `.sidstack/knowledge/` - Document storage (to create)
