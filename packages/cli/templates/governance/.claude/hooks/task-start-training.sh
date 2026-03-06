#!/bin/bash
# =============================================================================
# SidStack Task Start Training Context Hook
# Runs: After task_update (when status changes to in_progress)
# Purpose: Auto-inject relevant training lessons, rules, and skills
# =============================================================================

# Configuration
API_BASE="http://localhost:19432"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
# Determine projectId: prefer .sidstack/config.json, fallback to dirname
CONFIG_FILE="$PROJECT_DIR/.sidstack/config.json"
if [ -f "$CONFIG_FILE" ] && command -v jq &>/dev/null; then
    PROJECT_ID=$(jq -r '.projectId // ""' "$CONFIG_FILE" 2>/dev/null)
fi
PROJECT_ID="${PROJECT_ID:-$(basename "$PROJECT_DIR")}"
API_TIMEOUT=3

# Read hook input from stdin
INPUT=$(cat 2>/dev/null || echo "")

# Check if this is a task starting (status → in_progress)
IS_START=false
if command -v jq &>/dev/null && [ -n "$INPUT" ]; then
    STATUS=$(echo "$INPUT" | jq -r '.tool_input.status // ""' 2>/dev/null || echo "")
    TASK_ID=$(echo "$INPUT" | jq -r '.tool_input.taskId // ""' 2>/dev/null || echo "")
    if [ "$STATUS" = "in_progress" ]; then
        IS_START=true
    fi
fi

if [ "$IS_START" = false ]; then
    exit 0
fi

# Query training context for applicable rules and lessons
if ! command -v curl &>/dev/null || ! command -v jq &>/dev/null; then
    exit 0
fi

TRAINING_RESPONSE=$(curl -s --max-time $API_TIMEOUT \
    "${API_BASE}/api/training/context/${PROJECT_ID}?taskId=${TASK_ID}" 2>/dev/null || echo "")

if [ -z "$TRAINING_RESPONSE" ]; then
    exit 0
fi

# Extract rule and lesson counts
RULE_COUNT=$(echo "$TRAINING_RESPONSE" | jq -r '.rules | length // 0' 2>/dev/null || echo "0")
LESSON_COUNT=$(echo "$TRAINING_RESPONSE" | jq -r '.lessons | length // 0' 2>/dev/null || echo "0")
SKILL_COUNT=$(echo "$TRAINING_RESPONSE" | jq -r '.skills | length // 0' 2>/dev/null || echo "0")

# Build context message
CONTEXT=""

if [ "$RULE_COUNT" -gt 0 ] || [ "$LESSON_COUNT" -gt 0 ] || [ "$SKILL_COUNT" -gt 0 ]; then
    CONTEXT="[Training Context] "

    if [ "$RULE_COUNT" -gt 0 ]; then
        # Get first 3 rule titles
        RULE_TITLES=$(echo "$TRAINING_RESPONSE" | jq -r '.rules[:3][] | "- " + (.title // "untitled")' 2>/dev/null | tr '\n' '; ' | sed 's/; $//')
        CONTEXT="${CONTEXT}Rules(${RULE_COUNT}): ${RULE_TITLES}. "
    fi

    if [ "$LESSON_COUNT" -gt 0 ]; then
        LESSON_TITLES=$(echo "$TRAINING_RESPONSE" | jq -r '.lessons[:3][] | "- " + (.title // "untitled")' 2>/dev/null | tr '\n' '; ' | sed 's/; $//')
        CONTEXT="${CONTEXT}Lessons(${LESSON_COUNT}): ${LESSON_TITLES}. "
    fi

    if [ "$SKILL_COUNT" -gt 0 ]; then
        CONTEXT="${CONTEXT}Skills(${SKILL_COUNT}) available. "
    fi

    CONTEXT="${CONTEXT}Use training_context_get for full details."
fi

# Output
if [ -n "$CONTEXT" ]; then
    echo "$CONTEXT"
fi

exit 0
