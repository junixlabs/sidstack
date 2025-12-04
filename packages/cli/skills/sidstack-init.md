# SidStack Init Skill

## Purpose
Guide intelligent analysis and module setup for new SidStack projects.

## Philosophy

**Analysis-First, Not Prescription-First**

Don't follow a rigid checklist. Instead:
- Understand the project's architecture deeply
- Map logical boundaries, not just folder structure
- Create modules that reflect how developers think about the codebase

## When to Use
- User asks to initialize SidStack
- New project without `.sidstack/` directory
- User wants to set up knowledge and governance

## Pre-Check: SidStack Installation

**IMPORTANT:** Before creating modules, check if SidStack is initialized:

```bash
ls -la .sidstack/ 2>/dev/null || echo "NOT_INITIALIZED"
```

**If NOT_INITIALIZED:**
1. Ask user: "SidStack is not initialized. Would you like to run `sidstack init` for full setup (skills, governance, knowledge templates)?"
2. If yes → Run `sidstack init` first
3. If no → Just create `.sidstack/modules/` and proceed

**Why this matters:**
- `sidstack init` creates the full structure: skills, governance, knowledge templates
- Module-only setup works but misses other SidStack features
- User should make an informed choice

## Analysis Approach

### 1. Understand the Tech Stack
- Read `package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, etc.
- Identify primary language(s) and frameworks
- Note build tools and package managers

### 2. Explore Architecture Patterns
- Is this a monorepo? Modular monolith? Microservices?
- Are there workspace packages? Feature folders? Domain-driven structure?
- What naming conventions are used?

### 3. Map Code Relationships
- Trace import/export patterns
- Identify shared code and utilities
- Find service boundaries and integration points
- Note which parts depend on which

### 4. Identify Logical Modules
Think about:
- What would a developer call this part of the codebase?
- If you had to assign ownership, how would you divide it?
- What changes together? What has independent release cycles?

Good module boundaries:
- **Feature areas** (auth, payments, notifications)
- **Service layers** (api, database, cache)
- **Shared concerns** (utils, types, config)
- **Package boundaries** in monorepos

Bad module boundaries:
- One module per folder (too granular)
- Everything in one module (too coarse)
- Modules based on file type (models/, controllers/)

## Creating Module Files

After analysis, create `.sidstack/modules/{id}.yaml`:

```yaml
id: module-id
name: Human Readable Name
description: |
  What this module owns and why it exists.
  Include key responsibilities and boundaries.
status: active  # active | planned | deprecated

dependencies:
  - shared        # Based on actual import analysis
  - database

tech:
  languages: [TypeScript, Rust]
  frameworks: [React, Tauri]
  databases: [SQLite]

paths:
  source:
    - src/features/module-name/
    - packages/module-name/
  tests:
    - tests/module-name/

# Optional: API endpoints if applicable
api:
  endpoints:
    - GET /api/resource
    - POST /api/resource
```

## Validation

Always validate after creating modules:

```bash
./packages/cli/bin/run.js module validate
```

Fix any errors before proceeding. Common issues:
- `id` doesn't match filename
- Missing required fields
- Circular dependencies
- Invalid YAML syntax

## Output Quality

### Good Module Descriptions
> "Manages user authentication and session lifecycle. Owns JWT token generation, password hashing, OAuth integrations, and session storage. Consumed by API routes that require authenticated access."

### Bad Module Descriptions
> "Contains auth files" (too vague)
> "src/auth folder" (just restating the path)

### Good Dependency Mapping
Based on actual `import` statements, not assumptions.

### Bad Dependency Mapping
"Everything depends on shared" without verifying imports.

## Knowledge Opportunities

During analysis, identify content better suited as **knowledge documents**:

| Type | Examples | Directory |
|------|----------|-----------|
| Business Logic | Domain rules, workflows, state machines | `business-logic/` |
| API Docs | Endpoints, schemas, authentication | `api/` |
| Patterns | Architecture decisions, conventions | `patterns/` |
| Infrastructure | Deployment, CI/CD, Docker | `infrastructure/` |
| Module Deep Dives | Complex module internals | `modules/` |

**When you find such content**, ask user:
> "I noticed [X] which might be better as a knowledge document. Create it?"

Knowledge documents go in `.sidstack/knowledge/[category]/`.

## First Task Offer

After creating modules, offer to help with the first task:

> "Would you like me to help create your first task? I can suggest based on:
> - TODOs/FIXMEs found in code
> - Potential improvements I noticed
> - A task you have in mind"

Use MCP `task_create` if user wants a task.

## After Setup

### Quick Reference
Show keyboard shortcuts in a friendly way:
- **⌘1** Project Hub - See your project overview
- **⌘2** Task Manager - Track your work
- **⌘3** Knowledge - Browse documentation
- **⌘4** Ticket Queue - Manage tickets
- **⌘5** Training Room - Lessons and rules

### Recommended Next Steps
Based on project analysis, suggest 2-3 specific actions:
1. Most important module to work on first
2. Knowledge gaps worth documenting
3. Quick wins you noticed during analysis

## Example Summary Output

```
# SidStack Setup Complete

## Project Analysis

- **Type**: TypeScript monorepo with React frontend and Express backend
- **Structure**: 3 workspace packages + shared utilities
- **Key patterns**: Feature-based folder structure, shared types package

## Created Modules (7)

| Module | Description | Dependencies |
|--------|-------------|--------------|
| frontend | React SPA with routing and state management | shared, api-client |
| api-server | Express REST API with middleware | shared, database |
| database | Prisma ORM with PostgreSQL | shared |
| shared | TypeScript types and utilities | - |
| auth | JWT authentication and OAuth | shared, database |
| notifications | Email and push notification service | shared, database |
| api-client | Generated API client for frontend | shared |

## Dependency Graph

frontend → api-client → (external API)
api-server → database → (PostgreSQL)
        ↓
      auth → database
        ↓
  notifications

## Recommended Next Steps

Based on this project structure:
1. The `shared` module has no tests - consider adding type tests
2. `auth` and `api-server` are tightly coupled - consider extracting auth middleware
3. `notifications` could be made async with a queue

Open the Project Hub to see the capability tree.
```
