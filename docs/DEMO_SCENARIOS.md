# SidStack Demo Scenarios

Step-by-step scenarios showcasing SidStack's key features.

---

## Scenario 1: Task Management Flow

**Goal**: Create a task, track progress, and complete it.

### Steps

1. **Open Task Manager** (`Cmd+2`)
2. **Create task** via API or MCP:
   ```bash
   curl -X POST http://localhost:19432/api/tasks \
     -H "Content-Type: application/json" \
     -d '{"title": "Add user avatar upload", "projectId": "demo", "priority": "high", "taskType": "feature"}'
   ```
3. **View in Kanban** - task appears in "Todo" column
4. **Switch views** - toggle between Kanban, List, and Timeline views
5. **Track progress** - update status via MCP or API
6. **Complete task** - move to "Done" column or update via API

### What to highlight
- Three view modes (Kanban, List, Timeline)
- Task governance and quality gates
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
2. **Open Ticket Queue** (`Cmd+4`)
3. **Review ticket** - click to see details, description, external ID
4. **Change status** to "reviewing" then "approved"
5. **Convert to task** - click "Convert to Task" button
6. **Verify** - task appears in Task Manager (`Cmd+2`)

### What to highlight
- External ticket intake via API
- Review workflow (new → reviewing → approved)
- One-click conversion to task
- Auto-complete ticket when linked task completes

---

## Scenario 3: Project Hub Navigation

**Goal**: Navigate project features from central dashboard.

### Steps

1. **Open Project Hub** (`Cmd+1`)
2. **View project stats** - module count, active tasks, knowledge documents
3. **Click quick actions** - jump to any feature:
   - Task Manager - create and track tasks
   - Knowledge Browser - browse project documentation
   - Ticket Queue - manage external tickets
   - Training Room - view lessons learned
   - Agent Desk - manage agent workspaces
5. **Switch features** - use sidebar navigation or keyboard shortcuts

### What to highlight
- Central dashboard with unified view
- Quick access to all features

---

## Scenario 4: Agent Desk (Workspace Isolation)

**Goal**: Set up isolated agent workspaces using git worktrees.

### Steps

1. **Create workspace** via CLI:
   ```bash
   npx @sidstack/cli new my-project
   ```
2. **Add agent desks**:
   ```bash
   npx @sidstack/cli desk add worker-1 -b agent/worker-1 --role worker
   npx @sidstack/cli desk add reviewer-1 -b agent/reviewer-1 --role reviewer
   ```
3. **Open Agent Desk view** in the desktop app
4. **Acquire a desk** - MCP tool assigns a desk to an agent
5. **View desk status** - see which agent is working on which desk
6. **Release desk** when work is complete

### What to highlight
- Isolated workspaces per agent via git worktrees
- Shared `.sidstack/` knowledge across all desks
- MCP tools for desk management (acquire/release)

---

## Scenario 5: Training Room (Lessons Learned)

**Goal**: Record an incident, create a lesson, and define a skill.

### Steps

1. **Open Training Room** (`Cmd+5`)
2. **Record an incident** via MCP:
   ```
   Create an incident report: SQL injection found in search endpoint
   ```
3. **View incidents** in Training Room UI
4. **Create lesson** from incident:
   - What went wrong
   - Root cause
   - Prevention steps
5. **Create skill** from lesson:
   - Reusable pattern for future agents
6. **Create rule** for enforcement:
   - Auto-detect similar issues

### What to highlight
- Incident → Lesson → Skill → Rule pipeline
- Building organizational memory from mistakes
- Agents learn from past incidents

---

## Scenario 6: Knowledge Browser

**Goal**: Browse and search project knowledge.

### Steps

1. **Open Knowledge Browser** (`Cmd+3`)
2. **Browse by category** - 9 categories:
   - Context, Architecture, Decisions, Standards
   - Data, API, Operations, Projects, Incidents
3. **Search** - full-text search across all documents
4. **View document** - markdown rendering with metadata
5. **Filter by module** - see knowledge scoped to specific module

### What to highlight
- 9-category knowledge organization
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
2. **Run impact analysis** via MCP:
   ```
   Analyze the impact of refactoring to OAuth2
   ```
3. **View results**:
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
   npx @sidstack/cli init --scan
   ```
2. **Show governance structure**:
   ```bash
   npx @sidstack/cli governance show
   ```
3. **Check compliance**:
   ```bash
   npx @sidstack/cli governance check --json
   ```
4. **Use in Claude Code**:
   ```
   /sidstack
   ```
5. **Observe agent behavior**:
   - Agent reads principles before starting
   - Follows capability skill (sidstack-dev workflow)
   - Creates task, tracks progress
   - Runs quality gates before completing

### What to highlight
- Zero-config governance setup
- Agents follow consistent quality standards
- Quality gates enforce standards automatically

---

## Quick Demo Script (5 minutes)

For a quick overview, run these scenarios in order:

1. **Project Hub** (30s) - Open `Cmd+1`, show stats and quick actions
2. **Task Manager** (30s) - Open `Cmd+2`, show Kanban view, create a task
3. **Knowledge Browser** (30s) - Open `Cmd+3`, search and browse docs
4. **Ticket Queue** (30s) - Open `Cmd+4`, show ticket → task conversion
5. **Training Room** (30s) - Open `Cmd+5`, show incident/lesson pipeline
6. **Agent Desk** (30s) - Show desk list, acquire/release flow
7. **CLI Governance** (60s) - Run `sidstack governance show` + spawn agent
8. **Impact Analysis** (60s) - Show risk analysis for a refactor task
