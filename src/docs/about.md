# About SidStack

**SidStack** is a project intelligence platform that makes AI coding agents smarter. It gives tools like Claude Code persistent knowledge, governed task management, and impact analysis — so every AI session starts with full project context, not a blank slate.

## What Does SidStack Do?

Most AI coding tools start every session from zero. They don't know your project's business rules, architecture patterns, or past mistakes. SidStack solves this by providing:

- **Persistent Knowledge** — Document your project's business logic, API contracts, and design patterns. AI agents load this context instantly via MCP tools.
- **Governed Task Management** — Track work with quality gates that enforce standards before completion. Tasks auto-link to governance rules and acceptance criteria.
- **Impact Analysis** — Analyze the risk of code changes before writing a single line. Gate checks block dangerous changes automatically.
- **Learning Loop** — Capture incidents, extract lessons, create reusable skills, and enforce rules so the same mistake never happens twice.

## Core Principles

### Governance-First
SidStack uses 2 roles (Worker and Reviewer) with dynamic skill loading — not 10 fixed agents copying human org charts. One Worker loading different skill files becomes your Frontend Dev, API Architect, or Bug Fixer.

### Knowledge-Driven
Understand your project before automating. SidStack provides structured documentation that both humans and AI agents can read — business logic, API docs, design patterns, and module boundaries.

### Local-First
Everything runs on your machine. SQLite database, local files, no cloud accounts, no telemetry. Your code and project intelligence stay yours.

### Incremental
Start small. Run `sidstack init` to scaffold governance, then add knowledge docs as your project grows. No upfront configuration required.

## Key Features

| Feature | Description |
|---------|-------------|
| **Project Hub** | Unified dashboard for capabilities, goals, and project overview |
| **Knowledge Browser** | Browse, search, and preview project documentation |
| **Task Manager** | List, Kanban, and Timeline views with governance and quality gates |
| **Ticket Queue** | External ticket intake with status workflow and task conversion |
| **Training Room** | Incidents, lessons, skills, and enforcement rules |
| **Impact Analysis** | Risk scoring, scope detection, and validation gates |
| **MCP Server** | 32 tools for Claude Code integration |
| **CLI** | Project initialization, knowledge management, and diagnostics |

## How It Works

1. **Install** — `npm i -g @sidstack/cli` or download the desktop app
2. **Initialize** — `sidstack init` scaffolds governance and knowledge structure
3. **Build Knowledge** — Add docs about your project's business logic, APIs, and patterns
4. **Work with AI** — Claude Code uses SidStack's MCP tools to load context, manage tasks, and analyze impact
5. **Learn** — Incidents become lessons, lessons become skills, skills become rules

## Version

Current version: **v{{version}}**
