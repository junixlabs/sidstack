#!/bin/bash
# =============================================================================
# SidStack Smart Session Bootstrap
# Runs on: startup, resume, compact
# Purpose: Load rich context — tasks, branch correlation, relevant knowledge
# Output: plain text stdout (auto-added as context by Claude Code)
# Performance: API calls run in PARALLEL for faster startup
# =============================================================================

# Read all hook input from stdin
INPUT=$(cat 2>/dev/null || echo "")

# Parse source from input
SESSION_SOURCE="unknown"
if command -v jq &>/dev/null && [ -n "$INPUT" ]; then
    SESSION_SOURCE=$(echo "$INPUT" | jq -r '.source // "unknown"' 2>/dev/null || echo "unknown")
fi

# Project paths
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
CONTEXT_FILE="$PROJECT_DIR/.claude/context-state.json"
SESSION_FILE="$PROJECT_DIR/.claude/session-state.json"

# API settings
API_BASE="http://localhost:19432"
PROJECT_ID=$(basename "$PROJECT_DIR")
API_TIMEOUT=3

# =============================================================================
# Check API server health
# =============================================================================
API_HEALTHY=true
if command -v curl &>/dev/null; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 1 --max-time 2 "${API_BASE}/api/projects" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "000" ]; then
        API_HEALTHY=false
    fi
fi

CONTEXT=""

if [ "$API_HEALTHY" = false ]; then
    CONTEXT="[WARNING] SidStack API server not running at ${API_BASE}. Start with: cd packages/api-server && pnpm build && node dist/index.js &"
fi

# =============================================================================
# Git Branch -> Task Correlation
# =============================================================================
BRANCH_CONTEXT=""
CURRENT_BRANCH=""
if command -v git &>/dev/null; then
    CURRENT_BRANCH=$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
    if [ -n "$CURRENT_BRANCH" ] && [ "$CURRENT_BRANCH" != "HEAD" ]; then
        BRANCH_CONTEXT="Branch: ${CURRENT_BRANCH}"

        # Check for uncommitted changes
        CHANGED_COUNT=$(git -C "$PROJECT_DIR" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
        if [ "$CHANGED_COUNT" -gt 0 ]; then
            BRANCH_CONTEXT="${BRANCH_CONTEXT} (${CHANGED_COUNT} uncommitted changes)"
        fi
    fi
fi

# =============================================================================
# Detect changed modules (for knowledge suggestions)
# =============================================================================
CHANGED_MODULES=""
if command -v git &>/dev/null && [ -n "$CURRENT_BRANCH" ]; then
    # Get recently changed directories (top-level modules)
    CHANGED_DIRS=$(git -C "$PROJECT_DIR" diff --name-only HEAD~3 HEAD 2>/dev/null | \
        sed 's|/.*||' | sort -u | head -5 2>/dev/null || echo "")

    if [ -z "$CHANGED_DIRS" ]; then
        # Fallback: uncommitted changes
        CHANGED_DIRS=$(git -C "$PROJECT_DIR" status --porcelain 2>/dev/null | \
            awk '{print $2}' | sed 's|/.*||' | sort -u | head -5 2>/dev/null || echo "")
    fi

    if [ -n "$CHANGED_DIRS" ]; then
        CHANGED_MODULES=$(echo "$CHANGED_DIRS" | tr '\n' ', ' | sed 's/,$//')
    fi
fi

# =============================================================================
# Query API in PARALLEL
# =============================================================================
if command -v curl &>/dev/null && command -v jq &>/dev/null; then
    TMPDIR_HOOKS="${TMPDIR:-/tmp}/sidstack-hooks-$$"
    mkdir -p "$TMPDIR_HOOKS" 2>/dev/null

    # Launch API calls in parallel
    curl -s --connect-timeout 2 --max-time "$API_TIMEOUT" \
        "${API_BASE}/api/tasks?projectId=${PROJECT_ID}&status=in_progress" \
        > "$TMPDIR_HOOKS/active.json" 2>/dev/null &
    PID_ACTIVE=$!

    curl -s --connect-timeout 2 --max-time "$API_TIMEOUT" \
        "${API_BASE}/api/tasks?projectId=${PROJECT_ID}&status=pending&limit=100" \
        > "$TMPDIR_HOOKS/pending.json" 2>/dev/null &
    PID_PENDING=$!

    curl -s --connect-timeout 2 --max-time "$API_TIMEOUT" \
        "${API_BASE}/api/training/rules?projectId=${PROJECT_ID}&status=active" \
        > "$TMPDIR_HOOKS/rules.json" 2>/dev/null &
    PID_RULES=$!

    # If branch contains task-like pattern, try to find matching task
    BRANCH_TASK_ID=""
    if echo "$CURRENT_BRANCH" | grep -qE 'task-[0-9]' 2>/dev/null; then
        BRANCH_TASK_ID=$(echo "$CURRENT_BRANCH" | grep -oE 'task-[0-9]+-[a-z0-9]+' 2>/dev/null || echo "")
    fi

    # Wait for all to complete
    wait $PID_ACTIVE $PID_PENDING $PID_RULES 2>/dev/null

    # =========================================================================
    # Process active tasks
    # =========================================================================
    API_RESPONSE=$(cat "$TMPDIR_HOOKS/active.json" 2>/dev/null || echo "")
    ACTIVE_TASK_ID=""
    if [ -n "$API_RESPONSE" ]; then
        TASK_COUNT=$(echo "$API_RESPONSE" | jq -r '.tasks | length' 2>/dev/null || echo "0")
        if [ "$TASK_COUNT" -gt 0 ]; then
            ACTIVE_TASK_ID=$(echo "$API_RESPONSE" | jq -r '.tasks[0].id' 2>/dev/null)
            TASK_TITLE=$(echo "$API_RESPONSE" | jq -r '.tasks[0].title' 2>/dev/null)
            TASK_PROGRESS=$(echo "$API_RESPONSE" | jq -r '.tasks[0].progress // 0' 2>/dev/null)
            TASK_TYPE=$(echo "$API_RESPONSE" | jq -r '.tasks[0].taskType // ""' 2>/dev/null)
            CONTEXT="ACTIVE TASK: ${ACTIVE_TASK_ID} — ${TASK_TITLE} (${TASK_PROGRESS}%, type: ${TASK_TYPE})"

            # Correlate branch with task
            TASK_BRANCH=$(echo "$API_RESPONSE" | jq -r '.tasks[0].branch // ""' 2>/dev/null)
            if [ -n "$TASK_BRANCH" ] && [ "$TASK_BRANCH" != "null" ] && [ "$CURRENT_BRANCH" = "$TASK_BRANCH" ]; then
                CONTEXT="${CONTEXT} [branch matched]"
            elif [ -n "$BRANCH_TASK_ID" ] && [ "$BRANCH_TASK_ID" = "$ACTIVE_TASK_ID" ]; then
                CONTEXT="${CONTEXT} [branch matched]"
            fi
        fi
    fi

    # =========================================================================
    # Process pending tasks
    # =========================================================================
    PENDING_RESPONSE=$(cat "$TMPDIR_HOOKS/pending.json" 2>/dev/null || echo "")
    PENDING_COUNT=0
    if [ -n "$PENDING_RESPONSE" ]; then
        PENDING_COUNT=$(echo "$PENDING_RESPONSE" | jq -r '.tasks | length' 2>/dev/null || echo "0")
        if [ "$PENDING_COUNT" -gt 0 ]; then
            if [ -n "$CONTEXT" ]; then
                CONTEXT="$CONTEXT | Pending: ${PENDING_COUNT}"
            else
                CONTEXT="Pending tasks: ${PENDING_COUNT}"
            fi

            # Show top 3 pending tasks with priorities
            TOP_PENDING=$(echo "$PENDING_RESPONSE" | jq -r '[.tasks[:3][] | "\(.priority):\(.title[0:50])"] | join("; ")' 2>/dev/null || echo "")
            if [ -n "$TOP_PENDING" ] && [ "$TOP_PENDING" != "null" ]; then
                CONTEXT="${CONTEXT} [${TOP_PENDING}]"
            fi
        fi
    fi

    # =========================================================================
    # Process active rules
    # =========================================================================
    RULES_RESPONSE=$(cat "$TMPDIR_HOOKS/rules.json" 2>/dev/null || echo "")
    if [ -n "$RULES_RESPONSE" ]; then
        RULES_COUNT=$(echo "$RULES_RESPONSE" | jq -r 'if type == "array" then length else (.rules // []) | length end' 2>/dev/null || echo "0")
        if [ "$RULES_COUNT" -gt 0 ]; then
            [ -n "$CONTEXT" ] && CONTEXT="$CONTEXT | Active rules: ${RULES_COUNT}"
        fi
    fi

    # Cleanup temp files
    rm -rf "$TMPDIR_HOOKS" 2>/dev/null
fi

# =============================================================================
# Add branch context
# =============================================================================
if [ -n "$BRANCH_CONTEXT" ]; then
    if [ -n "$CONTEXT" ]; then
        CONTEXT="${CONTEXT} | ${BRANCH_CONTEXT}"
    else
        CONTEXT="${BRANCH_CONTEXT}"
    fi
fi

# =============================================================================
# Add changed modules hint
# =============================================================================
if [ -n "$CHANGED_MODULES" ]; then
    CONTEXT="${CONTEXT} | Recent activity: ${CHANGED_MODULES}"
fi

# =============================================================================
# Session continuity: restore saved state on resume
# =============================================================================
if [ "$SESSION_SOURCE" = "resume" ] || [ "$SESSION_SOURCE" = "compact" ]; then
    if [ -f "$SESSION_FILE" ] && command -v jq &>/dev/null; then
        SAVED_DECISIONS=$(jq -r '.decisions // "" | if type == "array" then join("; ") else . end' "$SESSION_FILE" 2>/dev/null || echo "")
        SAVED_BLOCKERS=$(jq -r '.blockers // "" | if type == "array" then join("; ") else . end' "$SESSION_FILE" 2>/dev/null || echo "")
        SAVED_AT=$(jq -r '.savedAt // ""' "$SESSION_FILE" 2>/dev/null || echo "")

        RESTORE_MSG=""
        if [ -n "$SAVED_DECISIONS" ] && [ "$SAVED_DECISIONS" != "null" ] && [ "$SAVED_DECISIONS" != "" ]; then
            RESTORE_MSG="[Session restored from ${SAVED_AT}] Decisions: ${SAVED_DECISIONS}"
        fi
        if [ -n "$SAVED_BLOCKERS" ] && [ "$SAVED_BLOCKERS" != "null" ] && [ "$SAVED_BLOCKERS" != "" ]; then
            RESTORE_MSG="${RESTORE_MSG:+$RESTORE_MSG | }Blockers: ${SAVED_BLOCKERS}"
        fi
        if [ -n "$RESTORE_MSG" ]; then
            CONTEXT="${CONTEXT:+$CONTEXT | }${RESTORE_MSG}"
        fi
    fi
fi

# =============================================================================
# Session-specific hints
# =============================================================================
case "$SESSION_SOURCE" in
    "compact")
        [ -n "$CONTEXT" ] && CONTEXT="$CONTEXT [Compacted]"
        ;;
    "resume")
        [ -n "$CONTEXT" ] && CONTEXT="$CONTEXT [Resumed]"
        ;;
    "startup")
        HINT="SidStack active. Use mcp__sidstack__task_list to check tasks, mcp__sidstack__task_create for new work."
        # Suggest next action based on state
        if [ -n "$ACTIVE_TASK_ID" ]; then
            HINT="Resume active task with mcp__sidstack__task_start_with_context({ taskId: \"${ACTIVE_TASK_ID}\" })"
        elif [ "$PENDING_COUNT" -gt 0 ]; then
            HINT="SidStack active. ${PENDING_COUNT} pending tasks. Use mcp__sidstack__task_list to pick next task."
        fi
        CONTEXT="${CONTEXT:+$CONTEXT | }${HINT}"
        ;;
esac

# Output
if [ -n "$CONTEXT" ]; then
    echo "$CONTEXT"
fi

exit 0
