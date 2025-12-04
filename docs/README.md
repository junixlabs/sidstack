# SidStack Documentation

Welcome to SidStack's documentation. SidStack is a knowledge-powered AI coding assistant with project intelligence, impact analysis, and governance for Claude Code.

---

## Product Strategy

- **[PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md)** - Vision, target customers, value proposition

---

## Quick Start

- **[QUICK_START.md](QUICK_START.md)** - Get from zero to productive
- **[GETTING_STARTED.md](GETTING_STARTED.md)** - Detailed setup guide with governance
- **[CLAUDE_CODE_INTEGRATION.md](CLAUDE_CODE_INTEGRATION.md)** - MCP configuration
- **[API_REFERENCE.md](API_REFERENCE.md)** - REST API documentation

---

## Current Sprint

- **[ROADMAP_Q1_2026.md](ROADMAP_Q1_2026.md)** - Active development plan and priorities

---

## Feature Guides

- **[USER_GUIDE_VIEW_ONLY_APP.md](USER_GUIDE_VIEW_ONLY_APP.md)** - Desktop app usage guide
- **[IMPACT_ANALYSIS.md](IMPACT_ANALYSIS.md)** - Change impact analyzer documentation
- **[TEAM_MANAGEMENT.md](TEAM_MANAGEMENT.md)** - Multi-agent team coordination

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
| PRODUCT_STRATEGY.md | Current | 2026-01 |
| GETTING_STARTED.md | Current | 2026-01 |
| ROADMAP_Q1_2026.md | Current | 2026-01 |
| USER_GUIDE_VIEW_ONLY_APP.md | Current | 2026-01 |
| IMPACT_ANALYSIS.md | Current | 2026-01 |
| TEAM_MANAGEMENT.md | Current | 2026-01 |
| TECHNICAL_DEBT.md | Current | 2026-01 |
| ADR-002 | Accepted | 2025-11 |
| ADR-004 | Accepted | 2025-11 |

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Desktop App | Tauri 2.x (Rust + React) |
| CLI | Oclif v3 (TypeScript) |
| MCP Server | TypeScript (@modelcontextprotocol/sdk) |
| API Server | Express.js |
| Database | SQLite (embedded) |
| State | Zustand (React) |
| Styling | Tailwind CSS |

---

## Getting Help

- Run `sidstack --help` for CLI help
- Check `CLAUDE.md` in project root for AI assistant instructions
- Review `.sidstack/governance.md` for agent governance

---

**Documentation Version:** 3.0
**Last Updated:** 2026-02-02
