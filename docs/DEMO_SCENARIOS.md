# SidStack Demo Scenarios

Step-by-step scenarios showcasing SidStack's key features.

---

## Scenario 1: Task Management Flow

**Goal**: Create a task, track progress, and complete it.

### Steps

1. **Open Task Manager** (`⌘2`)
2. **Create task** via API or MCP:
   ```bash
   curl -X POST http://localhost:19432/api/tasks \
     -H "Content-Type: application/json" \
     -d '{"title": "Add user avatar upload", "projectId": "demo", "priority": "high", "taskType": "feature"}'
   ```
3. **View in Kanban** - task appears in "Todo" column
4. **Switch views** - toggle between Kanban, Tree, and List views
5. **Launch Claude session** from task context menu:
   ```
   Right-click task → "Launch Claude Session"
   ```
6. **Track progress** - session status updates in Sessions view
7. **Complete task** - move to "Done" column or update via API

### What to highlight
- Three view modes (Kanban, Tree, List)
- Task-to-session integration
- Real-time status tracking

---

## Scenario 2: Ticket Queue (External Intake)

**Goal**: Receive an external ticket, review it, and convert to a task.

### Steps

1. **Create ticket** (simulating external source):
   ```bash
   curl -X POST http://localhost:19432/api/tickets \
     -H "Content-Type: application/json" \
     -d '{
       "projectId": "demo",
       "title": "Login page shows blank screen on Safari",
       "description": "Users report blank screen after login on Safari 17.x. Works on Chrome.",
       "type": "bug",
       "priority": "high",
       "source": "api",
       "externalId": "JIRA-456"
     }'
   ```
2. **Open Ticket Queue** (`⌘4`)
3. **Review ticket** - click to see details, description, external ID
4. **Change status** to "reviewing" then "approved"
5. **Convert to task** - click "Convert to Task" button
6. **Verify** - task appears in Task Manager (`⌘2`)

### What to highlight
- External ticket intake via API
- Review workflow (new → reviewing → approved)
- One-click conversion to task

---

## Scenario 3: Project Hub Navigation

**Goal**: Navigate project features from central dashboard.

### Steps

1. **Open Project Hub** (`⌘1`)
2. **View project stats** - module count, active tasks, sessions, knowledge documents
3. **Browse recent activity** - latest actions across all features
4. **Click quick actions** - jump to any feature:
   - Task Manager - create and track tasks
   - Knowledge Browser - browse project documentation
   - Ticket Queue - manage external tickets
   - Training Room - view lessons learned
   - Sessions - manage Claude Code sessions
5. **Check workspace status** - see Worktree Status in sidebar
6. **Switch features** - use sidebar navigation or keyboard shortcuts

### What to highlight
- Central dashboard with unified view
- Quick access to all features
- Real-time project stats and activity

---

## Scenario 4: Claude Session Management

**Goal**: Launch, track, and manage Claude Code sessions.

### Steps

1. **Open Sessions** (`⌘5`)
2. **Launch new session**:
   - Click "Launch Session" button
   - Select workspace path
   - Enter prompt: "Fix the Safari login bug"
   - Optionally link to a task
   - Choose terminal (iTerm, Terminal.app, Warp, etc.)
3. **Observe session launch** - new terminal window opens with Claude Code
4. **Track session** - status shows "active" with duration timer
5. **View session details** - click session card for event timeline
6. **Resume session** - click "Resume" to continue previous work

### What to highlight
- External terminal launch (real terminal, not embedded)
- Session tracking with status and duration
- Task-linked sessions for traceability

---

## Scenario 5: Training Room (Lessons Learned)

**Goal**: Record an incident, create a lesson, and define a skill.

### Steps

1. **Open Training Room** (`⌘5`)
2. **Create training session**:
   ```bash
   curl -X POST http://localhost:19432/api/training/sessions/api-server \
     -H "Content-Type: application/json" \
     -d '{"projectPath": "/path/to/project"}'
   ```
3. **Record an incident**:
   ```bash
   curl -X POST http://localhost:19432/api/training/incidents \
     -H "Content-Type: application/json" \
     -d '{
       "sessionId": "<session-id>",
       "title": "SQL injection in search endpoint",
       "description": "User input was concatenated into SQL query without parameterization",
       "type": "mistake",
       "severity": "high"
     }'
   ```
4. **View incidents** in Training Room UI
5. **Create lesson** from incident:
   - What went wrong
   - Root cause
   - Prevention steps
6. **Create skill** from lesson:
   - Reusable pattern for future agents
7. **Create rule** for enforcement:
   - Auto-detect similar issues

### What to highlight
- Incident → Lesson → Skill → Rule pipeline
- Building organizational memory from mistakes
- Agents learn from past incidents

---

## Scenario 6: Knowledge Browser

**Goal**: Browse and search project knowledge.

### Steps

1. **Open Knowledge Browser** (`⌘2`)
2. **Browse by type** - filter by:
   - Business Logic
   - API Endpoints
   - Design Patterns
   - Database Schemas
   - Module docs
3. **Search** - full-text search across all documents
4. **View document** - markdown rendering with metadata
5. **Filter by module** - see knowledge scoped to specific module

### What to highlight
- Unified knowledge from multiple sources
- Type and module filtering
- Searchable project documentation

---

## Scenario 7: Impact Analysis Before Changes

**Goal**: Analyze risks before implementing a major change.

### Steps

1. **Create a high-impact task**:
   ```bash
   curl -X POST http://localhost:19432/api/tasks \
     -H "Content-Type: application/json" \
     -d '{"title": "Refactor authentication to use OAuth2", "projectId": "demo", "priority": "high", "taskType": "refactor"}'
   ```
2. **Run impact analysis**:
   ```bash
   curl -X POST http://localhost:19432/api/impact/analyze \
     -H "Content-Type: application/json" \
     -d '{"taskId": "<task-id>", "projectPath": "/path/to/project"}'
   ```
3. **View results** in Impact Analysis view:
   - **Scope** - affected modules, files, dependencies
   - **Risks** - severity-rated risks with mitigation
   - **Validations** - checklist of tests and manual checks
   - **Gate status** - blocked/warning/clear
4. **Resolve blockers** - address risks, run validations
5. **Approve gate** - clear to proceed with implementation

### What to highlight
- Automated risk assessment
- Gate system prevents risky changes
- Validation checklist for quality assurance

---

## Scenario 8: Agent Governance (CLI Demo)

**Goal**: Show how governance ensures consistent agent quality.

### Steps

1. **Initialize governance** in a new project:
   ```bash
   sidstack init --governance
   ```
2. **Show governance structure**:
   ```bash
   sidstack governance show
   ```
3. **Check compliance**:
   ```bash
   sidstack governance check --json
   ```
4. **Spawn a governed agent** in Claude Code:
   ```
   /sidstack:agent worker Implement user registration with email verification
   ```
5. **Observe agent behavior**:
   - Agent reads principles before starting
   - Follows capability skill (implement/feature.md)
   - Creates task, tracks progress
   - Runs quality gates before completing
   - Uses handoff protocol if spawning sub-agents

### What to highlight
- Zero-config governance setup
- Agents follow consistent quality standards
- Quality gates enforce standards automatically

---

## Quick Demo Script (5 minutes)

For a quick overview, run these scenarios in order:

1. **Project Hub** (30s) - Open `⌘1`, show stats and quick actions
2. **Task Manager** (30s) - Open `⌘2`, show Kanban view, create a task
3. **Session Launch** (30s) - Launch a Claude session from task
4. **Ticket Queue** (30s) - Open `⌘4`, show ticket → task conversion
5. **Knowledge Browser** (30s) - Open `⌘3`, search and browse docs
6. **Training Room** (30s) - Open `⌘5`, show incident/lesson pipeline
7. **CLI Governance** (60s) - Run `sidstack governance show` + spawn agent
8. **Impact Analysis** (60s) - Show risk analysis for a refactor task
