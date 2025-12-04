---
name: documentation-standards
description: Optional skill for maintaining consistent documentation standards across the codebase.
category: optional
priority: medium
---

# Documentation Standards Skill

Maintain consistent, useful documentation throughout the codebase.

## Documentation Types

### 1. Code Comments

**When to Comment**:
- Complex algorithms or business logic
- Non-obvious decisions (with "why" not "what")
- Workarounds or temporary fixes
- Public API interfaces

**When NOT to Comment**:
- Self-explanatory code
- Restating what code does
- Commented-out code (delete it)

```typescript
// Bad - restates the obvious
// Increment counter by 1
counter++;

// Good - explains why
// Rate limit: max 100 requests per minute per user
if (requestCount > 100) {
  throw new RateLimitError();
}

// Good - documents non-obvious behavior
// Using floor instead of round to ensure we never exceed budget
const allocatedTokens = Math.floor(budget / tokenCost);
```

### 2. Function Documentation

**JSDoc Format**:
```typescript
/**
 * Creates a new user account with email verification.
 *
 * @param input - User registration data
 * @returns Created user with pending verification status
 * @throws {ValidationError} When email format is invalid
 * @throws {DuplicateError} When email already exists
 *
 * @example
 * ```typescript
 * const user = await createUser({
 *   email: 'user@example.com',
 *   name: 'John Doe'
 * });
 * console.log(user.verificationStatus); // 'pending'
 * ```
 */
async function createUser(input: CreateUserInput): Promise<User> {
  // implementation
}
```

### 3. Type Documentation

```typescript
/**
 * Represents a user in the system.
 *
 * @remarks
 * Users are created with 'pending' status and must verify
 * their email before accessing protected resources.
 */
interface User {
  /** Unique identifier (UUID v4) */
  id: string;

  /** Email address (must be unique across all users) */
  email: string;

  /** Display name (1-100 characters) */
  name: string;

  /** Account verification status */
  status: 'pending' | 'active' | 'suspended';

  /** ISO 8601 timestamp of account creation */
  createdAt: string;
}
```

### 4. README Documentation

**Project README Structure**:
```markdown
# Project Name

Brief description of what this project does.

## Quick Start

\`\`\`bash
# Installation
npm install

# Run development
npm run dev

# Run tests
npm test
\`\`\`

## Features

- Feature 1: Brief description
- Feature 2: Brief description

## Architecture

Brief overview of the system architecture.

## API Reference

Link to detailed API docs or brief overview.

## Contributing

Guidelines for contributing to this project.
```

### 5. API Documentation

**OpenAPI/Swagger for REST APIs**:
```yaml
paths:
  /users:
    post:
      summary: Create a new user
      description: |
        Creates a new user account. The user will receive
        a verification email at the provided address.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserInput'
            example:
              email: "user@example.com"
              name: "John Doe"
      responses:
        '201':
          description: User created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '400':
          description: Invalid input
        '409':
          description: Email already exists
```

## Documentation Workflow

### When Creating New Code
1. Write type definitions with JSDoc
2. Add function documentation
3. Include usage examples
4. Update README if adding features

### When Modifying Code
1. Update affected documentation
2. Remove outdated comments
3. Add explanation for changes if non-obvious

### When Reviewing Code
- Check that public APIs are documented
- Verify examples still work
- Ensure complex logic is explained

## Anti-Patterns

❌ **Stale documentation** - Worse than no documentation
❌ **Over-documentation** - Comments on every line
❌ **Under-documentation** - No docs on public APIs
❌ **Copy-paste documentation** - Same text everywhere

## Best Practices

1. **Keep docs close to code** - Inline JSDoc over separate files
2. **Use examples** - Show, don't just tell
3. **Document behavior** - What happens, not how
4. **Update with code** - Treat docs as part of the change
5. **Use tools** - TypeDoc, Swagger, etc.

## Checklist Before Completing Task

- [ ] Public functions have JSDoc comments
- [ ] Complex logic is explained
- [ ] Types are documented
- [ ] README updated if needed
- [ ] Examples provided where helpful
- [ ] No stale/outdated documentation
