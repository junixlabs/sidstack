# SidStack Documentation

Welcome to SidStack's documentation. SidStack is an AI-Powered Project Intelligence Platform with structured knowledge, impact analysis, and governance for Claude Code.

---

## Quick Start

- **[QUICK_START.md](QUICK_START.md)** - Get from zero to productive
- **[GETTING_STARTED.md](GETTING_STARTED.md)** - Detailed setup guide with governance
- **[CLAUDE_CODE_INTEGRATION.md](CLAUDE_CODE_INTEGRATION.md)** - MCP tools reference (49 tools)
- **[API_REFERENCE.md](API_REFERENCE.md)** - REST API documentation

---

## Product Strategy

- **[PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md)** - Vision, target customers, value proposition

---

## Current Sprint

- **[ROADMAP_Q1_2026.md](ROADMAP_Q1_2026.md)** - Development plan and priorities

---

## Feature Guides

- **[Knowledge Browser](guides/knowledge-browser.md)** - 9-category knowledge system
- **[Project Hub](guides/project-hub.md)** - Central dashboard navigation
- **[Task Management](guides/task-management.md)** - Task lifecycle and governance
- **[Ticket Queue](guides/ticket-queue.md)** - External ticket intake
- **[Training Room](guides/training-room.md)** - Incident-lesson-skill-rule pipeline
- **[Impact Analysis](IMPACT_ANALYSIS.md)** - Change impact analyzer
- **[DEMO_SCENARIOS.md](DEMO_SCENARIOS.md)** - Step-by-step demo scenarios

---

## Project Health

- **[TECHNICAL_DEBT.md](TECHNICAL_DEBT.md)** - Known issues and debt tracker

---

## Architecture Decision Records (ADRs)

- **[ADR-002](ADRs/002-oclif-cli-framework.md)** - Oclif for CLI Framework
- **[ADR-004](ADRs/004-turborepo-monorepo.md)** - Turborepo for Monorepo

---

## Document Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| QUICK_START.md | Current | 2026-02 |
| GETTING_STARTED.md | Current | 2026-02 |
| CLAUDE_CODE_INTEGRATION.md | Current | 2026-02 |
| API_REFERENCE.md | Current | 2026-02 |
| PRODUCT_STRATEGY.md | Needs Review | 2026-01 |
| ROADMAP_Q1_2026.md | Needs Review | 2026-02 |
| IMPACT_ANALYSIS.md | Current | 2026-01 |
| DEMO_SCENARIOS.md | Current | 2026-02 |
| TECHNICAL_DEBT.md | Current | 2026-02 |
| ADR-002 | Accepted | 2025-11 |
| ADR-004 | Accepted | 2025-11 |

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Desktop App | Tauri 2.x (Rust + React) |
| Web UI | React SPA (Vite + Caddy) |
| CLI | Oclif (TypeScript) |
| MCP Server | TypeScript (@modelcontextprotocol/sdk) |
| API Server | Express.js |
| Bot Server | Express.js + Gemini |
| Database | SQLite (better-sqlite3) |
| State | Zustand (React) |
| Styling | Tailwind CSS |
| Memory | mem0 (optional, via Docker) |
| Deployment | Docker Compose + Caddy (auto TLS) |

---

## Getting Help

- Run `npx @sidstack/cli --help` for CLI help
- Check `CLAUDE.md` in project root for AI assistant instructions
- Review `.sidstack/governance.md` for agent governance
