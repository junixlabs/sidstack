# ADR-004: Use Turborepo for Monorepo Management

**Status:** Accepted
**Date:** 2025-11-21
**Deciders:** Development Team

---

## Context

SidStack consists of multiple TypeScript packages (CLI, MCP server, API server, shared) that share code and dependencies. We need a monorepo tool to manage builds, dependencies, and development workflows efficiently.

### Requirements

- Fast incremental builds
- Efficient caching
- Parallel task execution
- Simple configuration
- Works with pnpm workspaces
- TypeScript support
- Good developer experience

---

## Decision

We will use **Turborepo** for monorepo management, combined with **pnpm workspaces**.

**Turborepo** is a high-performance build system for JavaScript/TypeScript monorepos, created by Vercel.

---

## Rationale

### 1. Performance
- **Incremental builds**: Only rebuilds what changed
- **Remote caching**: Cache builds across machines (optional)
- **Parallel execution**: Runs tasks in parallel when possible
- **Smart scheduling**: Optimizes task execution order

### 2. Simplicity
- Minimal configuration (single `turbo.json`)
- Works seamlessly with pnpm workspaces
- Easy to understand mental model
- No complex setup required

### 3. Caching
- Automatic task caching
- Content-based hashing
- Cache hits speed up builds dramatically
- Shared cache across team (optional)

### 4. Developer Experience
- Fast feedback loops
- Clear task dependencies
- Good error messages
- Active development by Vercel

### 5. Integration
- Works great with pnpm (faster than npm/yarn)
- TypeScript-first
- Supports custom scripts
- Integrates with CI/CD

---

## Consequences

### Positive

✅ **Faster Development**
- Instant rebuilds for unchanged packages
- Parallel builds across packages
- Local cache speeds up repeated builds

✅ **Efficient CI/CD**
- Only test/build affected packages
- Remote cache for faster CI builds
- Reduced CI time and costs

✅ **Simple Configuration**
```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    }
  }
}
```

✅ **Better Developer Experience**
- Fast iteration cycles
- Clear task execution order
- Immediate feedback

✅ **Scalability**
- Handles large monorepos well
- Proven at scale (Vercel uses it)
- Can grow with project

### Negative

❌ **Vercel-specific**
- Tied to Vercel ecosystem (but open-source)
- Less flexible than Nx for non-standard setups

❌ **Cache management**
- Local cache can grow large
- Need to understand caching behavior

---

## Alternatives Considered

### Option 1: Nx

**Pros:**
- More feature-rich
- Excellent dependency graph visualization
- Plugin ecosystem
- Code generation
- Better for polyglot monorepos

**Cons:**
- More complex configuration
- Steeper learning curve
- Slower than Turborepo for simple tasks
- More opinionated
- Overkill for our use case

**Why rejected:** Too complex for our needs. Turborepo's simplicity is better suited for SidStack.

---

### Option 2: Lerna

**Pros:**
- Long-established
- Simple mental model
- Good for publishing packages

**Cons:**
- Slower than Turborepo
- Less active development
- No built-in caching
- No parallel execution by default
- Being phased out in favor of Nx

**Why rejected:** Slower, less active development, no caching.

---

### Option 3: Rush

**Pros:**
- Designed for large monorepos
- Good for Microsoft-style projects
- Strict dependency management

**Cons:**
- Complex configuration
- Opinionated workflows
- Smaller community
- Steeper learning curve

**Why rejected:** Too enterprise-focused, too complex.

---

### Option 4: pnpm Workspaces Only (No Build Tool)

**Pros:**
- Simplest approach
- No additional tooling
- Just use pnpm scripts

**Cons:**
- No caching
- No parallel execution
- Slow incremental builds
- Manual dependency management

**Why rejected:** Missing critical features (caching, parallelization) that significantly improve development speed.

---

## Implementation Details

### Configuration

#### `turbo.json`
```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

#### `pnpm-workspace.yaml`
```yaml
packages:
  - 'packages/*'
```

#### Root `package.json`
```json
{
  "name": "sidstack",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "test": "turbo run test",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "^1.11.0"
  }
}
```

### Package Scripts

Each package has consistent scripts:
```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest",
    "lint": "eslint ."
  }
}
```

### Usage

```bash
# Build all packages
pnpm build

# Watch mode (development)
pnpm dev

# Test all packages
pnpm test

# Build specific package
pnpm --filter @sidstack/cli build

# Run with cache info
pnpm build --summarize
```

---

## Turborepo + pnpm Benefits

### Why pnpm?
- **Fastest** package manager
- **Disk efficient** (shared store)
- **Strict** dependency resolution (no phantom deps)
- **Workspace support** built-in

### Turborepo + pnpm Synergy
- Turborepo handles task orchestration
- pnpm handles dependency management
- Best of both worlds

---

## Caching Strategy

### Local Cache
- Stored in `.turbo/cache`
- Automatic cache invalidation based on:
  - File contents (hashing)
  - Dependencies
  - Environment variables

### Remote Cache (Optional)
- Can enable for teams
- Vercel provides free remote caching
- Speeds up CI/CD significantly

### Cache Management
```bash
# Clear cache
rm -rf .turbo/cache

# Disable cache for specific run
pnpm build --force

# Skip cache
pnpm build --no-cache
```

---

## Performance Comparison

### Without Turborepo (pnpm only)
```
Clean build:       ~60s
Incremental:       ~45s (rebuilds all)
No caching
```

### With Turborepo
```
Clean build:       ~60s (first time)
Incremental:       ~5s (only changed packages)
Cache hit:         <1s
Parallel:          ~30s (clean, all packages)
```

**Result:** 10-12x faster incremental builds

---

## Risk Mitigation

### Risk: Turborepo becomes unmaintained
**Likelihood:** Very low (backed by Vercel)
**Mitigation:**
- Open-source, can fork
- Can migrate to Nx if needed
- Core logic is scripts, not tied to tool

### Risk: Cache invalidation issues
**Likelihood:** Low (Turborepo is mature)
**Mitigation:**
- Can force rebuild with `--force`
- Cache key includes all inputs
- Clear cache if issues occur

### Risk: Local cache grows too large
**Likelihood:** Medium (over time)
**Mitigation:**
- Periodic cache cleanup
- `.gitignore` includes `.turbo/`
- Can configure cache size limits

---

## Validation Criteria

After Phase 1:

- [x] Build time reduced by >50% for incremental builds
- [x] Cache hit rate >80% for repeated builds
- [x] Developer can run `pnpm build` and it works
- [x] CI/CD uses caching effectively
- [x] No major cache invalidation issues

If validation fails:
- Evaluate Nx as alternative
- Consider simpler pnpm-only approach

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: CI

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Build
        run: pnpm build

      - name: Test
        run: pnpm test
```

---

## References

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Turborepo GitHub](https://github.com/vercel/turbo)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Vercel Blog: Turborepo](https://vercel.com/blog/turborepo)

---

**Decision Date:** 2025-11-21
**Supersedes:** None
**Superseded by:** None (current)
