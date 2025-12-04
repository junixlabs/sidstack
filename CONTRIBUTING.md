# Contributing to SidStack

## Prerequisites

- Node.js 20+
- pnpm 9+
- Rust (for Tauri desktop app)

## Setup

```bash
# Clone and install
git clone https://github.com/junixlabs/sidstack.git
cd sidstack
pnpm install

# Start development
pnpm dev          # Vite frontend only
pnpm tauri:dev    # Full Tauri desktop app (Rust + React)
```

## Project Structure

```
sidstack/
├── src/              # React frontend (Tauri webview)
├── src-tauri/        # Rust backend (Tauri)
├── packages/
│   ├── cli/          # Oclif CLI tool
│   ├── mcp-server/   # MCP Server for Claude Code
│   ├── api-server/   # Express.js REST API
│   └── shared/       # Shared types + SQLite
└── .sidstack/        # Local data (runtime)
```

## Development Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Vite dev server |
| `pnpm tauri:dev` | Start Tauri app (Rust + React) |
| `pnpm build` | Production build (Vite) |
| `pnpm tauri:build` | Production desktop app |
| `pnpm packages:build` | Build all packages |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm test` | Run tests |

## Coding Standards

### TypeScript
- Strict mode enabled
- Use `@/` path alias for imports
- Prefer named exports over default exports

### React
- Functional components with hooks
- `memo()` for expensive components
- Zustand for state management
- Tailwind CSS with design tokens (`var(--surface-0)`, `var(--text-primary)`, etc.)

### CSS
- Use CSS custom properties from `src/index.css` (design tokens)
- Avoid hardcoded Tailwind colors for semantic meaning; use tokens (`var(--color-info)`)
- Decorative per-feature colors may use Tailwind colors directly

### Accessibility
- WCAG AA contrast minimum
- `focus-visible` outlines on all interactive elements
- ARIA roles for menus, trees, tabs, dialogs
- Minimum text size: 10px

## Pull Request Process

1. Create a feature branch from `main`
2. Make changes and verify:
   ```bash
   pnpm typecheck   # Must pass
   pnpm build       # Must succeed
   pnpm test        # Must pass
   ```
3. Open a PR against `main`
4. PR title: short imperative description (e.g., "Add session resume support")
5. PR body: summary of changes, test plan

## Commit Conventions

- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Code restructuring (no behavior change)
- `docs:` Documentation only
- `test:` Adding/updating tests
- `chore:` Build, config, dependency updates

## Architecture Notes

- **Desktop-first**: Tauri 2.x app, not a web app
- **Local-first**: SQLite database, no cloud services
- **API server**: Express.js on localhost:19432 (for MCP + frontend)
- **No Go/gRPC/Neo4j**: Legacy dependencies fully removed

## Testing

```bash
# Run all tests
pnpm test

# Run specific package tests
cd packages/api-server && npx vitest run
```

## Questions?

Open an issue for bugs or feature requests.
