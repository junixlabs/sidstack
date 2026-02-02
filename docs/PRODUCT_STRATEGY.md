# SidStack Product Strategy

**Created:** 2026-01-22
**Last Updated:** 2026-01-22
**Status:** Active

---

## Vision Statement

**SidStack** = Local-first AI Project Intelligence Platform

> "Your AI finally remembers your project"

Structured project knowledge, impact analysis, and governance for AI coding assistants. Persistent context that makes every AI session smarter.

---

## Core Values (Why SidStack Exists)

| Value | Description | Metric |
|-------|-------------|--------|
| **Context Persistence** | AI remembers project context across sessions | Setup once, use forever |
| **Quality Governance** | AI follows coding standards and patterns | Pass quality gates before completion |
| **Local-First Privacy** | Data stays local, no cloud dependency | Zero external data transfer |
| **Visual Management** | Track AI work via desktop UI instead of terminal | Real-time status visibility |

---

## Key Differentiators

### 1. Project Hub - Central Navigation Dashboard

Capability tree, entity connections, and project overview.

**What Project Hub provides:**
- Capability registry (L0/L1/L2 hierarchy)
- Entity reference graph (tasks, knowledge, sessions interconnected)
- Context builder for Claude sessions
- Project stats and quick actions

**Why It Matters:**

| User Need | How Project Hub Helps |
|-----------|----------------------|
| "Where do I start?" | See capability tree overview |
| "What will this change affect?" | Impact analysis integration |
| "Onboard to new codebase" | AI-generated knowledge docs |
| "Planning a feature" | Context builder assembles relevant docs |
| "AI task delegation" | Session launch with project context |

**Competitive Advantage:**
- Claude Code: No persistent project knowledge
- Cursor: File tree only, no structured knowledge
- VS Code: No impact analysis or governance

### 2. Knowledge Persistence
(AI remembers project context - covered below)

### 3. Quality Governance
(AI follows coding standards - covered below)

---

## Problem Statement

### Developer Pain Points with AI Coding Tools

**Without SidStack:**
- **Context Loss** - Every new session requires re-explaining the project. AI doesn't remember past decisions.
- **Inconsistent Quality** - AI code doesn't follow team standards. Output varies across sessions.
- **No Visibility** - Hard to track what AI is working on and its progress.

**With SidStack:**
- **Persistent Knowledge** - Setup knowledge docs once, AI reads and understands project context automatically.
- **Governed Quality** - Governance rules enforced automatically. Quality gates block completion until standards are met.
- **Visual Dashboard** - Desktop app shows all AI work with real-time progress tracking.

---

## Target Customer Segments

### Segment 1: Solo Developer Power Users (PRIMARY)

**Priority:** P0 - Focus segment

**Profile:**
- Developers already using Claude Code, Cursor, GitHub Copilot
- Full-stack or working across multiple layers
- 2-5 years experience
- Side projects or freelance work

**Behaviors:**
- Uses AI tools daily
- Frustrated with context loss between sessions
- Wants AI to be "smarter" about their project
- Self-learners who explore new tools

**Pain Points:**
| Pain | Severity | Frequency |
|------|----------|-----------|
| Re-explain project every session | High | Daily |
| AI doesn't follow coding patterns | Medium | Daily |
| Can't delegate multiple tasks | Medium | Weekly |
| Manual task tracking | Low | Weekly |

**Value Proposition:**
> "Setup your project knowledge once. Your AI agents remember forever."

**Willingness to Pay:** $15-30/month (estimate)

---

### Segment 2: Small Tech Teams (SECONDARY)

**Priority:** P1 - Future segment

**Profile:**
- Startups or small companies (3-10 devs)
- Tech lead or senior dev as decision maker
- Already adopted AI tools at individual level
- Want to standardize AI usage across the team

**Pain Points:**
| Pain | Severity | Frequency |
|------|----------|-----------|
| AI code inconsistent across team members | High | Daily |
| Hard to share AI context | Medium | Weekly |
| No visibility into AI work | Medium | Weekly |
| Security concerns with cloud AI | High | Always |

**Value Proposition:**
> "Governed AI agents that follow your team's standards."

**Willingness to Pay:** $50-100/month per team (estimate)

---

### Segment 3: AI-First Agencies (FUTURE)

**Priority:** P2 - Long-term segment

**Profile:**
- Development agencies using AI for client projects
- Multiple projects running simultaneously
- Need to scale AI-assisted development

**Value Proposition:**
> "Scale AI development across all your projects."

**Note:** Defer until Segment 1 & 2 validated.

---

## Competitive Landscape

### Direct Competitors

| Competitor | Approach | Weakness vs SidStack |
|------------|----------|----------------------|
| Claude Code (vanilla) | Single agent, no persistence | No multi-agent, no memory |
| Cursor Composer | Multi-file but single agent | No orchestration, no governance |
| Continue.dev | IDE extension, context | No agent coordination |
| Aider | Git-focused single agent | No multi-agent, no UI |

### Positioning Map

```
                    Multi-Agent Orchestration
                              ↑
                              │
                              │     ★ SidStack
                              │     (Local, Visual, Governed)
                              │
    Simple ←──────────────────┼──────────────────→ Complex
                              │
           Claude Code ●      │           ● Enterprise AI Platforms
           Cursor ●           │             (Complicated, Expensive)
           Aider ●            │
                              │
                              ↓
                    Single Agent
```

### SidStack's Unique Position

**"The project intelligence layer that doesn't exist yet"**

- More context than single-agent tools (Claude Code, Cursor)
- Simpler than enterprise platforms
- Local-first (privacy)
- Visual management (not just terminal)

---

## Key Messages

### Primary Message
> **"Your AI finally remembers your project"**

### Supporting Messages

| Message | Target Pain | Use When |
|---------|-------------|----------|
| "Navigate your project like a map" | Codebase complexity | Project Hub pitch |
| "Setup once, AI remembers forever" | Context loss | Landing page hero |
| "One orchestrator, multiple agents" | Manual coordination | Feature section |
| "Governed AI that follows your standards" | Inconsistent output | For teams |
| "Local-first. Your code stays yours." | Privacy concerns | Security-conscious users |
| "See what your AI is doing" | No visibility | Desktop app pitch |

### Elevator Pitch (30 seconds)

> "SidStack is a project intelligence platform for AI coding agents. Unlike Claude Code which forgets everything each session, SidStack keeps your project knowledge persistent - so your AI always understands your codebase, follows your coding standards, and learns from past mistakes. It's local-first, so your code never leaves your machine."

---

## Success Metrics

### North Star Metric
**Weekly Active Projects** - Number of projects with at least one MCP tool call per week

### Supporting Metrics

| Metric | Target (6 months) | Why It Matters |
|--------|-------------------|----------------|
| Knowledge docs created | 500+ projects | Adoption indicator |
| Projects initialized | 1000+ projects | Setup adoption |
| Impact analyses run | Track | Differentiator usage |
| MCP tool calls per session | 5+ | Tool engagement |
| Session resume rate | >60% | Persistence value |
| Quality gate pass rate | >80% | Governance working |
| NPS | >40 | User satisfaction |

---

## Product Principles

### 1. Local-First Always
- Data stays on user's machine
- No cloud dependency for core features
- Optional sync only with explicit consent

### 2. Progressive Complexity
- Simple to start (single agent + basic knowledge)
- Powerful when needed (multi-agent + full governance)
- Never force complexity on users

### 3. Visual Over Terminal
- Desktop UI is primary interface
- Terminal for power users, not requirement
- Show, don't tell (agent status, progress)

### 4. Opinionated Defaults, Flexible Override
- Presets for common setups
- Governance templates that work out-of-box
- Allow customization for advanced users

### 5. AI-Native, Not AI-Bolted
- Built for AI workflows from ground up
- Not retrofitting AI into existing tool
- Agent-first architecture

---

## Roadmap Alignment

### Current Focus (Q1 2026)
**Phase:** Knowledge Browser & Foundation

| Feature | Value Delivered |
|---------|-----------------|
| Knowledge Browser UI | Visual project understanding |
| Project Hub | Central dashboard for navigation |
| Task Manager | AI task tracking |
| CLI Commands | Agent-friendly interfaces |

### Next Phase (Q2 2026)
**Phase:** Orchestration & Multi-Agent

| Feature | Value Delivered |
|---------|-----------------|
| Orchestrator Core | Multi-agent coordination |
| Agent Terminal UX | Visual agent management |
| Session Persistence | Resume AI work |

### Future (H2 2026)
**Phase:** Team & Scale

| Feature | Value Delivered |
|---------|-----------------|
| Team Knowledge Sharing | Collaborative AI |
| Advanced Governance | Enterprise-ready |
| Integrations | IDE plugins, CI/CD |

---

## Open Questions (To Validate)

### Product Questions
- [ ] How much friction is acceptable for knowledge setup?
- [ ] Do users actually need 2+ agents or is 1 enough?
- [ ] Desktop app vs CLI - which is primary for target users?

### Market Questions
- [ ] Willingness to pay for solo developers?
- [ ] How do teams currently share AI context?
- [ ] What triggers switching from Claude Code to alternatives?

### Technical Questions
- [ ] Knowledge doc format - markdown enough or need structured?
- [ ] Agent communication - how to show in UI effectively?
- [ ] Governance - auto-enforce or suggest?

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-22 | Focus on Solo Developers first | Easier to reach, faster feedback loop |
| 2026-01-22 | Desktop-first approach | Visual management is key differentiator |
| 2026-01-22 | Local-first architecture | Privacy is major concern, no cloud dependency |

---

## References

- `docs/ROADMAP_Q1_2026.md` - Current sprint plan
- `CLAUDE.md` - Technical context
