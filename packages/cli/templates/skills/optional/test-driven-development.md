---
name: test-driven-development
description: Optional skill for implementing features using TDD methodology. Write tests first, then implement.
category: optional
priority: medium
---

# Test-Driven Development (TDD) Skill

Implement features using the Red-Green-Refactor cycle.

## TDD Cycle

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│    ┌─────────┐                                      │
│    │  RED    │  Write a failing test                │
│    └────┬────┘                                      │
│         │                                           │
│         ▼                                           │
│    ┌─────────┐                                      │
│    │ GREEN   │  Write minimum code to pass         │
│    └────┬────┘                                      │
│         │                                           │
│         ▼                                           │
│    ┌─────────┐                                      │
│    │REFACTOR │  Improve code, keep tests green     │
│    └────┬────┘                                      │
│         │                                           │
│         └──────────────► Repeat                     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## TDD Workflow

### Step 1: RED - Write Failing Test

```typescript
// tests/user.service.test.ts
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with valid email', async () => {
      const service = new UserService(mockRepo);

      const user = await service.createUser({
        email: 'test@example.com',
        name: 'Test User'
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
    });

    it('should throw error for invalid email', async () => {
      const service = new UserService(mockRepo);

      await expect(
        service.createUser({ email: 'invalid', name: 'Test' })
      ).rejects.toThrow('Invalid email format');
    });
  });
});
```

Run test - it should FAIL (class doesn't exist yet).

### Step 2: GREEN - Implement Minimum Code

```typescript
// src/services/user.service.ts
export class UserService {
  constructor(private repo: UserRepository) {}

  async createUser(input: CreateUserInput): Promise<User> {
    if (!this.isValidEmail(input.email)) {
      throw new Error('Invalid email format');
    }

    return this.repo.create({
      id: generateId(),
      email: input.email,
      name: input.name,
    });
  }

  private isValidEmail(email: string): boolean {
    return email.includes('@') && email.includes('.');
  }
}
```

Run test - it should PASS.

### Step 3: REFACTOR - Improve Code

```typescript
// src/services/user.service.ts
import { z } from 'zod';

const emailSchema = z.string().email();

export class UserService {
  constructor(private repo: UserRepository) {}

  async createUser(input: CreateUserInput): Promise<User> {
    this.validateEmail(input.email);

    return this.repo.create({
      id: generateId(),
      ...input,
    });
  }

  private validateEmail(email: string): void {
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      throw new ValidationError('Invalid email format');
    }
  }
}
```

Run test - should still PASS.

## TDD Best Practices

### Write Tests First
- Think about the interface before implementation
- Tests define the expected behavior
- Implementation follows the contract

### One Test at a Time
- Write one failing test
- Make it pass
- Refactor
- Repeat

### Test Behavior, Not Implementation
```typescript
// Good - tests behavior
it('should return user by email', async () => {
  const user = await service.findByEmail('test@example.com');
  expect(user.email).toBe('test@example.com');
});

// Bad - tests implementation
it('should call repository findOne method', async () => {
  await service.findByEmail('test@example.com');
  expect(mockRepo.findOne).toHaveBeenCalled();
});
```

### Keep Tests Fast
- Mock external dependencies
- Use in-memory databases for integration tests
- Parallelize test execution

### Arrange-Act-Assert Pattern
```typescript
it('should update user name', async () => {
  // Arrange
  const existingUser = { id: '1', name: 'Old Name', email: 'test@example.com' };
  mockRepo.findById.mockResolvedValue(existingUser);

  // Act
  const updated = await service.updateName('1', 'New Name');

  // Assert
  expect(updated.name).toBe('New Name');
  expect(mockRepo.update).toHaveBeenCalledWith('1', { name: 'New Name' });
});
```

## When to Use TDD

✅ **Good for**:
- New features with clear requirements
- Bug fixes (write test that reproduces bug first)
- Refactoring (tests ensure behavior preservation)
- Complex business logic

⚠️ **Consider alternatives for**:
- Exploratory/prototype code
- UI components (use visual testing)
- Simple CRUD operations
- Integration with external APIs (mock first)

## TDD in Multi-Agent System

When working with other agents:
1. Share test files as specifications
2. Reviewer agent can verify test coverage
3. Tests serve as acceptance criteria
4. Other workers can understand expected behavior from tests
