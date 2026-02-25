---
id: scan-project
type: skill
title: AI-Powered Knowledge Scan
status: active
owner: all
tags: [knowledge, scan, bootstrap, init]
created: 2026-02-01
updated: 2026-02-08
---

# AI-Powered Knowledge Scan

Automatically analyze a codebase and generate structured knowledge documents in `.sidstack/knowledge/`.

## When to Use

- After `sidstack init --scan` to bootstrap project knowledge
- When onboarding to a new codebase
- To refresh knowledge docs after major changes

---

## Scan Prompt

The following prompt is used when launching Claude Code with `--scan`. Copy this section as the session prompt.

---

You are scanning this project to generate structured knowledge documentation. Your goal is to create `.sidstack/knowledge/` docs that help future Claude sessions understand this codebase quickly.

### Instructions

1. **Explore the project** using Glob, Grep, and Read tools
2. **Generate knowledge docs** using the Write tool
3. **Follow the exact frontmatter format** shown in the templates below
4. **Be concise** - document what matters, skip trivial details
5. **Use today's date** for `created` and `updated` fields

### 9-Folder Structure

Place documents in the appropriate category folder:

| Folder | Purpose | Type |
|--------|---------|------|
| `00-context/` | Vision, glossary, onboarding | Living |
| `01-architecture/` | System design, modules, patterns | Living |
| `02-decisions/` | ADRs, technical decisions | Event |
| `03-standards/` | Coding conventions, naming, testing | Living |
| `04-data/` | Database schema, ownership, retention | Living |
| `05-api/` | API contracts, schemas, versioning | Living |
| `06-operations/` | Deployment, monitoring, rollback | Living |
| `07-projects/` | Project-specific documentation | Event |
| `08-incidents/` | Incident reports, root cause analysis | Event |

### What to Scan

Explore in this order:

#### Phase 1: Project Context (00-context)
- Read `package.json` (or `pyproject.toml`, `Cargo.toml`, etc.)
- Read `README.md` if it exists
- Identify the tech stack, frameworks, and architecture

**Output:** `.sidstack/knowledge/00-context/project-overview.md`

#### Phase 2: Architecture (01-architecture)
- Read `tsconfig.json` / build config
- Glob for source directories (`src/`, `lib/`, `packages/`)
- Identify recurring patterns (adapters, factories, stores, hooks, etc.)
- Document 2-3 most important patterns used in the codebase

**Output:** `.sidstack/knowledge/01-architecture/system-design.md` and `{pattern}-pattern.md`

#### Phase 3: API (05-api, if applicable)
- Grep for route definitions (`Router`, `app.get`, `app.post`, `@Get`, `@Post`, etc.)
- Read route files to understand endpoints
- Document each API group (not every single endpoint - group by resource)

**Output:** `.sidstack/knowledge/05-api/{resource}-api.md` for each major API group

#### Phase 4: Data (04-data, if applicable)
- Grep for CREATE TABLE, schema definitions, model definitions
- Read migration files or schema files
- Document tables with columns, types, relationships

**Output:** `.sidstack/knowledge/04-data/{table}-table.md` for key tables

#### Phase 5: Business Logic (00-context)
- Identify core services, managers, or domain logic
- Read main business logic files
- Document workflows, state machines, key algorithms

**Output:** `.sidstack/knowledge/00-context/{feature}-workflow.md` for each major feature

### Document Templates

#### Project Overview (`00-context/project-overview.md`)

```markdown
---
id: project-overview
type: guide
status: active
tags: [overview, architecture]
created: YYYY-MM-DD
---

# Project Overview

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript/Python/etc. |
| Framework | React/Express/etc. |
| Database | SQLite/PostgreSQL/etc. |
| Build | Vite/Webpack/etc. |

## Directory Layout

project/
├── src/          # Description
├── packages/     # Description
└── ...

## Key Entry Points

- `src/index.ts` - Main entry
- `src/App.tsx` - App root

## Development Commands

npm run dev    # Start dev server
npm run build  # Production build
npm run test   # Run tests
```

#### API Reference (`05-api/{resource}-api.md`)

```markdown
---
id: {resource}-api
type: reference
module: {package-name}
status: active
tags: [api, {resource}]
created: YYYY-MM-DD
---

# {Resource} API

Base path: `/api/{resource}`

## Endpoints

### GET /api/{resource}
List all {resources}.

**Parameters:** projectId (query, optional)
**Response:** `{ items: [...] }`

### POST /api/{resource}
Create a {resource}.

**Body:** `{ title: string, ... }`
**Response:** `{ item: {...} }`

## Code Reference
- `path/to/routes.ts`
```

#### Database Table (`04-data/{table}-table.md`)

```markdown
---
id: {table}-table
type: reference
module: {package-name}
status: active
tags: [database, schema]
created: YYYY-MM-DD
---

# {Table} Table

## Schema

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Unique identifier |
| name | TEXT | Display name |
| created_at | INTEGER | Unix timestamp |

## Relationships
- Has many: {related_table}

## Code Reference
- `path/to/schema.ts`
```

#### Business Logic (`00-context/{feature}-workflow.md`)

```markdown
---
id: {feature-slug}
type: guide
module: {package-name}
status: active
tags: [workflow, {feature}]
created: YYYY-MM-DD
---

# {Feature Name}

## Overview
Brief description of what this does and why it exists.

## How It Works
1. Step one
2. Step two
3. Step three

## Key Rules
- Rule 1
- Rule 2

## Code Reference
- `path/to/implementation.ts` - Main logic
```

#### Design Pattern (`01-architecture/{name}-pattern.md`)

```markdown
---
id: {name}-pattern
type: pattern
status: active
tags: [pattern, {category}]
created: YYYY-MM-DD
---

# {Pattern Name} Pattern

## Purpose
What problem this pattern solves.

## Structure
Brief description of the pattern.

## Where Used
- `path/to/file1.ts` - Usage description
- `path/to/file2.ts` - Usage description
```

### Rules

1. **Don't over-document** - Focus on the 80% that matters. Skip trivial utils, config files, and boilerplate.
2. **Be accurate** - Read the actual code before documenting. Don't guess.
3. **Use relative paths** in Code Reference sections.
4. **Skip empty categories** - If there's no database, don't create `04-data/`.
5. **Max 10-15 docs total** - Quality over quantity. A focused set is more useful than exhaustive coverage.
6. **Frontmatter is mandatory** - Every doc must have the YAML frontmatter block.
7. **Update _README.md** - Each category folder should have a `_README.md` explaining its contents.

### Completion

After scanning, output a summary:
```
Knowledge scan complete:
- X documents created
- Categories: 00-context, 01-architecture, 04-data, 05-api
- Path: .sidstack/knowledge/
```
