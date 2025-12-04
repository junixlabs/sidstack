# Skill: Governance Compliance

This skill ensures agents follow the SidStack governance system.

## Governance Location

All governance documents are in `.sidstack/`:

```
.sidstack/
├── governance.md           # Master overview (READ FIRST)
├── principles/             # Rules you MUST follow
│   ├── code-quality.md     # Code standards
│   ├── testing.md          # Testing requirements
│   ├── security.md         # Security rules
│   └── collaboration.md    # Multi-agent work
├── skills/                 # Step-by-step guides
│   ├── capabilities/       # Capability-based skills
│   │   ├── implement/      # Implementation skills
│   │   ├── design/         # Design skills
│   │   ├── test/           # Testing skills
│   │   ├── review/         # Review skills
│   │   └── deploy/         # Deployment skills
│   └── shared/             # All agents
└── workflows/              # End-to-end processes
```

## Startup Protocol

**BEFORE starting any task, you MUST:**

1. **Read applicable principles:**
   ```bash
   # Read all principles (always applies)
   Read .sidstack/principles/code-quality.md
   Read .sidstack/principles/testing.md
   Read .sidstack/principles/security.md
   Read .sidstack/principles/collaboration.md
   ```

2. **Identify your role's capabilities:**
   - Worker agent → `.sidstack/skills/capabilities/implement/`, `/design/`, `/test/`
   - Reviewer agent → `.sidstack/skills/capabilities/review/`
   - All agents → `.sidstack/skills/shared/`

3. **For new features, follow workflow:**
   ```bash
   Read .sidstack/workflows/new-feature.md
   ```

## Task Execution Protocol

### Step 1: Select Capability Skill
Based on task type, select appropriate capability skill:

| Task Type | Skill File |
|-----------|------------|
| Implement feature | `.sidstack/skills/capabilities/implement/feature.md` |
| Fix bug | `.sidstack/skills/capabilities/implement/bugfix.md` |
| Refactor code | `.sidstack/skills/capabilities/implement/refactor.md` |
| Design system | `.sidstack/skills/capabilities/design/architecture.md` |
| Design database | `.sidstack/skills/capabilities/design/database.md` |
| Write tests | `.sidstack/skills/capabilities/test/unit.md` |
| Code review | `.sidstack/skills/capabilities/review/code.md` |
| Security audit | `.sidstack/skills/capabilities/review/security.md` |
| Any handoff | `.sidstack/skills/shared/handoff-simple.md` |

### Step 2: Follow Skill Steps
Execute each step in the skill document in order. Do not skip steps.

### Step 3: Apply Quality Gates
Before marking task complete:

```bash
# Run quality checks
pnpm typecheck    # Must pass with 0 errors
pnpm lint         # Must pass with 0 errors
pnpm test         # All tests must pass
```

### Step 4: Complete Handoff
Use the simplified handoff template from `.sidstack/skills/shared/handoff-simple.md`

## Principle Compliance Checklist

### Code Quality (Always)
- [ ] No `any` types (TypeScript)
- [ ] Explicit return types
- [ ] Functions < 40 lines
- [ ] Proper error handling
- [ ] No magic numbers

### Testing (Always)
- [ ] Tests for new code
- [ ] Tests cover edge cases
- [ ] All tests passing

### Security (Always)
- [ ] No hardcoded secrets
- [ ] Input validation
- [ ] Parameterized queries
- [ ] No sensitive data in logs

### Collaboration (Multi-agent)
- [ ] File locks acquired before edit
- [ ] Structured handoff provided
- [ ] Status reported to orchestrator

## Violations

If you violate any principle:
1. Stop immediately
2. Fix the violation
3. Re-run quality checks
4. Do NOT proceed until compliant

## Quick Reference

```bash
# Read governance overview
cat .sidstack/governance.md

# Read specific principle
cat .sidstack/principles/code-quality.md

# Read capability skill
cat .sidstack/skills/capabilities/implement/feature.md

# Check workflow
cat .sidstack/workflows/new-feature.md
```
