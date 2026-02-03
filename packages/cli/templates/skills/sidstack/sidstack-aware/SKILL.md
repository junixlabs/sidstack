---
name: sidstack-aware
description: >
  Use SidStack MCP tools for project management. Trigger when: (1) user asks to
  "check task", "list tasks", or mentions "task" (use task_list), (2) user asks to
  create/add/implement feature (use task_create), (3) working on code changes (use
  task_update with progress), (4) completing work (use task_complete).
---

# SidStack MCP Tools

## Task Management

| Action | Tool | Example |
|--------|------|---------|
| Check tasks | `task_list({projectId: "folder-name"})` | "check task", "what tasks" |
| Create task | `task_create({projectId, title, description})` | "implement X", "add feature" |
| Update progress | `task_update({taskId, progress: 50})` | During implementation |
| Complete | `task_complete({taskId})` | After finishing work |

## Knowledge

| Action | Tool | When |
|--------|------|------|
| Search | `knowledge_search({projectPath: ".", query})` | Before implementing |
| Context | `knowledge_context({projectPath: ".", moduleId})` | Understanding module |

## Impact Analysis

| Action | Tool | When |
|--------|------|------|
| Analyze | `impact_analyze({description})` | Before risky changes |
| Check gate | `impact_check_gate({analysisId})` | After analysis |

## Quick Reference

```
# User says "check task" or "list tasks"
task_list({ projectId: "project-folder-name" })

# User wants to implement something
task_create({
  projectId: "project-folder-name",
  title: "[feature] Description",
  description: "What and why",
  taskType: "feature"
})

# During work - update progress
task_update({ taskId: "xxx", progress: 50, status: "in_progress" })

# Done - complete task
task_complete({ taskId: "xxx" })
```
