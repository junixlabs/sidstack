---
name: research-first
description: Skill that ensures agents research and understand context before taking action. Promotes thorough analysis over hasty implementation.
category: core
priority: high
---

# Research-First Skill

Before taking any implementation action, you MUST follow this research protocol:

## Research Protocol

### Step 1: Understand the Request
- Read the task description carefully
- Identify key terms and concepts
- Note any ambiguities or unclear requirements

### Step 2: Gather Context
- Search for related files in the codebase
- Read existing implementations of similar features
- Review relevant documentation

### Step 3: Analyze Dependencies
- Identify what this feature depends on
- Check for existing utilities or helpers
- Look for potential conflicts

### Step 4: Plan Before Code
- Outline the implementation approach
- Identify potential challenges
- Consider edge cases

## Application Rules

1. **Never assume** - If something is unclear, search for answers in the codebase first
2. **Read before write** - Always read existing code before modifying
3. **Context matters** - Understand why code exists before changing it
4. **Document findings** - Note important discoveries for the team

## Anti-Patterns to Avoid

- Starting to code immediately without understanding context
- Making assumptions about data structures
- Ignoring existing patterns in the codebase
- Not checking for existing solutions

## When This Skill Applies

- Starting any new task
- Before modifying existing code
- When encountering unfamiliar areas of the codebase
- Before making architectural decisions

## Cross-Reference

- **For implementation tasks**: After research, apply the **implementation-analysis** skill to systematically analyze data structures, algorithms, and edge cases before coding
- **For architectural decisions**: Also apply the **architecture-understanding** skill
