#!/bin/bash
# =============================================================================
# SidStack Task Complete Learning Hook
# Runs: After mcp__sidstack__task_update (when status=completed)
# Purpose: Suggest creating a lesson if task had error patterns
# =============================================================================

# Configuration
API_BASE="http://localhost:19432"
API_TIMEOUT=3

# Read hook input from stdin (JSON: {tool_name, tool_input, tool_result})
INPUT=$(cat 2>/dev/null || echo "")

if ! command -v jq &>/dev/null || [ -z "$INPUT" ]; then
    exit 0
fi

# Extract task info from stdin
STATUS=$(echo "$INPUT" | jq -r '.tool_input.status // ""' 2>/dev/null || echo "")
TASK_ID=$(echo "$INPUT" | jq -r '.tool_input.taskId // ""' 2>/dev/null || echo "")

# Only trigger on task completion
if [ "$STATUS" != "completed" ] || [ -z "$TASK_ID" ]; then
    exit 0
fi

# Query task details from API
TASK_INFO=$(curl -s --max-time $API_TIMEOUT \
    "${API_BASE}/api/tasks/${TASK_ID}" 2>/dev/null || echo "")

if [ -z "$TASK_INFO" ]; then
    exit 0
fi

# Check for error/debugging patterns in task notes
NOTES=$(echo "$TASK_INFO" | jq -r '.notes // ""' 2>/dev/null || echo "")
HAS_ERROR_PATTERN=false

if echo "$NOTES" | grep -qiE 'error|fail|bug|fix|retry|debug|issue|problem|workaround' 2>/dev/null; then
    HAS_ERROR_PATTERN=true
fi

# Suggest lesson if patterns found
if [ "$HAS_ERROR_PATTERN" = true ]; then
    TASK_TITLE=$(echo "$TASK_INFO" | jq -r '.title // "unknown"' 2>/dev/null || echo "unknown")
    echo "Task ${TASK_ID} (${TASK_TITLE}) completed with error/debug patterns in notes. Consider creating a lesson: incident_create then lesson_create."
fi

exit 0
