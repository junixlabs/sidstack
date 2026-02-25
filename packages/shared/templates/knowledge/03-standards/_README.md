# Standards

Explicit engineering rules. Written as enforceable statements.

Every statement should be verifiable as pass/fail.

## What Belongs Here

- Coding conventions
- Error handling rules
- Logging standards
- HTTP client policy
- Testing requirements
- Security rules
- Definition of Done

## Writing Rule

Use imperative MUST/SHOULD/MAY statements:

```markdown
- All outbound HTTP requests MUST use the shared HTTP factory.
- Connection timeout MUST be set to 30 seconds.
- Retry logic MUST NOT exceed 3 attempts.
```

## Naming Convention

Descriptive names, no date prefix (living docs).

```
coding-conventions.md
error-handling.md
security-rules.md
```
