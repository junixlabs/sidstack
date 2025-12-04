# Skill: Research First

**ID:** research-first
**Created:** 2025-12-06
**Type:** core
**Applies To:** All agents (DEV, BA, QA, DA)

## When to Apply

Apply this skill when:
- Starting any new task
- Working on unfamiliar code
- Implementing new features
- Making changes to existing features

## Rule

**BEFORE implementing ANYTHING, you MUST:**

1. **Read README.md** of project/module
2. **Read CLAUDE.md** if exists (project conventions)
3. **Find docs** in `docs/` folder related to task
4. **Read specs** in `.claude/specs/` if exists

## Workflow

```bash
# Step 1: Find relevant documentation
Glob({ pattern: "**/README.md" })
Glob({ pattern: "**/CLAUDE.md" })
Glob({ pattern: "docs/**/*.md" })
Glob({ pattern: ".claude/specs/**/*.md" })

# Step 2: Read docs found
Read({ file_path: "docs/API_DESIGN.md" })
Read({ file_path: "CLAUDE.md" })

# Step 3: NOW implement
```

## Example

**Task:** "Call graph API to get nodes"

### WRONG (guessing):

```javascript
fetch('/api/graph')  // 404 error!
fetch('/api/nodes')  // 404 error!
```

### CORRECT (research first):

```bash
# 1. Find API docs
Glob({ pattern: "docs/*API*.md" })
# → Found: docs/API_DESIGN.md

# 2. Read docs
Read({ file_path: "docs/API_DESIGN.md" })
# → Found: GET /api/graph/overview

# 3. Use correct endpoint
fetch('/api/graph/overview')  // Success!
```

## Anti-patterns

- Assuming endpoint paths
- Starting to code without reading docs
- Making changes without understanding context
- Guessing function names or parameters

## Benefits

- Fewer 404 errors
- Faster implementation (less trial-and-error)
- Better code quality (follows existing patterns)
- Less token usage (get it right first time)
