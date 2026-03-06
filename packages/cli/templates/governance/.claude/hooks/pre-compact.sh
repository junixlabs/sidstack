#!/bin/bash
# =============================================================================
# SidStack Pre-Compact Hook
# Runs: Before context compaction
# Purpose: Save active task state that needs to persist across compaction
# =============================================================================

# Log file for debugging
LOG_FILE="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/hooks.log"
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] PRE-COMPACT: $1" >> "$LOG_FILE"
}

log "Hook triggered"

# Read stdin (hook input) - consume it
INPUT=$(cat 2>/dev/null || echo "")
log "Input received: ${INPUT:0:200}"

# Project paths
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
CONTEXT_FILE="$PROJECT_DIR/.claude/context-state.json"

# API settings - detect project ID from directory name
API_BASE="http://localhost:19432"
PROJECT_ID=$(basename "$PROJECT_DIR")
API_TIMEOUT=3

# Get timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date +"%Y-%m-%dT%H:%M:%SZ")

# Create context state directory (ignore errors)
mkdir -p "$(dirname "$CONTEXT_FILE")" 2>/dev/null || true

# =============================================================================
# Query API for in_progress tasks
# =============================================================================
PENDING_TASKS_JSON="[]"
ACTIVE_TASK_CONTEXT=""

if command -v curl &>/dev/null && command -v jq &>/dev/null; then
    log "Querying API for in_progress tasks (project: $PROJECT_ID)..."

    # Query tasks with status=in_progress
    API_RESPONSE=$(curl -s --max-time $API_TIMEOUT \
        "${API_BASE}/api/tasks?projectId=${PROJECT_ID}&status=in_progress" 2>/dev/null || echo "")

    if [ -n "$API_RESPONSE" ]; then
        # Check if response is valid JSON with tasks
        TASK_COUNT=$(echo "$API_RESPONSE" | jq -r '.tasks | length' 2>/dev/null || echo "0")
        log "Found $TASK_COUNT in_progress tasks"

        if [ "$TASK_COUNT" -gt 0 ]; then
            # Extract task IDs and titles
            PENDING_TASKS_JSON=$(echo "$API_RESPONSE" | jq '[.tasks[] | {id: .id, title: .title, progress: .progress}]' 2>/dev/null || echo "[]")

            # Build context string for the most recent task
            ACTIVE_TASK=$(echo "$API_RESPONSE" | jq -r '.tasks[0]' 2>/dev/null)
            if [ -n "$ACTIVE_TASK" ] && [ "$ACTIVE_TASK" != "null" ]; then
                TASK_ID=$(echo "$ACTIVE_TASK" | jq -r '.id' 2>/dev/null)
                TASK_TITLE=$(echo "$ACTIVE_TASK" | jq -r '.title' 2>/dev/null)
                TASK_PROGRESS=$(echo "$ACTIVE_TASK" | jq -r '.progress // 0' 2>/dev/null)
                ACTIVE_TASK_CONTEXT="ACTIVE TASK: ${TASK_ID} - ${TASK_TITLE} (${TASK_PROGRESS}%)"
                log "Active task: $ACTIVE_TASK_CONTEXT"
            fi
        fi
    else
        log "API not reachable or returned empty response"
    fi
else
    log "curl or jq not available, skipping API query"
fi

# =============================================================================
# Save state to context file
# =============================================================================
cat > "$CONTEXT_FILE" 2>/dev/null << EOF
{
  "lastCompact": "$TIMESTAMP",
  "lastContext": "Session compacted. Continue with active task if any.",
  "activeTaskContext": "$ACTIVE_TASK_CONTEXT",
  "pendingTasks": $PENDING_TASKS_JSON
}
EOF

log "Context saved to $CONTEXT_FILE"

# Always output valid JSON and exit 0
OUTPUT='{"continue":true}'
log "Output: $OUTPUT"
echo "$OUTPUT"

exit 0
