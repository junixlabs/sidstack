#!/bin/bash
# =============================================================================
# SidStack Prompt Context Hook
# Runs: Before each user prompt is processed
# Purpose: Inject active task context (NO auto-create - let skills/agent handle)
# Output: plain text stdout (auto-added as context by Claude Code)
# =============================================================================

# Get script directory and source workspace detection
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/scripts/detect-workspace.sh" ]; then
    source "$SCRIPT_DIR/scripts/detect-workspace.sh"
fi

# API settings
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
API_BASE="http://localhost:19432"
API_TIMEOUT=2

# Use workspace detection if available, fallback to basename
if type init_workspace_context &>/dev/null 2>&1; then
    init_workspace_context "$PROJECT_DIR"
    PROJECT_ID="${PROJECT_ID:-$(basename "$PROJECT_DIR")}"
else
    PROJECT_ID=$(basename "$PROJECT_DIR")
fi

# Cache settings
CACHE_FILE="$PROJECT_DIR/.claude/task-cache.json"
CACHE_TTL=60

# Read hook input (consume stdin)
INPUT=$(cat 2>/dev/null || echo "")

# =============================================================================
# Check cache for active task
# =============================================================================
ACTIVE_TASK_CONTEXT=""
ACTIVE_TASK_ID=""
CACHE_VALID=false

if [ -f "$CACHE_FILE" ] && command -v jq &>/dev/null; then
    CACHE_TIME=$(jq -r '.timestamp // 0' "$CACHE_FILE" 2>/dev/null || echo "0")
    CURRENT_TIME=$(date +%s)
    CACHE_AGE=$((CURRENT_TIME - CACHE_TIME))

    if [ "$CACHE_AGE" -lt "$CACHE_TTL" ]; then
        ACTIVE_TASK_CONTEXT=$(jq -r '.activeTaskContext // ""' "$CACHE_FILE" 2>/dev/null || echo "")
        ACTIVE_TASK_ID=$(jq -r '.activeTaskId // ""' "$CACHE_FILE" 2>/dev/null || echo "")
        if [ -n "$ACTIVE_TASK_CONTEXT" ] && [ "$ACTIVE_TASK_CONTEXT" != "null" ]; then
            CACHE_VALID=true
        fi
    fi
fi

# =============================================================================
# Query API if cache is stale
# =============================================================================
if [ "$CACHE_VALID" = false ] && command -v curl &>/dev/null && command -v jq &>/dev/null; then
    API_RESPONSE=$(curl -s --connect-timeout 2 --max-time "$API_TIMEOUT" \
        "${API_BASE}/api/tasks?projectId=${PROJECT_ID}&status=in_progress&limit=1" 2>/dev/null || echo "")

    if [ -n "$API_RESPONSE" ]; then
        TASK_COUNT=$(echo "$API_RESPONSE" | jq -r '.tasks | length' 2>/dev/null || echo "0")

        if [ "$TASK_COUNT" -gt 0 ]; then
            ACTIVE_TASK_ID=$(echo "$API_RESPONSE" | jq -r '.tasks[0].id' 2>/dev/null)
            TASK_TITLE=$(echo "$API_RESPONSE" | jq -r '.tasks[0].title' 2>/dev/null)
            TASK_PROGRESS=$(echo "$API_RESPONSE" | jq -r '.tasks[0].progress // 0' 2>/dev/null)
            ACTIVE_TASK_CONTEXT="ACTIVE TASK: ${ACTIVE_TASK_ID} - ${TASK_TITLE} (${TASK_PROGRESS}%)"
        fi

        # Update cache
        mkdir -p "$(dirname "$CACHE_FILE")" 2>/dev/null
        CURRENT_TIME=$(date +%s)
        CONTEXT_ESCAPED=$(printf '%s' "${ACTIVE_TASK_CONTEXT:-}" | sed 's/"/\\"/g')
        cat > "$CACHE_FILE" 2>/dev/null << EOF
{
  "timestamp": $CURRENT_TIME,
  "activeTaskContext": "$CONTEXT_ESCAPED",
  "activeTaskId": "${ACTIVE_TASK_ID:-}"
}
EOF
    fi
fi

# =============================================================================
# Output plain text context (no auto-create, just inform)
# =============================================================================
if [ -n "$ACTIVE_TASK_ID" ] && [ "$ACTIVE_TASK_ID" != "null" ]; then
    echo "[ACTIVE TASK] ${ACTIVE_TASK_ID} — When you finish the current request, you MUST call mcp__sidstack__task_complete({ taskId: \"${ACTIVE_TASK_ID}\" }) before responding to the user."
fi

exit 0
