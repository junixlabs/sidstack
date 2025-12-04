# ADR-002: Use Oclif for CLI Framework

**Status:** Accepted
**Date:** 2025-11-21
**Deciders:** Development Team

---

## Context

SidStack needs a robust CLI framework to handle complex command structures, plugin architecture, and provide excellent developer experience. The CLI is the primary interface for users, so the choice of framework significantly impacts usability and extensibility.

### Requirements

- Support for nested commands (e.g., `sidstack task create`)
- Plugin architecture for extensibility
- Auto-generated help documentation
- Argument parsing and validation
- Support for flags and options
- TypeScript-first
- Active maintenance and community

---

## Decision

We will use **Oclif (Open CLI Framework)** for SidStack's CLI.

**Oclif** is a framework for building CLIs in Node.js, created and maintained by Salesforce/Heroku.

---

## Rationale

### 1. Enterprise-Grade
- Used by Heroku CLI, Salesforce CLI
- Battle-tested in production at scale
- Proven reliability

### 2. TypeScript-First
- Written in TypeScript
- Excellent type safety
- Great IDE support

### 3. Plugin Architecture
- Built-in plugin system
- Plugins can add commands
- Perfect for SidStack's extensibility goals

### 4. Auto-Generated Help
- Help documentation auto-generated from code
- Consistent help formatting
- Examples and usage patterns built-in

### 5. Rich Features
- Command hooks (pre-run, post-run)
- Flag parsing with validation
- Spinner and progress indicators
- Colored output
- Auto-completion support

### 6. Active Development
- Regularly updated
- Large community
- Comprehensive documentation

---

## Consequences

### Positive

✅ **Rapid Development**
- Generators for commands
- Boilerplate handled by framework
- Focus on business logic

✅ **Excellent UX**
- Consistent command structure
- Professional help output
- Rich terminal features

✅ **Extensibility**
- Plugin system aligns with SidStack goals
- Users can extend CLI
- Third-party integrations possible

✅ **TypeScript Integration**
- Type-safe command definitions
- Autocomplete in IDE
- Compile-time validation

✅ **Testing Support**
- Built-in testing utilities
- Mock commands easily
- Test flag parsing

### Negative

❌ **Learning Curve**
- More complex than simple CLI libs
- Oclif-specific conventions
- More boilerplate than minimal solutions

❌ **Bundle Size**
- Larger than minimal alternatives
- More dependencies
- Slightly slower startup (acceptable for CLI)

❌ **Opinionated**
- Enforces certain patterns
- Less flexibility than building from scratch

---

## Alternatives Considered

### Option 1: Commander.js

**Pros:**
- Simple and lightweight
- Popular (widely used)
- Easy to learn
- Fast startup

**Cons:**
- No plugin system
- Manual help generation
- Flat command structure
- Not TypeScript-first

**Why rejected:** Lacks plugin architecture, which is critical for SidStack's extensibility goals.

---

### Option 2: Yargs

**Pros:**
- Powerful argument parsing
- Good TypeScript support
- Flexible

**Cons:**
- No plugin system
- Manual command organization
- Less structured than Oclif

**Why rejected:** No built-in plugin system, less structured for complex CLIs.

---

### Option 3: Caporal.js

**Pros:**
- Auto-generated help
- Colored output
- Good for small CLIs

**Cons:**
- Smaller community
- Less active maintenance
- No plugin system
- Not widely adopted

**Why rejected:** Smaller ecosystem, no plugin support.

---

### Option 4: Clap (Go alternative)

**Pros:**
- Excellent performance
- Used by major Go CLIs
- Rich features

**Cons:**
- Would require CLI in Go (conflicts with MCP integration)
- No plugin system (would need custom)
- Loses TypeScript ecosystem

**Why rejected:** Conflicts with ADR-001 (TypeScript for CLI layer).

---

## Implementation Details

### Project Structure

```
packages/cli/
├── src/
│   ├── commands/
│   │   ├── init.ts
│   │   ├── start.ts
│   │   ├── task/
│   │   │   ├── create.ts
│   │   │   ├── list.ts
│   │   │   └── show.ts
│   │   └── ...
│   ├── hooks/
│   │   ├── init.ts
│   │   └── ...
│   └── index.ts
├── package.json
└── tsconfig.json
```

### Example Command

```typescript
import { Command, Flags } from '@oclif/core';

export class TaskCreateCommand extends Command {
  static description = 'Create a new task';

  static examples = [
    '<%= config.bin %> <%= command.id %> --title "Fix bug" --priority 5',
  ];

  static flags = {
    title: Flags.string({
      char: 't',
      description: 'Task title',
      required: true
    }),
    description: Flags.string({
      char: 'd',
      description: 'Task description'
    }),
    priority: Flags.integer({
      char: 'p',
      description: 'Priority (1-5)',
      default: 3
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(TaskCreateCommand);

    // Implementation
    const task = await createTask({
      title: flags.title,
      description: flags.description,
      priority: flags.priority
    });

    this.log(`✓ Created task: ${task.id}`);
  }
}
```

### Plugin Structure

```typescript
// Plugin example
import { Command } from '@oclif/core';

export class MyPluginCommand extends Command {
  static description = 'Custom command from plugin';

  async run(): Promise<void> {
    this.log('Hello from plugin!');
  }
}
```

---

## Risk Mitigation

### Risk: Oclif becomes unmaintained
**Likelihood:** Low (backed by Salesforce)
**Mitigation:**
- Oclif is open-source, can fork if needed
- Large community can maintain
- Core CLI logic is abstracted, can migrate

### Risk: Performance issues
**Likelihood:** Low (CLIs aren't performance-critical)
**Mitigation:**
- CLI startup time acceptable (<500ms)
- Heavy operations delegated to services
- Lazy loading for plugins

### Risk: Learning curve for contributors
**Likelihood:** Medium
**Mitigation:**
- Comprehensive documentation
- Example commands
- Oclif has good official docs

---

## Validation Criteria

After Phase 1:

- [x] All core commands implemented
- [x] Help documentation is clear
- [x] Plugin system works
- [x] CLI startup time <500ms
- [x] Developer can add new command in <30 minutes

If validation fails:
- Evaluate simpler alternatives
- Assess if plugin system is truly needed

---

## References

- [Oclif Documentation](https://oclif.io/)
- [Oclif GitHub](https://github.com/oclif/oclif)
- [Heroku CLI (uses Oclif)](https://github.com/heroku/cli)
- [Salesforce CLI (uses Oclif)](https://github.com/salesforcecli/cli)

---

**Decision Date:** 2025-11-21
**Supersedes:** None
**Superseded by:** None (current)
