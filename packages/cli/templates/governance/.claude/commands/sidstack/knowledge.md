---
name: "SidStack: Knowledge"
description: Search, explore, and build project knowledge
category: core
version: 2.0.0
tags: [sidstack, knowledge, documentation]
---

# SidStack Knowledge

Manage project knowledge documentation.

## /sidstack:knowledge (no args) — Overview

Show knowledge stats:

1. `knowledge_list({ projectPath: "." })`
2. `knowledge_modules({ projectPath: "." })`
3. Display document counts by type and module

## /sidstack:knowledge search <query> — Search

```
knowledge_search({
  projectPath: ".",
  query: "$ARGUMENTS"
})
```

Display results with relevance. Offer to show full document.

## /sidstack:knowledge build — Generate Docs

Interactive knowledge building:

1. Scan project for undocumented areas (APIs, business logic, patterns)
2. Ask which areas to document
3. Generate docs with YAML frontmatter:

```yaml
---
id: unique-identifier
type: business-logic | api-endpoint | design-pattern | database-table | module
title: Human Readable Title
module: module-name
---
```

4. Validate: `sidstack knowledge validate`

## /sidstack:knowledge <question> — Q&A

If input looks like a question (how/what/where/why/show/explain):

1. Search knowledge docs
2. Search codebase with Glob/Grep
3. Provide answer with file references (`file.ts:line`)

**Read-only mode** — cannot modify source code.

## Arguments

`$ARGUMENTS` — Subcommand or question. If empty, show overview.
