# Technical Debt Tracker

**Last Updated**: 2026-02-25

---

## Active Issues

_No active technical debt items._

---

## Resolved (Archive)

All previous technical debt items have been resolved:

| ID | Issue | Priority | Resolved |
|----|-------|----------|----------|
| TD-001 | gRPC Client Dependency | Critical | 2026-01-03 |
| TD-002 | Git Cleanup (Go services) | Medium | 2026-01-27 |
| TD-003 | Empty Specs (OpenSpec) | Medium | 2026-01-27 |
| TD-004 | Rust Backend Warnings | Low | 2026-01-03 |
| TD-005 | Test Coverage | Medium | 2026-01-27 |
| TD-006 | CLI dist/ Stale Build | Critical | 2026-01-03 |
| TD-007 | Agent SDK Migration | High | 2026-01-08 |

### Key Cleanups in v0.5.0
- Removed capability registry, external session management, worktree UI
- Removed legacy CLI agent templates and old knowledge templates
- Removed legacy skills (impact-safe, knowledge-first, lesson-detector, training-context)
- Architecture simplified: API Server is now central gateway for all services
