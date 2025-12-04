# SidStack Claude Training Walkthrough

Interactive training scenarios using MCP tools. Claude can use these to learn SidStack step-by-step.

---

## Module 1: Task Management Basics

### Lesson: Create and Track a Task

**Step 1 - List existing tasks:**
```
task_list({ projectId: "your-project" })
```
Expected: Empty list or existing tasks.

**Step 2 - Create a task:**
```
task_create({
  projectId: "your-project",
  title: "Add user avatar upload",
  description: "Allow users to upload and display profile avatars",
  taskType: "feature",
  priority: "medium"
})
```
Expected: Returns task with ID.

**Step 3 - Start working:**
```
task_update({
  taskId: "<task-id>",
  status: "in_progress",
  progress: 0
})
```

**Step 4 - Track progress:**
```
task_update({ taskId: "<task-id>", progress: 50, notes: "API endpoint done, working on UI" })
```

**Step 5 - Complete:**
```
task_update({ taskId: "<task-id>", status: "completed", progress: 100 })
```

### Practice Exercise
Create a task for "Fix navbar alignment on mobile", mark it in-progress, update to 50%, then complete it.

---

## Module 2: Training Room

### Lesson: Record an Incident and Create a Lesson

**Step 1 - Create incident:**
```
incident_create({
  title: "SQL injection in search endpoint",
  description: "User input was concatenated directly into SQL query",
  type: "mistake",
  severity: "high",
  module: "api-server"
})
```

**Step 2 - Create lesson from incident:**
```
lesson_create({
  title: "Always use parameterized queries",
  description: "Never concatenate user input into SQL. Use prepared statements or ORM methods.",
  incidentId: "<incident-id>",
  applicability: "project-wide",
  tags: ["security", "sql", "input-validation"]
})
```

**Step 3 - Create a skill:**
```
skill_create({
  title: "Secure Database Query Checklist",
  type: "checklist",
  description: "Steps to ensure database queries are safe",
  steps: [
    "Use parameterized queries or ORM",
    "Validate input types before query",
    "Limit result set size",
    "Log query patterns (not values)"
  ]
})
```

**Step 4 - Create enforcement rule:**
```
rule_create({
  title: "No raw SQL string concatenation",
  description: "All database queries MUST use parameterized queries",
  level: "must",
  enforcement: "error",
  pattern: "sql.*concat|\\+ .*query|`\\$\\{.*\\}`.*SELECT",
  module: "api-server"
})
```

### Practice Exercise
Record an incident about a CORS misconfiguration, create a lesson about it, then create a rule to prevent it.

---

## Module 3: Impact Analysis

### Lesson: Analyze Before Implementing Risky Changes

**Step 1 - Run analysis:**
```
impact_analyze({
  description: "Refactor authentication from session-based to JWT tokens",
  taskId: "<task-id>"
})
```

**Step 2 - Check gate status:**
```
impact_check_gate({ analysisId: "<analysis-id>" })
```
Expected: `blocked`, `warning`, or `clear`.

**Step 3 - If blocked, review risks:**
```
impact_get_context({ analysisId: "<analysis-id>" })
```

**Step 4 - Resolve and approve:**
```
impact_approve_gate({
  analysisId: "<analysis-id>",
  approver: "user",
  reason: "Reviewed all risks, mitigation plan in place"
})
```

### Practice Exercise
Analyze the impact of "Add rate limiting to all API endpoints" and work through the gate system.

---

## Module 4: Knowledge System

### Lesson: Build and Query Project Knowledge

**Step 1 - List knowledge:**
```
knowledge_list({ projectPath: "/path/to/project" })
```

**Step 2 - Search:**
```
knowledge_search({ projectPath: "/path/to/project", query: "authentication" })
```

**Step 3 - Build context for a task:**
```
knowledge_context({
  projectPath: "/path/to/project",
  taskId: "<task-id>",
  format: "claude"
})
```

**Step 4 - List modules with stats:**
```
knowledge_modules({ projectPath: "/path/to/project" })
```

### Practice Exercise
Search for knowledge about "database" patterns and build context for a data migration task.

---

## Module 5: Session Management

### Lesson: Launch and Track Claude Sessions

**Step 1 - Launch session:**
```
session_launch({
  workspacePath: "/path/to/project",
  taskId: "<task-id>",
  prompt: "Fix the navbar alignment bug on mobile devices. Check src/components/Navbar.tsx"
})
```

**Step 2 - List active sessions:**
```
session_list({ workspacePath: "/path/to/project", status: ["active"] })
```

**Step 3 - Get session stats:**
```
session_stats({ workspacePath: "/path/to/project" })
```

### Practice Exercise
Launch a session for a code review task and track its progress.

---

## Module 6: Full Workflow

### Lesson: End-to-End Feature Development

This combines all modules into a complete workflow:

**1. Receive ticket:**
```
ticket_create({
  projectId: "your-project",
  title: "Add dark mode support",
  type: "feature",
  priority: "medium",
  source: "manual"
})
```

**2. Review and approve:**
```
ticket_update({ ticketId: "<ticket-id>", status: "approved" })
```

**3. Convert to task:**
```
ticket_convert_to_task({ ticketId: "<ticket-id>" })
```

**4. Run impact analysis:**
```
impact_analyze({ taskId: "<task-id>", description: "Add dark mode with theme toggle" })
```

**5. Check training context:**
```
training_context_get({ projectId: "your-project" })
```

**6. Build knowledge context:**
```
knowledge_context({ projectPath: "/path/to/project", taskId: "<task-id>" })
```

**7. Implement (task in-progress):**
```
task_update({ taskId: "<task-id>", status: "in_progress", progress: 0 })
```

**8. Track progress:**
```
task_update({ taskId: "<task-id>", progress: 50, notes: "Theme system done" })
task_update({ taskId: "<task-id>", progress: 80, notes: "Toggle UI done" })
```

**9. Quality gates:**
Run typecheck, lint, test.

**10. Complete:**
```
task_update({ taskId: "<task-id>", status: "completed", progress: 100 })
```

**11. Log lesson (if applicable):**
```
lesson_create({ title: "CSS variables for theming", ... })
```

---

## Completion

After completing all 6 modules, you understand:
- Task lifecycle management
- Training room (incidents → lessons → skills → rules)
- Impact analysis and gate system
- Knowledge system for project context
- Session management for parallel work
- End-to-end workflow from ticket to completion
