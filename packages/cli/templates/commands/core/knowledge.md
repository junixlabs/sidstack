---
name: "SidStack: Knowledge"
description: Knowledge system - build, explore, search, and manage project knowledge
category: core
version: 1.0.0
tags: [sidstack, knowledge, documentation, learn, assistant]
---

# SidStack Knowledge

Unified knowledge system for building, exploring, searching, and managing project documentation.

## Usage

```
/sidstack:knowledge [subcommand] [arguments]
```

## Routing

Parse `$ARGUMENTS` and route to the appropriate workflow:

| Input | Route to |
|-------|----------|
| (empty) | **Overview** - knowledge stats and quick search |
| `build` | **Build** - interactive knowledge building |
| `explore [topic]` | **Explore** - deep dive into a topic |
| `search [query]` | **Search** - search knowledge docs |
| `init` | **Init** - analyze project and bootstrap knowledge |
| `validate` | **Validate** - validate existing documents |
| `[question]` | **Q&A** - answer questions about the project |

If the input looks like a question (starts with how/what/where/why/show/explain), route to **Q&A**.

---

## Overview (no args)

Show knowledge system status:

1. Use `knowledge_list` to get all documents
2. Use `knowledge_modules` to get module stats
3. Display:

```
## Knowledge Overview

### Documents: [N] total
- business-logic: [N]
- api-endpoint: [N]
- design-pattern: [N]
- database-table: [N]
- module: [N]

### Modules
[List modules with document counts]

---
What would you like to do? (build/explore/search/init)
```

---

## Build - Interactive Knowledge Building

Full interactive workflow to build knowledge documentation.

### Phase 1: Project Scan

Analyze the project to identify areas needing documentation:

- API Endpoints (routes, controllers)
- Business Logic (services, workflows)
- Design Patterns (repositories, factories)
- Database (models, schemas)
- Modules (packages, features)

### Phase 2: Discovery Report

Present findings:
- List undocumented areas with priority
- Ask which areas to document first

### Phase 3: Interactive Q&A

For each area to document:
1. Show relevant code snippets
2. Ask clarifying questions about business rules
3. Confirm understanding before generating

### Phase 4: Document Generation

Generate documents with proper frontmatter:

```yaml
---
id: unique-identifier           # REQUIRED - kebab-case
type: business-logic            # REQUIRED - valid type
title: Human Readable Title     # RECOMMENDED
module: module-name             # OPTIONAL
status: implemented             # OPTIONAL
tags: [tag1, tag2]              # OPTIONAL
related: [other-doc-id]         # OPTIONAL
created: YYYY-MM-DD             # OPTIONAL
---
```

### Valid `type` Values

| Type | Folder |
|------|--------|
| `index` | root or any |
| `business-logic` | `business-logic/` |
| `api-endpoint` | `api/` |
| `design-pattern` | `patterns/` |
| `database-table` | `database/` |
| `module` | `modules/` |

### Phase 5: Validation (REQUIRED)

After generating documents:

```bash
sidstack knowledge validate
```

Do NOT consider build complete until validation passes with 0 invalid files.

### Build Arguments

| Argument | Description |
|----------|-------------|
| `build` | Full project scan |
| `build api` | Focus on API documentation |
| `build business-logic` | Focus on business logic |
| `build patterns` | Focus on design patterns |
| `build database` | Focus on database schemas |
| `build modules` | Focus on modules |
| `build [file-path]` | Document specific file |
| `build continue` | Resume previous session |

### Output Location

```
.sidstack/knowledge/
├── _index.md              # Root index
├── business-logic/
├── api/
├── patterns/
├── database/
└── modules/
```

---

## Explore - Deep Topic Exploration

`explore [topic]` - Proactively explore and document a topic.

### Guardrails

**READ-ONLY MODE for source code:**
- CAN read any file in the project
- CANNOT modify source code or configuration
- CAN write to: `.sidstack/assistant-spaces/**/*`

### Process

1. **Choose focus area** from arguments or suggest areas
2. **Deep exploration**
   - Find all relevant files
   - Read and understand the code
   - Trace data flows and dependencies
   - Identify patterns and conventions
3. **Create documentation**
   - Save to `.sidstack/assistant-spaces/analysis/[topic].md`
   - Include architecture diagrams (text-based)
   - Document key components
   - Note design decisions and trade-offs
4. **Cross-reference**
   - Link to related topics
   - Note areas needing more exploration

### Suggested Topics

| Area | What to Document |
|------|------------------|
| Architecture | System design, component relationships |
| Data Flow | How data moves through the system |
| API Surface | Endpoints, request/response |
| State Management | How state is stored and updated |
| Error Handling | How errors are caught, logged, surfaced |
| Build System | Build process, scripts, deployment |

### Output Format

```markdown
# [Topic] Analysis

**Explored:** YYYY-MM-DD
**Scope:** [What was covered]
**Status:** [Complete/Partial/Needs Update]

## Overview
## Architecture
## Key Components
## Data Flow
## Patterns & Conventions
## Trade-offs & Decisions
## Related Topics
```

---

## Search

`search [query]` - Search knowledge documents.

1. Use `knowledge_search({ query: "..." })`
2. Display results with relevance
3. Offer to show full document

---

## Init - Bootstrap Knowledge

`init` - Analyze the codebase and bootstrap knowledge documentation.

### Process

1. **Explore codebase structure**
   - Project root structure (directories, config files)
   - Package.json for dependencies
   - Source code organization

2. **Identify modules/packages**
   - Look in: packages/, services/, apps/, src/modules/, src/features/
   - Determine name, purpose, dependencies

3. **Identify features**
   - Scan routes/API endpoints
   - Check README for features
   - Note: name, description, type, status

4. **Detect architecture pattern**
   - Monorepo, microservices, layered, feature-based, MVC

5. **Generate initial knowledge documents**
   - Create module docs in `.sidstack/knowledge/modules/`
   - Create index document
   - Validate all generated documents

---

## Q&A - Answer Questions

When input looks like a question, act as a project assistant:

### Guardrails

**READ-ONLY MODE:**
- CAN read any file in the project
- CANNOT modify source code or configuration
- CAN write to: `.sidstack/assistant-spaces/**/*`

### Process

1. **Understand the question**
2. **Research the codebase** using Glob, Grep, Read
3. **Provide clear answer** with file references (`file.ts:line`)
4. **Document findings** (optional) in `.sidstack/assistant-spaces/`

### Question Types

| Type | Example | Approach |
|------|---------|----------|
| Where is X? | "Where is the login handler?" | Glob + Grep |
| How does X work? | "How does auth work?" | Read + trace flow |
| Why is X like this? | "Why use SQLite?" | Check docs, comments |
| What does X do? | "What does this function do?" | Read and explain |
| Show me X | "Show me the API routes" | Glob + Read + summarize |

If asked to modify code, explain:
> "In knowledge mode, I'm read-only. For code changes, work directly with Claude Code or use `/sidstack:agent worker`."

---

## Validate

`validate` - Validate existing knowledge documents.

Check all documents in `.sidstack/knowledge/`:
1. Frontmatter exists with `---` delimiters
2. Required fields present: `id`, `type`
3. Valid type value
4. Valid status value (if present)
5. Has at least one heading
6. Content is not empty
7. File ends with newline

```bash
sidstack knowledge validate
```

---

## MCP Tools Used

- `knowledge_list` - List all knowledge docs
- `knowledge_get` - Get single document
- `knowledge_search` - Search knowledge
- `knowledge_context` - Build context for session
- `knowledge_modules` - List modules with stats

## Arguments

`$ARGUMENTS` - Subcommand and arguments as described above. If empty, show overview. If looks like a question, answer it.
