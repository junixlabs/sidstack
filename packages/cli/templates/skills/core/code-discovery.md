---
name: code-discovery
description: Skill for efficiently navigating and understanding codebases. Enables systematic exploration of code structure and patterns.
category: core
priority: high
---

# Code Discovery Skill

Systematic approach to exploring and understanding codebases.

## Discovery Techniques

### 1. Entry Point Analysis
- Find main entry points (main.ts, index.ts, app.ts)
- Trace execution flow from entry
- Identify initialization patterns

### 2. Structure Mapping
```
Use these patterns to map the codebase:

# Find all TypeScript/JavaScript files
Glob: **/*.{ts,tsx,js,jsx}

# Find configuration files
Glob: **/*.{json,yaml,yml,toml}

# Find test files
Glob: **/*.{test,spec}.{ts,tsx,js,jsx}

# Find type definitions
Glob: **/*.d.ts
```

### 3. Pattern Recognition
Look for these common patterns:
- **Controllers/Handlers**: Files ending in `.controller.ts`, `.handler.ts`
- **Services**: Files ending in `.service.ts`
- **Repositories**: Files ending in `.repository.ts`
- **Models**: Files in `models/`, `entities/`, or `types/`
- **Utils**: Files in `utils/`, `helpers/`, `lib/`

### 4. Dependency Tracing
```
# Find all imports of a module
Grep: from ['"].*moduleName['"]

# Find all usages of a class/function
Grep: className|functionName

# Find interface implementations
Grep: implements InterfaceName
```

### 5. Configuration Analysis
Key files to examine:
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `.env.example` - Environment variables
- `docker-compose.yml` - Service dependencies

## Discovery Workflow

1. **Start with README** - Understand project purpose
2. **Check package.json** - See dependencies and scripts
3. **Map directories** - Understand folder structure
4. **Find entry points** - Trace main execution paths
5. **Identify patterns** - Recognize architectural decisions
6. **Note conventions** - Document naming and organization patterns

## Questions to Answer

When exploring a codebase, answer these:
- What is the primary purpose of this code?
- What are the main modules/components?
- How is data structured and stored?
- What external dependencies exist?
- What testing patterns are used?
- What coding conventions are followed?

## Output Format

After discovery, provide:
```
## Codebase Overview

### Purpose
[Brief description]

### Key Components
- Component A: [purpose]
- Component B: [purpose]

### Architecture
[Pattern used: MVC, Clean Architecture, etc.]

### Important Files
- [file]: [purpose]

### Conventions
- Naming: [patterns]
- Testing: [approach]
- Error handling: [approach]
```
