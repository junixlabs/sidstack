---
name: sidstack-aware
description: Use SidStack MCP tools for project management. Automatically apply when working on code changes, tasks, or needing project context.
user-invocable: false
---

# SidStack Integration

You have access to SidStack MCP tools. Use them when appropriate:

## Task Management

- `task_list({projectId, preset: "actionable"})` — see current work
- `task_create({title, description, projectId})` — track new work
- `task_update({taskId, progress, status})` — report progress at milestones (30%, 60%, 90%)
- `task_complete({taskId})` — finish with quality gate check

## Knowledge

- `knowledge_search({projectPath, query})` — find patterns, decisions, business logic
- `knowledge_context({projectPath, moduleId})` — get context for a module

## Impact Analysis

- `impact_analyze({description})` — assess risk before significant changes
- `impact_check_gate({analysisId})` — check if safe to proceed

## When to Use

- **Starting implementation?** → `knowledge_search` first to find existing patterns
- **Changing core modules?** → `impact_analyze` first to assess risk
- **Working on task?** → `task_update(progress)` at milestones
- **Completing work?** → `task_complete` to run quality gates

## Tool Reference

| Category | Tools |
|----------|-------|
| Tasks | `task_list`, `task_create`, `task_update`, `task_complete`, `task_get` |
| Knowledge | `knowledge_list`, `knowledge_get`, `knowledge_search`, `knowledge_context` |
| Impact | `impact_analyze`, `impact_check_gate`, `impact_list` |
| Tickets | `ticket_list`, `ticket_create`, `ticket_update`, `ticket_convert_to_task` |
| Training | `lesson_create`, `skill_create`, `rule_check` |
| Sessions | `session_launch` |
