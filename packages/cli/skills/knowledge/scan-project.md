---
id: scan-project
type: skill
title: AI-Powered Knowledge Scan
status: active
owner: all
tags: [knowledge, scan, bootstrap, init]
created: 2026-02-01
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

### What to Scan

Explore in this order:

#### Phase 1: Project Structure
- Read `package.json` (or `pyproject.toml`, `Cargo.toml`, etc.)
- Read `README.md` if it exists
- Read `tsconfig.json` / build config
- Glob for source directories (`src/`, `lib/`, `packages/`)
- Identify the tech stack, frameworks, and architecture

**Output:** `.sidstack/knowledge/modules/project-structure.md`

#### Phase 2: API Endpoints (if applicable)
- Grep for route definitions (`Router`, `app.get`, `app.post`, `@Get`, `@Post`, etc.)
- Read route files to understand endpoints
- Document each API group (not every single endpoint - group by resource)

**Output:** `.sidstack/knowledge/api/{resource}-api.md` for each major API group

#### Phase 3: Database Schema (if applicable)
- Grep for CREATE TABLE, schema definitions, model definitions
- Read migration files or schema files
- Document tables with columns, types, relationships

**Output:** `.sidstack/knowledge/database/{table}-table.md` for key tables

#### Phase 4: Business Logic
- Identify core services, managers, or domain logic
- Read main business logic files
- Document workflows, state machines, key algorithms

**Output:** `.sidstack/knowledge/business-logic/{feature}.md` for each major feature

#### Phase 5: Design Patterns
- Identify recurring patterns (adapters, factories, stores, hooks, etc.)
- Document 2-3 most important patterns used in the codebase

**Output:** `.sidstack/knowledge/patterns/{pattern}-pattern.md`

### Document Templates

#### Project Structure (`knowledge/modules/project-structure.md`)

```markdown
---
id: project-structure
type: reference
status: active
tags: [overview, architecture]
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# Project Structure

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript/Python/etc. |
| Framework | React/Express/etc. |
| Database | SQLite/PostgreSQL/etc. |
| Build | Vite/Webpack/etc. |

## Directory Layout

```
project/
├── src/          # Description
├── packages/     # Description
└── ...
```

## Key Entry Points

- `src/index.ts` - Main entry
- `src/App.tsx` - App root

## Development Commands

```bash
npm run dev    # Start dev server
npm run build  # Production build
npm run test   # Run tests
```
```

#### API Reference (`knowledge/api/{resource}-api.md`)

```markdown
---
id: {resource}-api
type: reference
module: {package-name}
status: active
tags: [api, {resource}]
created: YYYY-MM-DD
updated: YYYY-MM-DD
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

#### Database Table (`knowledge/database/{table}-table.md`)

```markdown
---
id: {table}-table
type: reference
module: {package-name}
status: active
tags: [database, schema]
created: YYYY-MM-DD
updated: YYYY-MM-DD
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

#### Business Logic (`knowledge/business-logic/{feature}.md`)

```markdown
---
id: {feature-slug}
type: reference
module: {package-name}
status: active
tags: [business-logic, {feature}]
created: YYYY-MM-DD
updated: YYYY-MM-DD
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

#### Design Pattern (`knowledge/patterns/{name}-pattern.md`)

```markdown
---
id: {name}-pattern
type: reference
status: active
tags: [pattern, {category}]
created: YYYY-MM-DD
updated: YYYY-MM-DD
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

### Index Files

Create `_index.md` in each folder:

```markdown
---
id: {category}-index
type: index
status: active
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# {Category} Knowledge

| Document | Description |
|----------|-------------|
| [doc-1](doc-1.md) | Brief description |
| [doc-2](doc-2.md) | Brief description |
```

### Rules

1. **Don't over-document** - Focus on the 80% that matters. Skip trivial utils, config files, and boilerplate.
2. **Be accurate** - Read the actual code before documenting. Don't guess.
3. **Use relative paths** in Code Reference sections.
4. **Skip empty categories** - If there's no database, don't create `knowledge/database/`.
5. **Max 10-15 docs total** - Quality over quantity. A focused set is more useful than exhaustive coverage.
6. **Frontmatter is mandatory** - Every doc must have the YAML frontmatter block.
7. **Update _index.md** - Always create/update the index for each category you populate.

### Completion

After scanning, output a summary:
```
Knowledge scan complete:
- X documents created
- Categories: api, database, business-logic, patterns, modules
- Path: .sidstack/knowledge/
```
