---
name: sidstack-knowledge
description: "Build, audit, and maintain project knowledge. Modes: init (bootstrap knowledge for existing project), audit (health check + fix), update (post-feature doc update), search (find + context). Triggers on: /sidstack-knowledge or 'build knowledge', 'audit docs', 'update docs'."
argument-hint: "[init|audit|update|search] [module-name or description]"
allowed-tools: mcp__sidstack__knowledge_create, mcp__sidstack__knowledge_update, mcp__sidstack__knowledge_delete, mcp__sidstack__knowledge_list, mcp__sidstack__knowledge_get, mcp__sidstack__knowledge_search, mcp__sidstack__knowledge_modules, mcp__sidstack__knowledge_module_overview, mcp__sidstack__knowledge_health, mcp__sidstack__knowledge_context, mcp__sidstack__entity_link, mcp__sidstack__entity_references, mcp__sidstack__memory_add, mcp__sidstack__memory_search
---

# SidStack Knowledge Management

4 modes for building and maintaining project knowledge.

## Usage

```
/sidstack-knowledge init
/sidstack-knowledge init auth payment
/sidstack-knowledge audit
/sidstack-knowledge audit knowledge
/sidstack-knowledge update auth
/sidstack-knowledge search "how does auth work"
```

## Step 0: Initialize

Run EVERY time before any mode:

1. **Detect mode** from first argument. Default `audit` if not specified.
2. **Load current state**: `knowledge_modules(projectPath)` → get module list + health scores
3. **Load health**: `knowledge_health(projectPath)` → get issues

---

## Init Mode — Bootstrap knowledge for existing project

Purpose: Analyze codebase and create comprehensive knowledge documents for a project that has no or minimal documentation.

### Input

| Input | Action |
|-------|--------|
| `init` | Discover all modules, create docs for each |
| `init auth payment` | Only create docs for specified modules |

### Process

#### Phase 1: Discover Modules

Scan project structure to identify modules:

```
1. Read project root: package.json, monorepo config (pnpm-workspace.yaml, lerna.json)
2. Scan directories: src/, packages/, apps/, lib/, services/
3. Identify boundaries: each package, each major src/ subdirectory
4. Check existing knowledge: knowledge_modules(projectPath)
5. Report: "Found X modules, Y already documented, Z need documentation"
```

Present module list for user confirmation before proceeding.

#### Phase 2: For each module, create documents

**Step 2a: Module Definition** (type=module)

Read the module's entry point, README, package.json. Create:

```
knowledge_create({
  projectPath, title: "[Module Name]",
  type: "module", module: "[module-id]",
  content: "# [Module Name]\n\n## Purpose\n...\n## Architecture\n...\n## Key Files\n..."
})
```

Minimum content:
- **Purpose** — What and why (from README or inferred from code)
- **Architecture** — Key patterns, storage, dependencies
- **Key Files** — Entry points, main components

**Step 2b: Guide** (type=guide)

Read the module's main logic, handlers, public API. Create a usage guide:

```
knowledge_create({
  projectPath, title: "[Module] Usage Guide",
  type: "guide", module: "[module-id]",
  content: "# [Module] Usage Guide\n\n## Overview\n...\n## How to Use\n..."
})
```

**Step 2c: Reference** (type=reference) — Only if module has API/config/schema

Read API routes, config files, schema definitions. Create reference:

```
knowledge_create({
  projectPath, title: "[Module] API Reference",
  type: "reference", module: "[module-id]",
  content: "# [Module] API Reference\n\n## Endpoints\n...\n## Configuration\n..."
})
```

**Step 2d: Link entities**

```
entity_link(source: knowledge/[module-doc], target: knowledge/[guide-doc], relationship: "related_to")
```

#### Phase 3: Project-level documents

If these don't exist yet, create:

| Document | Type | Content Source |
|----------|------|----------------|
| System Overview | guide | README.md, architecture dirs |
| Development Setup | guide | package.json scripts, contributing guide |
| Coding Conventions | rule | eslint config, tsconfig, existing patterns |

#### Phase 4: Report

```markdown
## Knowledge Init Complete

| Module | Docs Created | Health |
|--------|-------------|--------|
| auth | 3 (module, guide, reference) | 85 |
| payment | 2 (module, guide) | 65 |

**Total:** X documents created across Y modules
**Next:** Run `/sidstack-knowledge audit` to check completeness
```

---

## Audit Mode — Health check and fix

Purpose: Identify knowledge gaps and fix them.

### Input

| Input | Action |
|-------|--------|
| `audit` | Full audit of all modules |
| `audit auth` | Audit specific module only |

### Process

#### Step 1: Collect Data

```
knowledge_health(projectPath)     → issues (stale, missing, broken links)
knowledge_modules(projectPath)    → module list with health scores
```

#### Step 2: Analyze Issues

Group by severity:

| Priority | Issue Type | Action |
|----------|-----------|--------|
| **Critical** | Module with 0 docs | Create module doc + guide |
| **High** | Stale docs (>90 days, source files changed) | Update content |
| **High** | Docs with status=review | Review and update |
| **Medium** | Module health < 50 | Add missing doc types |
| **Medium** | Docs without module field | Assign to correct module |
| **Low** | Missing tags | Add tags |
| **Low** | Missing summary | Add summary |

#### Step 3: Fix (with confirmation)

Present fix plan:

```markdown
## Audit Results

### Critical (2)
- [ ] Module `payment` has no docs → Create module doc + guide
- [ ] Module `notification` has no docs → Create module doc + guide

### High (3)
- [ ] `auth-api-reference` stale (last updated 120 days ago, auth.ts changed) → Update
- [ ] `database-schema` has status=review → Review and update
- [ ] `setup-guide` references deprecated config → Update

### Medium (4)
- [ ] 4 docs have no module assigned → Assign modules

Proceed with fixes? [Critical first, then High]
```

Wait for user approval, then execute fixes in priority order.

#### Step 4: Report

```markdown
## Audit Complete

| Metric | Before | After |
|--------|--------|-------|
| Total docs | 38 | 42 |
| Average health | 62 | 78 |
| Critical issues | 2 | 0 |
| High issues | 3 | 0 |
```

---

## Update Mode — Post-feature documentation update

Purpose: After developing a feature, update affected knowledge documents.

### Input

| Input | Action |
|-------|--------|
| `update auth` | Update docs for auth module based on recent changes |
| `update` | Detect changed modules from git, update their docs |

### Process

#### Step 1: Detect Changes

```
# If module specified:
knowledge_module_overview(projectPath, moduleId) → current docs

# If no module specified, detect from git:
git diff --name-only HEAD~5  → changed files → map to modules
```

#### Step 2: Review Each Affected Doc

For each document in the affected module:

1. Read current doc content: `knowledge_get(id)`
2. Read current source code (files in `covers` field)
3. Compare: does doc still match reality?
4. If outdated → prepare update

#### Step 3: Apply Updates

For each doc needing update:

```
knowledge_update({
  id: "[doc-id]",
  content: "[updated content]",
  status: "active"   // reset from "review" if applicable
})
```

#### Step 4: Check for New Docs Needed

| Change Type | Doc Action |
|------------|------------|
| New API endpoint | Create/update reference doc |
| New module/service | Create module doc + guide |
| Behavior change | Update guide |
| Technical decision | Create decision doc (ADR) |
| Bug fix with non-obvious cause | Create incident via `incident_create` |

#### Step 5: Checklist Report

```markdown
## Update Complete — Module: auth

### Updated
- [x] Auth API Reference — added new `/oauth/revoke` endpoint
- [x] Auth Guide — updated token refresh flow

### Created
- [x] ADR: Switch to PKCE for OAuth — decision doc

### No Change Needed
- Auth Module Definition — still accurate
- Auth Security Rules — unchanged

### Reminders
- [ ] Run `knowledge_health` in 1 week to catch any missed updates
```

---

## Search Mode — Find and build context

Purpose: Find relevant knowledge and build context for a topic.

### Input

| Input | Action |
|-------|--------|
| `search "oauth flow"` | Search + show results with context |
| `search auth` | Show all docs in auth module |

### Process

```
# Text search
knowledge_search(projectPath, query: "oauth flow")

# Module browse
knowledge_module_overview(projectPath, moduleId: "auth")

# Semantic search (if available)
memory_search(projectPath, query: "oauth flow")
```

Present results grouped by relevance:

```markdown
## Search Results: "oauth flow"

### Direct Matches (knowledge)
1. **Auth Guide** [guide] — Score: 95
   > Section: Token Refresh Flow — describes the OAuth refresh mechanism...
2. **Auth API Reference** [reference] — Score: 80
   > Endpoints: POST /oauth/token, POST /oauth/revoke...

### Semantic Matches (memory)
1. "OAuth refresh tokens must be rotated on each use" — relevance: 85%
2. "Auth module uses PKCE flow since 2026-01" — relevance: 72%

### Related Modules
- **auth** — 5 docs, health: 85
- **api-server** — 2 docs, health: 70

Build full context? → knowledge_context(projectPath, moduleId: "auth")
```

---

## Document Quality Standards

When creating or updating documents, follow these standards:

### Content Structure
- Start with `# Title` matching the document title
- Include `## Purpose` / `## Overview` section first
- Use tables for structured data
- Use code blocks for commands/examples
- Keep sections focused — split long docs into multiple documents

### Metadata
- Always set `module` field (except true project-level docs)
- Add 2-5 relevant `tags`
- Set `summary` (1 sentence describing the doc)
- Set `dependsOn` if doc depends on another
- Set `related` for cross-references
- Set `covers` for source files the doc describes (enables stale detection)

### Module Health Targets

| Score | Status | Action |
|-------|--------|--------|
| 80-100 | Healthy | Maintain with regular audits |
| 50-79 | Needs attention | Add missing doc types |
| 0-49 | Critical | Prioritize init/audit |

---

## Error Handling

| Situation | Action |
|-----------|--------|
| MCP tools unavailable | Warn user, suggest checking API server |
| No modules found | Guide user to identify modules manually |
| Knowledge empty | Start with init mode |
| Module not found | List available modules, suggest closest match |
| Stale doc with no source files | Ask user if doc is still relevant |
