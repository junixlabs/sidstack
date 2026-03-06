#!/bin/bash
# =============================================================================
# SidStack Task Create Context Hook
# Runs: After mcp__sidstack__task_create
# Purpose: Remind agent to search memory + knowledge and link entities
# =============================================================================

# Read hook input from stdin
INPUT=$(cat 2>/dev/null || echo "")

if ! command -v jq &>/dev/null || [ -z "$INPUT" ]; then
    exit 0
fi

# Extract task info from tool result
TASK_ID=$(echo "$INPUT" | jq -r '.tool_result.content[0].text // ""' 2>/dev/null | jq -r '.task.id // ""' 2>/dev/null || echo "")
TASK_TITLE=$(echo "$INPUT" | jq -r '.tool_result.content[0].text // ""' 2>/dev/null | jq -r '.task.title // ""' 2>/dev/null || echo "")

if [ -z "$TASK_ID" ] || [ "$TASK_ID" = "null" ]; then
    exit 0
fi

# Inject workflow reminder
cat << EOF
[Task Created: ${TASK_ID}] Before implementation, you MUST:
1. mcp__sidstack__knowledge_search({ projectPath: ".", query: "${TASK_TITLE}" }) — find relevant docs
2. mcp__sidstack__memory_search({ query: "${TASK_TITLE}", projectId: "FOLDER_NAME" }) — find past learnings
3. For each relevant doc found: mcp__sidstack__entity_link({ sourceType: "task", sourceId: "${TASK_ID}", targetType: "knowledge", targetId: "[docId]", relationship: "requires_context" })
EOF

exit 0
