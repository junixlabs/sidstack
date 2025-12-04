# Technical Debt Tracker

**Last Updated**: 2026-01-27

---

## Critical Issues

### 1. CLI dist/ Stale Build Files

**Status**: ✅ Resolved
**Discovered**: 2026-01-03
**Resolved**: 2026-01-03
**Impact**: Critical - CLI completely broken

**Problem**:
- `packages/cli/dist/` contained stale compiled files importing `@sidstack/grpc-client`
- Source files were deleted but dist/ wasn't cleaned
- `tsconfig.tsbuildinfo` incremental cache prevented proper rebuild

**Solution Applied**:
```bash
cd packages/cli
rm -f tsconfig.tsbuildinfo  # Clear incremental build cache
rm -rf dist/
npx tsc
cp -r templates dist/
```

**Verified Working**:
- `sidstack doctor` ✓
- `sidstack init` ✓
- `sidstack analyze` ✓
- `sidstack orchestrator ps` ✓

---

### 2. MCP Server - gRPC Client Dependency (RESOLVED)

**Status**: ✅ Resolved
**Resolved**: 2026-01-03

**Solution Applied**:
- Removed `@sidstack/grpc-client` import from `index.ts`
- Created stub functions for deprecated gRPC clients that throw clear error messages
- SQLite-based tools in `sqlite-tools.ts` provide all essential agent management functionality
- Added SQLite tools to main tools export
- handleToolCall now delegates to handleSqliteToolCall for SQLite tool names

**Working SQLite Tools** (in `sqlite-tools.ts`):
- task_create, task_breakdown
- agent_read_task, agent_update_status, agent_send_message
- agent_get_messages, agent_create_artifact, agent_query_agents
- agent_report_progress, agent_progress_status
- file_lock_acquire, file_lock_release, file_lock_check, file_lock_list

**Deprecated Tools** (will throw error if called):
- graph_query, semantic_search (Neo4j-based)
- knowledge_store, knowledge_query (Neo4j-based)
- Other Neo4j graph tools

**Notes**:
- Old gRPC-based tool handlers still exist but will throw deprecation errors
- Can be removed in future cleanup if not needed

---

### 3. Agent SDK Migration Complete

**Status**: ✅ Resolved
**Discovered**: 2026-01-06
**Resolved**: 2026-01-08
**Impact**: High - Better reliability and type safety

**Changes Made**:
- Migrated from CLI-based Claude interactions to Agent SDK V2
- Created `apps/agent-manager/sidecar/` Node.js WebSocket server
- Built sidecar binary using esbuild + pkg
- Added auto-restart on sidecar crash
- Implemented error classification for user-friendly messages
- Session persistence via Tauri commands
- Removed backward compatibility (SDK-only mode)

**Deprecated Files** (marked with @deprecated):
- `src/hooks/useClaudeProcess.ts` - Use `useAgentSDK.ts` instead
- `src/components/agent-terminal/AgentTerminalView.tsx` - Use `AgentTerminalViewSDK.tsx` instead
- `src-tauri/src/claude_process.rs` - Replaced by `sdk_sidecar.rs`

**New Architecture**:
```
Frontend -> WebSocket -> Sidecar (Node.js) -> Agent SDK V2 -> Claude API
```

**Benefits**:
- Type-safe SDK message handling
- Reliable streaming without parsing issues
- Built-in session resume support
- Better error handling with classification

---

## Medium Priority

### 4. Go Services Deletion Not Committed

**Status**: ✅ Resolved
**Resolved**: 2026-01-27
**Impact**: Medium - Cluttered git status

**Solution**: Go services (`services/graph-service/`, `services/cache-service/`, `proto/`) were removed. All gRPC/Neo4j/Qdrant dependencies eliminated. Architecture simplified to SQLite-only.

---

### 3. OpenSpec Specs Directory Empty

**Status**: ✅ Resolved
**Resolved**: 2026-01-27
**Impact**: Medium

**Solution**: Knowledge system implemented via Unified Knowledge API (`/api/knowledge`). OpenSpec changes cleaned up - all 20 active changes archived (69 total archived). Knowledge Browser UI provides project context browsing.

---

## Low Priority

### 4. Rust Backend Warnings

**Status**: ✅ Resolved
**Resolved**: 2026-01-03
**Impact**: Low - Build noise

**Solution Applied**:
- Removed unused imports (Duration, mpsc, TeamHistory, TeamIndexEntry)
- Fixed unused variables with underscore prefix
- Added `#![allow(dead_code)]` to modules with planned-but-unused code:
  - claude_session.rs, recovery_watchdog.rs, session_tracker.rs
  - terminal_registry.rs, team_storage.rs, team_manager.rs
  - agent_coordinator.rs, claude_process.rs
- Removed unused ParseError variant from openspec.rs

**Verified**: `cargo build` now produces 0 warnings

---

### 5. Test Coverage

**Status**: ✅ Resolved
**Resolved**: 2026-01-27
**Impact**: Medium

**Current State**:
- **CLI**: 108 tests passing (module, governance, preset, knowledge commands)
- **API Server**: 27 smoke tests passing (health, CRUD, route mounting, error handling)
- Old deprecated tests removed

**Test Infrastructure**:
- CLI: Vitest with oclif test helpers
- API Server: Vitest + supertest with isolated temp SQLite DB
- Port isolation: `API_PORT=0` avoids EADDRINUSE conflicts

---

## Tracking

| ID | Issue | Priority | Status | Target |
|----|-------|----------|--------|--------|
| TD-006 | CLI dist/ Stale Build | Critical | ✅ Resolved | ASAP |
| TD-001 | gRPC Client Dependency | Critical | ✅ Resolved | Week 1 |
| TD-002 | Git Cleanup | Medium | ✅ Resolved | Week 1 |
| TD-003 | Empty Specs | Medium | ✅ Resolved | Week 1 |
| TD-004 | Rust Warnings | Low | ✅ Resolved | Ongoing |
| TD-005 | Test Coverage | Medium | ✅ Resolved | Week 4 |
| TD-007 | Agent SDK Migration | High | ✅ Resolved | Week 2 |
