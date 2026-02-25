# SidStack Skill Test Suite

Test framework for validating Claude Code skills.

## Directory Structure

```
tests/skills/
├── capability/      # Test new functionality
├── regression/      # Prevent breakage of working features
├── activation/      # Test trigger accuracy
└── README.md
```

## Test Types

### Capability Tests
Test what the skill should be able to do.
- Happy path scenarios
- Edge cases
- Complex workflows

### Regression Tests
Ensure previously working features stay working.
- Basic functionality
- Known bug fixes
- Critical paths

### Activation Tests
Test when skills should/shouldn't trigger.
- Should trigger (various phrasings)
- Should NOT trigger (false positives)
- Direct invocation (/skill-name)

## Test Case Format

```json
{
  "id": "test-unique-id",
  "skill": "skill-name",
  "type": "capability|regression|activation",
  "description": "What this test verifies",
  "input": {
    "prompt": "User message that triggers the test",
    "context": {
      "files": ["path/to/file.ts"],
      "taskId": "optional-task-id"
    }
  },
  "expected": {
    "activation": true|false,
    "keywords": ["expected", "output", "keywords"],
    "tools_called": ["tool1", "tool2"],
    "output_format": "markdown|json|table"
  },
  "tags": ["security", "core", "edge-case"]
}
```

## Running Tests

### Manual Testing Protocol

1. Start fresh Claude Code session
2. Load test case prompt
3. Observe:
   - Did skill activate?
   - Was output format correct?
   - Were expected tools called?
4. Record PASS/FAIL with notes

### Automated Validation (Future)

```bash
# Planned: Automated test runner
pnpm test:skills --type capability
pnpm test:skills --skill sidstack-aware
```

## Evaluation Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Activation Rate | >84% | TBD |
| False Positive Rate | <10% | TBD |
| Output Consistency | >90% | TBD |
| Cross-model Parity | >85% | TBD |
