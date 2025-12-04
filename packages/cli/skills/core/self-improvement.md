# Skill: Self-Improvement

**ID:** self-improvement
**Created:** 2025-12-06
**Type:** core
**Applies To:** All agents (Worker, Reviewer)

## When to Apply

Apply this skill when:
- You encounter an error
- You find a bug
- You learn something important about the codebase
- You discover a pattern that other agents should know

## Rule

**When you encounter a mistake, learn and record:**

1. **Analyze root cause** - Why did the error happen
2. **Create a lesson** - So future agents avoid same mistake
3. **Update approach** - Change how you work

## Workflow

```bash
# 1. Got error
fetch('/api/tasks')  // 404

# 2. Analyze
# -> Error caused by guessing endpoint instead of researching

# 3. Record to prevent repeat
lesson_create({
  moduleId: "api-server",
  title: "Always verify API endpoints before calling",
  problem: "Guessed endpoint path, got 404",
  rootCause: "Did not grep source to find correct endpoint paths",
  solution: "Always grep source to find correct endpoint paths before calling"
})

# 4. Change approach
# From now: Grep first, call later
Grep({ pattern: "router\\.get.*tasks" })
# Then call correct endpoint
```

## Lesson Types

| Type | When to Use |
|------|-------------|
| Pattern error | For recurring mistakes to prevent |
| Security issue | For vulnerabilities found during work |
| Architecture decision | For important choices and rationale |
| Performance insight | For optimization discoveries |

## Anti-patterns

- Repeating the same mistakes
- Not documenting learnings
- Keeping knowledge only in your context
- Ignoring errors without understanding why

## Benefits

- Collective learning across all agents
- Fewer repeated mistakes
- Better decision documentation
- Continuous improvement of agent skills
